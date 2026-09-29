import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

const proxyMocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  isAuthorizedPersonnelOccurrenceDocument: vi.fn(),
}));

vi.mock("./_core/context", () => ({ getAuthenticatedUser: proxyMocks.getAuthenticatedUser }));
vi.mock("./_core/env", () => ({ ENV: { forgeApiUrl: "https://storage-fixture.invalid", forgeApiKey: "fixture-only-key" } }));
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, isAuthorizedPersonnelOccurrenceDocument: proxyMocks.isAuthorizedPersonnelOccurrenceDocument };
});

import { canReadStorageKey, isSafeStorageKey, personnelOccurrenceOwnerId, registerStorageProxy } from "./_core/storageProxy";

const authorizedKey = "personnel/occurrences/17/fake-medical-file.pdf";
const fixtures: Record<string, Record<string, unknown> | null> = {
  rh: { id: 41, role: "user", personnelRole: "RH" },
  supervisor: { id: 17, role: "user", personnelRole: "SUPERVISOR" },
  finance: { id: 42, role: "user", personnelRole: "FINANCEIRO" },
  admin: { id: 43, role: "admin", personnelRole: "ADM" },
  unauthenticated: null,
  gestor: null,
};

type RouteHandler = (req: any, res: any) => Promise<void>;
let routeHandler: RouteHandler;

function fixtureRequest(identity: string) {
  return {
    params: { "0": authorizedKey },
    headers: { cookie: identity === "unauthenticated" ? undefined : `fixture=${identity}` },
  };
}

function responseDouble() {
  const response: any = {
    status: vi.fn(function (this: any) { return this; }),
    send: vi.fn(function (this: any) { return this; }),
    set: vi.fn(function (this: any) { return this; }),
    redirect: vi.fn(function (this: any) { return this; }),
  };
  return response;
}

async function invokeProxy(identity: string, key = authorizedKey) {
  const req = fixtureRequest(identity);
  req.params["0"] = key;
  const res = responseDouble();
  await routeHandler(req, res);
  return res;
}

describe("proxy de arquivos pessoais", () => {
  let upstreamFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    proxyMocks.getAuthenticatedUser.mockImplementation(async (req: { headers: { cookie?: string } }) => {
      const identity = /fixture=(\w+)/.exec(req.headers.cookie ?? "")?.[1] ?? "unauthenticated";
      return fixtures[identity] ?? null;
    });
    proxyMocks.isAuthorizedPersonnelOccurrenceDocument.mockImplementation(async (key: string) => key === authorizedKey);
    upstreamFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "https://signed-fixture.invalid/file" }) });
    vi.stubGlobal("fetch", upstreamFetch);

    const app = {
      get: vi.fn((_path: string, handler: RouteHandler) => { routeHandler = handler; }),
    } as unknown as Express;
    registerStorageProxy(app);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("aceita apenas namespaces conhecidos e chaves sem traversal", () => {
    expect(isSafeStorageKey(authorizedKey)).toBe(true);
    expect(isSafeStorageKey("generated/1730000000000.png")).toBe(true);
    expect(isSafeStorageKey("/personnel/occurrences/17/file.pdf")).toBe(false);
    expect(isSafeStorageKey("personnel/occurrences/17/../file.pdf")).toBe(false);
    expect(isSafeStorageKey("personnel\\occurrences\\17\\file.pdf")).toBe(false);
    expect(isSafeStorageKey("private/unknown/file.pdf")).toBe(false);
    expect(personnelOccurrenceOwnerId(authorizedKey)).toBe(17);
    expect(personnelOccurrenceOwnerId("generated/1730000000000.png")).toBeNull();
  });

  it.each(["unauthenticated", "supervisor", "gestor", "finance"])(
    "nega %s no endpoint do proxy sem solicitar URL assinada",
    async (identity) => {
      const response = await invokeProxy(identity);
      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.send).toHaveBeenCalledWith("Storage access denied");
      expect(upstreamFetch).not.toHaveBeenCalled();
      expect(proxyMocks.isAuthorizedPersonnelOccurrenceDocument).not.toHaveBeenCalled();
    },
  );

  it("permite RH autenticado somente quando o arquivo está vinculado à ocorrência e ao proprietário", async () => {
    const response = await invokeProxy("rh");
    expect(proxyMocks.isAuthorizedPersonnelOccurrenceDocument).toHaveBeenCalledWith(authorizedKey);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    expect(response.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(response.redirect).toHaveBeenCalledWith(307, "https://signed-fixture.invalid/file");
  });

  it("permite ADM preexistente somente quando o documento está registrado", async () => {
    const response = await invokeProxy("admin");
    expect(proxyMocks.isAuthorizedPersonnelOccurrenceDocument).toHaveBeenCalledWith(authorizedKey);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    expect(response.redirect).toHaveBeenCalledWith(307, "https://signed-fixture.invalid/file");
  });

  it("nega RH se a chave não corresponde a documento autorizado de uma ocorrência", async () => {
    proxyMocks.isAuthorizedPersonnelOccurrenceDocument.mockResolvedValueOnce(false);
    const response = await invokeProxy("rh", "personnel/occurrences/17/not-linked.pdf");
    expect(response.status).toHaveBeenCalledWith(403);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("preserva o namespace separado de imagens geradas não pessoais", async () => {
    const response = await invokeProxy("unauthenticated", "generated/1730000000000.png");
    expect(proxyMocks.getAuthenticatedUser).not.toHaveBeenCalled();
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    expect(response.redirect).toHaveBeenCalledWith(307, "https://signed-fixture.invalid/file");
  });

  it("expõe o predicado de política do proxy sem acesso ao banco real", async () => {
    expect(await canReadStorageKey(fixtureRequest("rh") as never, authorizedKey)).toBe(true);
    expect(await canReadStorageKey(fixtureRequest("finance") as never, authorizedKey)).toBe(false);
  });
});
