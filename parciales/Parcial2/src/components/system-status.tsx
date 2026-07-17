import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="system-page container">
      <section className="system-card panel">
        <span className="system-code" aria-hidden="true">404</span>
        <h1>Página no encontrada</h1>
        <p>Puede que el enlace haya cambiado o que la dirección esté incompleta.</p>
        <Link className="button button-primary" to="/">Volver al inicio</Link>
      </section>
    </main>
  );
}

export function NetworkStatus() {
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
      <div><strong>Sin conexión</strong><small>Reintentaremos automáticamente cuando vuelva la red.</small></div>
      <button type="button" onClick={() => setOnline(navigator.onLine)}>Reintentar</button>
    </aside>
  );
}
