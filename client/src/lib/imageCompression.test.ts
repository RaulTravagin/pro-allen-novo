// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { compressImageFile } from "./imageCompression";

describe("compressImageFile", () => {
  it("preserva arquivos que não são imagens rasterizadas", async () => {
    const file = new File(["dados"], "dados.json", {
      type: "application/json",
    });

    await expect(compressImageFile(file)).resolves.toBe(file);
  });
});
