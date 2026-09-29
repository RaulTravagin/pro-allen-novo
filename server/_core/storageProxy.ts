import type { Express, Request } from "express";
import { ENV } from "./env";
import { getAuthenticatedUser } from "./context";
import { getPersonnelRole, isAuthorizedPersonnelOccurrenceDocument } from "../db";

const PERSONNEL_DOCUMENT_KEY = /^personnel\/occurrences\/([1-9]\d*)\/[A-Za-z0-9._-]+$/;
const PUBLIC_GENERATED_IMAGE_KEY = /^generated\/[1-9]\d*\.png$/;

export function personnelOccurrenceOwnerId(key: string) {
  const match = PERSONNEL_DOCUMENT_KEY.exec(key);
  if (!match) return null;
  const ownerId = Number(match[1]);
  return Number.isSafeInteger(ownerId) ? ownerId : null;
}

export function isSafeStorageKey(key: string) {
  if (!key || key.length > 512 || key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    return false;
  }
  return PERSONNEL_DOCUMENT_KEY.test(key) || PUBLIC_GENERATED_IMAGE_KEY.test(key);
}

export async function canReadStorageKey(req: Pick<Request, "headers">, key: string) {
  if (!isSafeStorageKey(key)) return false;

  // Generated images are the only non-personnel namespace currently used by the app.
  if (PUBLIC_GENERATED_IMAGE_KEY.test(key)) return true;

  const user = await getAuthenticatedUser(req as Request);
  if (!user) return false;
  const role = getPersonnelRole(user);
  if (role !== "RH" && role !== "ADM") return false;

  const ownerId = personnelOccurrenceOwnerId(key);
  if (!ownerId) return false;
  return isAuthorizedPersonnelOccurrenceDocument(key);
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!isSafeStorageKey(key)) {
      res.status(400).send("Invalid storage key");
      return;
    }

    if (!(await canReadStorageKey(req, key))) {
      res.status(403).send("Storage access denied");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        console.error(`[StorageProxy] forge error status=${forgeResp.status}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
