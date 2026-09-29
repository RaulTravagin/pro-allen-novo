import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { RouteClosureError } from "./route-closure";

vi.mock("./db", () => ({
  createCoverageVisit: vi.fn(),
}));

import * as db from "./db";
import { appRouter } from "./routers";

const ownerContext: TrpcContext = {
  user: {
    id: 7,
    openId: "local:paulo.murashita",
    email: null,
    name: "Paulo Murashita",
    loginMethod: "local",
    username: "paulo.murashita",
    passwordHash: "hash",
    mustChangePassword: false,
    isOperational: true,
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

const coverageReason = "Cobertura emergencial por ausência no posto";

describe("checklists.createCoverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.createCoverageVisit).mockResolvedValue({ checklistId: 301 } as never);
  });

  it("registra cobertura fora da rota dentro do serviço transacional", async () => {
    const result = await appRouter.createCaller(ownerContext).checklists.createCoverage({
      supervisorRouteId: 11,
      postId: 92,
      coverageReason,
    });

    expect(result).toEqual({ checklistId: 301 });
    expect(db.createCoverageVisit).toHaveBeenCalledWith({ supervisorRouteId: 11, supervisorId: 7, postId: 92, coverageReason });
  });

  it("passa a Base Operacional ao serviço que prepara o posto e trava a rota antes do checklist", async () => {
    const result = await appRouter.createCaller(ownerContext).checklists.createCoverage({
      supervisorRouteId: 11,
      postId: "operational_base",
      coverageReason: "Permanência operacional na base",
    });

    expect(result).toEqual({ checklistId: 301 });
    expect(db.createCoverageVisit).toHaveBeenCalledWith({
      supervisorRouteId: 11,
      supervisorId: 7,
      postId: "operational_base",
      coverageReason: "Permanência operacional na base",
    });
  });

  it("exige justificativa antes de iniciar a mutation de cobertura", async () => {
    await expect(appRouter.createCaller(ownerContext).checklists.createCoverage({
      supervisorRouteId: 11,
      postId: 92,
      coverageReason: "urgente",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.createCoverageVisit).not.toHaveBeenCalled();
  });

  it("propaga falha de propriedade/estado validada dentro do lock da rota", async () => {
    vi.mocked(db.createCoverageVisit).mockRejectedValue(new RouteClosureError("NOT_FOUND", "Rota não encontrada para este supervisor"));

    await expect(appRouter.createCaller(ownerContext).checklists.createCoverage({
      supervisorRouteId: 11,
      postId: 92,
      coverageReason,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.createCoverageVisit).toHaveBeenCalledWith({ supervisorRouteId: 11, supervisorId: 7, postId: 92, coverageReason });
  });

  it("propaga conflito quando a transação encontra visita ativa ou posto planejado", async () => {
    vi.mocked(db.createCoverageVisit).mockRejectedValue(new RouteClosureError("CONFLICT", "Finalize a visita ativa antes de registrar uma cobertura"));

    await expect(appRouter.createCaller(ownerContext).checklists.createCoverage({
      supervisorRouteId: 11,
      postId: 92,
      coverageReason,
    })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
