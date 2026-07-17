import { verifyToken } from "@clerk/backend";
import { extractBearerKey, resolveRole } from "./auth";

export type CustomerIdentity = { userId: string };
type TokenVerifier = (token: string) => Promise<{ sub?: string }>;

function configuredVerifier(token: string) {
  const jwtKey = process.env.CLERK_JWT_KEY?.replace(/\\n/g, "\n").trim();
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!jwtKey && !secretKey) throw new Error("Clerk server-side no está configurado.");
  return verifyToken(token, {
    ...(jwtKey ? { jwtKey } : { secretKey }),
    authorizedParties: process.env.CLERK_AUTHORIZED_PARTIES?.split(",").map((item) => item.trim()).filter(Boolean),
  });
}

export async function authenticateCustomer(req: Request, verifier: TokenVerifier = configuredVerifier): Promise<CustomerIdentity | null> {
  const token = extractBearerKey(req.headers.get("authorization"));
  if (!token || resolveRole(token) !== "public") return null;
  try {
    const payload = await verifier(token);
    return payload.sub ? { userId: payload.sub } : null;
  } catch {
    return null;
  }
}
