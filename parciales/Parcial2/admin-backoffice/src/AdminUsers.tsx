import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage, type ApiErrorBody } from "./api-error";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "support" | "admin";
  status: "invited" | "active" | "suspended";
};

export function AdminUsers({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("urbansprout-admin-key") ?? "");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("support");
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState({ name: false, email: false });
  const nameError = name.trim() ? "" : "El nombre es requerido.";
  const emailError = !email.trim() ? "El correo es requerido." : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "" : "Ingresa un correo electrónico válido.";
  const inviteInvalid = Boolean(nameError || emailError);

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}`, ...init?.headers },
    });
    const body = (await response.json()) as { data?: AdminUser[] | AdminUser } & ApiErrorBody;
    if (!response.ok) throw new Error(getApiErrorMessage(body, "No se pudo gestionar usuarios."));
    return body;
  }, [adminKey, apiBaseUrl]);

  const loadUsers = useCallback(async () => {
    if (!adminKey) return;
    try {
      const body = await request(`/admin/users?q=${encodeURIComponent(query)}`);
      setUsers((body.data as AdminUser[]) ?? []);
      setMessage("");
    } catch (error) {
      setUsers([]);
      setMessage(error instanceof Error ? error.message : "Error al buscar usuarios.");
    }
  }, [adminKey, query, request]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  function saveKey() {
    sessionStorage.setItem("urbansprout-admin-key", adminKey);
    window.dispatchEvent(new Event("urbansprout-admin-key"));
    void loadUsers();
  }

  async function invite() {
    setTouched({ name: true, email: true });
    if (inviteInvalid) return;
    try {
      await request("/admin/users/invite", { method: "POST", body: JSON.stringify({ name: name.trim(), email: email.trim(), role }) });
      setName(""); setEmail(""); setTouched({ name: false, email: false }); setMessage("Invitación registrada.");
      await loadUsers();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Error al invitar."); }
  }

  async function update(user: AdminUser, changes: Partial<Pick<AdminUser, "role" | "status">>) {
    const action = changes.status === "suspended" ? "suspender" : "actualizar";
    if (!window.confirm(`¿Confirmas ${action} a ${user.email}?`)) return;
    try {
      await request(`/admin/users/${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify(changes) });
      setMessage("Usuario actualizado.");
      await loadUsers();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Error al actualizar."); }
  }

  return (
    <section className="panel admin-users-panel">
      <div className="section-header"><div><h2>Usuarios administrativos</h2><p>Invita, asigna roles y suspende accesos del equipo.</p></div></div>
      <div className="admin-key-row">
        <label htmlFor="admin-api-key">Clave administrativa</label>
        <input id="admin-api-key" type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} placeholder="MCP_ADMIN_KEY" />
        <button className="button button-outline" type="button" onClick={saveKey}>Validar clave</button>
      </div>
      {message ? <p role="status" className="form-help">{message}</p> : null}
      {adminKey ? <>
        <form className="user-invite-form" noValidate onSubmit={(event) => { event.preventDefault(); void invite(); }}>
          <div className="form-field">
            <input aria-label="Nombre del usuario" aria-invalid={touched.name && Boolean(nameError)} aria-describedby={touched.name && nameError ? "invite-name-error" : undefined} value={name} onChange={(event) => setName(event.target.value)} onBlur={() => setTouched((current) => ({ ...current, name: true }))} placeholder="Nombre" />
            {touched.name && nameError ? <span id="invite-name-error" className="form-error" role="alert">{nameError}</span> : null}
          </div>
          <div className="form-field">
            <input aria-label="Email del usuario" aria-invalid={touched.email && Boolean(emailError)} aria-describedby={touched.email && emailError ? "invite-email-error" : undefined} type="email" value={email} onChange={(event) => setEmail(event.target.value)} onBlur={() => setTouched((current) => ({ ...current, email: true }))} placeholder="correo@ejemplo.com" />
            {touched.email && emailError ? <span id="invite-email-error" className="form-error" role="alert">{emailError}</span> : null}
          </div>
          <select aria-label="Rol de invitación" value={role} onChange={(event) => setRole(event.target.value as AdminUser["role"])}><option value="support">Support</option><option value="admin">Admin</option></select>
          <button className="button button-primary" type="submit" disabled={inviteInvalid}>Invitar usuario</button>
        </form>
        <input className="user-search" aria-label="Buscar usuarios" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o email" />
        <div className="users-list">
          {users.map((user) => <article className="user-card" key={user.id}>
            <div><strong>{user.name}</strong><span>{user.email}</span><small>{user.status}</small></div>
            <select aria-label={`Rol de ${user.email}`} value={user.role} onChange={(event) => void update(user, { role: event.target.value as AdminUser["role"] })}><option value="support">Support</option><option value="admin">Admin</option></select>
            <button className={`button ${user.status === "suspended" ? "button-outline" : "button-danger"}`} type="button" onClick={() => void update(user, { status: user.status === "suspended" ? "active" : "suspended" })}>{user.status === "suspended" ? "Reactivar" : "Suspender"}</button>
          </article>)}
          {users.length === 0 ? <p className="empty">No hay usuarios para mostrar.</p> : null}
        </div>
      </> : null}
    </section>
  );
}
