import { useEffect, useState, type CSSProperties } from 'react';
import { validTVLoyaltyUrl, type TVLoyaltySettings } from './tvLoyalty';
export function TVLoyalty({ settings }: { settings: TVLoyaltySettings }) {
  const [qr, setQr] = useState('');
  const url =
    (validTVLoyaltyUrl(settings.url) ? settings.url : '') ||
    new URL('/fidelite', window.location.origin).href;
  useEffect(() => {
    let active = true;
    setQr('');
    import('qrcode')
      .then((q) =>
        q.toDataURL(url, {
          width: 600,
          margin: 4,
          errorCorrectionLevel: 'M',
          color: { dark: settings.qrColor, light: '#ffffff' },
        }),
      )
      .then((value) => {
        if (active) setQr(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [url, settings.qrColor]);
  if (!settings.enabled) return null;
  return (
    <a
      className="tv-loyalty"
      data-qr-side={settings.qrSide}
      style={
        {
          background: settings.background,
          color: settings.textColor,
          borderColor: settings.borderColor,
          '--qr-scale': settings.qrScale / 100,
          '--text-scale': settings.textScale / 100,
        } as CSSProperties
      }
      href={url}
      aria-label="S’inscrire à la carte de fidélité Blanco"
    >
      {settings.qrVisible &&
        (qr ? (
          <img src={qr} alt="QR d’inscription à la carte de fidélité Blanco" />
        ) : (
          <span className="tv-qr-placeholder" />
        ))}
      <div>
        <span className="tv-loyalty-eyebrow">{settings.eyebrow}</span>
        <strong>{settings.title}</strong>
        <p>{settings.description}</p>
        <small>{settings.footnote}</small>
      </div>
    </a>
  );
}
