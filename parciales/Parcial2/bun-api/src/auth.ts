// Autenticación por rol para las operaciones sensibles / MCP.
//
// Modelo: cada API key (definida por variable de entorno) se resuelve a un rol.
// Cada rol tiene un set de permisos. Las peticiones sin key son "public".
//
// Las keys se pasan como `Authorization: Bearer <key>`. El storefront y el
// backoffice siguen usando los endpoints abiertos (internos); los endpoints
// nuevos y sensibles (reports, export, audit, cancel, sync, auth) exigen key.

export type Role = "public" | "client" | "support" | "admin";

export type Permission =
  | "catalog:read"
  | "catalog:write"
  | "orders:read"
  | "orders:cancel"
  | "orders:sync"
  | "metrics:read"
  | "reports:read"
  | "export:read"
  | "audit:read"
  | "auth:read";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  public: [],
  client: ["orders:cancel"],
  support: ["catalog:read", "orders:read", "auth:read"],
  admin: [
    "catalog:read",
    "catalog:write",
    "orders:read",
    "orders:cancel",
    "orders:sync",
    "metrics:read",
    "reports:read",
    "export:read",
    "audit:read",
    "auth:read",
  ],
};

// Mapa key -> rol, tomado de variables de entorno. En producción cada rol
// tendría su propia key secreta; para el avance se configuran por env.
function buildKeyRoleMap(): Map<string, Role> {
  const map = new Map<string, Role>();
  const entries: [string | undefined, Role][] = [
    [process.env.MCP_ADMIN_KEY?.trim(), "admin"],
    [process.env.MCP_SUPPORT_KEY?.trim(), "support"],
    [process.env.MCP_CLIENT_KEY?.trim(), "client"],
  ];
  for (const [key, role] of entries) {
    if (key) map.set(key, role);
  }
  return map;
}

const keyRoleMap = buildKeyRoleMap();

export function extractBearerKey(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function resolveRole(apiKey: string | null): Role {
  if (!apiKey) return "public";
  return keyRoleMap.get(apiKey) ?? "public";
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsForRole(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}
