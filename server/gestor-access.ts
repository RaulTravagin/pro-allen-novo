import { createHash, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { parse } from "cookie";
import { SignJWT, jwtVerify } from "jose";

export const GESTOR_COOKIE_NAME = "gestor_access";
export const GESTOR_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const GESTOR_ROLE = "gestor" as const;

function signingKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não configurado");
  return new TextEncoder().encode(secret);
}

function passwordDigest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function isGestorPasswordValid(candidate: string) {
  const configuredPassword = process.env.GESTOR_ACCESS_PASSWORD;
  if (!configuredPassword || !candidate) return false;

  const expected = passwordDigest(configuredPassword);
  const received = passwordDigest(candidate);
  return timingSafeEqual(expected, received);
}

export async function createGestorSession() {
  return new SignJWT({ access: GESTOR_ROLE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("plano-rotas-pro-allen")
    .setAudience("gestor")
    .setIssuedAt()
    .setExpirationTime(`${GESTOR_SESSION_MAX_AGE_SECONDS}s`)
    .sign(signingKey());
}

export async function hasGestorSession(req: Pick<Request, "headers">) {
  const rawCookie = req.headers.cookie;
  const cookieHeader = Array.isArray(rawCookie) ? rawCookie.join("; ") : rawCookie;
  const token = cookieHeader ? parse(cookieHeader)[GESTOR_COOKIE_NAME] : undefined;
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      issuer: "plano-rotas-pro-allen",
      audience: "gestor",
    });
    return payload.access === GESTOR_ROLE;
  } catch {
    return false;
  }
}
