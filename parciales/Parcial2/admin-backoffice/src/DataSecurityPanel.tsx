import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage, type ApiErrorBody } from "./api-error";

type ApiKey = { id: string; name: string; prefix: string; permissions: string[]; expiresAt: string | null; lastUsedAt: string | null; revokedAt: string | null };
type Backup = { id: string; createdAt: string; reason: string; documentCount: number; byteSize: number };
type Migration = { version: number; name: string; applied: boolean };

export function DataSecurityPanel({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("urbansprout-admin-key") ?? (import.meta.env.VITE_E2E === "true" ? import.meta.env.VITE_E2E_ADMIN_KEY ?? "" : ""));
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [name, setName] = useState("Integración de catálogo");
  const [expiresAt, setExpiresAt] = useState("");
  const [revealedToken, setRevealedToken] = useState("");
  const [message, setMessage] = useState("");

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}`, ...init?.headers } });
    const body = (await response.json().catch(() => null)) as ({ data?: unknown; token?: string } & ApiErrorBody) | null;
    if (!response.ok) throw new Error(getApiErrorMessage(body, "No se pudo completar la operación."));
    return body;
  }, [adminKey, apiBaseUrl]);

  const load = useCallback(async () => {
    if (!adminKey) return;
    try {
      const [keys, backupRows, migrationRows] = await Promise.all([request("/admin/api-keys"), request("/admin/backups"), request("/admin/migrations")]);
      setApiKeys((keys?.data as ApiKey[]) ?? []); setBackups((backupRows?.data as Backup[]) ?? []); setMigrations((migrationRows?.data as Migration[]) ?? []); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudieron cargar las operaciones."); }
  }, [adminKey, request]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const refresh = () => setAdminKey(sessionStorage.getItem("urbansprout-admin-key") ?? ""); window.addEventListener("urbansprout-admin-key", refresh); return () => window.removeEventListener("urbansprout-admin-key", refresh); }, []);

  async function createKey() {
    try {
      const body = await request("/admin/api-keys", { method: "POST", body: JSON.stringify({ name: name.trim(), permissions: ["catalog:read"], expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null }) });
      setRevealedToken(body?.token ?? ""); setMessage("API key creada. Copia el secreto ahora; no volverá a mostrarse."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo crear la API key."); }
  }
  async function keyAction(id: string, action: "rotate" | "revoke") {
    if (!window.confirm(action === "rotate" ? "¿Rotar esta API key? La anterior será revocada." : "¿Revocar esta API key?")) return;
    try { const body = await request(`/admin/api-keys/${encodeURIComponent(id)}/${action}`, { method: "POST" }); setRevealedToken(body?.token ?? ""); setMessage(action === "rotate" ? "API key rotada. Copia el nuevo secreto ahora." : "API key revocada."); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo actualizar la API key."); }
  }
  async function createBackup() { try { await request("/admin/backups", { method: "POST" }); setMessage("Backup creado correctamente."); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo crear el backup."); } }
  async function restoreBackup(id: string) { if (!window.confirm("Restaurar reemplazará los datos actuales. ¿Deseas continuar?")) return; try { await request(`/admin/backups/${encodeURIComponent(id)}/restore`, { method: "POST", body: JSON.stringify({ confirmation: `RESTORE:${id}` }) }); setMessage("Backup restaurado."); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo restaurar."); } }

  return <section className="panel stack" aria-labelledby="data-security-title">
    <div className="section-header"><div><h2 id="data-security-title">Datos y seguridad</h2><p>API keys, migraciones versionadas y recuperación de MongoDB.</p></div><button className="button button-outline" type="button" onClick={() => void load()}>Actualizar</button></div>
    {message ? <p className="status-message" role="status">{message}</p> : null}
    <div className="form-row"><div className="form-group"><label htmlFor="api-key-name">Nombre de integración</label><input id="api-key-name" value={name} onChange={(event) => setName(event.target.value)} /></div><div className="form-group"><label htmlFor="api-key-expiry">Expira</label><input id="api-key-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></div></div>
    <button className="button button-primary" type="button" disabled={name.trim().length < 2} onClick={() => void createKey()}>Crear API key</button>
    {revealedToken ? <div className="secret-reveal" role="alert"><strong>Secreto de una sola visualización</strong><code>{revealedToken}</code><button type="button" className="button button-outline" onClick={() => void navigator.clipboard.writeText(revealedToken)}>Copiar</button></div> : null}
    <div className="table"><div className="table-row table-head"><span>Nombre</span><span>Prefijo</span><span>Permisos</span><span>Estado</span><span>Acciones</span><span>Uso</span></div>{apiKeys.map((key) => <div className="table-row" key={key.id}><span>{key.name}</span><code>{key.prefix}</code><span>{key.permissions.join(", ")}</span><span>{key.revokedAt ? "Revocada" : "Activa"}</span><span><button type="button" onClick={() => void keyAction(key.id, "rotate")}>Rotar</button> <button type="button" disabled={Boolean(key.revokedAt)} onClick={() => void keyAction(key.id, "revoke")}>Revocar</button></span><small>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString("es-PA") : "Sin uso"}</small></div>)}</div>
    <div className="section-header"><div><h3>Backups</h3><p>Snapshots JSON con retención gratuita.</p></div><button className="button button-primary" type="button" onClick={() => void createBackup()}>Crear backup</button></div>
    <div className="table"><div className="table-row table-head"><span>Fecha</span><span>Tipo</span><span>Documentos</span><span>Tamaño</span><span>Acción</span><span>ID</span></div>{backups.map((backup) => <div className="table-row" key={backup.id}><span>{new Date(backup.createdAt).toLocaleString("es-PA")}</span><span>{backup.reason}</span><span>{backup.documentCount}</span><span>{Math.ceil(backup.byteSize / 1024)} KB</span><button type="button" onClick={() => void restoreBackup(backup.id)}>Restaurar</button><code>{backup.id.slice(0, 8)}</code></div>)}</div>
    <div><h3>Migraciones</h3><p className="meta">{migrations.filter((item) => item.applied).length}/{migrations.length} aplicadas automáticamente.</p><ul>{migrations.map((migration) => <li key={migration.version}>v{migration.version} — {migration.name}: {migration.applied ? "Aplicada" : "Pendiente"}</li>)}</ul></div>
  </section>;
}
