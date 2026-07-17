import { useAuth, useUser } from "@clerk/clerk-react";
import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { commerceApi, type Review } from "@/lib/commerce";
import type { Product } from "@/lib/catalog";
import { isClerkConfigured } from "@/lib/env";

const hasClerkContext = () => isClerkConfigured() && import.meta.env.VITE_E2E !== "true";

export function WishlistButton({ productId, compact = false }: { productId: string; compact?: boolean }) {
  if (!hasClerkContext()) return <div className={compact ? "wishlist-compact" : "stack"}>
    <button type="button" className="wishlist-button" aria-label="Guardar en favoritos" onClick={() => undefined} disabled title="Configura Clerk para usar favoritos"><span aria-hidden="true">♡</span>{compact ? null : " Guardar"}</button>
  </div>;
  return <AuthenticatedWishlistButton productId={productId} compact={compact} />;
}

function AuthenticatedWishlistButton({ productId, compact = false }: { productId: string; compact?: boolean }) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    void getToken().then((token) => token ? commerceApi.getWishlist(user.id, token) : null)
      .then((result) => result && setSaved(result.productIds.includes(productId)))
      .catch(() => undefined);
  }, [getToken, productId, user?.id]);

  async function toggle() {
    if (!user?.id) { setMessage("Inicia sesión para guardar favoritos."); return; }
    setBusy(true); setMessage("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Tu sesión expiró.");
      if (saved) { await commerceApi.removeWishlist(user.id, productId, token); setSaved(false); }
      else { const result = await commerceApi.addWishlist(user.id, productId, token); setSaved(result.productIds.includes(productId)); }
      window.dispatchEvent(new CustomEvent("wishlist-changed"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo actualizar."); }
    finally { setBusy(false); }
  }

  return <div className={compact ? "wishlist-compact" : "stack"}>
    <button type="button" className={`wishlist-button ${saved ? "is-saved" : ""}`} onClick={() => void toggle()}
      disabled={busy} aria-pressed={saved} aria-label={saved ? "Quitar de favoritos" : "Guardar en favoritos"}>
      <span aria-hidden="true">{saved ? "♥" : "♡"}</span>{compact ? null : saved ? " Guardado" : " Guardar"}
    </button>
    {message ? <span className="field-error" role="status">{message}</span> : null}
  </div>;
}

export function Reviews({ productId }: { productId: string }) {
  if (!hasClerkContext()) return <section className="panel glass reviews-section" aria-labelledby="reviews-title">
    <h2 id="reviews-title" className="compact-title">Reseñas verificadas</h2>
    <p className="meta">Configura Clerk e inicia sesión para publicar una reseña. Las reseñas existentes se consultan mediante la API pública.</p>
  </section>;
  return <AuthenticatedReviews productId={productId} />;
}

function AuthenticatedReviews({ productId }: { productId: string }) {
  const { user } = useUser(); const { getToken } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]); const [error, setError] = useState("");
  const [rating, setRating] = useState(5); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { void commerceApi.getReviews(productId).then(setReviews).catch((e: Error) => setError(e.message)); }, [productId]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (comment.trim().length < 10) { setError("La reseña debe tener al menos 10 caracteres."); return; }
    setBusy(true);
    try {
      const token = await getToken(); if (!token) throw new Error("Inicia sesión para publicar.");
      const review = await commerceApi.createReview(productId, { rating, comment: comment.trim() }, token);
      setReviews((current) => [review, ...current.filter((item) => item.id !== review.id)]); setComment("");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo publicar la reseña."); }
    finally { setBusy(false); }
  }
  const average = reviews.length ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length : 0;
  return <section className="panel glass reviews-section" aria-labelledby="reviews-title">
    <div className="section-inline-header"><div><h2 id="reviews-title" className="compact-title">Reseñas verificadas</h2>
      <p className="meta">{reviews.length ? `${average.toFixed(1)} de 5 · ${reviews.length} reseña${reviews.length === 1 ? "" : "s"}` : "Aún no hay reseñas."}</p></div></div>
    {user ? <form className="review-form" onSubmit={submit}>
      <label>Calificación<select value={rating} onChange={(e) => setRating(Number(e.target.value))}>{[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} estrellas</option>)}</select></label>
      <label>Tu experiencia<textarea value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} placeholder="Cuéntanos cómo te fue con el kit" /></label>
      <button className="button button-primary" disabled={busy}>{busy ? "Publicando..." : "Publicar reseña"}</button>
    </form> : <p className="meta"><Link to="/sign-in">Inicia sesión</Link> para reseñar una compra.</p>}
    {error ? <p className="status-error" role="alert">{error}</p> : null}
    <div className="review-list">{reviews.map((review) => <article className="review-card" key={review.id}>
      <strong>{review.authorName}</strong><span aria-label={`${review.rating} de 5 estrellas`}>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span>
      <p>{review.comment}</p><time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString("es-PA")}</time>
    </article>)}</div>
  </section>;
}

export function WishlistPanel({ products }: { products: Product[] }) {
  if (!hasClerkContext()) return null;
  return <AuthenticatedWishlistPanel products={products} />;
}

function AuthenticatedWishlistPanel({ products }: { products: Product[] }) {
  const { user } = useUser(); const { getToken } = useAuth();
  const [ids, setIds] = useState<string[]>([]); const [error, setError] = useState("");
  useEffect(() => {
    const load = () => { if (!user?.id) return; void getToken().then((token) => token ? commerceApi.getWishlist(user.id, token) : null).then((x) => x && setIds(x.productIds)).catch((e: Error) => setError(e.message)); };
    load(); window.addEventListener("wishlist-changed", load); return () => window.removeEventListener("wishlist-changed", load);
  }, [getToken, user?.id]);
  const saved = products.filter((product) => ids.includes(product.id));
  return <section className="panel stack"><h2 className="compact-title">Mi wishlist</h2>
    {error ? <p className="status-error">{error}</p> : null}
    {!saved.length ? <p className="meta">Guarda kits con el corazón para encontrarlos aquí.</p> : <div className="wishlist-grid">{saved.map((product) =>
      <Link key={product.id} to={`/producto/${product.id}`} className="wishlist-card"><img src={product.imageUrl} alt="" /><span><strong>{product.name}</strong><small>${product.priceUsd.toFixed(2)} USD</small></span></Link>)}</div>}
  </section>;
}
