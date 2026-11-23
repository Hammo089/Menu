import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Download, Plus, Users, LogOut, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib';
import { personnel, randomKey, download } from './api';
import { Calendar, MonthPicker } from './Calendar';
import DayEditor from './DayEditor';
import Profile from './Profile';
import WeeklyPlanner from './WeeklyPlanner';
import Access from './Access';
import Absence from './Absence';
import {
  decimal,
  fullName,
  hm,
  totals,
  allocations,
  type Day,
  type Employee,
  type Report,
} from './core';
import './personnel.css';
type Audit = {
  id: string;
  work_date: string | null;
  action: string;
  actor: string;
  note: string;
  created_at: string;
};
type Document = { id: string; name: string; path: string; created_at: string };
const today = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date());
const blankEmployee = (): Employee => ({
  id: '',
  first_name: '',
  last_name: '',
  profile: {},
  weekly_hours: 0,
  active: true,
  version: 0,
});
export default function PersonnelApp() {
  const employeeMode = location.pathname.replace(/\/$/, '') === '/equipe';
  const [authEpoch, setAuthEpoch] = useState(0);
  const currentOwner = useRef('');
  const [signed, setSigned] = useState<boolean | null>(null),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [session, setSession] = useState(() => {
      const incoming = new URLSearchParams(location.hash.slice(1)).get('invitation');
      if (incoming && incoming !== sessionStorage.getItem('blanco-personnel-link')) {
        sessionStorage.removeItem('blanco-personnel-session');
        return '';
      }
      return sessionStorage.getItem('blanco-personnel-session') || '';
    }),
    [link, setLink] = useState(() => {
      const value =
        new URLSearchParams(location.hash.slice(1)).get('invitation') ||
        sessionStorage.getItem('blanco-personnel-link') ||
        '';
      if (/^[a-f0-9]{64}$/.test(value)) {
        sessionStorage.setItem('blanco-personnel-link', value);
        return value;
      }
      return '';
    }),
    [pin, setPin] = useState('');
  const [month, setMonth] = useState(today().slice(0, 7)),
    [employees, setEmployees] = useState<Employee[]>([]),
    [employee, setEmployee] = useState<Employee | null>(null),
    [selected, setSelected] = useState(''),
    [date, setDate] = useState(today()),
    [days, setDays] = useState<Day[]>([]),
    [allDays, setAllDays] = useState<Day[]>([]),
    [archived, setArchived] = useState(false),
    [newEmployee, setNewEmployee] = useState(false);
  const [tab, setTab] = useState('hours'),
    [audit, setAudit] = useState<Audit[]>([]),
    [reports, setReports] = useState<Report[]>([]),
    [documents, setDocuments] = useState<Document[]>([]),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [editorEpoch, setEditorEpoch] = useState(0);
  const scope = useRef(0),
    dashboardNumber = useRef(0),
    loadNumber = useRef(0),
    selectedRef = useRef(selected),
    dirty = useRef(false);
  selectedRef.current = selected;
  useEffect(() => {
    document.title = employeeMode ? 'Blanco — Mon espace salarié' : 'Blanco — Gestion du personnel';
    if (location.hash) history.replaceState(null, '', location.pathname);
    if (employeeMode) return;
    if (!supabase) {
      setSigned(false);
      return;
    }
    let active = true,
      authChanges = 0;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && authChanges === 0) {
        currentOwner.current = data.session?.user.id || '';
        setSigned(!!data.session);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      authChanges++;
      const nextOwner = s?.user.id || '';
      const changed = currentOwner.current !== nextOwner;
      if (changed) {
        currentOwner.current = nextOwner;
        scope.current++;
        setAuthEpoch((x) => x + 1);
      }
      setSigned(!!s);
      if (!s || changed) {
        setEmployee(null);
        setEmployees([]);
        setDays([]);
        setAllDays([]);
        setAudit([]);
        setReports([]);
        setDocuments([]);
        setSelected('');
        setNewEmployee(false);
        dirty.current = false;
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [employeeMode]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, []);
  useEffect(() => {
    if (!employeeMode) return;
    const changedLink = () => {
      const incoming = new URLSearchParams(location.hash.slice(1)).get('invitation');
      if (!incoming || !/^[a-f0-9]{64}$/.test(incoming)) return;
      if (incoming !== sessionStorage.getItem('blanco-personnel-link')) {
        const previous = sessionStorage.getItem('blanco-personnel-session');
        scope.current++;
        loadNumber.current++;
        sessionStorage.removeItem('blanco-personnel-session');
        sessionStorage.setItem('blanco-personnel-link', incoming);
        setSession('');
        setLink(incoming);
        setPin('');
        setEmployee(null);
        setDays([]);
        dirty.current = false;
        if (previous) void personnel('employee_logout', { session: previous }).catch(() => {});
      }
      history.replaceState(null, '', location.pathname);
    };
    window.addEventListener('hashchange', changedLink);
    return () => window.removeEventListener('hashchange', changedLink);
  }, [employeeMode]);
  async function dashboard() {
    const ticket = scope.current,
      number = ++dashboardNumber.current;
    const r = await personnel('dashboard', { month });
    if (ticket !== scope.current || number !== dashboardNumber.current) return;
    setEmployees(r.employees);
    setAllDays(r.days);
    if (!selectedRef.current && r.employees.length)
      setSelected(r.employees.find((e: Employee) => e.active)?.id || r.employees[0].id);
  }
  async function loadMonth() {
    if ((employeeMode && !session) || (!employeeMode && !selected)) return;
    const ticket = ++loadNumber.current,
      auth = scope.current;
    setLoading(true);
    try {
      const r = await personnel(employeeMode ? 'employee_month' : 'month', {
        month,
        employeeId: selected,
        session,
      });
      if (ticket !== loadNumber.current || auth !== scope.current) return;
      setDays(r.days);
      setEmployee(r.employee);
      setAudit(r.audit || []);
      setReports(r.reports || []);
      setDocuments(r.documents || []);
      setError('');
    } catch (e) {
      if (ticket !== loadNumber.current || auth !== scope.current) return;
      setError((e as Error).message);
      if (employeeMode && /expiré|Reconnectez/.test((e as Error).message)) {
        setSession('');
        sessionStorage.removeItem('blanco-personnel-session');
        setEmployee(null);
        setDays([]);
      }
    } finally {
      if (ticket === loadNumber.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (!employeeMode && signed) void dashboard().catch((e) => setError(e.message));
  }, [employeeMode, signed, month, authEpoch]);
  useEffect(() => {
    loadNumber.current++;
    dirty.current = false;
    setDays([]);
    setEmployee(null);
    setAudit([]);
    setReports([]);
    setDocuments([]);
    if (employeeMode ? !!session : !!signed && !!selected) void loadMonth();
  }, [employeeMode, signed, session, selected, month, authEpoch]);
  function canLeave() {
    if (dirty.current || busy || loading) {
      setNotice(
        'Attendez la sauvegarde du brouillon ou enregistrez la journée avant de changer de page.',
      );
      return false;
    }
    return true;
  }
  function chooseMonth(value: string) {
    if (!canLeave()) return;
    setMonth(value);
    setDate(value === today().slice(0, 7) ? today() : value + '-01');
    setNotice('');
  }
  function saved(day: Day) {
    setDays((old) => [...old.filter((d) => d.work_date !== day.work_date), day]);
    setAllDays((old) => [
      ...old.filter((d) => d.employee_id !== day.employee_id || d.work_date !== day.work_date),
      day,
    ]);
  }
  async function authLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (employeeMode) {
        const key = randomKey();
        await personnel('employee_login', { link, pin, session: key });
        sessionStorage.setItem('blanco-personnel-session', key);
        setSession(key);
        setPin('');
      } else {
        if (!supabase) throw new Error('Serveur non configuré.');
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) throw new Error('Vérifiez votre e-mail et votre mot de passe.');
        setPassword('');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    scope.current++;
    loadNumber.current++;
    if (employeeMode) {
      const old = session;
      setSession('');
      setEmployee(null);
      setDays([]);
      sessionStorage.removeItem('blanco-personnel-session');
      try {
        await personnel('employee_logout', { session: old });
      } catch {
        /* local logout always completes */
      }
    } else await supabase?.auth.signOut();
  }
  async function reportBlob(r: Report) {
    if (r.file_path) {
      const { data, error: e } = await supabase!.storage
        .from('personnel-documents')
        .download(r.file_path);
      if (!e && data) return data;
    }
    const { pdf } = await import('./reports');
    const blob = await pdf(r);
    const path = r.snapshot.employee.id + '/' + r.id + '.pdf';
    const result = await supabase!.storage
      .from('personnel-documents')
      .upload(path, blob, { contentType: 'application/pdf', upsert: false });
    if (result.error && String(result.error.statusCode) !== '409')
      throw new Error(
        'Relevé archivé, mais le PDF n’a pas pu être sauvegardé : ' + result.error.message,
      );
    await personnel('report_file', { reportId: r.id, path });
    return blob;
  }
  async function generate(id = selected, format = 'pdf') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { report: r } = await personnel('report_create', {
        employeeId: id,
        month,
        requestId: crypto.randomUUID(),
      });
      const name = `Blanco-${fullName(r.snapshot.employee)}-${month}-v${r.version}`;
      if (format === 'xlsx') {
        const { excel } = await import('./reports');
        download(excel(r), name + '.xlsx');
        await reportBlob(r);
      } else download(await reportBlob(r), name + '.pdf');
      setNotice('Relevé définitif archivé. Les versions précédentes sont conservées.');
      await loadMonth();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function generateAll() {
    if (
      !confirm(
        'Générer les relevés des employés actifs pour ' +
          month +
          ' ? Toutes les propositions doivent être traitées.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      const { zipSync } = await import('fflate');
      const files: Record<string, Uint8Array> = {};
      for (const e of employees.filter((e) => e.active)) {
        const { report: r } = await personnel('report_create', {
          employeeId: e.id,
          month,
          requestId: crypto.randomUUID(),
        });
        files[`Blanco-${fullName(e).replace(/[\\/]/g, '-')}-${month}-v${r.version}.pdf`] =
          new Uint8Array(await (await reportBlob(r)).arrayBuffer());
      }
      download(
        new Blob([new Uint8Array(zipSync(files))], { type: 'application/zip' }),
        `Blanco-releves-${month}.zip`,
      );
      setNotice('Les relevés ont été archivés et regroupés dans un ZIP.');
      await loadMonth();
    } catch (e) {
      setError(
        (e as Error).message + ' Les relevés déjà générés restent accessibles dans les archives.',
      );
    } finally {
      setBusy(false);
    }
  }
  const authorized = employeeMode ? !!session : signed === true,
    summary = totals(days, month),
    pending = days.filter(
      (d) => d.work_date.startsWith(month) && d.proposal_state === 'pending',
    ).length;
  return (
    <div className="hr-app">
      <header className="hr-header">
        <a className="hr-brand" href={employeeMode ? '/equipe' : '/admin'}>
          Blanco<span>COFFEE & MORE</span>
        </a>
        <span className="hr-header-caption">
          {employeeMode ? 'MON ESPACE SALARIÉ' : 'GESTION DU PERSONNEL'}
        </span>
        {authorized && (
          <button
            type="button"
            aria-label="Déconnexion"
            onClick={() => {
              if (
                dirty.current &&
                !confirm(
                  'Un brouillon est en cours. Vous déconnecter sans attendre sa sauvegarde ?',
                )
              )
                return;
              dirty.current = false;
              void logout();
            }}
          >
            <LogOut size={17} />
            Déconnexion
          </button>
        )}
      </header>
      {!authorized ? (
        <main className="hr-login">
          <span className="hr-eyebrow">BLANCO · GRENOBLE</span>
          <h1>
            {employeeMode ? 'Vos heures, en toute simplicité.' : 'Votre équipe, au même endroit.'}
          </h1>
          <p>
            {employeeMode
              ? 'Sélectionnez vos journées, proposez vos horaires. La direction vérifie et valide.'
              : 'Un espace confidentiel pour les dossiers, les horaires et les relevés comptables.'}
          </p>
          <form onSubmit={authLogin}>
            {employeeMode ? (
              <>
                {!link && (
                  <label>
                    Lien personnel
                    <input
                      required
                      value={link}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLink(
                          v.includes('#')
                            ? new URLSearchParams(v.split('#')[1]).get('invitation') || ''
                            : v,
                        );
                      }}
                      placeholder="Collez le lien transmis par la direction"
                    />
                  </label>
                )}
                <label>
                  Votre PIN personnel
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  />
                </label>
                <p className="hr-muted">
                  Lien ou PIN perdu ? Contactez la direction de Blanco pour récupérer votre accès.
                </p>
              </>
            ) : (
              <>
                <label>
                  E-mail administrateur
                  <input
                    required
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  Mot de passe
                  <input
                    required
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              </>
            )}
            <button className="hr-primary" disabled={busy || (!employeeMode && signed === null)}>
              {busy ? 'Connexion…' : 'Se connecter'}
            </button>
            {error && (
              <p className="hr-error" role="alert">
                {error}
              </p>
            )}
          </form>
        </main>
      ) : (
        <main className="hr-main">
          <div className="hr-page-heading">
            <div>
              <span className="hr-eyebrow">BLANCO · GRENOBLE</span>
              <h1>
                {employeeMode
                  ? employee
                    ? `Bonjour ${employee.first_name}.`
                    : 'Votre espace salarié'
                  : 'Les bonnes heures, les bonnes décisions.'}
              </h1>
              <p>
                {employeeMode
                  ? 'Choisissez un jour. Aucun horaire ne sera validé sans l’accord de la direction.'
                  : 'Déclarez, vérifiez et préparez les relevés de votre équipe.'}
              </p>
            </div>
            {tab !== 'planning' && <MonthPicker month={month} onChange={chooseMonth} />}
          </div>
          {error && (
            <p role="alert" className="hr-error">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="hr-notice">
              {notice}
            </p>
          )}
          {!employeeMode && (
            <>
              <div className="hr-toolbar">
                <button
                  type="button"
                  className="hr-primary"
                  onClick={() => {
                    if (canLeave()) {
                      setNewEmployee(true);
                      setTab('profile');
                    }
                  }}
                >
                  <Plus size={17} />
                  Ajouter un employé
                </button>
                <button type="button" disabled={busy} onClick={() => void generateAll()}>
                  <Download size={17} />
                  Tous les relevés du mois
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      download(
                        new Blob([JSON.stringify(await personnel('export_backup'), null, 2)], {
                          type: 'application/json',
                        }),
                        `Blanco-personnel-sauvegarde-${today()}.json`,
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Exporter la sauvegarde
                </button>
                <label className="hr-check">
                  <input
                    type="checkbox"
                    checked={archived}
                    onChange={(e) => setArchived(e.target.checked)}
                  />
                  Anciens employés
                </label>
              </div>
              <div className="hr-employees" aria-label="Employés">
                {employees
                  .filter((e) => archived || e.active)
                  .map((e) => {
                    const total = totals(
                      allDays.filter((d) => d.employee_id === e.id),
                      month,
                    );
                    const waiting = allDays.filter(
                      (d) =>
                        d.employee_id === e.id &&
                        d.work_date.startsWith(month) &&
                        d.proposal_state === 'pending',
                    ).length;
                    return (
                      <button
                        type="button"
                        key={e.id}
                        className={selected === e.id && !newEmployee ? 'selected' : ''}
                        onClick={() => {
                          if (canLeave()) {
                            setSelected(e.id);
                            setNewEmployee(false);
                            setTab('hours');
                          }
                        }}
                      >
                        <Users size={20} />
                        <strong>{fullName(e)}</strong>
                        <span>{hm(total.minutes)} validées</span>
                        <small>
                          {waiting
                            ? `${waiting} demande(s) à vérifier`
                            : e.active
                              ? 'À jour'
                              : 'Archivé'}
                        </small>
                      </button>
                    );
                  })}
              </div>
            </>
          )}
          {newEmployee ? (
            <Profile
              key="new"
              employee={blankEmployee()}
              onSaved={(created) => {
                setNotice('Fiche enregistrée.');
                setSelected(created.id);
                setNewEmployee(false);
                void dashboard();
              }}
            />
          ) : (
            employee && (
              <>
                <div className="hr-stats">
                  <div>
                    <CheckCircle2 size={18} />
                    <span>Heures validées du mois</span>
                    <strong>{hm(summary.minutes)}</strong>
                    <small>{decimal(summary.minutes)} heures décimales</small>
                  </div>
                  <div>
                    <CalendarDays size={18} />
                    <span>Jours travaillés</span>
                    <strong>{summary.worked}</strong>
                    <small>Les jours sans saisie restent non déclarés.</small>
                  </div>
                  <div>
                    <span>Demandes à vérifier</span>
                    <strong>{pending}</strong>
                    <small>Seules les heures approuvées vont au comptable.</small>
                  </div>
                </div>
                {!employeeMode && (
                  <nav className="hr-tabs" aria-label="Dossier employé">
                    {[
                      ['hours', 'Horaires'],
                      ['planning', 'Programme hebdomadaire'],
                      ['profile', 'Informations'],
                      ['access', 'Accès salarié'],
                      ['documents', 'Documents'],
                      ['reports', 'Relevés & historique'],
                    ].map(([v, n]) => (
                      <button
                        type="button"
                        key={v}
                        className={tab === v ? 'active' : ''}
                        onClick={() => {
                          if (canLeave()) setTab(v);
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </nav>
                )}
                {tab === 'hours' || employeeMode ? (
                  <>
                    <div className="hr-schedule">
                      <div>
                        <Calendar
                          month={month}
                          days={days}
                          selected={date}
                          onSelect={(d) => {
                            if (canLeave()) {
                              setDate(d);
                              setNotice('');
                              if (matchMedia('(max-width: 850px)').matches)
                                requestAnimationFrame(() =>
                                  document.querySelector('.hr-day-editor')?.scrollIntoView({
                                    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                                      ? 'auto'
                                      : 'smooth',
                                    block: 'start',
                                  }),
                                );
                            }
                          }}
                        />
                        <Absence
                          key={employee.id + date}
                          employeeId={employee.id}
                          session={employeeMode ? session : undefined}
                          date={date}
                          onBusy={setBusy}
                          onSaved={async () => {
                            await loadMonth();
                            setEditorEpoch((x) => x + 1);
                            if (!employeeMode) await dashboard();
                            setNotice(
                              employeeMode
                                ? 'Période envoyée pour validation.'
                                : 'Période validée.',
                            );
                          }}
                        />
                        <div className="hr-card hr-week-summary">
                          <h3>Semaines · lundi au dimanche</h3>
                          {Object.entries(summary.weeks)
                            .sort()
                            .map(([w, m]) => (
                              <p key={w}>
                                <span>
                                  Semaine du{' '}
                                  {new Date(w + 'T12:00Z').toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                  })}
                                </span>
                                <strong>{hm(m)}</strong>
                              </p>
                            ))}
                          <small>
                            Heures réelles ventilées à minuit.{' '}
                            {employee.weekly_hours
                              ? `Contrat : ${employee.weekly_hours} h/semaine. `
                              : ''}
                            L’écart n’est pas automatiquement une heure supplémentaire.
                          </small>
                        </div>
                      </div>
                      <DayEditor
                        key={selected + date + editorEpoch}
                        date={date}
                        day={days.find((d) => d.work_date === date)}
                        employeeId={employee.id}
                        session={employeeMode ? session : undefined}
                        carried={days
                          .filter((d) => d.work_date !== date)
                          .flatMap(allocations)
                          .filter((a) => a.date === date)
                          .reduce((sum, a) => sum + a.minutes, 0)}
                        onSaved={saved}
                        onDirty={(v) => {
                          dirty.current = v;
                        }}
                        onReload={() => {
                          dirty.current = false;
                          void loadMonth().then(() => setEditorEpoch((x) => x + 1));
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="hr-text-button"
                      onClick={() => {
                        if (canLeave()) {
                          void loadMonth().then(() => setEditorEpoch((v) => v + 1));
                          if (!employeeMode) void dashboard();
                        }
                      }}
                    >
                      Actualiser les horaires
                    </button>
                  </>
                ) : tab === 'planning' ? (
                  <WeeklyPlanner
                    key={employee.id}
                    employee={employee}
                    initialDate={date}
                    onDirty={(v) => {
                      dirty.current = v;
                    }}
                    onBusy={setBusy}
                  />
                ) : tab === 'profile' ? (
                  <Profile
                    key={employee.id + employee.version}
                    employee={employee}
                    onSaved={() => {
                      setNotice('Fiche enregistrée.');
                      void dashboard();
                      void loadMonth();
                    }}
                  />
                ) : tab === 'access' ? (
                  <Access key={employee.id} employeeId={employee.id} />
                ) : tab === 'documents' ? (
                  <section className="hr-card">
                    <h2>Documents confidentiels</h2>
                    <p>
                      PDF, JPEG ou PNG · 5 Mo maximum. Ces documents restent réservés à la
                      direction.
                    </p>
                    <label>
                      Joindre un document
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        disabled={busy}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (
                            file.size > 5 * 1024 * 1024 ||
                            !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)
                          ) {
                            setError('Choisissez un PDF, JPEG ou PNG de moins de 5 Mo.');
                            return;
                          }
                          setBusy(true);
                          try {
                            const path =
                              employee.id +
                              '/' +
                              crypto.randomUUID() +
                              '.' +
                              { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[
                                file.type
                              ];
                            const { error: err } = await supabase!.storage
                              .from('personnel-documents')
                              .upload(path, file, { contentType: file.type });
                            if (err) throw err;
                            await personnel('document_add', {
                              employeeId: employee.id,
                              path,
                              name: file.name,
                            });
                            await loadMonth();
                            setNotice('Document ajouté au dossier privé.');
                          } catch (err) {
                            setError((err as Error).message);
                          } finally {
                            setBusy(false);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                    {documents.map((d) => (
                      <div className="hr-list-row" key={d.id}>
                        <span>{d.name}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const { data, error: e } = await supabase!.storage
                                .from('personnel-documents')
                                .download(d.path);
                              if (e) throw e;
                              download(data, d.name);
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          Télécharger
                        </button>
                      </div>
                    ))}
                  </section>
                ) : (
                  <section className="hr-card">
                    <h2>Relevés comptables — {month}</h2>
                    <p>
                      Seules les heures approuvées sont incluses. Traitez les brouillons et demandes
                      en cours avant le relevé définitif. Les anciennes versions restent conservées.
                    </p>
                    <div className="hr-actions">
                      <button
                        type="button"
                        className="hr-primary"
                        disabled={busy}
                        onClick={() => void generate()}
                      >
                        Générer le relevé PDF
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void generate(selected, 'xlsx')}
                      >
                        Générer Excel
                      </button>
                    </div>
                    {reports.map((r) => (
                      <div className="hr-list-row" key={r.id}>
                        <span>
                          Version {r.version} ·{' '}
                          {new Date(r.generated_at).toLocaleString('fr-FR', {
                            timeZone: 'Europe/Paris',
                          })}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const { report } = await personnel('report_get', { reportId: r.id });
                              download(
                                await reportBlob(report),
                                `Blanco-${month}-v${r.version}.pdf`,
                              );
                            } catch (e) {
                              setError((e as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          PDF archivé
                        </button>
                      </div>
                    ))}
                    <h3>Historique des modifications</h3>
                    {audit.map((a) => (
                      <div className="hr-audit" key={a.id}>
                        <strong>
                          {a.work_date || 'Dossier'} · {a.action}
                        </strong>
                        <small>
                          {new Date(a.created_at).toLocaleString('fr-FR', {
                            timeZone: 'Europe/Paris',
                          })}{' '}
                          · {a.actor.startsWith('admin:') ? 'Direction' : 'Salarié'}
                        </small>
                        {a.note && <span>{a.note}</span>}
                      </div>
                    ))}
                  </section>
                )}
              </>
            )
          )}
          {loading && <p role="status">Chargement du dossier…</p>}
          <footer className="hr-footer">
            <span>Blanco Coffee & More · Grenoble</span>
            <span>Données confidentielles · Europe/Paris</span>
            {employeeMode && <a href="/equipe/confidentialite">Confidentialité</a>}
          </footer>
        </main>
      )}
    </div>
  );
}
