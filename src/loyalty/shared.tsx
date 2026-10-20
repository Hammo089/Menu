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
      {src ? <img src={src} alt={label} /> : <p>Préparation du QR…</p>}
      {download && src && (
        <a className="loy-link" href={src} download="blanco-fidelite-qr.png">
          Télécharger le QR
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
        <button className="loy-icon-button" aria-label="Fermer" onClick={onClose}>
          <X />
        </button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
export function StampCard({ member }: { member: Member }) {
  return (
    <section className="loy-stamp-card">
      <div className="loy-card-top">
        <span>BLANCO CLUB</span>
        <Coffee size={23} />
      </div>
      <h2>
        Bonjour {member.name.split(' ')[0]}
        <span>Votre prochaine pause se prépare.</span>
      </h2>
      <div
        className="loy-stamps"
        aria-label={`${member.stamps} tampons sur ${member.goal}`}
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
          {member.goal - member.stamps} pause{member.goal - member.stamps > 1 ? 's' : ''} avant
          votre cadeau
        </span>
      </div>
    </section>
  );
}
export function Rules({ program }: { program: Program }) {
  return (
    <div className="loy-rules">
      <h3>Une habitude qui fait plaisir.</h3>
      <p>
        {program.goal} boissons payées en {program.window_days} jours à partir du premier tampon ={' '}
        <strong>{program.reward_label.toLowerCase()}</strong>.
      </p>
      <p>
        {rewardDescription({
          kind: program.reward_kind,
          value: program.reward_value,
          maxPriceCents: program.max_price_cents,
        })}
        . Cadeau valable {program.reward_days} jours à partir de son obtention, utilisable{' '}
        {program.next_day ? 'dès le lendemain (heure de Grenoble)' : 'immédiatement'}. Après le
        cadeau, une nouvelle carte commence au prochain tampon.
      </p>
      <p>{program.eligible_text}</p>
      <p>
        Carte personnelle. Les tampons expirés ne sont pas reportés. Les règles d’une carte
        commencée restent identiques jusqu’à sa fin.
      </p>
    </div>
  );
}
export function History({ member }: { member: Member }) {
  return (
    <details className="loy-history">
      <summary>
        Mes dernières visites <span>{member.totalStamps} boissons au total</span>
      </summary>
      {member.history.length ? (
        <ul>
          {member.history.map((e) => (
            <li key={e.id}>
              <span>
                {e.kind === 'stamp'
                  ? `+${e.delta} tampon${e.delta > 1 ? 's' : ''}`
                  : e.kind === 'redeem'
                    ? 'Cadeau utilisé'
                    : e.kind === 'recover'
                      ? 'Accès à la carte renouvelé'
                      : 'Opération annulée'}
              </span>
              <time>{date(e.at)}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p>La première pause vous attend ☕</p>
      )}
    </details>
  );
}
