import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const initialPassword = process.env.INITIAL_SUPERVISOR_PASSWORD;
const activeSupervisorUsernames = [
  "paulo.murashita",
  "rodrigo.ramos",
  "aparecido.quirino",
];

function createContext() {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const context: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
      clearCookie: () => undefined,
    } as TrpcContext["res"],
  };
  return { context, cookies };
}

describe("contas locais de supervisores", () => {
  it("autentica as três contas locais ativas com a senha inicial protegida", async () => {
    expect(initialPassword).toBeTruthy();

    for (const username of activeSupervisorUsernames) {
      const { context, cookies } = createContext();
      const result = await appRouter.createCaller(context).localAuth.login({
        username,
        password: initialPassword!,
      });
      expect(result).toMatchObject({ success: true, user: { username } });
      expect(cookies[0]?.name).toBe("supervisor_access");
    }
  });

  it("mantém Raul Travagin bloqueado após sua remoção da operação", async () => {
    await expect(appRouter.createCaller(createContext().context).localAuth.login({
      username: "raul.travagin",
      password: initialPassword!,
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
