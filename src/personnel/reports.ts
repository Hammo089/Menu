import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';
import { strToU8, zipSync } from 'fflate';
import {
  dates,
  decimal,
  fullName,
  hm,
  holidays,
  kinds,
  totals,
  allocations,
  type Report,
} from './core';
export function reportRows(report: Report) {
  const { snapshot: s } = report,
    holiday = holidays(+s.month.slice(0, 4)),
    sum = totals(s.days, s.month);
  return dates(s.month).map((date) => {
    const day = s.days.find((x) => x.work_date === date),
      h = day?.approved;
    const carries = s.days.filter(
      (d) => d.work_date !== date && allocations(d).some((a) => a.date === date),
    );
    const worked = sum.byDay[date] || 0,
      carry = carries[0]?.approved;
    const carryPause = !!carry?.breakEnd && carry.breakEnd < carry.arrival;
    const breakStart =
      h?.kind === 'work'
        ? h.breakStart
        : carryPause
          ? carry!.breakStart < carry!.arrival
            ? carry!.breakStart
            : '00:00'
          : '';
    const breakEnd = h?.kind === 'work' ? h.breakEnd : carryPause ? carry!.breakEnd : '';
    const note = [
      h?.note || '',
      ...carries.map(
        (d) =>
          `Report du poste du ${d.work_date} : ${d.approved!.arrival}–${d.approved!.departure} (+1j)${d.approved!.breakStart ? ', pause ' + d.approved!.breakStart + '–' + d.approved!.breakEnd : ''}.`,
      ),
      h?.overnight
        ? 'La colonne Travail est ventilée sur la date réelle ; la plage continue le lendemain.'
        : '',
    ]
      .filter(Boolean)
      .join(' ');
    return [
      date,
      new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' }).format(
        new Date(date + 'T12:00Z'),
      ),
      holiday[date] || '',
      h
        ? kinds[h.kind] + (carries.length ? ' + report' : '')
        : carries.length
          ? 'Report de veille'
          : 'Non déclaré',
      h?.kind === 'work' ? h.arrival : carry ? '00:00' : '',
      breakStart,
      breakEnd,
      h?.kind === 'work' ? h.departure + (h.overnight ? ' (+1j)' : '') : carry?.departure || '',
      worked ? hm(worked) : '',
      worked ? worked / 60 : '',
      note,
    ];
  });
}
const clean = (s: unknown) =>
  String(s ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export async function pdf(report: Report) {
  const doc = await PDFDocument.create();
  doc.setTitle('Blanco — Relevé mensuel');
  doc.setCreationDate(new Date(report.snapshot.generatedAt));
  doc.setModificationDate(new Date(report.snapshot.generatedAt));
  doc.registerFontkit(fontkit);
  const [fontResponse, logoResponse] = await Promise.all([
    fetch('/fonts/DejaVuSans.ttf'),
    fetch('/brand/blanco-logo.jpg'),
  ]);
  if (!fontResponse.ok || !logoResponse.ok)
    throw new Error('Les ressources du relevé sont indisponibles. Réessayez avec une connexion.');
  const normal = await doc.embedFont(await fontResponse.arrayBuffer(), { subset: true }),
    bold = normal,
    logo = await doc.embedJpg(await logoResponse.arrayBuffer());
  const fontSafe = (s: unknown) => clean(s);
  let page = doc.addPage([595, 842]),
    y = 795;
  const pages = [page];
  function line(value: unknown, size = 10, isBold = false, x = 40) {
    if (y < 55) {
      page = doc.addPage([595, 842]);
      pages.push(page);
      y = 795;
      page.drawText(
        fontSafe(
          `BLANCO · ${fullName(report.snapshot.employee)} · ${report.snapshot.month} · v${report.version}`,
        ).slice(0, 110),
        { x: 40, y, size: 8, font: normal, color: rgb(0.3, 0.4, 0.3) },
      );
      y -= 27;
    }
    page.drawText(fontSafe(value), {
      x,
      y,
      size,
      font: isBold ? bold : normal,
      color: rgb(0.13, 0.24, 0.18),
    });
    y -= size + 7;
  }
  function wrap(value: unknown, max = 95) {
    const words = fontSafe(value).split(' ');
    let row = '';
    for (const w of words) {
      if ((row + ' ' + w).length > max) {
        line(row, 8);
        row = w;
      } else row += (row ? ' ' : '') + w;
    }
    if (row) line(row, 8);
  }
  page.drawImage(logo, { x: 460, y: 755, width: 90, height: 65 });
  line('BLANCO', 29, true);
  line('COFFEE & MORE · GRENOBLE', 9);
  y -= 12;
  line('RELEVÉ MENSUEL DES HEURES VALIDÉES', 15, true);
  line(
    new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(report.snapshot.month + '-01T12:00Z'),
    ),
    13,
    true,
  );
  const s = report.snapshot,
    e = s.employee,
    t = totals(s.days, s.month);
  line(fullName(e), 14, true);
  if (e.profile?.address) wrap(e.profile.address);
  if (e.profile?.phone || e.profile?.email)
    wrap([e.profile.phone, e.profile.email].filter(Boolean).join(' · '));
  wrap(
    `Contrat : ${e.profile?.contractType || 'Non renseigné'} · ${e.weekly_hours || 'Non renseigné'} h/semaine · Début : ${e.profile?.contractStart || '—'} · Fin : ${e.profile?.contractEnd || '—'}`,
  );
  line(
    `Version ${report.version} · Généré le ${new Date(s.generatedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`,
    8,
  );
  y -= 6;
  function cell(value: unknown, x: number, width: number, size = 7.5) {
    const text = fontSafe(value);
    let actual = size;
    while (actual > 5.5 && normal.widthOfTextAtSize(text, actual) > width) actual -= 0.25;
    page.drawText(text, { x, y, size: actual, font: normal, color: rgb(0.13, 0.24, 0.18) });
  }
  function tableHeader() {
    page.drawRectangle({ x: 38, y: y - 5, width: 519, height: 20, color: rgb(0.9, 0.94, 0.87) });
    [
      ['Date', 40, 38],
      ['Jour', 82, 66],
      ['Statut', 152, 87],
      ['Arrivée', 243, 47],
      ['Pause', 295, 84],
      ['Départ', 384, 60],
      ['Travail', 449, 60],
      ['Décimal', 514, 41],
    ].forEach(([v, x, w]) => cell(v, x as number, w as number, 8));
    y -= 20;
  }
  tableHeader();
  for (const [rowIndex, row] of reportRows(report).entries()) {
    if (y < 85) {
      line('', 10);
      if (y < 85) {
        y = 40;
        line('', 10);
      }
      tableHeader();
    }
    const date = String(row[0]).slice(8) + '/' + String(row[0]).slice(5, 7);
    if (rowIndex % 2 === 1)
      page.drawRectangle({ x: 38, y: y - 4, width: 519, height: 15, color: rgb(0.97, 0.98, 0.95) });
    cell(date, 40, 38);
    cell(row[1], 82, 66);
    cell(String(row[3]).replace('Absence non rémunérée', 'Abs. non rémunérée'), 152, 87);
    cell(row[4] || '—', 243, 47);
    cell(row[5] ? row[5] + '–' + row[6] : '—', 295, 84);
    cell(row[7] || '—', 384, 60);
    cell(row[8] || '—', 449, 60);
    cell(typeof row[9] === 'number' ? row[9].toFixed(2).replace('.', ',') : '—', 514, 41);
    y -= 15;
    if (row[2]) line('Jour férié : ' + row[2], 6.5);
    if (row[10]) wrap('Remarque : ' + row[10], 105);
  }
  y -= 12;
  line(`TOTAL RÉEL DU MOIS : ${hm(t.minutes)} / ${decimal(t.minutes)} h`, 13, true);
  line(`Jours travaillés : ${t.worked} · Pauses réelles du mois : ${hm(t.pauses)}`, 9);
  for (const [kind, n] of Object.entries(t.absences))
    line(`${kinds[kind as keyof typeof kinds]} : ${n} jour(s)`, 9);
  for (const [week, minutes] of Object.entries(t.weeks).sort())
    line(`Semaine du ${week} : ${hm(minutes)} (${decimal(minutes)} h)`, 8);
  if (e.weekly_hours) {
    const reference = (e.weekly_hours * 52) / 12;
    line(`Référence moyenne contractuelle : ${reference.toFixed(2).replace('.', ',')} h/mois`, 9);
    line(`Écart indicatif : ${(t.minutes / 60 - reference).toFixed(2).replace('.', ',')} h`, 9);
  }
  wrap(
    'Heures ventilées à la date réelle, y compris les passages de minuit et les changements d’heure Europe/Paris. Les semaines affichées sont complètes lorsque des heures sont enregistrées dans les mois voisins.',
  );
  wrap(
    'Seules les heures approuvées sont incluses. Un jour sans saisie reste non déclaré. Les absences ne sont pas comptées comme travail. Aucun calcul automatique de majoration ou d’heures supplémentaires ; validation par le cabinet comptable.',
  );
  pages.forEach((p, i) =>
    p.drawText(`Blanco · Réf. ${report.id.slice(0, 8)} · ${i + 1}/${pages.length}`, {
      x: 40,
      y: 25,
      size: 7,
      font: normal,
      color: rgb(0.45, 0.45, 0.45),
    }),
  );
  return new Blob([new Uint8Array(await doc.save())], { type: 'application/pdf' });
}
const xml = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
export function excel(report: Report) {
  const t = totals(report.snapshot.days, report.snapshot.month);
  const rows: unknown[][] = [
    [
      'BLANCO — ' + fullName(report.snapshot.employee),
      report.snapshot.month,
      'Version ' + report.version,
    ],
    [
      'Date',
      'Jour',
      'Jour férié',
      'Statut',
      'Arrivée',
      'Début pause',
      'Fin pause',
      'Départ',
      'Heures/minutes',
      'Heures décimales',
      'Remarque',
    ],
    ...reportRows(report),
    [],
    ['Total réel du mois', hm(t.minutes), t.minutes / 60],
    ['Pauses', hm(t.pauses)],
    ['Les écarts ne sont pas automatiquement des heures supplémentaires.'],
    ['Les heures traversant minuit sont ventilées dans les totaux au mois réel.'],
  ];
  return spreadsheet(rows);
}
export function spreadsheet(rows: unknown[][], sheetName = 'Heures validées') {
  const column = (n: number) => {
    let s = '';
    for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => (typeof v === 'number' ? `<c r="${column(j)}${i + 1}"><v>${v}</v></c>` : `<c r="${column(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`)).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const files: Record<string, string> = {
    '[Content_Types].xml':
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' +
      xml(sheetName) +
      '" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': sheet,
  };
  return new Blob(
    [
      new Uint8Array(
        zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))),
      ),
    ],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
}
