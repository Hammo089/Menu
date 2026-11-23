import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';
import { spreadsheet } from './reports';
import { fullName, hm, addDays, type Employee } from './core';
import { plannedMinutes, planRows, type WeeklyPlan } from './planning';
export function planningExcel(employee: Employee, plan: WeeklyPlan) {
  return spreadsheet(
    [
      ['BLANCO — PLANNING PRÉVISIONNEL', fullName(employee)],
      ['Du', plan.week_start, 'Au', addDays(plan.week_start, 6), 'Version', plan.version],
      [
        'Date',
        'Jour',
        'Statut',
        'Arrivée',
        'Début pause',
        'Fin pause',
        'Départ',
        'Durée prévue',
        'Heures décimales',
        'Remarque',
      ],
      ...planRows(plan),
      [],
      [
        'Total des postes commencés cette semaine',
        hm(plannedMinutes(plan.days)),
        plannedMinutes(plan.days) / 60,
      ],
      ['Consigne de la direction', plan.note],
      ['Ce planning ne constitue pas un relevé d’heures travaillées ou validées.'],
    ],
    'Planning',
  );
}
export async function planningPdf(employee: Employee, plan: WeeklyPlan) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [fontData, logoData] = await Promise.all([
    fetch('/fonts/DejaVuSans.ttf').then((r) => {
      if (!r.ok) throw new Error('Police indisponible.');
      return r.arrayBuffer();
    }),
    fetch('/brand/blanco-logo.jpg').then((r) => r.arrayBuffer()),
  ]);
  const font = await pdf.embedFont(fontData, { subset: true }),
    logo = await pdf.embedJpg(logoData);
  let page = pdf.addPage([595, 842]),
    y = 785;
  function line(s: string, size = 10) {
    if (y < 60) {
      page = pdf.addPage([595, 842]);
      y = 790;
    }
    page.drawText(s.replace(/[\r\n]+/g, ' '), {
      x: 38,
      y,
      size,
      font,
      color: rgb(0.14, 0.26, 0.18),
    });
    y -= size + 10;
  }
  function wrap(s: string) {
    let row = '';
    for (const word of s.split(/\s+/)) {
      if (font.widthOfTextAtSize(row + ' ' + word, 9) > 510) {
        line(row, 9);
        row = word;
      } else row += (row ? ' ' : '') + word;
    }
    if (row) line(row, 9);
  }
  page.drawImage(logo, { x: 465, y: 750, width: 90, height: 65 });
  line('BLANCO', 27);
  line('PLANNING HEBDOMADAIRE', 15);
  wrap(fullName(employee));
  line(`Du ${plan.week_start} au ${addDays(plan.week_start, 6)} · Version ${plan.version}`, 10);
  line('Programme prévisionnel établi par la direction · Europe/Paris', 8);
  y -= 12;
  for (const r of planRows(plan)) {
    if (y < 150) {
      page = pdf.addPage([595, 842]);
      y = 790;
    }
    page.drawRectangle({ x: 35, y: y - 7, width: 525, height: 25, color: rgb(0.91, 0.95, 0.88) });
    line(`${r[1]} ${r[0]} — ${r[2]}`, 11);
    if (r[3]) line(`Arrivée : ${r[3]}   ·   Départ : ${r[6]}   ·   Durée : ${r[7]}`, 10);
    if (r[4]) line(`Pause : ${r[4]} – ${r[5]}`, 9);
    if (r[9]) wrap(String(r[9]));
    y -= 8;
  }
  line(`Total prévu : ${hm(plannedMinutes(plan.days))}`, 13);
  if (plan.note) wrap('Consigne : ' + plan.note);
  wrap(
    'Total des postes commencés cette semaine. Ce planning ne valide aucune heure travaillée et ne remplace pas le relevé comptable.',
  );
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
}
