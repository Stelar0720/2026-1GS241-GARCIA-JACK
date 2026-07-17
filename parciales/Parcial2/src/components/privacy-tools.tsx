import { useAuth } from "@clerk/clerk-react";
import { useState } from "react";
import { getApiErrorMessage, type ApiErrorBody } from "@/lib/api-error";
import { getApiUrl } from "@/lib/env";

export function PrivacyTools() {
  const { getToken } = useAuth();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [message, setMessage] = useState("");

  async function request(method: "GET" | "DELETE") {
    const token = await getToken();
    if (!token) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
    const response = await fetch(`${getApiUrl()}/me/data`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(method === "DELETE" ? { body: JSON.stringify({ confirm: "DELETE_MY_DATA" }) } : {}) });
    const body = (await response.json().catch(() => null)) as ApiErrorBody | Record<string, unknown> | null;
    if (!response.ok) throw new Error(getApiErrorMessage(body as ApiErrorBody, "No se pudo completar la solicitud de privacidad."));
    return body;
  }

  async function exportData() {
    setBusy("export"); setMessage("");
    try {
      const body = await request("GET");
      const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `urbansprout-mis-datos-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
      setMessage("Exportación generada correctamente.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo exportar."); } finally { setBusy(null); }
  }

  async function deleteData() {
    if (confirmation !== "ELIMINAR MIS DATOS") return;
    if (!window.confirm("Esta acción es irreversible: se eliminarán favoritos y reseñas, y tus órdenes quedarán anonimizadas. ¿Continuar?")) return;
    setBusy("delete"); setMessage("");
    try { await request("DELETE"); setConfirmation(""); setMessage("Datos eliminados y órdenes anonimizadas. La cuenta de acceso de Clerk se gestiona por separado."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudieron eliminar los datos."); } finally { setBusy(null); }
  }

  return <section className="panel stack" aria-labelledby="privacy-tools-title">
    <div><h2 id="privacy-tools-title" className="compact-title">Privacidad y mis datos</h2><p className="meta">Descarga una copia portable o ejerce tu derecho de eliminación. Conservamos las órdenes únicamente anonimizadas.</p></div>
    <div className="cta-row"><button className="button button-outline" type="button" disabled={busy !== null} onClick={() => void exportData()}>{busy === "export" ? "Exportando..." : "Exportar mis datos (JSON)"}</button></div>
    <div className="danger-zone"><label htmlFor="delete-data-confirmation">Para eliminar, escribe <strong>ELIMINAR MIS DATOS</strong></label><input id="delete-data-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /><button className="button button-danger" type="button" disabled={confirmation !== "ELIMINAR MIS DATOS" || busy !== null} onClick={() => void deleteData()}>{busy === "delete" ? "Eliminando..." : "Eliminar mis datos"}</button></div>
    {message ? <p className={message.includes("correctamente") || message.includes("anonimizadas") ? "success-message" : "status-error"} role="status">{message}</p> : null}
  </section>;
}
