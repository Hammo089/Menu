import { useLoyaltyLanguage } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { Coffee, Gift, X } from 'lucide-react';
import { date, rewardDescription, type Member, type Program } from './lib';

export function QR({
  value,
  label = 'Code QR',
  download = false,
}: {
  value: string;
  label?: string;
  download?: boolean;
}) {
  const { t, lang } = useLoyaltyLanguage();

  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true;
    setSrc('');
    import('qrcode')
      .then((q) =>
        q.toDataURL(value, {
          width: 720,
          margin: 3,
          errorCorrectionLevel: 'M',
          color: { dark: '#183e31', light: '#ffffff' },
        }),
      )
      .then((data) => {
        if (active) setSrc(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [value]);
  return (
    <div className="loy-qr">
      {src ? <img src={src} alt={t(label)} /> : <p>{t('Préparation du QR…')}</p>}
      {download && src && (
        <a className="loy-link" href={src} download="blanco-fidelite-qr.png">
          {t('Télécharger le QR')}{' '}
        </a>
      )}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { t, lang } = useLoyaltyLanguage();

  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab') {
        const nodes = [
          ...(dialog.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select, textarea, [tabindex="0"]',
          ) || []),
        ];
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', fn);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', fn);
      document.body.style.overflow = before;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="loy-modal-bg"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="loy-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialog}
      >
        <button className="loy-icon-button" aria-label={t('Fermer')} onClick={onClose}>
          <X />
        </button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
export function StampCard({ member }: { member: Member }) {
  const { t, lang } = useLoyaltyLanguage();

  return (
    <section className="loy-stamp-card">
      <div className="loy-card-top">
        <span>BLANCO CLUB</span>
        <Coffee size={23} />
      </div>
      <h2>
        {t('Bonjour')} {member.name.split(' ')[0]}
        <span>{t('Votre prochaine pause se prépare.')}</span>
      </h2>
      <div
        className="loy-stamps"
        aria-label={t('{0} tampons sur {1}', member.stamps, member.goal)}
        style={{ '--stamp-cols': member.goal <= 6 ? 3 : 4 } as React.CSSProperties}
      >
        {Array.from({ length: member.goal }, (_, i) => (
          <span
            key={i}
            className={i < member.stamps ? 'earned' : i === member.goal - 1 ? 'gift' : ''}
            aria-hidden="true"
          >
            {i === member.goal - 1 ? (
              <Gift />
            ) : i < member.stamps ? (
              <Coffee />
            ) : (
              <span>{String(i + 1).padStart(2, '0')}</span>
            )}
          </span>
        ))}
      </div>
      <div className="loy-card-bottom">
        <strong>
          {member.stamps}
          <small> / {member.goal}</small>
        </strong>
        <span>
          {member.goal - member.stamps} {t('pause')}
          {lang === 'fr' && member.goal - member.stamps > 1 ? 's' : ''}{' '}
          {t('avant votre cadeau')}{' '}
        </span>
      </div>
    </section>
  );
}
export function Rules({ program }: { program: Program }) {
  const { t, lang } = useLoyaltyLanguage();

  return (
    <div className="loy-rules">
      <h3>{t('Une habitude qui fait plaisir.')}</h3>
      <p>
        {program.goal} {t('boissons payées en')} {program.window_days}{' '}
        {t('jours à partir du premier tampon =')}{' '}
        <strong>{program.reward_label.toLowerCase()}</strong>.
      </p>
      <p>
        {rewardDescription({
          kind: program.reward_kind,
          value: program.reward_value,
          maxPriceCents: program.max_price_cents,
        })}
        {t('. Cadeau valable')} {program.reward_days}{' '}
        {t('jours à partir de son obtention, utilisable')}{' '}
        {program.next_day ? t('dès le lendemain (heure de Grenoble)') : t('immédiatement')}
        {t('. Après le cadeau, une nouvelle carte commence au prochain tampon.')}{' '}
      </p>
      <p>{program.eligible_text}</p>
      <p>
        {t(
          'Carte personnelle. Les tampons expirés ne sont pas reportés. Les règles d’une carte commencée restent identiques jusqu’à sa fin.',
        )}{' '}
      </p>
    </div>
  );
}
export function History({ member }: { member: Member }) {
  const { t, lang } = useLoyaltyLanguage();

  return (
    <details className="loy-history">
      <summary>
        {t('Mes dernières visites')}{' '}
        <span>
          {member.totalStamps} {t('boissons au total')}
        </span>
      </summary>
      {member.history.length ? (
        <ul>
          {member.history.map((e) => (
            <li key={e.id}>
              <span>
                {e.kind === 'stamp'
                  ? t('+{0} tampon{1}', e.delta, e.delta > 1 ? 's' : '')
                  : e.kind === 'redeem'
                    ? t('Cadeau utilisé')
                    : e.kind === 'recover'
                      ? t('Accès à la carte renouvelé')
                      : t('Opération annulée')}
              </span>
              <time>{date(e.at, lang)}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p>{t('La première pause vous attend ☕')}</p>
      )}
    </details>
  );
}
