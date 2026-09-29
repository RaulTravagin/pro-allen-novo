import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const popMocks = vi.hoisted(() => ({
  getPersonnelRole: vi.fn(),
  getPostById: vi.fn(),
  listPostPopDocuments: vi.fn(),
  getPostPopDocumentById: vi.fn(),
  createPostPopDocument: vi.fn(),
  deletePostPopDocument: vi.fn(),
  supervisorRouteCanAccessPost: vi.fn(),
  storagePut: vi.fn(),
  storageGetSignedUrl: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getPersonnelRole: popMocks.getPersonnelRole,
    getPostById: popMocks.getPostById,
    listPostPopDocuments: popMocks.listPostPopDocuments,
    getPostPopDocumentById: popMocks.getPostPopDocumentById,
    createPostPopDocument: popMocks.createPostPopDocument,
    deletePostPopDocument: popMocks.deletePostPopDocument,
    supervisorRouteCanAccessPost: popMocks.supervisorRouteCanAccessPost,
  };
});
vi.mock("./storage", () => ({ storagePut: popMocks.storagePut, storageGetSignedUrl: popMocks.storageGetSignedUrl }));

import { appRouter } from "./routers";
import { createGestorSession } from "./gestor-access";

const savedJwtSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET ||= "pops-test-only-signing-secret";

function createContext(options: { role?: "admin" | "user"; personnelRole?: "SUPERVISOR" | "RH" | "FINANCEIRO" | "ADM"; id?: number; cookie?: string } = {}) {
  return {
    user: options.role ? { id: options.id ?? 12, role: options.role, personnelRole: options.personnelRole ?? null } as TrpcContext["user"] : null,
    req: { protocol: "https", headers: options.cookie ? { cookie: options.cookie } : {} } as TrpcContext["req"],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  } satisfies TrpcContext;
}

const doc = {
  id: 77,
  postId: 31,
  originalName: "Procedimento de abertura.pdf",
  mimeType: "application/pdf",
  storageKey: "posts/pops/31/private-object.pdf",
  uploadedBy: 4,
  createdAt: new Date("2026-09-01T12:00:00Z"),
};

describe("autorização tRPC de POPs por posto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    popMocks.getPersonnelRole.mockImplementation((user: { personnelRole?: string; role?: string } | null) => user?.personnelRole ?? (user?.role === "admin" ? "ADM" : "SUPERVISOR"));
    popMocks.getPostById.mockResolvedValue({ id: 31, routeId: 4, isActive: true });
    popMocks.listPostPopDocuments.mockResolvedValue([doc]);
    popMocks.getPostPopDocumentById.mockResolvedValue(doc);
    popMocks.createPostPopDocument.mockResolvedValue(doc);
    popMocks.deletePostPopDocument.mockResolvedValue({ id: 77, deleted: true });
    popMocks.storagePut.mockResolvedValue({ key: doc.storageKey, url: `/manus-storage/${doc.storageKey}` });
    popMocks.supervisorRouteCanAccessPost.mockResolvedValue(true);
    popMocks.storageGetSignedUrl.mockResolvedValue("https://private-storage.invalid/signed-token");
  });

  afterAll(() => {
    if (savedJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = savedJwtSecret;
  });

  it("permite ADM consultar os POPs sem expor a chave interna", async () => {
    const caller = appRouter.createCaller(createContext({ role: "user", personnelRole: "ADM" }));
    const result = await caller.gestor.postPops.list({ postId: 31 });
    expect(result).toEqual([{ id: 77, postId: 31, originalName: doc.originalName, mimeType: doc.mimeType, createdAt: doc.createdAt }]);
    expect(JSON.stringify(result)).not.toContain(doc.storageKey);
  });

  it.each(["SUPERVISOR", "RH", "FINANCEIRO"] as const)("nega administração de POPs ao perfil %s", async (personnelRole) => {
    const caller = appRouter.createCaller(createContext({ role: "user", personnelRole }));
    await expect(caller.gestor.postPops.list({ postId: 31 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.gestor.postPops.upload({ postId: 31, name: "procedimento.pdf", mimeType: "application/pdf", base64: "JVBERi0x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.gestor.postPops.delete({ postId: 31, documentId: 77 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("permite Gestor administrar e nega consulta sem sessão de gestão", async () => {
    const noSession = appRouter.createCaller(createContext());
    await expect(noSession.gestor.postPops.list({ postId: 31 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const token = await createGestorSession();
    const manager = appRouter.createCaller(createContext({ cookie: `gestor_access=${token}` }));
    await expect(manager.gestor.postPops.list({ postId: 31 })).resolves.toHaveLength(1);
    await expect(manager.gestor.postPops.upload({ postId: 31, name: "procedimento.pdf", mimeType: "application/pdf", base64: "JVBERi0x" })).resolves.toMatchObject({ id: 77, postId: 31 });
    await expect(manager.gestor.postPops.delete({ postId: 31, documentId: 77 })).resolves.toEqual({ id: 77, deleted: true });
  });

  it("lista anexos ao supervisor apenas na instância de rota vinculada ao posto", async () => {
    const caller = appRouter.createCaller(createContext({ role: "user", personnelRole: "SUPERVISOR", id: 21 }));
    await expect(caller.supervisorRoutes.getPostPops({ supervisorRouteId: 88, postId: 31 })).resolves.toHaveLength(1);
    expect(popMocks.supervisorRouteCanAccessPost).toHaveBeenCalledWith(88, 31, 21);
    popMocks.supervisorRouteCanAccessPost.mockResolvedValueOnce(false);
    await expect(caller.supervisorRoutes.getPostPops({ supervisorRouteId: 89, postId: 31 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(popMocks.listPostPopDocuments).toHaveBeenCalledTimes(1);
  });

  it("só emite URL de leitura ao supervisor depois de conferir o vínculo rota-posto", async () => {
    const caller = appRouter.createCaller(createContext({ role: "user", personnelRole: "SUPERVISOR", id: 21 }));
    await expect(caller.postPops.downloadUrl({ postId: 31, documentId: 77, supervisorRouteId: 88 })).resolves.toEqual({ url: "https://private-storage.invalid/signed-token" });
    popMocks.supervisorRouteCanAccessPost.mockResolvedValueOnce(false);
    await expect(caller.postPops.downloadUrl({ postId: 31, documentId: 77, supervisorRouteId: 89 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(popMocks.storageGetSignedUrl).toHaveBeenCalledTimes(1);
  });
});
