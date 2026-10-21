import { useLoyaltyLanguage, LoyaltyLanguageProvider, FrenchLoyaltyContent } from './i18n';
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Coffee,
  Gift,
  LogOut,
  QrCode,
  Search,
  Settings2,
  ShieldCheck,
  Undo2,
  Users,
} from 'lucide-react';
import { supabase } from '../lib';
import {
  cardLink,
  date,
  makeKey,
  readScan,
  rewardDescription,
  rpc,
  type Member,
  type Program,
  type Result,
} from './lib';
import { History, Modal, QR, Rules, StampCard } from './shared';
import LoyaltySettings from './Settings';
import './loyalty.css';
const Scanner = lazy(() => import('./Scanner'));
type Tab = 'clients' | 'settings' | 'poster' | 'staff';
type PendingOperation = {
  signature: string;
  id: string;
  action: 'stamp' | 'redeem' | 'undo';
  payload: Record<string, unknown>;
};
function restoredOperation(): PendingOperation | null {
  try {
    const op = JSON.parse(sessionStorage.getItem('blanco-loyalty-pending-v1') || 'null');
    return op &&
      ['stamp', 'redeem', 'undo'].includes(op.action) &&
      typeof op.id === 'string' &&
      typeof op.signature === 'string' &&
      readScan(op.payload?.code)
      ? op
      : null;
  } catch {
    return null;
  }
}

function LoyaltyAdminContent() {
  const { t, lang, setLang } = useLoyaltyLanguage();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t('Blanco — Gestion fidélité');
    return () => {
      document.documentElement.dir = 'ltr';
    };
  }, [lang]);
  const [auth, setAuth] = useState<'loading' | 'login' | 'denied' | 'ready'>('loading');
  const [owner, setOwner] = useState(false),
    [program, setProgram] = useState<Program | null>(null);
  const [tab, setTab] = useState<Tab>('clients'),
    [query, setQuery] = useState(''),
    [offset, setOffset] = useState(0);
  const [members, setMembers] = useState<Result['members']>([]),
    [stats, setStats] = useState<Result['stats'] | null>(null);
  const [selected, setSelected] = useState<Member | null>(null),
    [staff, setStaff] = useState<Result['staff']>([]);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [searching, setSearching] = useState(false);
  const [manual, setManual] = useState(''),
    [amount, setAmount] = useState(1),
    [paid, setPaid] = useState(false);
  const [modal, setModal] = useState<'recover' | 'erase' | null>(null),
    [recoveryLink, setRecoveryLink] = useState('');
  const [confirmReward, setConfirmReward] = useState<string | null>(null);
  const [approvalCode, setApprovalCode] = useState('');
  const [copiedRecovery, setCopiedRecovery] = useState(false);
  const [pending, setPending] = useState<PendingOperation | null>(restoredOperation);
  function rememberOperation(op: PendingOperation | null) {
    setPending(op);
    try {
      if (op) sessionStorage.setItem('blanco-loyalty-pending-v1', JSON.stringify(op));
      else sessionStorage.removeItem('blanco-loyalty-pending-v1');
    } catch {
      /* In-memory retry remains available. */
    }
  }
  const searchSequence = useRef(0);
  const open = useCallback(async (code: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    setRecoveryLink('');
    setPaid(false);
    setAmount(1);
    setConfirmReward(null);
    try {
      const r = await rpc('member', { code });
      setSelected(r.member);
      setProgram(r.program);
      setOwner(r.owner);
      setTab('clients');
      history.replaceState(null, '', `/admin/fidelite?carte=${encodeURIComponent(code)}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  const load = useCallback(async () => {
    const seq = ++searchSequence.current;
    setSearching(true);
    try {
      const r = await rpc('search', { query, offset });
      if (seq === searchSequence.current) {
        setMembers(r.members);
        setStats(r.stats);
      }
    } catch (e) {
      if (seq === searchSequence.current) setError((e as Error).message);
    } finally {
      if (seq === searchSequence.current) setSearching(false);
    }
  }, [query, offset]);
  useEffect(() => {
    if (!supabase) {
      setAuth('login');
      setError('Le service fidélité n’est pas configuré.');
      return;
    }
    let active = true;
    const check = async () => {
      const { data } = await supabase!.auth.getSession();
      if (!active) return;
      if (!data.session) {
        setAuth('login');
        return;
      }
      try {
        const r = await rpc('access');
        if (!active) return;
        setOwner(r.owner);
        setProgram(r.program);
        setAuth('ready');
      } catch {
        if (active) setAuth('denied');
      }
    };
    void check();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => void check(), 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (auth !== 'ready') return;
    const code = readScan(new URLSearchParams(location.search).get('carte') || '');
    if (code) void open(code);
  }, [auth, open]);
  useEffect(() => {
    if (auth !== 'ready') return;
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [auth, load]);
  useEffect(() => {
    if (tab === 'staff' && owner)
      rpc('staff')
        .then((r) => setStaff(r.staff))
        .catch((e) => setError(e.message));
  }, [tab, owner]);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get('email')),
      password: String(f.get('password')),
    });
    if (error) setError('Connexion impossible. Vérifiez votre adresse et votre mot de passe.');
    setBusy(false);
  }
  async function mutate(action: 'stamp' | 'redeem' | 'undo', payload: Record<string, unknown>) {
    if (!selected || busy) return;
    const data = { code: selected.code, ...payload };
    const signature = JSON.stringify({ action, ...data });
    if (pending && pending.signature !== signature) {
      setError(
        'Une opération est en attente de confirmation. Confirmez-la avec le bouton « Vérifier et réessayer » avant de continuer.',
      );
      return;
    }
    const op = pending || { signature, id: crypto.randomUUID(), action, payload: data };
    rememberOperation(op);
    await executeOperation(op);
  }
  async function executeOperation(op: PendingOperation) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await rpc(op.action, { ...op.payload, requestId: op.id });
      setSelected(r.member);
      setTab('clients');
      rememberOperation(null);
      setPaid(false);
      setConfirmReward(null);
      setNotice(
        op.action === 'stamp'
          ? 'Tampons ajoutés. La carte du client se met à jour automatiquement.'
          : op.action === 'redeem'
            ? 'Cadeau enregistré comme utilisé.'
            : 'Opération annulée.',
      );
      void load();
    } catch (e) {
      if ((e as Error & { definitive?: boolean }).definitive) rememberOperation(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const reset = () => {
    setSelected(null);
    setRecoveryLink('');
    setError('');
    setNotice('');
    setConfirmReward(null);
    history.replaceState(null, '', '/admin/fidelite');
    void load();
  };
  return (
    <div className="loyalty-app loy-admin" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
      <header className="loy-header">
        <a href="/admin" className="loy-wordmark">
          Blanco<span>{t('ESPACE FIDÉLITÉ')}</span>
        </a>
        <div className="loy-actions">
          <div
            className="loy-language-switch"
            role="group"
            aria-label={lang === 'ar' ? 'لغة لوحة الإدارة' : 'Langue de gestion'}
          >
            <button className={lang === 'ar' ? 'active' : ''} onClick={() => setLang('ar')}>
              عربي
            </button>
            <button className={lang === 'fr' ? 'active' : ''} onClick={() => setLang('fr')}>
              FR
            </button>
          </div>
          <a href="/admin" className="loy-link">
            <ArrowLeft size={15} /> {t('Gestion du menu')}{' '}
          </a>
          {auth === 'ready' && (
            <button className="loy-link" onClick={() => void supabase?.auth.signOut()}>
              <LogOut size={16} /> {t('Déconnexion')}{' '}
            </button>
          )}
        </div>
      </header>
      {auth !== 'ready' ? (
        <main className="loy-auth loy-panel">
          <ShieldCheck size={32} />
          <h1>
            {auth === 'loading'
              ? t('Un instant…')
              : auth === 'denied'
                ? t('Accès réservé à l’équipe.')
                : t('Bonjour, l’équipe.')}
          </h1>
          {auth === 'denied' ? (
            <>
              <p>
                {t(
                  'Ce compte n’a pas accès à la fidélité. Demandez au responsable de l’autoriser.',
                )}
              </p>
              <button className="loy-button" onClick={() => void supabase?.auth.signOut()}>
                {t('Changer de compte')}{' '}
              </button>
            </>
          ) : auth === 'login' ? (
            <form onSubmit={login}>
              <p>{t('Connectez-vous avec votre compte de gestion Blanco.')}</p>
              <label>
                {t('Adresse e-mail')}{' '}
                <input type="email" name="email" autoComplete="username" required />
              </label>
              <label>
                {t('Mot de passe')}{' '}
                <input type="password" name="password" autoComplete="current-password" required />
              </label>
              <button className="loy-button" disabled={busy}>
                {busy ? t('Connexion…') : t('Se connecter')}
              </button>
            </form>
          ) : null}
          {error && (
            <p role="alert" className="loy-alert">
              {t(error)}
            </p>
          )}
        </main>
      ) : (
        <main className="loy-admin-main">
          <div className="loy-admin-intro">
            <div>
              <span className="loy-eyebrow">{t('BLANCO CLUB · GRENOBLE')}</span>
              <h1>{t('Chaque visite compte.')}</h1>
              <p>{t('Un scan, un sourire, une petite attention.')}</p>
            </div>
            <a className="loy-secondary" href="/fidelite" target="_blank" rel="noreferrer">
              {t('Voir la carte client')} <ArrowRight size={16} />
            </a>
          </div>
          <nav className="loy-admin-tabs" aria-label={t('Gestion fidélité')}>
            {(
              [
                { id: 'clients', label: t('Clients & caisse'), icon: Users },
                ...(owner ? [{ id: 'settings', label: t('Programme'), icon: Settings2 }] : []),
                { id: 'poster', label: t('QR d’inscription'), icon: QrCode },
                ...(owner ? [{ id: 'staff', label: t('Équipe'), icon: ShieldCheck }] : []),
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? 'active' : ''}
                onClick={() => {
                  setTab(t.id as Tab);
                  setError('');
                  setNotice('');
                }}
              >
                <t.icon size={17} />
                {t.label}
              </button>
            ))}
          </nav>
          {error && (
            <div role="alert" className="loy-alert">
              {t(error)}
            </div>
          )}
          {notice && (
            <p role="status" className="loy-notice">
              <Check size={16} />
              {t(notice)}
            </p>
          )}
          {pending && !busy && (
            <div className="loy-offline" role="status">
              {t('Opération en attente sur la carte')} {String(pending.payload.code)}
              {t('. Réessayez avec le même identifiant : elle ne sera pas comptée deux fois.')}{' '}
              <button className="loy-secondary" onClick={() => void executeOperation(pending)}>
                {t('Vérifier et réessayer')}{' '}
              </button>
            </div>
          )}
          {tab === 'settings' && owner && program && (
            <LoyaltySettings program={program} onSave={setProgram} />
          )}
          {tab === 'poster' && (
            <section className="loy-poster loy-panel">
              <span className="loy-eyebrow">{t('À POSER PRÈS DE LA CAISSE')}</span>
              <h2 lang="fr" dir="ltr">
                Un café aujourd’hui. <br />
                Une attention demain.{' '}
              </h2>
              <p lang="fr" dir="ltr">
                Scannez. Inscrivez-vous. Cumulez vos petits bonheurs.
              </p>
              <QR
                value={`${location.origin}/fidelite`}
                label={t('QR pour s’inscrire au programme fidélité')}
                download
              />
              <a className="loy-link" href="/fidelite">
                {location.origin}/fidelite
              </a>
              {program && (
                <FrenchLoyaltyContent>
                  <Rules program={program} />
                </FrenchLoyaltyContent>
              )}
              <button className="loy-button loy-no-print" onClick={() => window.print()}>
                {t('Imprimer l’affiche')}{' '}
              </button>
            </section>
          )}
          {tab === 'staff' && owner && (
            <section className="loy-panel">
              <h2>{t('Une équipe de confiance.')}</h2>
              <p>
                {t(
                  'Les équipiers peuvent chercher une carte, ajouter des tampons, utiliser un cadeau et annuler leur dernière opération pendant 15 minutes. Le responsable garde les réglages, la récupération et la suppression des comptes.',
                )}{' '}
              </p>
              <p>
                {t(
                  'Créez d’abord le compte confirmé dans Supabase → Authentication → Users, puis autorisez son e-mail ici. Les identifiants ne se partagent pas.',
                )}{' '}
              </p>
              <form
                className="loy-inline-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError('');
                  const email = new FormData(e.currentTarget).get('email');
                  try {
                    const r = await rpc('staff', { email, active: true });
                    setStaff(r.staff);
                    setNotice('Accès accordé.');
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  {t('E-mail de l’équipier')} <input type="email" name="email" required />
                </label>
                <button className="loy-button" disabled={busy}>
                  {t('Autoriser')}{' '}
                </button>
              </form>
              <ul className="loy-staff-list">
                {staff.map((s) => (
                  <li key={s.email}>
                    <span>
                      {s.email}
                      <small>{s.active ? t('Autorisé') : t('Accès suspendu')}</small>
                    </span>
                    <button
                      className="loy-secondary"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const r = await rpc('staff', { email: s.email, active: !s.active });
                          setStaff(r.staff);
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {s.active ? t('Suspendre') : t('Réactiver')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {tab === 'clients' &&
            (selected ? (
              <>
                <button className="loy-link loy-back" onClick={reset}>
                  <ArrowLeft size={16} /> {t('Tous les clients')}{' '}
                </button>
                <div className="loy-member-layout">
                  <div>
                    <div className="loy-panel loy-member-info">
                      <span className="loy-eyebrow">{t('CARTE CLIENT')}</span>
                      <h2>{selected.name}</h2>
                      <p>
                        <bdi>{selected.phone}</bdi> <span>· {selected.code}</span>
                      </p>
                      <p className="loy-field-help">
                        {t('Inscrit le')} {date(selected.createdAt, lang)}
                      </p>
                    </div>
                    <StampCard member={selected} />
                    <History member={selected} />
                  </div>
                  <div className="loy-member-actions">
                    <section className="loy-panel">
                      <span className="loy-eyebrow">{t('APRÈS LE PAIEMENT')}</span>
                      <h2>{t('Une pause de plus.')}</h2>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void mutate('stamp', { amount, paid });
                        }}
                      >
                        <label>
                          {t('Nombre de boissons payées')}{' '}
                          <input
                            type="number"
                            min={1}
                            max={50}
                            required
                            value={amount}
                            onChange={(e) => setAmount(+e.target.value)}
                          />
                        </label>
                        <label className="loy-checkbox">
                          <input
                            type="checkbox"
                            required
                            checked={paid}
                            onChange={(e) => setPaid(e.target.checked)}
                          />
                          <span>
                            {t(
                              'J’ai vérifié les boissons payées et éligibles. Les boissons offertes ne comptent pas.',
                            )}{' '}
                          </span>
                        </label>
                        <button className="loy-button" disabled={busy || !program?.enabled}>
                          <Coffee size={18} />
                          {busy
                            ? t('Enregistrement…')
                            : t('Ajouter {0} tampon{1}', amount, amount > 1 ? 's' : '')}
                        </button>
                      </form>
                      {!program?.enabled && (
                        <p className="loy-alert">
                          {t(
                            'Le programme est en pause. Les cadeaux déjà gagnés restent utilisables.',
                          )}{' '}
                        </p>
                      )}
                      {selected.cycleExpiresAt && (
                        <p className="loy-field-help">
                          {t('Carte à compléter avant le')} {date(selected.cycleExpiresAt, lang)}.
                        </p>
                      )}
                    </section>
                    <section className="loy-panel">
                      <span className="loy-eyebrow">{t('LE PLAISIR D’OFFRIR')}</span>
                      <h2>{t('Ses cadeaux.')}</h2>
                      {!selected.rewards.length && (
                        <p>{t('Encore quelques pauses avant le premier cadeau.')}</p>
                      )}
                      {selected.rewards.map((r) => (
                        <article key={r.id} className={`loy-staff-reward ${r.status}`}>
                          <Gift size={23} />
                          <div>
                            <h3>{r.label}</h3>
                            <p>{t(rewardDescription(r))}</p>
                            <small>
                              {r.status === 'used'
                                ? t('Déjà utilisé')
                                : r.status === 'expired'
                                  ? t('Expiré')
                                  : r.status === 'soon'
                                    ? t('Disponible le {0}', date(r.availableAt, lang))
                                    : t('Valable jusqu’au {0}', date(r.expiresAt, lang))}
                            </small>
                            {r.status === 'ready' &&
                              (confirmReward === r.id ? (
                                <div className="loy-confirm">
                                  <p>
                                    {t(
                                      'Confirmer la remise du cadeau au client ? Aucun tampon ne sera ajouté.',
                                    )}{' '}
                                  </p>
                                  <label>
                                    {t('Code cadeau du client (6 chiffres)')}
                                    <input
                                      inputMode="numeric"
                                      autoComplete="off"
                                      value={approvalCode}
                                      maxLength={6}
                                      onChange={(e) =>
                                        setApprovalCode(e.target.value.replace(/\D/g, ''))
                                      }
                                    />
                                  </label>
                                  <p className="loy-field-help">
                                    {t(
                                      'Le client génère ce code sur son téléphone. Ne lui demandez jamais son PIN.',
                                    )}
                                  </p>
                                  <button
                                    className="loy-button"
                                    disabled={busy || !/^\d{6}$/.test(approvalCode)}
                                    onClick={() =>
                                      void mutate('redeem', { rewardId: r.id, approvalCode })
                                    }
                                  >
                                    {t('Confirmer l’utilisation')}{' '}
                                  </button>
                                  <button
                                    className="loy-link"
                                    disabled={busy}
                                    onClick={() => setConfirmReward(null)}
                                  >
                                    {t('Annuler')}{' '}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="loy-secondary"
                                  disabled={busy}
                                  onClick={() => {
                                    setApprovalCode('');
                                    setConfirmReward(r.id);
                                  }}
                                >
                                  {t('Utiliser ce cadeau')}{' '}
                                </button>
                              ))}
                          </div>
                        </article>
                      ))}
                    </section>
                    {selected.lastEvent?.canUndo && (
                      <button
                        className="loy-secondary"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(t('Annuler la dernière opération sur cette carte ?')))
                            void mutate('undo', { eventId: selected.lastEvent!.id });
                        }}
                      >
                        <Undo2 size={17} /> {t('Annuler la dernière opération (15 min)')}{' '}
                      </button>
                    )}
                    {owner && (
                      <details className="loy-panel">
                        <summary>{t('Assistance & données du client')}</summary>
                        <p>
                          {t(
                            'Vérifiez toujours l’identité du client au comptoir avant de renouveler son accès.',
                          )}{' '}
                        </p>
                        <div className="loy-actions">
                          <button
                            className="loy-secondary"
                            disabled={busy}
                            onClick={() => {
                              setRecoveryLink('');
                              setModal('recover');
                            }}
                          >
                            {t('Retrouver son accès')}{' '}
                          </button>
                          <button
                            className="loy-danger"
                            disabled={busy}
                            onClick={() => setModal('erase')}
                          >
                            {t('Supprimer ses données')}{' '}
                          </button>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="loy-stats">
                  {stats &&
                    [
                      [t('Clients'), stats.members],
                      [t('Boissons fidélisées'), stats.stamps],
                      [t('Cadeaux à utiliser'), stats.ready],
                      [t('Cadeaux savourés'), stats.redeemed],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <strong>{Number(value).toLocaleString('fr-FR')}</strong>
                        <span>{label}</span>
                      </div>
                    ))}
                </div>
                <div className="loy-cashier-layout">
                  <section className="loy-panel">
                    <span className="loy-eyebrow">{t('LE GESTE SIMPLE EN CAISSE')}</span>
                    <h2>{t('Bonjour, les habitués.')}</h2>
                    <Suspense fallback={<p>{t('Préparation de la caméra…')}</p>}>
                      <Scanner onScan={(code) => void open(code)} />
                    </Suspense>
                    <form
                      className="loy-inline-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const code = readScan(manual);
                        if (!code) {
                          setError('Vérifiez le code (BL-12345-ABCDE).');
                          return;
                        }
                        void open(code);
                      }}
                    >
                      <label>
                        {t('Ou saisir le code de la carte')}{' '}
                        <input
                          value={manual}
                          onChange={(e) => setManual(e.target.value.toUpperCase())}
                          placeholder="BL-12345-ABCDE"
                          required
                          maxLength={16}
                        />
                      </label>
                      <button className="loy-button" disabled={busy}>
                        {t('Ouvrir')}{' '}
                      </button>
                    </form>
                  </section>
                  <section className="loy-panel">
                    <span className="loy-eyebrow">{t('UNE CARTE ÉGARÉE ?')}</span>
                    <h2>{t('Retrouver un client.')}</h2>
                    <label className="loy-search">
                      <Search size={18} />
                      <input
                        aria-label={t('Rechercher un client')}
                        placeholder={t('Nom, téléphone ou code…')}
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setOffset(0);
                        }}
                      />
                    </label>
                    <p className="loy-field-help">
                      {t(
                        'Recherche par nom ou par au moins 4 chiffres du téléphone. Vérifiez les homonymes avec le numéro.',
                      )}{' '}
                    </p>
                    <div className="loy-client-list" aria-busy={searching}>
                      {members.map((m) => (
                        <button key={m.code} onClick={() => void open(m.code)} disabled={busy}>
                          <span className="loy-avatar">{m.name[0].toUpperCase()}</span>
                          <span>
                            <strong>{m.name}</strong>
                            <small>
                              <bdi>{m.phone}</bdi>
                            </small>
                            <small>
                              {m.stamps}/{m.goal} {t('tampons')}{' '}
                              {m.rewards > 0 ? t(' · {0} cadeau(x)', m.rewards) : ''}
                            </small>
                          </span>
                          <ArrowRight size={17} />
                        </button>
                      ))}
                      {!members.length && (
                        <p>{searching ? t('Recherche…') : t('Aucun client trouvé.')}</p>
                      )}
                    </div>
                    <div className="loy-pagination">
                      <button
                        className="loy-link"
                        disabled={offset === 0 || searching}
                        onClick={() => setOffset((o) => Math.max(0, o - 20))}
                      >
                        {t('Précédents')}{' '}
                      </button>
                      <span>
                        {t('Page')} {offset / 20 + 1}
                      </span>
                      <button
                        className="loy-link"
                        disabled={members.length < 20 || searching}
                        onClick={() => setOffset((o) => o + 20)}
                      >
                        {t('Suivants')}{' '}
                      </button>
                    </div>
                  </section>
                </div>
              </>
            ))}
        </main>
      )}
      {modal === 'recover' && selected && (
        <Modal
          title={recoveryLink ? t('Sa carte est retrouvée.') : t('Redonner accès à sa carte.')}
          onClose={() => setModal(null)}
        >
          {recoveryLink ? (
            <>
              <p>
                {t(
                  'Le solde et les cadeaux sont conservés. L’ancien lien ne fonctionne plus. Demandez au client de scanner ce QR et d’enregistrer sa nouvelle carte.',
                )}{' '}
              </p>
              <div className="loy-recovery-summary">
                <strong>
                  {selected.stamps} / {selected.goal} {t('tampons')}
                </strong>
                <span>
                  {selected.totalStamps} {t('boissons au total')} ·{' '}
                  {
                    selected.rewards.filter((r) => r.status === 'ready' || r.status === 'soon')
                      .length
                  }{' '}
                  {t('Cadeaux à utiliser')}
                </span>
              </div>
              <p>
                {t(
                  'Ce lien ouvre le suivi client : tampons, boissons comptabilisées et cadeaux. Le client choisit d’abord son nouveau PIN.',
                )}
              </p>
              <label>
                {t('Lien personnel de suivi du client')}
                <input
                  dir="ltr"
                  readOnly
                  value={recoveryLink}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
              <a className="loy-button" href={recoveryLink} target="_blank" rel="noreferrer">
                {t('Ouvrir son nouveau lien')}
              </a>
              <button
                className="loy-secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(recoveryLink);
                    setCopiedRecovery(true);
                  } catch {
                    setError('Copie impossible. Sélectionnez et copiez le lien ci-dessus.');
                  }
                }}
              >
                {t('Copier son lien privé')}
              </button>
              {copiedRecovery && (
                <p className="loy-notice" role="status">
                  {t('Lien copié. Remettez-le uniquement à ce client.')}
                </p>
              )}
              <p className="loy-field-help">
                {t(
                  'Lien sans limite de temps, à usage unique. Un nouveau lien annule le précédent. Les anciens accès et l’ancien PIN sont désactivés. Le QR ci-dessous ouvre exactement ce même lien.',
                )}
              </p>
              <QR
                value={recoveryLink}
                label={t('Nouveau lien privé à remettre uniquement au client')}
              />
            </>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy) return;
                setBusy(true);
                setError('');
                const f = new FormData(e.currentTarget);
                const key = makeKey();
                try {
                  const r = await rpc('recover', {
                    code: selected.code,
                    key,
                    last4: f.get('last4'),
                    verified: f.get('verified') === 'on',
                  });
                  setSelected(r.member);
                  setCopiedRecovery(false);
                  setRecoveryLink(cardLink(key));
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                {t('Pour')} <strong>{selected.name}</strong>
                {t(
                  '. Faites dire son numéro au client, sans le lui souffler, pour distinguer les homonymes.',
                )}{' '}
              </p>
              <label>
                {t('Les 4 derniers chiffres de son téléphone')}{' '}
                <input
                  name="last4"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  minLength={4}
                  autoComplete="off"
                  required
                />
              </label>
              <label className="loy-checkbox">
                <input type="checkbox" name="verified" required />
                <span>
                  {t('Le client est présent et j’ai vérifié son identité et son numéro.')}
                </span>
              </label>
              <p className="loy-field-help">
                {t(
                  'L’ancien lien personnel sera désactivé. Les tampons, les cadeaux et le code de caisse sont conservés.',
                )}{' '}
              </p>
              <button className="loy-button" disabled={busy}>
                {t('Créer son nouveau lien')}{' '}
              </button>
            </form>
          )}
          {error && (
            <p className="loy-alert" role="alert">
              {t(error)}
            </p>
          )}
        </Modal>
      )}
      {modal === 'erase' && selected && (
        <Modal title={t('Supprimer définitivement sa carte ?')} onClose={() => setModal(null)}>
          <p>
            {t(
              'À la demande du client, cette action efface son nom, son téléphone, ses tampons, ses cadeaux et son historique. Elle ne peut pas être annulée.',
            )}{' '}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              const f = new FormData(e.currentTarget);
              try {
                await rpc('erase', { code: selected.code, confirm: f.get('confirm') });
                setModal(null);
                reset();
                setNotice('Les données de ce client ont été supprimées.');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {t('Recopiez')} {selected.code} {t('pour confirmer')}{' '}
              <input name="confirm" required pattern={selected.code} autoComplete="off" />
            </label>
            <button className="loy-danger" disabled={busy}>
              {t('Effacer définitivement')}{' '}
            </button>
          </form>
          {error && (
            <p className="loy-alert" role="alert">
              {t(error)}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}

export default function LoyaltyAdmin() {
  return (
    <LoyaltyLanguageProvider>
      <LoyaltyAdminContent />
    </LoyaltyLanguageProvider>
  );
}
