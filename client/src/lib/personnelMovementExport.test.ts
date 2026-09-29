import { describe, expect, it } from "vitest";
import { buildPersonnelMovementWorksheets } from "./personnelMovementExport";

describe("exportação de relatórios de movimentações", () => {
  const personnelRows = [
    { kind: "FT" as const, civilDate: "2026-09-15", employeeName: "Funcionária Teste", position: "Vigilante", post: "Posto Norte", status: "APPROVED" as const, amount: "120.00", paymentDate: new Date("2026-09-20T12:00:00Z"), reason: "Cobertura de folga" },
    { kind: "EXTRA" as const, civilDate: "2026-09-16", employeeName: "Funcionário Teste", position: "Vigilante", post: "Posto Sul", status: "PENDING" as const, amount: "80.00", hoursOrDaily: "4.00", description: "Apoio operacional", cpf: "CPF-SENSIVEL", pixKey: "PIX-SENSIVEL", documentUrl: "/private/medical.pdf" },
  ];

  it("exporta para RH resumo totalizador e campos operacionais sem CPF, PIX ou anexos", () => {
    const [summary, details] = buildPersonnelMovementWorksheets(personnelRows, "RH", "01–15 · 09/2026");
    expect(summary?.rows.slice(0, 3)).toEqual([
      ["Folgas trabalhadas (FT)", 1, 120],
      ["Serviços extras", 1, 80],
      ["Total", 2, 200],
    ]);
    expect(details?.headers).toContain("Detalhe operacional");
    expect(details?.headers).toContain("Posto");
    const exportText = JSON.stringify([summary, details]);
    expect(exportText).toContain("Cobertura de folga");
    expect(exportText).not.toContain("CPF-SENSIVEL");
    expect(exportText).not.toContain("PIX-SENSIVEL");
    expect(exportText).not.toContain("medical.pdf");
  });

  it("exporta para Financeiro nome, referência, status e valor, excluindo texto operacional e dados privados", () => {
    const [summary, details] = buildPersonnelMovementWorksheets(personnelRows, "FINANCEIRO", "16–30 · 09/2026");
    expect(summary?.rows[2]).toEqual(["Total", 2, 200]);
    expect(details?.headers).toEqual(["Data de referência", "Tipo", "Funcionário", "Status", "Valor (R$)", "Pagamento previsto"]);
    const exportText = JSON.stringify([summary, details]);
    expect(exportText).toContain("Funcionária Teste");
    expect(exportText).not.toContain("Cobertura de folga");
    expect(exportText).not.toContain("Apoio operacional");
    expect(exportText).not.toContain("CPF-SENSIVEL");
    expect(exportText).not.toContain("PIX-SENSIVEL");
    expect(exportText).not.toContain("medical.pdf");
  });

  it("mantém o relatório do Gestor agregado por data/tipo, sem dados de pessoa, status ou pagamento", () => {
    const rows = [
      { civilDate: "2026-09-01", kind: "FT" as const, count: 2, amount: 600, employeeName: "Não exportar", status: "APPROVED", cpf: "CPF-SENSIVEL" },
      { civilDate: "2026-09-02", kind: "EXTRA" as const, count: 1, amount: 70, employeeName: "Não exportar", description: "Confidencial", pixKey: "PIX-SENSIVEL" },
    ];
    const worksheets = buildPersonnelMovementWorksheets(rows, "GESTOR", "01–15 · 09/2026");
    const exportText = JSON.stringify(worksheets);
    expect(worksheets[0]?.rows).toEqual([
      ["Folgas trabalhadas (FT)", 2], ["Serviços extras", 1], ["Total de movimentações", 3],
    ]);
    expect(worksheets[1]?.headers).toEqual(["Data civil", "Tipo", "Quantidade de registros"]);
    expect(exportText).not.toContain("600");
    expect(exportText).not.toContain("APPROVED");
    expect(exportText).not.toContain("Não exportar");
    expect(exportText).not.toContain("CPF-SENSIVEL");
    expect(exportText).not.toContain("PIX-SENSIVEL");
    expect(exportText).not.toContain("Confidencial");
  });
});
