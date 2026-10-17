import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import { formatPrice, safeImage } from './lib';
import type { Product, Settings, Season } from './types';

export function BrandMark({
  name = 'Blanco',
  tagline = 'COFFEE & MORE',
}: {
  name?: string;
  tagline?: string;
}) {
  if (name === 'Blanco' && tagline === 'COFFEE & MORE')
    return (
      <span className="brand-logo">
        <img src="/brand/blanco-logo.jpg" alt="Blanco Coffee & More" />
      </span>
    );
  return (
    <span className="wordmark">
      {name}
      <span>{tagline}</span>
    </span>
  );
}

export function ProductImage({
  product,
  className = '',
}: {
  product: Product;
  className?: string;
}) {
  return (
    <img
      className={className}
      src={safeImage(product.image)}
      alt={product.name.replaceAll('*', '')}
      loading="lazy"
      onError={(e) => {
        if (!e.currentTarget.src.endsWith('/images/coffee.jpg'))
          e.currentTarget.src = '/images/coffee.jpg';
      }}
    />
  );
}
export function SeasonEffect({ season }: { season: Season }) {
  const layer = useRef<HTMLDivElement>(null);
  let actual = season;
  if (season === 'auto') {
    const month = Number(
      new Intl.DateTimeFormat('fr-FR', { month: 'numeric', timeZone: 'Europe/Paris' }).format(
        new Date(),
      ),
    );
    actual =
      month >= 9 && month <= 11
        ? 'autumn'
        : month === 12 || month <= 2
          ? 'winter'
          : month >= 6 && month <= 8
            ? 'summer'
            : 'spring';
  }
  useEffect(() => {
    const element = layer.current;
    if (!element) return;
    const measure = () =>
      element.style.setProperty('--season-travel', `${element.clientHeight + 180}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [actual]);
  if (actual === 'none') return null;
  return (
    <div ref={layer} className={`season-effect ${actual}`} aria-hidden="true">
      {actual === 'summer' ? (
        <>
          <div className="summer-sun" />
          <img className="summer-parasol" src="/effects/parasol.svg" alt="" />
        </>
      ) : (
        Array.from({ length: actual === 'winter' ? 24 : 14 }, (_, i) => (
          <span
            key={i}
            className="season-particle"
            style={
              {
                left: `${(i * 37 + 3) % 100}%`,
                animationDelay: `${i * -2.9}s`,
                animationDuration: `${20 + (i % 6) * 3}s`,
                width:
                  actual === 'winter'
                    ? `${9 + (i % 4) * 5}px`
                    : `clamp(36px, ${3.2 + (i % 3) * 0.8}vw, ${60 + (i % 3) * 12}px)`,
                '--sway': `${i % 2 ? -1 : 1}`,
                '--turn': `${i * 47}deg`,
                '--tone': `${(i % 3) * 14 - 10}deg`,
              } as CSSProperties
            }
          >
            {actual === 'winter' ? (
              <i className="snow-crystal" />
            ) : (
              <img
                src={actual === 'autumn' ? '/effects/autumn-leaf.png' : '/effects/petal.svg'}
                alt=""
              />
            )}
          </span>
        ))
      )}
    </div>
  );
}
export function Promotion({
  products,
  settings,
  preview = false,
  onClose,
}: {
  products: Product[];
  settings: Settings;
  preview?: boolean;
  onClose?: () => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const index = useRef(0);
  const eligible = products.filter((p) => p.available && settings.promotionIds.includes(p.id));
  const ids = eligible.map((p) => p.id).join(',');
  useEffect(() => {
    if (preview) {
      setActive(ids.split(',')[0] || null);
      return;
    }
    setActive(null);
    if (!settings.adsEnabled || !ids) return;
    const list = ids.split(',');
    let hide: number | undefined;
    const show = window.setInterval(() => {
      setActive(list[index.current++ % list.length]);
      hide = window.setTimeout(() => setActive(null), settings.adDurationSeconds * 1000);
    }, settings.adIntervalSeconds * 1000);
    return () => {
      clearInterval(show);
      clearTimeout(hide);
    };
  }, [ids, preview, settings.adsEnabled, settings.adDurationSeconds, settings.adIntervalSeconds]);
  const product = eligible.find((p) => p.id === active);
  if (!product) return null;
  return (
    <div
      className="promotion-backdrop"
      role={preview ? 'dialog' : undefined}
      aria-label={preview ? 'Aperçu de la publicité' : undefined}
      aria-modal={preview || undefined}
      onClick={preview ? onClose : undefined}
    >
      <article className="promotion-card" onClick={(e) => e.stopPropagation()}>
        {preview && (
          <button
            className="icon-button close-promotion"
            onClick={onClose}
            aria-label="Fermer / إغلاق"
          >
            <X />
          </button>
        )}
        <span className="eyebrow">BLANCO · {settings.promotionLabel}</span>
        <ProductImage product={product} />
        <div className="promotion-copy">
          <h2>{product.name.replaceAll('*', '')}</h2>
          <p>{settings.promotionText}</p>
          <strong>{formatPrice(product.priceCents)}</strong>
        </div>
      </article>
    </div>
  );
}
