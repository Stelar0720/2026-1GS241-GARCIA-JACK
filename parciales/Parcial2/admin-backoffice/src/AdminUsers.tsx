import { useCallback, useEffect, useState } from "react";

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

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}`, ...init?.headers },
    });
    const body = (await response.json()) as { data?: AdminUser[] | AdminUser; error?: string };
    if (!response.ok) throw new Error(body.error ?? "No se pudo gestionar usuarios.");
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
    void loadUsers();
  }

  async function invite() {
    try {
      await request("/admin/users/invite", { method: "POST", body: JSON.stringify({ name, email, role }) });
      setName(""); setEmail(""); setMessage("Invitación registrada.");
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
        <div className="user-invite-form">
          <input aria-label="Nombre del usuario" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre" />
          <input aria-label="Email del usuario" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@ejemplo.com" />
          <select aria-label="Rol de invitación" value={role} onChange={(event) => setRole(event.target.value as AdminUser["role"])}><option value="support">Support</option><option value="admin">Admin</option></select>
          <button className="button button-primary" type="button" disabled={!name.trim() || !email.trim()} onClick={() => void invite()}>Invitar usuario</button>
        </div>
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
