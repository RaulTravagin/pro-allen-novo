import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getSupervisorRouteById: vi.fn(),
  getSupervisorShiftReport: vi.fn(),
  updateSupervisorRoute: vi.fn(),
}));

import * as db from "./db";
import { appRouter } from "./routers";

const context: TrpcContext = {
  user: {
    id: 7,
    openId: "local:paulo.murashita",
    name: "Paulo Murashita",
    email: null,
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

describe("supervisorRoutes.finishShift", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getSupervisorRouteById).mockResolvedValue({ id: 13, supervisorId: 7, status: "in_progress", kmInitial: "12000" } as never);
    vi.mocked(db.updateSupervisorRoute).mockResolvedValue(undefined as never);
    vi.mocked(db.getSupervisorShiftReport).mockResolvedValue({ status: "completed", supervisorRouteId: 13, metrics: { kmFinal: 12025 } } as never);
  });

  it("fecha a rota e retorna o relatório compilado", async () => {
    const result = await appRouter.createCaller(context).supervisorRoutes.finishShift({ supervisorRouteId: 13, kmFinal: 12025 });

    expect(result).toEqual({ closed: true, report: expect.objectContaining({ status: "completed", supervisorRouteId: 13 }) });
    expect(db.updateSupervisorRoute).toHaveBeenCalledWith(13, expect.objectContaining({ kmFinal: 12025, status: "completed", completedAt: expect.any(Date) }));
    expect(db.getSupervisorShiftReport).toHaveBeenCalledWith(7, 13);
  });

  it("rejeita KM final menor que o KM inicial", async () => {
    await expect(appRouter.createCaller(context).supervisorRoutes.finishShift({ supervisorRouteId: 13, kmFinal: 11999 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.updateSupervisorRoute).not.toHaveBeenCalled();
  });
});
