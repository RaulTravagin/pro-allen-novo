import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getRouteById: vi.fn(),
  getSupervisorRoutesToday: vi.fn(),
  createSupervisorRoute: vi.fn(),
}));

import * as db from "./db";
import { appRouter } from "./routers";

const context: TrpcContext = {
  user: {
    id: 1,
    openId: "supervisor-1",
    name: "Supervisor",
    email: "supervisor@example.com",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("supervisorRoutes.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getRouteById).mockResolvedValue({ id: 1, name: "Rota 1" } as never);
  });

  it("reutiliza a rota aberta do dia em vez de lançar conflito", async () => {
    vi.mocked(db.getSupervisorRoutesToday).mockResolvedValue([
      { id: 44, status: "pending" },
    ] as never);
    const caller = appRouter.createCaller(context);

    await expect(caller.supervisorRoutes.create({ routeId: 1, date: new Date() })).resolves.toBe(44);
    expect(db.createSupervisorRoute).not.toHaveBeenCalled();
  });

  it("cria uma rota quando não existe rota aberta no dia", async () => {
    vi.mocked(db.getSupervisorRoutesToday).mockResolvedValue([]);
    vi.mocked(db.createSupervisorRoute).mockResolvedValue(45);
    const caller = appRouter.createCaller(context);

    await expect(caller.supervisorRoutes.create({ routeId: 1, date: new Date() })).resolves.toBe(45);
    expect(db.createSupervisorRoute).toHaveBeenCalledWith(1, 1, expect.any(Date));
  });
});
