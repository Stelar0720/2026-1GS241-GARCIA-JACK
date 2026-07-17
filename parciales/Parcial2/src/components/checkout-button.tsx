import { useState } from "react";
import { getApiErrorMessage, type ApiErrorBody } from "@/lib/api-error";

type CheckoutButtonProps = {
  productId: string;
  userId: string | null;
  userEmail: string | null;
  disabled?: boolean;
};

export function CheckoutButton({ productId, userId, userEmail, disabled = false }: CheckoutButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, userId, userEmail }),
      });

      const rawBody = await response.text();
      let parsedBody: ({ checkoutUrl?: string } & ApiErrorBody) | null = null;

      try {
        parsedBody = JSON.parse(rawBody) as { checkoutUrl?: string } & ApiErrorBody;
      } catch {
        parsedBody = null;
      }

      if (!response.ok) {
        throw new Error(getApiErrorMessage(parsedBody, "No se pudo iniciar el checkout."));
      }

      if (!parsedBody?.checkoutUrl) {
        throw new Error("Stripe no devolvió una URL de checkout válida.");
      }

      window.location.href = parsedBody.checkoutUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado en el checkout.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <button className="button button-primary" type="button" disabled={disabled || loading} onClick={handleCheckout}>
        {disabled ? "Sin stock" : loading ? "Redirigiendo..." : "Comprar kit"}
      </button>
      {error ? <p className="status-error">{error}</p> : null}
    </div>
  );
}
