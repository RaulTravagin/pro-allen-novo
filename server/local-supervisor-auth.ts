import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request } from "express";
import { parse } from "cookie";
import { SignJWT, jwtVerify } from "jose";

const scrypt = promisify(scryptCallback);
export const LOCAL_SUPERVISOR_COOKIE_NAME = "supervisor_access";
export const LOCAL_SUPERVISOR_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

function signingKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não configurado");
  return new TextEncoder().encode(secret);
}

export async function hashSupervisorPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifySupervisorPassword(password: string, storedHash: string | null | undefined) {
  if (!password || !storedHash) return false;
  const [algorithm, salt, encodedHash] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !encodedHash) return false;

  const expected = Buffer.from(encodedHash, "base64url");
  const derived = await scrypt(password, salt, expected.length) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export async function createSupervisorSession(userId: number) {
  return new SignJWT({ access: "supervisor", userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("plano-rotas-pro-allen")
    .setAudience("supervisor")
    .setIssuedAt()
    .setExpirationTime(`${LOCAL_SUPERVISOR_SESSION_MAX_AGE_SECONDS}s`)
    .sign(signingKey());
}

export async function getLocalSupervisorSessionUserId(req: Pick<Request, "headers">) {
  const rawCookie = req.headers.cookie;
  const cookieHeader = Array.isArray(rawCookie) ? rawCookie.join("; ") : rawCookie;
  const token = cookieHeader ? parse(cookieHeader)[LOCAL_SUPERVISOR_COOKIE_NAME] : undefined;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      issuer: "plano-rotas-pro-allen",
      audience: "supervisor",
    });
    return payload.access === "supervisor" && typeof payload.userId === "number" ? payload.userId : null;
  } catch {
    return null;
  }
}
