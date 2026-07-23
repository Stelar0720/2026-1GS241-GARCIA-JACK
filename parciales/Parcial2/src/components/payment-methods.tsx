import { useAuth } from "@clerk/clerk-react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getApiErrorMessage, type ApiErrorBody } from "@/lib/api-error";
import { getApiUrl, getStripePublishableKey } from "@/lib/env";
import { translatePaymentMethod, useLocale } from "@/lib/i18n";

type SavedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
};

type CardFormProps = {
  onCancel: () => void;
  onSaved: () => Promise<void>;
  setMessage: (message: string) => void;
};

function CardForm({ onCancel, onSaved, setMessage }: CardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { locale } = useLocale();
  const text = useCallback((key: string) => translatePaymentMethod(locale, key), [locale]);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements || saving) return;

    setSaving(true);
    setMessage("");
    const submitted = await elements.submit();
    if (submitted.error) {
      setMessage(submitted.error.message ?? text("confirmError"));
      setSaving(false);
      return;
    }

    const result = await stripe.confirmSetup({ elements, redirect: "if_required" });
    if (result.error) {
      setMessage(result.error.message ?? text("confirmError"));
      setSaving(false);
      return;
    }

    if (result.setupIntent?.status === "succeeded") {
      setMessage(text("saved"));
      await onSaved();
      return;
    }

    setMessage(text("confirmError"));
    setSaving(false);
  }

  return (
    <form className="payment-method-form stack" onSubmit={(event) => void submit(event)}>
      <h3 className="compact-title">{text("cardTitle")}</h3>
      <PaymentElement options={{ layout: "tabs" }} />
      <div className="cta-row">
        <button className="button button-primary" type="submit" disabled={!stripe || !elements || saving}>
          {saving ? text("saving") : text("save")}
        </button>
        <button className="button button-outline" type="button" disabled={saving} onClick={onCancel}>
          {text("cancel")}
        </button>
      </div>
    </form>
  );
}

export function PaymentMethodsPanel() {
  const { getToken } = useAuth();
  const { locale } = useLocale();
  const text = useCallback((key: string) => translatePaymentMethod(locale, key), [locale]);
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const publishableKey = getStripePublishableKey();
  const stripePromise = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), [publishableKey]);

  const request = useCallback(
    async (method: "GET" | "POST" | "DELETE", path = "") => {
      const token = await getToken();
      if (!token) throw new Error(text("sessionExpired"));
      const response = await fetch(`${getApiUrl()}/me/payment-methods${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => null)) as ApiErrorBody | Record<string, unknown> | null;
      if (response.status === 503) {
        const error = new Error(text("unavailable"));
        error.name = "StripeUnavailable";
        throw error;
      }
      if (!response.ok) {
        throw new Error(getApiErrorMessage(body as ApiErrorBody, text("manageError")));
      }
      return body as { data: unknown };
    },
    [getToken, text],
  );

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
    if (!stripePromise) {
      setMessage(text("configMissing"));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const body = await request("POST");
      const intent = body.data as { clientSecret: string | null };
      if (!intent.clientSecret) throw new Error(text("invalidIntent"));
      setClientSecret(intent.clientSecret);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("startError"));
    } finally {
      setBusy(false);
    }
  }

  async function removeCard(id: string) {
    if (!window.confirm(text("removeConfirm"))) return;
    setBusy(true);
    setMessage("");
    try {
      await request("DELETE", `/${encodeURIComponent(id)}`);
      setMessage(text("removed"));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("removeError"));
    } finally {
      setBusy(false);
    }
  }

  async function cardSaved() {
    setClientSecret(null);
    await load();
  }

  return (
    <section className="panel stack" aria-labelledby="payment-methods-title">
      <div>
        <h2 id="payment-methods-title" className="compact-title">{text("title")}</h2>
        <p className="meta">{text("description")}</p>
      </div>

      {unavailable ? (
        <p className="meta" role="status">{text("unavailable")}</p>
      ) : (
        <>
          {loading ? <p className="loading-text">{text("loading")}</p> : null}
          {!loading && methods.length === 0 ? <p className="meta">{text("empty")}</p> : null}
          {methods.length > 0 ? (
            <ul className="payment-method-list">
              {methods.map((method) => (
                <li key={method.id} className="payment-method-item">
                  <span>
                    <strong>{method.brand.toUpperCase()}</strong> •••• {method.last4}
                    {method.expMonth && method.expYear ? (
                      <small> · {text("expires")} {String(method.expMonth).padStart(2, "0")}/{method.expYear}</small>
                    ) : null}
                  </span>
                  <button className="button button-outline" type="button" disabled={busy} onClick={() => void removeCard(method.id)}>
                    {text("remove")}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {clientSecret && stripePromise ? (
            <Elements stripe={stripePromise} options={{ clientSecret, locale }}>
              <CardForm onCancel={() => setClientSecret(null)} onSaved={cardSaved} setMessage={setMessage} />
            </Elements>
          ) : (
            <div className="cta-row">
              <button className="button button-primary" type="button" disabled={busy} onClick={() => void addCard()}>
                {busy ? text("preparing") : text("add")}
              </button>
            </div>
          )}
        </>
      )}

      {message ? (
        <p className={message === text("saved") || message === text("removed") ? "success-message" : "status-error"} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
