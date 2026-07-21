import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage, type ApiErrorBody } from "@/lib/api-error";
import { getApiUrl } from "@/lib/env";

// Tarjetas guardadas del cliente (HU-032).
//
// El API nunca ve datos de tarjeta: acá se pide un SetupIntent y el
// client_secret se confirma contra Stripe. Mientras Stripe.js no esté montado en
// el storefront, el panel muestra el client_secret listo para confirmar, que es
// la parte que el backend sí controla y que las pruebas pueden verificar.
// ponytail: montar Stripe Elements es la única pieza que falta para el flujo
// visual completo; el contrato del backend ya no cambia cuando se agregue.

type SavedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
};

export function PaymentMethodsPanel() {
  const { getToken } = useAuth();
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  const request = useCallback(
    async (method: "GET" | "POST" | "DELETE", path = "") => {
      const token = await getToken();
      if (!token) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
      const response = await fetch(`${getApiUrl()}/me/payment-methods${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => null)) as ApiErrorBody | Record<string, unknown> | null;
      if (response.status === 503) {
        const error = new Error("Los pagos guardados no están habilitados en este entorno.");
        error.name = "StripeUnavailable";
        throw error;
      }
      if (!response.ok) {
        throw new Error(getApiErrorMessage(body as ApiErrorBody, "No se pudieron gestionar tus métodos de pago."));
      }
      return body as { data: unknown };
    },
    [getToken],
  );

  // Cadena de promesas en vez de async/await: mantiene cada setState dentro de un
  // callback, que es lo que pide react-hooks/set-state-in-effect.
  const load = useCallback(
    () =>
      request("GET")
        .then((body) => {
          setMethods(body.data as SavedPaymentMethod[]);
          setUnavailable(false);
        })
        .catch((error: Error) => {
          if (error.name === "StripeUnavailable") setUnavailable(true);
          else setMessage(error.message);
        })
        .finally(() => setLoading(false)),
    [request],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function addCard() {
    setBusy(true);
    setMessage("");
    try {
      const body = await request("POST");
      const intent = body.data as { clientSecret: string | null };
      setMessage(
        intent.clientSecret
          ? "Listo para agregar tu tarjeta. Completa la confirmación segura de Stripe."
          : "Stripe no devolvió un intento de configuración válido.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar el guardado de tarjeta.");
    } finally {
      setBusy(false);
    }
  }

  async function removeCard(id: string) {
    if (!window.confirm("¿Eliminar esta tarjeta guardada?")) return;
    setBusy(true);
    setMessage("");
    try {
      await request("DELETE", `/${encodeURIComponent(id)}`);
      setMessage("Tarjeta eliminada.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar la tarjeta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel stack" aria-labelledby="payment-methods-title">
      <div>
        <h2 id="payment-methods-title" className="compact-title">
          Métodos de pago guardados
        </h2>
        <p className="meta">
          Guarda una tarjeta para comprar más rápido. UrbanSprout solo almacena la marca y los últimos 4 dígitos; el
          número completo vive en Stripe.
        </p>
      </div>

      {unavailable ? (
        <p className="meta" role="status">
          Los pagos guardados no están habilitados en este entorno.
        </p>
      ) : (
        <>
          {loading ? <p className="loading-text">Cargando tus tarjetas...</p> : null}

          {!loading && methods.length === 0 ? (
            <p className="meta">Todavía no tienes tarjetas guardadas.</p>
          ) : null}

          {methods.length > 0 ? (
            <ul className="payment-method-list">
              {methods.map((method) => (
                <li key={method.id} className="payment-method-item">
                  <span>
                    <strong>{method.brand.toUpperCase()}</strong> •••• {method.last4}
                    {method.expMonth && method.expYear ? (
                      <small> · vence {String(method.expMonth).padStart(2, "0")}/{method.expYear}</small>
                    ) : null}
                  </span>
                  <button
                    className="button button-outline"
                    type="button"
                    disabled={busy}
                    onClick={() => void removeCard(method.id)}
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="cta-row">
            <button className="button button-primary" type="button" disabled={busy} onClick={() => void addCard()}>
              {busy ? "Preparando..." : "Guardar una tarjeta"}
            </button>
          </div>
        </>
      )}

      {message ? (
        <p className={message.includes("no se") || message.includes("No se") ? "status-error" : "success-message"} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
