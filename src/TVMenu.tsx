import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Maximize, Minimize, Settings2, X } from 'lucide-react';
import originalSvg from './data/original-menu.svg?raw';
import { initialMenu, originalPrice } from './lib';
import { useMenu } from './store';
import { Promotion } from './components';
import TVAtmosphere from './HolidayEffect';
import type { MenuState, Settings } from './types';

export function renderTvSvg(menu: MenuState) {
  const document = new DOMParser().parseFromString(originalSvg, 'image/svg+xml');
  const setText = (node: Element, text: string) => {
    const span = node.querySelector('tspan');
    if (!span) return;
    span.textContent = text;
    span.setAttribute('x', (span.getAttribute('x') || '0').split(' ')[0]);
  };
  for (const category of initialMenu.categories) {
    const current = menu.categories.find((c) => c.id === category.id);
    const heading = document.querySelector(`[data-category="${category.id}"]`);
    if (!current) {
      heading?.remove();
      for (const p of initialMenu.products.filter((p) => p.categoryId === category.id))
        document.querySelectorAll(`[data-product="${p.id}"]`).forEach((n) => n.remove());
      continue;
    }
    if (heading && current.name !== category.name) setText(heading, current.name);
    const originals = initialMenu.products
      .filter((p) => p.categoryId === category.id)
      .sort((a, b) => a.order - b.order);
    const rows = menu.products
      .filter((p) => p.categoryId === category.id && p.available)
      .sort((a, b) => a.order - b.order);
    // Preserve original typography and positions exactly until this section changes structurally.
    const sameStructure =
      rows.length === originals.length && rows.every((p, i) => p.id === originals[i].id);
    if (sameStructure) {
      for (const p of rows)
        for (const field of ['name', 'price'] as const) {
          const node = document.querySelector(`[data-product="${p.id}"][data-field="${field}"]`);
          const value = field === 'name' ? p.name : originalPrice(p.priceCents);
          if (node && node.getAttribute('data-original') !== value) setText(node, value);
        }
      continue;
    }
    const templates = ['name', 'price'].map(
      (field) =>
        document
          .querySelector(`[data-product="${originals[0].id}"][data-field="${field}"]`)
          ?.cloneNode(true) as Element,
    );
    const baseline = (id: string) => {
      const n = document.querySelector(`[data-product="${id}"][data-field="name"]`)!;
      const t = n.querySelector('tspan')!;
      const matrix = (n.getAttribute('transform')!.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g) || []).map(
        Number,
      );
      return {
        x: matrix[4],
        y: matrix[3] * Number(t.getAttribute('y')) + matrix[5],
        size: matrix[0] * Number(n.getAttribute('font-size')),
      };
    };
    const first = baseline(originals[0].id),
      last = baseline(originals.at(-1)!.id);
    const nameTransform = templates[1]
      .getAttribute('transform')!
      .match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g)!
      .map(Number);
    const priceX = nameTransform[4] + 38;
    const container = document.querySelector(`[data-product="${originals[0].id}"]`)!.parentElement!;
    for (const p of originals)
      document.querySelectorAll(`[data-product="${p.id}"]`).forEach((n) => n.remove());
    const step = Math.min(20.26, (last.y - first.y + 20.26) / Math.max(rows.length, 1));
    rows.forEach((p, i) =>
      templates.forEach((template, j) => {
        const node = template.cloneNode(true) as Element;
        const span = node.querySelector('tspan')!;
        node.removeAttribute('data-product');
        node.setAttribute(
          'transform',
          `matrix(1 0 0 1 ${j === 0 ? first.x : priceX} ${first.y + i * step})`,
        );
        node.setAttribute('font-size', String(Math.min(first.size, step * 0.78)));
        span.setAttribute('x', '0');
        span.setAttribute('y', '0');
        if (j === 1) node.setAttribute('text-anchor', 'end');
        span.textContent = j === 0 ? p.name : originalPrice(p.priceCents);
        container.appendChild(node);
      }),
    );
  }
  return new XMLSerializer().serializeToString(document.documentElement);
}
export default function TVMenu() {
  const { menu } = useMenu();
  const container = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [controls, setControls] = useState(true);
  const [panel, setPanel] = useState(false);
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [device, setDevice] = useState<Partial<Pick<Settings, 'tvOrientation' | 'tvRotation'>>>(
    () => {
      try {
        const data = JSON.parse(localStorage.getItem('blanco-tv-device-v1') || '{}');
        return {
          ...(['portrait', 'landscape'].includes(data.tvOrientation)
            ? { tvOrientation: data.tvOrientation }
            : {}),
          ...([0, 90, 180, 270].includes(data.tvRotation) ? { tvRotation: data.tvRotation } : {}),
        };
      } catch {
        return {};
      }
    },
  );
  const orientation = device.tvOrientation || menu.settings.tvOrientation;
  const rotation = device.tvRotation ?? menu.settings.tvRotation;
  const ratio = orientation === 'portrait' ? 9 / 16 : 16 / 9;
  const rotated = rotation === 90 || rotation === 270;
  const availableWidth = rotated ? viewport.height : viewport.width;
  const availableHeight = rotated ? viewport.width : viewport.height;
  const width = Math.min(availableWidth, availableHeight * ratio);
  const height = width / ratio;
  const deviceChange = (value: Partial<Pick<Settings, 'tvOrientation' | 'tvRotation'>>) => {
    const next = { ...device, ...value };
    setDevice(next);
    try {
      localStorage.setItem('blanco-tv-device-v1', JSON.stringify(next));
    } catch {
      /* Device overrides work for this session. */
    }
  };
  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    if (!controls || panel) return;
    const timeout = setTimeout(() => setControls(false), 5000);
    return () => clearTimeout(timeout);
  }, [controls, panel]);
  const svg = useMemo(() => renderTvSvg(menu), [menu]);
  useEffect(() => {
    document.documentElement.classList.add('tv-document');
    const change = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', change);
    let lock: WakeLockSentinel | undefined;
    const wake = async () => {
      if (document.visibilityState === 'visible' && 'wakeLock' in navigator)
        try {
          lock = await navigator.wakeLock.request('screen');
        } catch {
          /* Google TV can manage wake locks itself. */
        }
    };
    void wake();
    document.addEventListener('visibilitychange', wake);
    return () => {
      document.documentElement.classList.remove('tv-document');
      document.removeEventListener('fullscreenchange', change);
      document.removeEventListener('visibilitychange', wake);
      void lock?.release();
    };
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await container.current?.requestFullscreen();
    } catch {
      setControls(true);
    }
  };
  return (
    <div
      ref={container}
      className="tv-screen"
      style={
        {
          background: menu.settings.tvBackground,
          '--accent': menu.settings.accent,
        } as CSSProperties
      }
      onPointerMove={() => setControls(true)}
      onKeyDown={(e) => {
        setControls(true);
        if (e.target === e.currentTarget && e.key === 'Enter') setPanel(true);
      }}
      tabIndex={0}
      aria-label="Menu Blanco pour télévision"
    >
      <div
        className={`tv-stage ${orientation}`}
        data-orientation={orientation}
        data-rotation={rotation}
        style={{ width, height, transform: `translate(-50%,-50%) rotate(${rotation}deg)` }}
      >
        <div
          className="tv-artwork"
          style={{ transform: `scale(${menu.settings.tvScale})` }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <TVAtmosphere settings={menu.settings} />
        <Promotion products={menu.products} settings={menu.settings} />
      </div>
      <div
        className={`tv-controls ${controls || panel ? 'visible' : ''}`}
        onFocus={() => setControls(true)}
      >
        <button onClick={() => setPanel(!panel)} aria-label="إعدادات الشاشة / Réglages de l’écran">
          <Settings2 />
        </button>
        <button onClick={() => void toggleFullscreen()} aria-label="Plein écran">
          {fullscreen ? <Minimize /> : <Maximize />}
        </button>
      </div>
      {panel && (
        <section
          className="tv-settings"
          dir="rtl"
          role="dialog"
          aria-label="إعدادات الشاشة / Réglages de l’écran"
        >
          <header>
            <h2>إعدادات الشاشة · Écran</h2>
            <button
              className="icon-button"
              onClick={() => setPanel(false)}
              aria-label="إغلاق / Fermer"
            >
              <X />
            </button>
          </header>
          <label>
            اتجاه الشاشة / Orientation
            <select
              value={orientation}
              onChange={(e) =>
                deviceChange({ tvOrientation: e.target.value as Settings['tvOrientation'] })
              }
            >
              <option value="portrait">عمودي / Vertical</option>
              <option value="landscape">أفقي / Horizontal</option>
            </select>
          </label>
          <label>
            تدوير / Rotation
            <select
              value={rotation}
              onChange={(e) =>
                deviceChange({ tvRotation: Number(e.target.value) as Settings['tvRotation'] })
              }
            >
              {[0, 90, 180, 270].map((n) => (
                <option key={n} value={n}>
                  {n}°
                </option>
              ))}
            </select>
          </label>
          <p>
            هالإعدادات لهالشاشة فقط.
            <br />
            Ces réglages concernent cet écran uniquement.
          </p>
          {menu.settings.season === 'weather' && (
            <a
              className="weather-credit"
              href="https://www.met.no/en"
              target="_blank"
              rel="noreferrer"
            >
              Météo : MET Norway · CC BY 4.0
            </a>
          )}
          <button
            className="button"
            onClick={() => {
              setDevice({});
              try {
                localStorage.removeItem('blanco-tv-device-v1');
              } catch {
                /* Optional storage. */
              }
            }}
          >
            إعدادات لوحة التحكم / Réglages par défaut
          </button>
          <button className="button dark" onClick={() => setPanel(false)}>
            تم / Terminé
          </button>
        </section>
      )}
    </div>
  );
}
