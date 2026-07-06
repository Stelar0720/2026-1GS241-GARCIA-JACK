import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FAQS,
  FOOTER,
  HERO,
  HOW_IT_WORKS,
  MARQUEE_ITEMS,
  STATS,
  Stat,
  TESTIMONIALS,
  VALUE_PROPS,
} from "@/lib/content";

// ============================================================
// Hero
// ============================================================

export function Hero({ authAction }: { authAction?: React.ReactNode }) {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div>
          <span className="hero-badge">🌿 {HERO.badge}</span>
          <h1>{HERO.title}</h1>
          <p>{HERO.subtitle}</p>
          <div className="cta-row">
            <a className="button button-primary" href="#catalogo">
              Empezar a cultivar hoy
            </a>
            <a className="button button-outline" href="#como-funciona">
              Ver cómo funciona
            </a>
            {authAction}
          </div>
          <ul className="hero-trust" aria-label="Garantías de compra">
            {HERO.trust.map((item) => (
              <li key={item}>✓ {item}</li>
            ))}
          </ul>
        </div>
        <div className="hero-card glass">
          <div className="hero-card-head">
            <h3>¿Qué incluye cada kit?</h3>
            <span className="pill">Todo listo para sembrar</span>
          </div>
          <ul>
            <li>Semillas seleccionadas para microcultivos de ciclo corto.</li>
            <li>Macetas compactas y sustrato ligero enriquecido.</li>
            <li>Guía impresa de riego y luz para espacios pequeños.</li>
            <li>Soporte por WhatsApp durante las primeras 2 semanas.</li>
          </ul>
          <div className="hero-card-stats">
            <div>
              <strong>7 días</strong>
              <span>primer brote</span>
            </div>
            <div>
              <strong>4.8★</strong>
              <span>valoración</span>
            </div>
            <div>
              <strong>24–48 h</strong>
              <span>envío en Panamá</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Marquee de confianza
// ============================================================

export function TrustMarquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {items.map((item, index) => (
          <span key={`${item}-${index}`}>
            <em>🌱</em> {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Estadísticas con contadores animados (HU-023)
// ============================================================

function useCountUp(target: number, decimals = 0, durationMs = 1400) {
  const ref = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;

        if (reducedMotion) {
          setValue(target);
          return;
        }

        const start = performance.now();
        function tick(now: number) {
          const progress = Math.min((now - start) / durationMs, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Number((target * eased).toFixed(decimals)));
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [target, decimals, durationMs]);

  return { ref, value };
}

function StatItem({ stat }: { stat: Stat }) {
  const { ref, value } = useCountUp(stat.value, stat.decimals ?? 0);
  return (
    <div
      className="stat-item glass"
      ref={(node) => {
        ref.current = node;
      }}
    >
      <strong>
        {stat.prefix}
        {value.toLocaleString("es-PA", {
          minimumFractionDigits: stat.decimals ?? 0,
          maximumFractionDigits: stat.decimals ?? 0,
        })}
        {stat.suffix}
      </strong>
      <span>{stat.label}</span>
    </div>
  );
}

export function StatsBar() {
  return (
    <section className="stats" aria-label="UrbanSprout en números">
      <div className="container stats-grid">
        {STATS.map((stat) => (
          <StatItem key={stat.label} stat={stat} />
        ))}
      </div>
    </section>
  );
}

// ============================================================
// Propuesta de valor
// ============================================================

export function ValueProps() {
  return (
    <section className="value-props">
      <div className="container">
        <p className="section-kicker">Por qué UrbanSprout</p>
        <h2 className="section-title">Cultivar en la ciudad, sin fricción</h2>
        <div className="value-grid">
          {VALUE_PROPS.map((prop) => (
            <article className="value-card glass" key={prop.title}>
              <span className="value-icon" aria-hidden="true">
                {prop.icon}
              </span>
              <h3>{prop.title}</h3>
              <p>{prop.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Cómo funciona
// ============================================================

export function HowItWorks() {
  return (
    <section className="how-it-works" id="como-funciona">
      <div className="container">
        <p className="section-kicker">De la caja a la mesa</p>
        <h2 className="section-title">Cómo funciona</h2>
        <div className="steps-grid">
          {HOW_IT_WORKS.map((item) => (
            <article className="step-card glass" key={item.step}>
              <span className="step-number">{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Testimonios (HU-023)
// ============================================================

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" aria-label={`${rating} de 5 estrellas`}>
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}

export function Testimonials() {
  return (
    <section className="testimonials">
      <div className="container">
        <p className="section-kicker">Clientes reales</p>
        <h2 className="section-title">Lo que cosechan nuestros clientes</h2>
        <div className="testimonial-grid">
          {TESTIMONIALS.map((t) => (
            <figure className="testimonial-card glass" key={t.name}>
              <Stars rating={t.rating} />
              <blockquote>“{t.text}”</blockquote>
              <figcaption>
                <strong>{t.name}</strong>
                <span>{t.location}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FAQ en acordeón (HU-022)
// ============================================================

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="faq" id="faq">
      <div className="container faq-inner">
        <div>
          <p className="section-kicker">Dudas frecuentes</p>
          <h2 className="section-title">Preguntas antes de sembrar</h2>
          <p className="meta">
            ¿No encuentras tu respuesta? Escríbenos a {FOOTER.contact.email} o por WhatsApp al{" "}
            {FOOTER.contact.whatsapp}.
          </p>
        </div>
        <div className="faq-list">
          {FAQS.map((faq, index) => {
            const open = openIndex === index;
            return (
              <div className={`faq-item glass ${open ? "faq-open" : ""}`} key={faq.question}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenIndex(open ? null : index)}
                >
                  <span>{faq.question}</span>
                  <em aria-hidden="true">{open ? "−" : "+"}</em>
                </button>
                {open ? <p>{faq.answer}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// CTA final
// ============================================================

export function FinalCta() {
  return (
    <section className="final-cta">
      <div className="container final-cta-card glass">
        <div>
          <h2>¿Listo para tu primera cosecha?</h2>
          <p>Elige tu kit hoy y en dos semanas estarás cortando hojas frescas en tu propia casa.</p>
        </div>
        <a className="button button-primary" href="#catalogo">
          Ver los kits
        </a>
      </div>
    </section>
  );
}

// ============================================================
// Footer completo (HU-024: enlaces legales)
// ============================================================

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <span className="brand">
            <span aria-hidden="true">🌿</span> UrbanSprout
          </span>
          <p>{FOOTER.tagline}</p>
        </div>
        <nav className="footer-col" aria-label="Tienda">
          <h4>Tienda</h4>
          <a href="/#catalogo">Catálogo de kits</a>
          <a href="/#como-funciona">Cómo funciona</a>
          <a href="/#faq">Preguntas frecuentes</a>
        </nav>
        <nav className="footer-col" aria-label="Legal">
          <h4>Legal</h4>
          <Link to="/terminos">Términos y condiciones</Link>
          <Link to="/privacidad">Política de privacidad</Link>
          <Link to="/devoluciones">Envíos y devoluciones</Link>
        </nav>
        <div className="footer-col">
          <h4>Contacto</h4>
          <span>{FOOTER.contact.email}</span>
          <span>WhatsApp {FOOTER.contact.whatsapp}</span>
          <span>{FOOTER.contact.location}</span>
        </div>
      </div>
      <div className="container footer-bottom">
        <p>© 2026 UrbanSprout · by Los Extraditables 😈 · Hecho en Panamá</p>
      </div>
    </footer>
  );
}
