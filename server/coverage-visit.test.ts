import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  createVisitChecklist: vi.fn(),
  createChecklistItem: vi.fn(),
  getPostById: vi.fn(),
  getOrCreateOperationalBasePost: vi.fn(),
  getSupervisorRouteById: vi.fn(),
  getVisitChecklistsByRoute: vi.fn(),
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

describe("checklists.createCoverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getSupervisorRouteById).mockResolvedValue({ id: 11, supervisorId: 7, routeId: 1, status: "in_progress" } as never);
    vi.mocked(db.getPostById).mockResolvedValue({ id: 92, routeId: 2, name: "Posto de cobertura" } as never);
    vi.mocked(db.getOrCreateOperationalBasePost).mockResolvedValue({ id: 93, routeId: 50, name: "Base Operacional" } as never);
    vi.mocked(db.getVisitChecklistsByRoute).mockResolvedValue([] as never);
    vi.mocked(db.createVisitChecklist).mockResolvedValue(301);
  });

  it("registra uma cobertura fora da rota com justificativa e checklist padrão", async () => {
    const result = await appRouter.createCaller(ownerContext).checklists.createCoverage({
      supervisorRouteId: 11,
      postId: 92,
      coverageReason: "Cobertura emergencial por ausência no posto",
    });

    expect(result).toEqual({ checklistId: 301 });
    expect(db.createVisitChecklist).toHaveBeenCalledWith(11, 92, {
      isCoverage: true,
      coverageReason: "Cobertura emergencial por ausência no posto",
    });
    expect(db.createChecklistItem).toHaveBeenCalledTimes(9);
  });

  it("registra uma atividade na Base Operacional com justificativa e posto persistível", async () => {
    const result = await appRouter.createCaller(ownerContext).checklists.createCoverage({
      supervisorRouteId: 11,
      postId: "operational_base",
      coverageReason: "Permanência operacional na base",
    });

    expect(result).toEqual({ checklistId: 301 });
    expect(db.getOrCreateOperationalBasePost).toHaveBeenCalledTimes(1);
    expect(db.createVisitChecklist).toHaveBeenCalledWith(11, 93, {
      isCoverage: true,
      coverageReason: "Permanência operacional na base",
    });
    expect(db.createChecklistItem).toHaveBeenCalledTimes(9);
  });

  it("exige justificativa antes de criar uma cobertura", async () => {
    await expect(appRouter.createCaller(ownerContext).checklists.createCoverage({
      supervisorRouteId: 11,
      postId: 92,
      coverageReason: "urgente",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.createVisitChecklist).not.toHaveBeenCalled();
  });

  it("exige justificativa também para a Base Operacional", async () => {
    await expect(appRouter.createCaller(ownerContext).checklists.createCoverage({
      supervisorRouteId: 11,
      postId: "operational_base",
      coverageReason: "urgente",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.getOrCreateOperationalBasePost).not.toHaveBeenCalled();
    expect(db.createVisitChecklist).not.toHaveBeenCalled();
  });

  it("bloqueia um posto que já pertence à rota planejada", async () => {
    vi.mocked(db.getPostById).mockResolvedValue({ id: 3, routeId: 1, name: "Posto planejado" } as never);

    await expect(appRouter.createCaller(ownerContext).checklists.createCoverage({
      supervisorRouteId: 11,
      postId: 3,
      coverageReason: "Cobertura emergencial por ausência no posto",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("bloqueia cobertura em uma rota pertencente a outro supervisor", async () => {
    vi.mocked(db.getSupervisorRouteById).mockResolvedValue({ id: 11, supervisorId: 18, routeId: 1, status: "in_progress" } as never);

    await expect(appRouter.createCaller(ownerContext).checklists.createCoverage({
      supervisorRouteId: 11,
      postId: 92,
      coverageReason: "Cobertura emergencial por ausência no posto",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.createVisitChecklist).not.toHaveBeenCalled();
  });
});
