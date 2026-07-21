import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLocale } from "@/lib/i18n";

export function NotFoundPage() {
  const { t } = useLocale();
  return (
    <main className="system-page container">
      <section className="system-card panel">
        <span className="system-code" aria-hidden="true">404</span>
        <h1>{t("errors.notFoundTitle")}</h1>
        <p>{t("errors.notFoundBody")}</p>
        <Link className="button button-primary" to="/">{t("errors.backHome")}</Link>
      </section>
    </main>
  );
}

export function NetworkStatus() {
  const { t } = useLocale();
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const checkConnection = () => setOnline(navigator.onLine);
    window.addEventListener("online", checkConnection);
    window.addEventListener("offline", checkConnection);
    const retryTimer = window.setInterval(checkConnection, 15_000);
    return () => {
      window.removeEventListener("online", checkConnection);
      window.removeEventListener("offline", checkConnection);
      window.clearInterval(retryTimer);
    };
  }, []);
  if (online) return null;
  return (
    <aside className="offline-banner" role="status" aria-live="polite">
      <span aria-hidden="true">●</span>
      <div><strong>{t("errors.offlineTitle")}</strong><small>{t("errors.offlineBody")}</small></div>
      <button type="button" onClick={() => setOnline(navigator.onLine)}>{t("errors.retry")}</button>
    </aside>
  );
}
