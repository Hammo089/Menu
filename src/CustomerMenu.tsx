import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowUpRight, Coffee, MapPin, Search, X } from 'lucide-react';
import { useMenu } from './store';
import { formatPrice } from './lib';
import { BrandMark, ProductImage } from './components';
import type { Product } from './types';

export default function CustomerMenu() {
  const { menu } = useMenu();
  const { products, categories, settings } = menu;
  const [active, setActive] = useState('all');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<Product | null>(null);
  const orderedCategories = [...categories].sort((a, b) => a.order - b.order);
  const visible = useMemo(
    () =>
      products
        .filter(
          (p) =>
            p.available &&
            (active === 'all' || p.categoryId === active) &&
            p.name.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')),
        )
        .sort((a, b) => a.order - b.order),
    [products, active, query],
  );
  const featured =
    products.find((p) => p.available && settings.promotionIds.includes(p.id)) ||
    products.find((p) => p.available);
  return (
    <main
      className="customer"
      style={
        {
          '--accent': settings.accent,
          '--paper': settings.background,
          '--ink': settings.textColor,
        } as CSSProperties
      }
    >
      <header className="customer-header">
        <a href="/" aria-label="Blanco — accueil">
          <BrandMark name={settings.brandName} tagline={settings.tagline} />
        </a>
        <span className="location">
          <MapPin size={14} /> Grenoble, France
        </span>
        <a className="header-menu-link" href="#carte">
          Notre carte <ArrowUpRight size={15} />
        </a>
        <a className="header-menu-link" href="/fidelite">
          Blanco Club
        </a>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="little-dot" /> VOTRE PAUSE, TOUT SIMPLEMENT.
          </span>
          <h1>
            Un café.
            <br />
            Un instant.
            <br />
            <em>Blanco.</em>
          </h1>
          <p>
            Du premier espresso à la dernière gorgée.
            <br />
            Trouvez votre petit plaisir du jour.
          </p>
          <a className="button dark" href="#carte">
            Explorer la carte <ArrowDown size={17} />
          </a>
          <span className="hero-footnote">CAFÉ · MATCHA · PETITES FAIMS</span>
        </div>
        <div className="hero-photo">
          <img
            src="/images/hero.jpg"
            alt="Un café servi dans une tasse, photographie d’illustration"
          />
          <div className="photo-stamp">
            COFFEE
            <br />
            <em>& more.</em>
            <span>BLANCO · GRENOBLE</span>
          </div>
          <span className="photo-caption">LES PETITS MOMENTS FONT LES BELLES JOURNÉES.</span>
        </div>
      </section>
      <div className="brand-ribbon">
        <span>Un peu de douceur</span>
        <Coffee size={20} />
        <span>Beaucoup de caractère</span>
        <Coffee size={20} />
        <span>À savourer chez Blanco</span>
        <Coffee size={20} />
      </div>
      <section id="carte" className="menu-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FAITES COMME CHEZ VOUS</span>
            <h2>
              À chaque envie,
              <br />
              <em>son petit bonheur.</em>
            </h2>
          </div>
          <label className="search-box">
            <Search size={18} />
            <input
              aria-label="Rechercher un produit"
              placeholder="Un café, un matcha…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="icon-button"
                aria-label="Effacer la recherche"
                onClick={() => setQuery('')}
              >
                <X size={16} />
              </button>
            )}
          </label>
        </div>
        <nav className="category-tabs" aria-label="Catégories">
          <button
            className={active === 'all' ? 'selected' : ''}
            aria-pressed={active === 'all'}
            onClick={() => setActive('all')}
          >
            Toute la carte <span>{products.filter((p) => p.available).length}</span>
          </button>
          {orderedCategories.map((c) => (
            <button
              key={c.id}
              className={active === c.id ? 'selected' : ''}
              aria-pressed={active === c.id}
              onClick={() => setActive(c.id)}
            >
              {c.name.toLocaleLowerCase('fr')}
            </button>
          ))}
        </nav>
        {!query && active === 'all' && featured && (
          <button className="featured-product" onClick={() => setDetail(featured)}>
            <ProductImage product={featured} />
            <div>
              <span className="eyebrow">LA TOUCHE BLANCO</span>
              <h3>{featured.name.replaceAll('*', '')}</h3>
              <p>Une pause à votre image.</p>
              <strong>{formatPrice(featured.priceCents)}</strong>
            </div>
            <span className="round-arrow">
              <ArrowUpRight />
            </span>
          </button>
        )}
        {orderedCategories
          .filter((c) => visible.some((p) => p.categoryId === c.id))
          .map((c) => (
            <section className="product-category" key={c.id}>
              <div className="category-heading">
                <h3>{c.name}</h3>
                <span>
                  {visible
                    .filter((p) => p.categoryId === c.id)
                    .length.toString()
                    .padStart(2, '0')}
                </span>
              </div>
              <div className="product-grid">
                {visible
                  .filter((p) => p.categoryId === c.id)
                  .map((p) => (
                    <button className="product-card" key={p.id} onClick={() => setDetail(p)}>
                      <div className="product-photo">
                        <ProductImage product={p} />
                        <span className="product-more">
                          <ArrowUpRight size={17} />
                        </span>
                      </div>
                      <div className="product-info">
                        <h4>{p.name}</h4>
                        <span>{formatPrice(p.priceCents)}</span>
                      </div>
                    </button>
                  ))}
              </div>
            </section>
          ))}
        {visible.length === 0 && (
          <div className="empty-state">
            <Coffee />
            <h3>Aucun résultat pour « {query} »</h3>
            <button
              className="button"
              onClick={() => {
                setQuery('');
                setActive('all');
              }}
            >
              Voir toute la carte
            </button>
          </div>
        )}
        <p className="menu-note">
          Photos d’illustration. Pour les allergènes et les options disponibles, demandez à notre
          équipe. Les suppléments sont indiqués dans la carte.
        </p>
      </section>
      <footer className="customer-footer">
        <a href="/" aria-label="Blanco — accueil">
          <BrandMark name={settings.brandName} tagline={settings.tagline} />
        </a>
        <p>
          Votre prochaine bonne habitude.
          <br />
          <span>Grenoble, France · Prix en euros</span>
        </p>
        <a href="/admin">
          Espace privé <ArrowUpRight size={14} />
        </a>
      </footer>
      {detail && (
        <div className="detail-backdrop" onClick={() => setDetail(null)}>
          <article
            className="product-detail"
            role="dialog"
            aria-modal="true"
            aria-label={detail.name}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setDetail(null);
            }}
          >
            <button
              autoFocus
              className="icon-button detail-close"
              aria-label="Fermer"
              onClick={() => setDetail(null)}
            >
              <X />
            </button>
            <ProductImage product={detail} />
            <div>
              <span className="eyebrow">
                {categories.find((c) => c.id === detail.categoryId)?.name}
              </span>
              <h2>{detail.name}</h2>
              <strong>{formatPrice(detail.priceCents)}</strong>
              <p>Notre équipe vous renseigne sur les ingrédients, les allergènes et les options.</p>
              <button className="button dark" onClick={() => setDetail(null)}>
                Retour à la carte
              </button>
            </div>
          </article>
        </div>
      )}
    </main>
  );
}
