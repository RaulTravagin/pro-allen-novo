import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { RouteClosureError } from "./route-closure";

vi.mock("./db", () => ({
  closeSupervisorRoute: vi.fn(),
  getSupervisorShiftReport: vi.fn(),
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
    vi.mocked(db.closeSupervisorRoute).mockResolvedValue({ closed: true, exceptionAudit: null } as never);
    vi.mocked(db.getSupervisorShiftReport).mockResolvedValue({ status: "completed", supervisorRouteId: 13, metrics: { kmFinal: 12025 } } as never);
  });

  it("fecha a rota e retorna o relatório compilado", async () => {
    const result = await appRouter.createCaller(context).supervisorRoutes.finishShift({ supervisorRouteId: 13, kmFinal: 12025 });

    expect(result).toEqual({ closed: true, exceptionAudit: null, report: expect.objectContaining({ status: "completed", supervisorRouteId: 13 }) });
    expect(db.closeSupervisorRoute).toHaveBeenCalledWith({ supervisorRouteId: 13, supervisorId: 7, kmFinal: 12025, exceptionJustification: undefined });
    expect(db.getSupervisorShiftReport).toHaveBeenCalledWith(7, 13);
  });

  it("rejeita KM final menor que o KM inicial", async () => {
    vi.mocked(db.closeSupervisorRoute).mockRejectedValue(new RouteClosureError("BAD_REQUEST", "O KM final informado é inválido"));
    await expect(appRouter.createCaller(context).supervisorRoutes.finishShift({ supervisorRouteId: 13, kmFinal: 11999 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.getSupervisorShiftReport).not.toHaveBeenCalled();
  });
});
