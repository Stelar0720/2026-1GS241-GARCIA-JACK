import { Link, useParams } from "react-router-dom";
import { Product } from "@/lib/catalog";
import { getProductExtra } from "@/lib/content";
import { Stars } from "@/components/home-sections";

type ProductDetailProps = {
  products: Product[];
  loadingProducts: boolean;
  cartLines: { product: Product; quantity: number }[];
  addToCart: (product: Product) => void;
  viewCart: () => void;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-PA", { style: "currency", currency: "USD" }).format(value);
}

export function ProductDetailPage({
  products,
  loadingProducts,
  cartLines,
  addToCart,
  viewCart,
}: ProductDetailProps) {
  const { id } = useParams<{ id: string }>();
  const product = products.find((item) => item.id === id);

  if (loadingProducts && !product) {
    return (
      <main className="container detail-page">
        <p className="loading-text">Cargando producto...</p>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="container detail-page">
        <section className="panel glass stack" style={{ maxWidth: "620px" }}>
          <h1 className="section-title">Producto no encontrado</h1>
          <p className="meta">El kit que buscas no existe o ya no está disponible.</p>
          <Link className="button button-primary" to="/#catalogo">
            Volver al catálogo
          </Link>
        </section>
      </main>
    );
  }

  const extra = getProductExtra(product);
  const inCart = cartLines.some((line) => line.product.id === product.id);
  const related = products.filter((item) => item.id !== product.id && item.active === 1).slice(0, 3);

  return (
    <main className="detail-page">
      <div className="container">
        <nav className="breadcrumb" aria-label="Ruta de navegación">
          <Link to="/">Inicio</Link>
          <span aria-hidden="true">/</span>
          <Link to="/#catalogo">Catálogo</Link>
          <span aria-hidden="true">/</span>
          <strong>{product.name}</strong>
        </nav>

        <section className="detail-grid">
          <div className="detail-media glass">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} />
            ) : (
              <div className="detail-media-fallback" aria-hidden="true">
                🌿
              </div>
            )}
          </div>

          <div className="detail-info glass">
            <div className="detail-pills">
              {product.tag ? <span className="pill">{product.tag}</span> : null}
              <span className="pill">Nivel: {extra.level}</span>
            </div>
            <h1>{product.name}</h1>
            <p className="meta">{product.description}</p>
            <p className="detail-price">{formatMoney(product.priceUsd)}</p>
            <span className={`stock-pill ${product.stock <= 0 ? "stock-empty" : ""}`}>
              {product.stock <= 0 ? "Sin stock" : `${product.stock} disponibles`}
            </span>

            <dl className="spec-grid">
              <div>
                <dt>Luz necesaria</dt>
                <dd>{extra.light}</dd>
              </div>
              <div>
                <dt>Espacio mínimo</dt>
                <dd>{extra.space}</dd>
              </div>
              <div>
                <dt>Primera cosecha</dt>
                <dd>{extra.harvest}</dd>
              </div>
              <div>
                <dt>Rendimiento</dt>
                <dd>{extra.cycles}</dd>
              </div>
            </dl>

            <div className="cta-row">
              <button
                className="button button-primary"
                type="button"
                disabled={product.stock <= 0}
                onClick={() => (inCart ? viewCart() : addToCart(product))}
              >
                {product.stock <= 0 ? "Sin stock" : inCart ? "Ver en carrito" : "Agregar al carrito"}
              </button>
              <Link className="button button-outline" to="/#catalogo">
                Seguir explorando
              </Link>
            </div>
            <p className="detail-guarantee">✓ Garantía de germinación 30 días · ✓ Envío 24–48 h</p>
          </div>
        </section>

        <section className="detail-columns">
          <article className="panel glass stack">
            <h2 className="compact-title">Qué incluye la caja</h2>
            <ul className="includes-list">
              {extra.includes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="panel glass stack">
            <h2 className="compact-title">Así se cultiva</h2>
            <ol className="detail-steps">
              {extra.steps.map((step, index) => (
                <li key={step.title}>
                  <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p className="meta">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </article>
        </section>

        <section className="detail-testimonial glass">
          <Stars rating={5} />
          <blockquote>“{extra.testimonial.text}”</blockquote>
          <p className="meta">— {extra.testimonial.name}</p>
        </section>

        {related.length > 0 ? (
          <section className="related">
            <h2 className="section-title">También te puede servir</h2>
            <div className="related-grid">
              {related.map((item) => (
                <Link className="related-card glass" to={`/producto/${item.id}`} key={item.id}>
                  {item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : null}
                  <div>
                    <h3>{item.name}</h3>
                    <p className="price">{formatMoney(item.priceUsd)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
