import { describe, expect, it } from "vitest";
import { toPublicUser } from "./routers";

describe("contrato público de usuário", () => {
  it("remove credenciais e identificadores internos", () => {
    const safeUser = toPublicUser({
      id: 7,
      openId: "internal-open-id",
      name: "Usuário fictício",
      loginMethod: "local",
      username: "usuario.teste",
      passwordHash: "scrypt$fake$fake",
      mustChangePassword: true,
      isOperational: true,
      defaultShift: "day",
      personnelRole: "RH",
      role: "user",
      createdAt: new Date("2026-01-01T12:00:00Z"),
      updatedAt: new Date("2026-01-01T12:00:00Z"),
      lastSignedIn: new Date("2026-01-01T12:00:00Z"),
    });

    expect(safeUser).toEqual({
      id: 7,
      name: "Usuário fictício",
      username: "usuario.teste",
      role: "user",
      personnelRole: "RH",
      isOperational: true,
      defaultShift: "day",
    });
    expect(safeUser).not.toHaveProperty("passwordHash");
    expect(safeUser).not.toHaveProperty("openId");
    expect(safeUser).not.toHaveProperty("email");
  });
});
