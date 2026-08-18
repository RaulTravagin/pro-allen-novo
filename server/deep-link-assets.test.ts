import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("assets em rotas profundas", () => {
  it("mantém o ponto de entrada e os assets na raiz para abrir /gestor/acesso diretamente", () => {
    const root = process.cwd();
    const html = fs.readFileSync(path.join(root, "client", "index.html"), "utf8");
    const viteConfig = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8");

    expect(html).toContain('src="/src/main.tsx"');
    expect(viteConfig).toContain('base: "/"');
  });
});
