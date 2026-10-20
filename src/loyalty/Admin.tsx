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

export default function LoyaltyAdmin() {
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
    document.documentElement.lang = 'fr';
    document.title = 'Blanco — Gestion fidélité';
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
    <div className="loyalty-app loy-admin">
      <header className="loy-header">
        <a href="/admin" className="loy-wordmark">
          Blanco<span>ESPACE FIDÉLITÉ</span>
        </a>
        <div className="loy-actions">
          <a href="/admin" className="loy-link">
            <ArrowLeft size={15} /> Gestion du menu
          </a>
          {auth === 'ready' && (
            <button className="loy-link" onClick={() => void supabase?.auth.signOut()}>
              <LogOut size={16} /> Déconnexion
            </button>
          )}
        </div>
      </header>
      {auth !== 'ready' ? (
        <main className="loy-auth loy-panel">
          <ShieldCheck size={32} />
          <h1>
            {auth === 'loading'
              ? 'Un instant…'
              : auth === 'denied'
                ? 'Accès réservé à l’équipe.'
                : 'Bonjour, l’équipe.'}
          </h1>
          {auth === 'denied' ? (
            <>
              <p>Ce compte n’a pas accès à la fidélité. Demandez au responsable de l’autoriser.</p>
              <button className="loy-button" onClick={() => void supabase?.auth.signOut()}>
                Changer de compte
              </button>
            </>
          ) : auth === 'login' ? (
            <form onSubmit={login}>
              <p>Connectez-vous avec votre compte de gestion Blanco.</p>
              <label>
                Adresse e-mail
                <input type="email" name="email" autoComplete="username" required />
              </label>
              <label>
                Mot de passe
                <input type="password" name="password" autoComplete="current-password" required />
              </label>
              <button className="loy-button" disabled={busy}>
                {busy ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>
          ) : null}
          {error && (
            <p role="alert" className="loy-alert">
              {error}
            </p>
          )}
        </main>
      ) : (
        <main className="loy-admin-main">
          <div className="loy-admin-intro">
            <div>
              <span className="loy-eyebrow">BLANCO CLUB · GRENOBLE</span>
              <h1>Chaque visite compte.</h1>
              <p>Un scan, un sourire, une petite attention.</p>
            </div>
            <a className="loy-secondary" href="/fidelite" target="_blank" rel="noreferrer">
              Voir la carte client <ArrowRight size={16} />
            </a>
          </div>
          <nav className="loy-admin-tabs" aria-label="Gestion fidélité">
            {(
              [
                { id: 'clients', label: 'Clients & caisse', icon: Users },
                ...(owner ? [{ id: 'settings', label: 'Programme', icon: Settings2 }] : []),
                { id: 'poster', label: 'QR d’inscription', icon: QrCode },
                ...(owner ? [{ id: 'staff', label: 'Équipe', icon: ShieldCheck }] : []),
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
              {error}
            </div>
          )}
          {notice && (
            <p role="status" className="loy-notice">
              <Check size={16} />
              {notice}
            </p>
          )}
          {pending && !busy && (
            <div className="loy-offline" role="status">
              Opération en attente sur la carte {String(pending.payload.code)}. Réessayez avec le
              même identifiant : elle ne sera pas comptée deux fois.{' '}
              <button className="loy-secondary" onClick={() => void executeOperation(pending)}>
                Vérifier et réessayer
              </button>
            </div>
          )}
          {tab === 'settings' && owner && program && (
            <LoyaltySettings program={program} onSave={setProgram} />
          )}
          {tab === 'poster' && (
            <section className="loy-poster loy-panel">
              <span className="loy-eyebrow">À POSER PRÈS DE LA CAISSE</span>
              <h2>
                Un café aujourd’hui.
                <br />
                Une attention demain.
              </h2>
              <p>Scannez. Inscrivez-vous. Cumulez vos petits bonheurs.</p>
              <QR
                value={`${location.origin}/fidelite`}
                label="QR pour s’inscrire au programme fidélité"
                download
              />
              <a className="loy-link" href="/fidelite">
                {location.origin}/fidelite
              </a>
              {program && <Rules program={program} />}
              <button className="loy-button loy-no-print" onClick={() => window.print()}>
                Imprimer l’affiche
              </button>
            </section>
          )}
          {tab === 'staff' && owner && (
            <section className="loy-panel">
              <h2>Une équipe de confiance.</h2>
              <p>
                Les équipiers peuvent chercher une carte, ajouter des tampons, utiliser un cadeau et
                annuler leur dernière opération pendant 15 minutes. Le responsable garde les
                réglages, la récupération et la suppression des comptes.
              </p>
              <p>
                Créez d’abord le compte confirmé dans Supabase → Authentication → Users, puis
                autorisez son e-mail ici. Les identifiants ne se partagent pas.
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
                  E-mail de l’équipier
                  <input type="email" name="email" required />
                </label>
                <button className="loy-button" disabled={busy}>
                  Autoriser
                </button>
              </form>
              <ul className="loy-staff-list">
                {staff.map((s) => (
                  <li key={s.email}>
                    <span>
                      {s.email}
                      <small>{s.active ? 'Autorisé' : 'Accès suspendu'}</small>
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
                      {s.active ? 'Suspendre' : 'Réactiver'}
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
                  <ArrowLeft size={16} /> Tous les clients
                </button>
                <div className="loy-member-layout">
                  <div>
                    <div className="loy-panel loy-member-info">
                      <span className="loy-eyebrow">CARTE CLIENT</span>
                      <h2>{selected.name}</h2>
                      <p>
                        {selected.phone} <span>· {selected.code}</span>
                      </p>
                      <p className="loy-field-help">Inscrit le {date(selected.createdAt)}</p>
                    </div>
                    <StampCard member={selected} />
                    <History member={selected} />
                  </div>
                  <div className="loy-member-actions">
                    <section className="loy-panel">
                      <span className="loy-eyebrow">APRÈS LE PAIEMENT</span>
                      <h2>Une pause de plus.</h2>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void mutate('stamp', { amount, paid });
                        }}
                      >
                        <label>
                          Nombre de boissons payées
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
                            J’ai vérifié les boissons payées et éligibles. Les boissons offertes ne
                            comptent pas.
                          </span>
                        </label>
                        <button className="loy-button" disabled={busy || !program?.enabled}>
                          <Coffee size={18} />
                          {busy
                            ? 'Enregistrement…'
                            : `Ajouter ${amount} tampon${amount > 1 ? 's' : ''}`}
                        </button>
                      </form>
                      {!program?.enabled && (
                        <p className="loy-alert">
                          Le programme est en pause. Les cadeaux déjà gagnés restent utilisables.
                        </p>
                      )}
                      {selected.cycleExpiresAt && (
                        <p className="loy-field-help">
                          Carte à compléter avant le {date(selected.cycleExpiresAt)}.
                        </p>
                      )}
                    </section>
                    <section className="loy-panel">
                      <span className="loy-eyebrow">LE PLAISIR D’OFFRIR</span>
                      <h2>Ses cadeaux.</h2>
                      {!selected.rewards.length && (
                        <p>Encore quelques pauses avant le premier cadeau.</p>
                      )}
                      {selected.rewards.map((r) => (
                        <article key={r.id} className={`loy-staff-reward ${r.status}`}>
                          <Gift size={23} />
                          <div>
                            <h3>{r.label}</h3>
                            <p>{rewardDescription(r)}</p>
                            <small>
                              {r.status === 'used'
                                ? 'Déjà utilisé'
                                : r.status === 'expired'
                                  ? 'Expiré'
                                  : r.status === 'soon'
                                    ? `Disponible le ${date(r.availableAt)}`
                                    : `Valable jusqu’au ${date(r.expiresAt)}`}
                            </small>
                            {r.status === 'ready' &&
                              (confirmReward === r.id ? (
                                <div className="loy-confirm">
                                  <p>
                                    Confirmer la remise du cadeau au client ? Aucun tampon ne sera
                                    ajouté.
                                  </p>
                                  <button
                                    className="loy-button"
                                    disabled={busy}
                                    onClick={() => void mutate('redeem', { rewardId: r.id })}
                                  >
                                    Confirmer l’utilisation
                                  </button>
                                  <button
                                    className="loy-link"
                                    disabled={busy}
                                    onClick={() => setConfirmReward(null)}
                                  >
                                    Annuler
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="loy-secondary"
                                  disabled={busy}
                                  onClick={() => setConfirmReward(r.id)}
                                >
                                  Utiliser ce cadeau
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
                          if (confirm('Annuler la dernière opération sur cette carte ?'))
                            void mutate('undo', { eventId: selected.lastEvent!.id });
                        }}
                      >
                        <Undo2 size={17} /> Annuler la dernière opération (15 min)
                      </button>
                    )}
                    {owner && (
                      <details className="loy-panel">
                        <summary>Assistance & données du client</summary>
                        <p>
                          Vérifiez toujours l’identité du client au comptoir avant de renouveler son
                          accès.
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
                            Retrouver son accès
                          </button>
                          <button
                            className="loy-danger"
                            disabled={busy}
                            onClick={() => setModal('erase')}
                          >
                            Supprimer ses données
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
                      ['Clients', stats.members],
                      ['Boissons fidélisées', stats.stamps],
                      ['Cadeaux à utiliser', stats.ready],
                      ['Cadeaux savourés', stats.redeemed],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <strong>{Number(value).toLocaleString('fr-FR')}</strong>
                        <span>{label}</span>
                      </div>
                    ))}
                </div>
                <div className="loy-cashier-layout">
                  <section className="loy-panel">
                    <span className="loy-eyebrow">LE GESTE SIMPLE EN CAISSE</span>
                    <h2>Bonjour, les habitués.</h2>
                    <Suspense fallback={<p>Préparation de la caméra…</p>}>
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
                        Ou saisir le code de la carte
                        <input
                          value={manual}
                          onChange={(e) => setManual(e.target.value.toUpperCase())}
                          placeholder="BL-12345-ABCDE"
                          required
                          maxLength={16}
                        />
                      </label>
                      <button className="loy-button" disabled={busy}>
                        Ouvrir
                      </button>
                    </form>
                  </section>
                  <section className="loy-panel">
                    <span className="loy-eyebrow">UNE CARTE ÉGARÉE ?</span>
                    <h2>Retrouver un client.</h2>
                    <label className="loy-search">
                      <Search size={18} />
                      <input
                        aria-label="Rechercher un client"
                        placeholder="Nom, téléphone ou code…"
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setOffset(0);
                        }}
                      />
                    </label>
                    <p className="loy-field-help">
                      Recherche par nom ou par au moins 4 chiffres du téléphone. Vérifiez les
                      homonymes avec le numéro.
                    </p>
                    <div className="loy-client-list" aria-busy={searching}>
                      {members.map((m) => (
                        <button key={m.code} onClick={() => void open(m.code)} disabled={busy}>
                          <span className="loy-avatar">{m.name[0].toUpperCase()}</span>
                          <span>
                            <strong>{m.name}</strong>
                            <small>{m.phone}</small>
                            <small>
                              {m.stamps}/{m.goal} tampons{' '}
                              {m.rewards > 0 ? ` · ${m.rewards} cadeau(x)` : ''}
                            </small>
                          </span>
                          <ArrowRight size={17} />
                        </button>
                      ))}
                      {!members.length && (
                        <p>{searching ? 'Recherche…' : 'Aucun client trouvé.'}</p>
                      )}
                    </div>
                    <div className="loy-pagination">
                      <button
                        className="loy-link"
                        disabled={offset === 0 || searching}
                        onClick={() => setOffset((o) => Math.max(0, o - 20))}
                      >
                        Précédents
                      </button>
                      <span>Page {offset / 20 + 1}</span>
                      <button
                        className="loy-link"
                        disabled={members.length < 20 || searching}
                        onClick={() => setOffset((o) => o + 20)}
                      >
                        Suivants
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
          title={recoveryLink ? 'Sa carte est retrouvée.' : 'Redonner accès à sa carte.'}
          onClose={() => setModal(null)}
        >
          {recoveryLink ? (
            <>
              <p>
                Le solde et les cadeaux sont conservés. L’ancien lien ne fonctionne plus. Demandez
                au client de scanner ce QR et d’enregistrer sa nouvelle carte.
              </p>
              <QR value={recoveryLink} label="Nouveau lien privé à remettre uniquement au client" />
              <a className="loy-link" href={recoveryLink} target="_blank" rel="noreferrer">
                Ouvrir son nouveau lien
              </a>
              <button
                className="loy-secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(recoveryLink);
                    setNotice('Lien copié. Remettez-le uniquement à ce client.');
                  } catch {
                    setError('Copie impossible. Utilisez le QR.');
                  }
                }}
              >
                Copier son lien privé
              </button>
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
                  setRecoveryLink(cardLink(key));
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                Pour <strong>{selected.name}</strong>. Faites dire son numéro au client, sans le lui
                souffler, pour distinguer les homonymes.
              </p>
              <label>
                Les 4 derniers chiffres de son téléphone
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
                <span>Le client est présent et j’ai vérifié son identité et son numéro.</span>
              </label>
              <p className="loy-field-help">
                L’ancien lien personnel sera désactivé. Les tampons, les cadeaux et le code de
                caisse sont conservés.
              </p>
              <button className="loy-button" disabled={busy}>
                Créer son nouveau lien
              </button>
            </form>
          )}
          {error && (
            <p className="loy-alert" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
      {modal === 'erase' && selected && (
        <Modal title="Supprimer définitivement sa carte ?" onClose={() => setModal(null)}>
          <p>
            À la demande du client, cette action efface son nom, son téléphone, ses tampons, ses
            cadeaux et son historique. Elle ne peut pas être annulée.
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
              Recopiez {selected.code} pour confirmer
              <input name="confirm" required pattern={selected.code} autoComplete="off" />
            </label>
            <button className="loy-danger" disabled={busy}>
              Effacer définitivement
            </button>
          </form>
          {error && (
            <p className="loy-alert" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
