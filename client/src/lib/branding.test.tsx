import { describe, expect, it } from "vitest";

describe("identidade pública do sistema", () => {
  it("usa CT3 como título público configurado", () => {
    const title = import.meta.env.VITE_APP_TITLE ?? process.env.VITE_APP_TITLE;
    expect(title).toBe("CT3");
  });
});
