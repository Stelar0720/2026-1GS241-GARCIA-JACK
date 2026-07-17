export type ApiErrorBody = {
  error?: { code: string; message: string; details: Record<string, unknown> | null };
};

export function getApiErrorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const error = (body as ApiErrorBody).error;
  return typeof error?.message === "string" && error.message ? error.message : fallback;
}
