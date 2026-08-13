import { describe, expect, it } from "vitest";

describe("identidade pública do sistema", () => {
  it("usa Pro Allen como título público configurado", () => {
    const title = import.meta.env.VITE_APP_TITLE ?? process.env.VITE_APP_TITLE;
    expect(title).toBe("Pro Allen");
  });
});
