import type { Express, Request } from "express";
import { ENV } from "./env";
import { getLocalSupervisorSessionUserId } from "../local-supervisor-auth";
import { hasGestorSession } from "../gestor-access";
import { getPersonnelRole, getUserById } from "../db";

export function personnelOccurrenceOwnerId(key: string) {
  const match = /^personnel\/occurrences\/(\d+)\//.exec(key);
  return match ? Number(match[1]) : null;
}

export function isSafeStorageKey(key: string) {
  return Boolean(key) && !key.includes("..") && !key.includes("\\") && !key.startsWith("/");
}

async function canReadStorageKey(req: Pick<Request, "headers">, key: string) {
  if (!key.startsWith("personnel/occurrences/")) return true;
  if (await hasGestorSession(req)) return true;

  const localUserId = await getLocalSupervisorSessionUserId(req);
  if (!localUserId) return false;
  const user = await getUserById(localUserId);
  if (!user) return false;
  const role = getPersonnelRole(user);
  const ownerId = personnelOccurrenceOwnerId(key);
  return role === "RH" || role === "ADM" || ownerId === localUserId;
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
