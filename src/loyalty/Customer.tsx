import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Coffee,
  Download,
  Gift,
  QrCode,
  RefreshCw,
  Share2,
  Smartphone,
} from 'lucide-react';
import {
  CARD_KEY,
  CACHE_KEY,
  cardLink,
  date,
  makeKey,
  rpc,
  scanLink,
  storageGet,
  storageSet,
  validKey,
  rewardDescription,
  type Member,
  type Program,
  type Reward,
} from './lib';
import { History, Modal, QR, Rules, StampCard } from './shared';
import './loyalty.css';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
function initialKey() {
  const fromURL = new URLSearchParams(location.hash.slice(1)).get('cle');
  if (validKey(fromURL)) return fromURL;
  const saved = storageGet(CARD_KEY);
  return validKey(saved) ? saved : null;
}
function initialCard(key: string | null): Member | null {
  try {
    const cached = JSON.parse(storageGet(CACHE_KEY) || 'null');
    return key && cached?.key === key ? cached.member : null;
  } catch {
    return null;
  }
}
function PinFields({ confirm = false }: { confirm?: boolean }) {
  return (
    <>
      <label>
        Votre PIN (6 chiffres)
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          autoComplete={confirm ? 'new-password' : 'current-password'}
          required
        />
      </label>
      {confirm && (
        <label>
          Confirmez votre PIN
          <input
            name="pinConfirm"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            autoComplete="new-password"
            required
          />
        </label>
      )}
    </>
  );
}
const goodPin = (pin: string) =>
  /^[0-9]{6}$/.test(pin) && !/^([0-9])\1{5}$/.test(pin) && !['123456', '654321'].includes(pin);
export default function CustomerLoyalty() {
  const [key, setKey] = useState<string | null>(initialKey);
  const [member, setMember] = useState<Member | null>(() => initialCard(initialKey()));
  const [program, setProgram] = useState<Program | null>(null);
  const [setupName, setSetupName] = useState<string | null>(null);
  const [giftReward, setGiftReward] = useState<Reward | null>(null);
  const [giftCode, setGiftCode] = useState<{ code: string; expires: string } | null>(null);
  const [giftError, setGiftError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [entryMode, setEntryMode] = useState<'register' | 'login'>(() =>
    new URLSearchParams(location.search).get('connexion') === '1' ? 'login' : 'register',
  );
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [offline, setOffline] = useState(true),
    [savedAt, setSavedAt] = useState('');
  const [modal, setModal] = useState<'qr' | 'save' | 'forget' | 'reward' | null>(null),
    [notice, setNotice] = useState('');
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const registrationKey = useRef(makeKey());
  const consentPage = location.pathname.endsWith('/confidentialite');
  const mounted = useRef(true);
  const activeKey = useRef(key);
  activeKey.current = key;
  useEffect(() => {
    const change = () => {
      const incoming = new URLSearchParams(location.hash.slice(1)).get('cle');
      if (!validKey(incoming) || incoming === activeKey.current) return;
      setMember(initialCard(incoming));
      setSetupName(null);
      setOffline(true);
      setSavedAt('');
      setNotice('');
      setError('');
      setModal(null);
      setLoading(true);
      setKey(incoming);
    };
    addEventListener('hashchange', change);
    return () => removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    storageSet('blanco-loyalty-key-v1', null);
    storageSet('blanco-loyalty-cache-v1', null);
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const result = await rpc(key ? 'card' : 'program', key ? { key } : {});
        if (!mounted.current || activeKey.current !== key) return;
        setProgram(result.program);
        setError('');
        setOffline(false);
        setSavedAt(new Date().toISOString());
        if (result.setupRequired) {
          setSetupName(result.setupName || '');
          setMember(null);
          storageSet(CACHE_KEY, null);
          return;
        }
        setSetupName(null);
        if (key && result.member) {
          setMember(result.member);
          storageSet(CACHE_KEY, JSON.stringify({ key, member: result.member }));
          storageSet(CARD_KEY, key);
        }
      } catch (e) {
        if (mounted.current && activeKey.current === key) {
          setOffline(true);
          if ((e as Error & { definitive?: boolean }).definitive) {
            setMember(null);
            setSetupName(null);
            storageSet(CACHE_KEY, null);
          }
          if (!silent) setError((e as Error).message);
        }
      } finally {
        if (mounted.current && activeKey.current === key) setLoading(false);
      }
    },
    [key],
  );
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(true), 30000);
    const focus = () => void refresh(true);
    addEventListener('focus', focus);
    addEventListener('online', focus);
    const off = () => setOffline(true);
    addEventListener('offline', off);
    return () => {
      clearInterval(timer);
      removeEventListener('focus', focus);
      removeEventListener('online', focus);
      removeEventListener('offline', off);
    };
  }, [refresh]);
  useEffect(() => {
    document.documentElement.lang = 'fr';
    document.title = 'Blanco Club — Ma carte fidélité';
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = '/loyalty.webmanifest';
    document.head.append(manifest);
    const icon = document.createElement('link');
    icon.rel = 'apple-touch-icon';
    icon.href = '/loyalty-icons/apple-touch-icon.png';
    document.head.append(icon);
    const meta = document.createElement('meta');
    meta.name = 'apple-mobile-web-app-capable';
    meta.content = 'yes';
    document.head.append(meta);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    addEventListener('beforeinstallprompt', prompt);
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker
        .register('/loyalty-sw.js', { scope: '/fidelite' })
        .catch(() => {});
    return () => {
      manifest.remove();
      icon.remove();
      meta.remove();
      removeEventListener('beforeinstallprompt', prompt);
    };
  }, []);
  useEffect(() => {
    if (!key) return;
    history.replaceState(null, '', `${location.pathname}#cle=${key}`);
    // The manifest receives the private start URL through an HttpOnly cookie, never a query parameter.
    let active = true;
    const controller = new AbortController();
    void fetch('/api/loyalty-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
      signal: controller.signal,
    })
      .then((r) => {
        if (r.ok && active) {
          const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
          if (link) link.href = `/api/loyalty-manifest?v=${Date.now()}`;
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      controller.abort();
    };
  }, [key]);
  async function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const pin = String(form.get('pin') || '');
      if (entryMode === 'register' && (!goodPin(pin) || pin !== form.get('pinConfirm')))
        throw new Error(
          'Choisissez un PIN personnel de 6 chiffres et confirmez-le à l’identique, sans suite évidente.',
        );
      const result = await rpc(entryMode === 'login' ? 'login' : 'register', {
        key: registrationKey.current,
        name: form.get('name'),
        phone: form.get('phone'),
        pin,
        consent: form.get('consent') === 'on',
        website: form.get('website'),
      });
      storageSet(CARD_KEY, registrationKey.current);
      storageSet(
        CACHE_KEY,
        JSON.stringify({ key: registrationKey.current, member: result.member }),
      );
      setMember(result.member);
      setProgram(result.program);
      setKey(registrationKey.current);
      setOffline(false);
      setNotice(
        entryMode === 'login'
          ? 'Heureux de vous retrouver ! Vos tampons et vos cadeaux sont toujours là.'
          : 'Bienvenue au club ! Enregistrez votre carte pour la retrouver facilement.',
      );
      if (entryMode === 'register') setModal('save');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function activate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !key) return;
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    const pin = String(form.get('pin') || '');
    try {
      if (!goodPin(pin) || pin !== form.get('pinConfirm'))
        throw new Error(
          'Choisissez un PIN personnel de 6 chiffres et confirmez-le à l’identique, sans suite évidente.',
        );
      let result;
      try {
        result = await rpc('activate', { key, deviceKey: registrationKey.current, pin });
      } catch (original) {
        try {
          result = await rpc('card', { key: registrationKey.current });
        } catch {
          throw original;
        }
      }
      storageSet(CARD_KEY, registrationKey.current);
      storageSet(
        CACHE_KEY,
        JSON.stringify({ key: registrationKey.current, member: result.member }),
      );
      setMember(result.member);
      setProgram(result.program);
      setSetupName(null);
      setKey(registrationKey.current);
      setOffline(false);
      setNotice(
        'Votre PIN est enregistré. Retrouvez ici vos tampons, vos boissons comptabilisées et vos cadeaux.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function showLogin() {
    storageSet(CARD_KEY, null);
    storageSet(CACHE_KEY, null);
    setKey(null);
    setMember(null);
    setSetupName(null);
    setEntryMode('login');
    setError('');
    setNotice('');
    setModal(null);
    history.replaceState(null, '', '/fidelite');
    void fetch('/api/loyalty-session', { method: 'DELETE' }).catch(() => {});
  }
  async function copyLink() {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(cardLink(key));
      setNotice('Lien privé copié. Gardez-le pour vous.');
    } catch {
      setNotice('Copiez l’adresse de cette page pour conserver votre carte.');
    }
  }
  function download() {
    if (!key) return;
    const file = new Blob(
      [
        `Ma carte Blanco Club\n\nLien personnel (à garder privé) :\n${cardLink(key)}\n\nCode à présenter en caisse : ${member?.code}\n`,
      ],
      { type: 'text/plain;charset=utf-8' },
    );
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ma-carte-blanco.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (signingOut)
    return (
      <div className="loading-screen">
        Blanco<span>Déconnexion…</span>
      </div>
    );
  const rules = member?.rules || program;
  return (
    <div className="loyalty-app">
      <header className="loy-header">
        <a href="/" className="loy-wordmark">
          Blanco<span>COFFEE & MORE</span>
        </a>
        <a href="/menu" className="loy-link">
          <ArrowLeft size={15} /> La carte
        </a>
      </header>
      {consentPage ? (
        <main className="loy-legal">
          <p>
            Vous pouvez rouvrir votre carte avec votre téléphone et votre PIN personnel de six
            chiffres. Gardez votre PIN secret. L’équipe ne vous demandera jamais votre PIN : pour
            utiliser un cadeau, générez sur votre téléphone un code cadeau temporaire après saisie
            de votre PIN.
          </p>
          <span className="loy-eyebrow">EN TOUTE TRANSPARENCE</span>
          <h1>
            Votre pause.
            <br />
            Vos données.
          </h1>
          <p>
            Blanco, Grenoble, utilise votre nom et votre téléphone pour gérer votre carte fidélité
            et vous aider à retrouver votre compte au comptoir. Aucun SMS publicitaire n’est envoyé.
            Le numéro n’est pas vérifié par SMS.
          </p>
          <p>
            Votre QR de caisse contient uniquement votre code de carte. Votre lien personnel permet
            de consulter votre carte : gardez-le privé. Une photo du QR ne suffit pas à utiliser un
            cadeau. Seule l’équipe autorisée peut ajouter des tampons ou utiliser un cadeau.
          </p>
          <h2>Carte perdue ou accès oublié ?</h2>
          <p>
            Si vous perdez votre carte, votre lien personnel ou ne parvenez plus à accéder à votre
            compte, contactez la direction de Blanco au comptoir. Après vérification de votre nom et
            de votre numéro de téléphone au comptoir, la direction vous remettra un lien sécurisé,
            valable 30 minutes et utilisable une seule fois, pour choisir un nouveau PIN et
            retrouver le même compte, avec vos tampons et vos cadeaux encore valables. Il n’est pas
            nécessaire de créer un nouveau compte.
          </p>
          <p>
            Vos données et votre historique sont conservés tant que votre carte existe. Demandez au
            responsable au comptoir de consulter, corriger ou supprimer vos données. La suppression
            efface votre carte, vos tampons, vos cadeaux et votre historique. Vous pouvez aussi
            saisir la CNIL (cnil.fr).
          </p>
          <p>
            Le service utilise Supabase pour les données et Vercel pour l’hébergement. Votre
            navigateur conserve votre lien et une copie de la carte pour l’affichage hors ligne. Ces
            données servent au fonctionnement de la carte, sans publicité ni suivi marketing. Vous
            pouvez les retirer de cet appareil depuis votre carte ou les réglages du navigateur.
          </p>
          {rules && <Rules program={rules} />}
          <p>
            Conditions du 20 octobre 2026. Programme gratuit, sans achat requis pour s’inscrire. Les
            tampons sont attribués au comptoir après vérification des boissons payées. Les cadeaux
            ne sont pas échangeables contre de l’argent. Aucun remboursement de tampon.
          </p>
          <a className="loy-button" href="/fidelite">
            Revenir à ma carte
          </a>
        </main>
      ) : (
        <main className={`loy-customer ${member ? 'has-card' : ''}`}>
          {!member && (
            <section className="loy-welcome">
              <span className="loy-eyebrow">
                <span /> LES HABITUÉS ONT LEURS PETITS PRIVILÈGES
              </span>
              <h1>
                Votre café.
                <br />
                Vos petits <em>bonheurs.</em>
              </h1>
              <p>{program?.title || 'Les petites habitudes récompensées.'}</p>
              <div className="loy-welcome-perks">
                <span>
                  <Coffee /> Savourez
                </span>
                <i />
                <span>
                  <QrCode /> Cumulez
                </span>
                <i />
                <span>
                  <Gift /> Profitez
                </span>
              </div>
            </section>
          )}
          <section className="loy-content">
            {error && (
              <div role="alert" className="loy-alert">
                {error}
                <button onClick={() => void refresh()}>Réessayer</button>
              </div>
            )}
            {notice && (
              <p className="loy-notice" role="status">
                <Check size={16} />
                {notice}
              </p>
            )}
            {loading && !member && !program ? (
              <div className="loy-panel">Votre pause se prépare…</div>
            ) : setupName !== null ? (
              <form className="loy-panel" onSubmit={activate}>
                <span className="loy-eyebrow">VOTRE CARTE EST RETROUVÉE</span>
                <h2>Bonjour {setupName.split(' ')[0]}.</h2>
                <p>
                  Choisissez votre nouveau PIN personnel. Vous retrouverez ensuite vos tampons, vos
                  boissons comptabilisées et vos cadeaux. Ce lien ne s’utilise qu’une fois.
                </p>
                <PinFields confirm />
                <p className="loy-field-help">
                  Évitez 123456 et les chiffres identiques. Gardez votre PIN pour vous : notre
                  équipe ne vous le demandera pas.
                </p>
                <button className="loy-button" disabled={busy}>
                  {busy ? 'Sécurisation…' : 'Enregistrer mon PIN et ouvrir ma carte'}
                </button>
              </form>
            ) : member ? (
              <>
                <div className="loy-member-heading">
                  <span className="loy-eyebrow">VOTRE CARTE, TOUJOURS AVEC VOUS</span>
                  <button
                    className="loy-icon-button"
                    aria-label="Actualiser ma carte"
                    onClick={() => void refresh()}
                    disabled={loading}
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
                {offline && (
                  <p className="loy-offline" role="status">
                    Dernière carte enregistrée — connexion nécessaire pour confirmer le solde. Votre
                    QR reste utilisable en caisse.
                  </p>
                )}
                <StampCard member={member} />
                <div className="loy-progress-note">
                  {member.cycleExpiresAt ? (
                    <>
                      À compléter avant le <strong>{date(member.cycleExpiresAt)}</strong> (heure de
                      Grenoble).
                    </>
                  ) : member.cycleExpired ? (
                    'Les précédents tampons ont expiré. Une nouvelle pause, un nouveau départ.'
                  ) : (
                    'Le délai commence à votre prochaine boisson payée.'
                  )}
                </div>
                <button className="loy-button loy-scan-button" onClick={() => setModal('qr')}>
                  <QrCode /> Présenter ma carte <ArrowRight size={18} />
                </button>
                <div className="loy-code">
                  <span>Ou donnez ce code en caisse</span>
                  <strong>{member.code}</strong>
                </div>
                <div className="loy-customer-totals">
                  <div>
                    <strong>{member.totalStamps}</strong>
                    <span>Boissons comptabilisées</span>
                  </div>
                  <div>
                    <strong>
                      {
                        member.rewards.filter((r) => r.status === 'ready' || r.status === 'soon')
                          .length
                      }
                    </strong>
                    <span>Cadeaux en réserve</span>
                  </div>
                </div>
                {member.rewards.some((r) => r.status === 'ready' || r.status === 'soon') && (
                  <section className="loy-gifts">
                    <span className="loy-eyebrow">UNE ATTENTION POUR VOUS</span>
                    {member.rewards
                      .filter((r) => r.status === 'ready' || r.status === 'soon')
                      .map((r) => (
                        <article key={r.id}>
                          <div className="loy-gift-icon">
                            <Gift />
                          </div>
                          <div>
                            <h3>{r.label}</h3>
                            <p>{rewardDescription(r)}</p>
                            <small>
                              {r.status === 'soon' ? `Dès le ${date(r.availableAt)} · ` : ''}
                              Jusqu’au {date(r.expiresAt)}
                            </small>
                            <strong>
                              {r.status === 'ready'
                                ? 'À savourer au comptoir'
                                : 'Bientôt disponible'}
                            </strong>
                            {r.status === 'ready' && (
                              <button
                                className="loy-secondary"
                                onClick={() => {
                                  setGiftReward(r);
                                  setGiftCode(null);
                                  setGiftError('');
                                  setModal('reward');
                                }}
                              >
                                Préparer mon cadeau
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                  </section>
                )}
                <button className="loy-save-button" onClick={() => setModal('save')}>
                  <Smartphone size={19} />
                  <span>
                    Votre carte en un geste<small>Ajoutez-la à votre écran d’accueil</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
                <History member={member} />
                {savedAt && (
                  <p className="loy-sync">
                    {offline ? 'Dernière vérification' : 'Carte à jour'} ·{' '}
                    {new Date(savedAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </>
            ) : key ? (
              <div className="loy-panel">
                <h2>Retrouvons votre carte.</h2>
                <p>
                  Connectez-vous avec votre téléphone et votre PIN. Pour un ancien compte sans PIN
                  ou un PIN oublié, demandez un lien sécurisé à la direction de Blanco.
                </p>
                <button className="loy-secondary" onClick={showLogin}>
                  Me connecter avec mon téléphone et mon PIN
                </button>
              </div>
            ) : (
              <form className="loy-signup loy-panel" onSubmit={register}>
                <div className="loy-entry-tabs" role="group" aria-label="Accès à ma carte">
                  <button
                    type="button"
                    className={entryMode === 'register' ? 'active' : ''}
                    onClick={() => {
                      setEntryMode('register');
                      setError('');
                    }}
                  >
                    Créer ma carte
                  </button>
                  <button
                    type="button"
                    className={entryMode === 'login' ? 'active' : ''}
                    onClick={() => {
                      setEntryMode('login');
                      setError('');
                    }}
                  >
                    J’ai déjà une carte
                  </button>
                </div>
                <span className="loy-eyebrow">BIENVENUE AU BLANCO CLUB</span>
                <h2>
                  {entryMode === 'login' ? 'Heureux de vous revoir.' : 'On fait connaissance ?'}
                </h2>
                <p>
                  {entryMode === 'login'
                    ? 'Votre téléphone et votre PIN personnel pour retrouver votre carte.'
                    : 'Deux petites infos, et votre prochaine pause compte déjà.'}
                </p>
                {entryMode === 'register' && (
                  <label>
                    Votre nom et prénom
                    <input
                      name="name"
                      autoComplete="name"
                      minLength={2}
                      maxLength={70}
                      required
                      placeholder="Camille Martin"
                    />
                  </label>
                )}
                <label>
                  Votre téléphone
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    minLength={8}
                    maxLength={24}
                    required
                    placeholder="06 12 34 56 78"
                  />
                </label>
                <PinFields key={entryMode} confirm={entryMode === 'register'} />
                <p className="loy-field-help">
                  {entryMode === 'login'
                    ? 'PIN oublié ou ancien compte sans PIN ? La direction peut vous remettre un lien sécurisé. Ne créez pas une seconde carte.'
                    : 'Gardez votre PIN secret. Pas de SMS publicitaire. Évitez les suites évidentes et les chiffres identiques.'}
                </p>
                <label className="loy-honeypot" aria-hidden="true">
                  Votre site
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
                {entryMode === 'register' && (
                  <label className="loy-checkbox">
                    <input type="checkbox" name="consent" required />
                    <span>
                      J’accepte les{' '}
                      <a href="/fidelite/confidentialite" target="_blank" rel="noreferrer">
                        conditions du programme et l’utilisation de mes données
                      </a>{' '}
                      pour gérer ma carte.
                    </span>
                  </label>
                )}
                <button
                  className="loy-button"
                  disabled={busy || (entryMode === 'register' && !program?.enabled)}
                >
                  {busy
                    ? entryMode === 'login'
                      ? 'Ouverture de votre carte…'
                      : 'Création de votre carte…'
                    : entryMode === 'login'
                      ? 'Retrouver ma carte'
                      : program && !program.enabled
                        ? 'Inscriptions en pause'
                        : 'Créer ma carte gratuite'}
                  <ArrowRight size={18} />
                </button>
                <p className="loy-field-help">
                  {entryMode === 'login'
                    ? 'Notre équipe peut vous aider au comptoir si vous avez oublié votre PIN ou changé de numéro.'
                    : 'Déjà inscrit ? Utilisez « J’ai déjà une carte » pour retrouver vos tampons.'}
                </p>
              </form>
            )}
            {rules && <Rules program={rules} />}
          </section>
        </main>
      )}
      <footer className="loy-footer">
        <span>Blanco Club · Grenoble</span>
        <a href="/fidelite/confidentialite">Conditions & confidentialité</a>
        {key && !consentPage && (
          <button onClick={() => setModal('forget')}>Me déconnecter de cet appareil</button>
        )}
      </footer>
      {modal === 'qr' && member && (
        <Modal title="À vous de jouer." onClose={() => setModal(null)}>
          <p>Présentez ce QR à notre équipe. Chaque pause compte.</p>
          <QR value={scanLink(member.code)} label="QR de ma carte à présenter en caisse" />
          <strong className="loy-big-code">{member.code}</strong>
          <p className="loy-field-help">
            Seule notre équipe peut ajouter un tampon ou utiliser un cadeau.
          </p>
        </Modal>
      )}
      {modal === 'save' && key && (
        <Modal title="Une place sur votre écran." onClose={() => setModal(null)}>
          <p>Retrouvez votre carte comme une application, gratuitement.</p>
          {install && (
            <button
              className="loy-button"
              onClick={async () => {
                await install.prompt();
                await install.userChoice;
                setInstall(null);
              }}
            >
              Ajouter à mon écran d’accueil
            </button>
          )}
          <div className="loy-install-guide">
            <h3>Sur iPhone</h3>
            <p>
              Ouvrez ce lien dans <strong>Safari</strong>, touchez <Share2 size={15} /> Partager,
              puis <strong>Sur l’écran d’accueil</strong>.
            </p>
            <h3>Sur Android</h3>
            <p>
              Dans Chrome ou Samsung Internet : menu ⋮, puis{' '}
              <strong>Ajouter à l’écran d’accueil</strong> ou{' '}
              <strong>Installer l’application</strong>.
            </p>
          </div>
          <p className="loy-field-help">
            Gardez aussi une copie de votre lien privé. Il donne accès à votre carte, sans mot de
            passe.
          </p>
          <div className="loy-actions">
            <button className="loy-secondary" onClick={() => void copyLink()}>
              Copier mon lien privé
            </button>
            <button className="loy-secondary" onClick={download}>
              <Download size={16} /> Enregistrer mon lien
            </button>
          </div>
          <button className="loy-button" onClick={() => setModal(null)}>
            C’est fait !
          </button>
        </Modal>
      )}
      {modal === 'reward' && giftReward && (
        <Modal
          title="Votre cadeau, en toute sérénité."
          onClose={() => {
            setModal(null);
            setGiftCode(null);
            setGiftError('');
          }}
        >
          {giftCode ? (
            <>
              <p>
                Donnez ce code cadeau à notre équipe. Il ne s’utilise qu’une fois pour cette
                récompense.
              </p>
              <strong className="loy-approval-code" aria-label="Code cadeau temporaire">
                {giftCode.code}
              </strong>
              <p>
                Valable jusqu’à{' '}
                {new Date(giftCode.expires).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Europe/Paris',
                })}
                , heure de Grenoble (5 minutes maximum).
              </p>
              <button className="loy-secondary" onClick={() => setGiftCode(null)}>
                Générer un nouveau code
              </button>
            </>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy || !key) return;
                setBusy(true);
                setGiftError('');
                const pin = new FormData(e.currentTarget).get('pin');
                try {
                  const result = await rpc('reward_authorize', {
                    key,
                    pin,
                    rewardId: giftReward.id,
                  });
                  if (!result.approvalCode || !result.approvalExpiresAt)
                    throw Error('Impossible de préparer ce cadeau. Réessayez.');
                  setGiftCode({ code: result.approvalCode, expires: result.approvalExpiresAt });
                } catch (e) {
                  setGiftError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                {giftReward.label}. Entrez votre PIN ici, sur votre téléphone. Ne communiquez jamais
                votre PIN à l’équipe : seul le code cadeau temporaire lui sera remis.
              </p>
              <PinFields />
              <button className="loy-button" disabled={busy}>
                {busy ? 'Préparation…' : 'Obtenir mon code cadeau'}
              </button>
            </form>
          )}
          {giftError && (
            <p className="loy-alert" role="alert">
              {giftError}
            </p>
          )}
        </Modal>
      )}
      {modal === 'forget' && (
        <Modal title="Vous déconnecter de cet appareil ?" onClose={() => setModal(null)}>
          <p>
            Votre compte, vos tampons et vos cadeaux restent chez Blanco. Pour revenir, saisissez
            simplement votre téléphone et votre PIN dans « J’ai déjà une carte ».
          </p>
          <button
            className="loy-danger"
            onClick={async () => {
              // Invalidate in-flight card reads before clearing the device. A slow
              // pre-logout response must never put its private key back in storage.
              mounted.current = false;
              setSigningOut(true);
              activeKey.current = null;
              setKey(null);
              setMember(null);
              setEntryMode('login');
              setBusy(true);
              setModal(null);
              storageSet(CARD_KEY, null);
              storageSet(CACHE_KEY, null);
              await fetch('/api/loyalty-session', {
                method: 'DELETE',
                keepalive: true,
                signal: AbortSignal.timeout(5000),
              }).catch(() => {});
              storageSet(CARD_KEY, null);
              storageSet(CACHE_KEY, null);
              location.replace('/fidelite?connexion=1');
            }}
          >
            Me déconnecter
          </button>
        </Modal>
      )}
    </div>
  );
}
