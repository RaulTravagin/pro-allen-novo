import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const initialPassword = process.env.INITIAL_SUPERVISOR_PASSWORD;
const supervisorUsernames = [
  "paulo.murashita",
  "rodrigo.ramos",
  "aparecido.quirino",
  "raul.travagin",
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
  it("autentica as quatro contas reais com a senha inicial protegida", async () => {
    expect(initialPassword).toBeTruthy();

    for (const username of supervisorUsernames) {
      const { context, cookies } = createContext();
      const result = await appRouter.createCaller(context).localAuth.login({
        username,
        password: initialPassword!,
      });
      expect(result).toMatchObject({ success: true, user: { username } });
      expect(cookies[0]?.name).toBe("supervisor_access");
    }
  });
});
