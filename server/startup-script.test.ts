import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as {
  scripts: Record<string, string>;
};
const renderYaml = readFileSync(
  new URL("../render.yaml", import.meta.url),
  "utf8"
);

describe("arranque do serviço Render", () => {
  it("executa as migrations antes do servidor e não chama seed", () => {
    const startCommand = packageJson.scripts["start:render"];

    expect(startCommand).toBe(
      "pnpm db:migrate && NODE_ENV=production node dist/index.js"
    );
    expect(startCommand).not.toContain("db:seed:external");
  });

  it("mantém o seed externo como comando manual e o Blueprint usa start:render", () => {
    expect(packageJson.scripts["db:seed:external"]).toBe(
      "tsx server/external-seed.ts"
    );
    expect(renderYaml).toMatch(/^\s*startCommand:\s*pnpm start:render\s*$/m);
  });
});
