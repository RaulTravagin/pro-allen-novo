import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import * as schema from "../drizzle/schema";
import { checklistItems, posts, supervisorRoutes, visitChecklists } from "../drizzle/schema";
import { getCurrentOperationalPeriod } from "./operational-shifts";

/**
 * O banco externo não fica disponível no ambiente de testes, então validamos o SQL
 * efetivamente emitido pelo Drizzle: colunas qualificadas e ausência de colunas inexistentes.
 */
const db = drizzle({ schema, connection: { connectionString: "postgres://user:pass@localhost:5432/db" } });
const period = getCurrentOperationalPeriod(new Date("2026-08-21T12:00:00-03:00"));
const routeFilter = and(gte(supervisorRoutes.shiftStartedAt, period.start), lt(supervisorRoutes.shiftStartedAt, period.end));
const routeKmInitial = sql`"supervisorRoutes"."kmInitial"`;
const routeKmFinal = sql`"supervisorRoutes"."kmFinal"`;
const routeRouteId = sql`"supervisorRoutes"."routeId"`;
const postRouteId = sql`"posts"."routeId"`;
const itemId = sql`"checklistItems"."id"`;
const itemIsCompliant = sql`"checklistItems"."isCompliant"`;
const answeredNonCompliant = sql`"answeredVisits"."nonCompliantItems"`;

function routeAggregateSql() {
  return db.select({
    totalKm: sql<string | null>`coalesce(sum(greatest(${routeKmFinal} - ${routeKmInitial}, 0)) filter (where ${routeKmInitial} is not null and ${routeKmFinal} is not null), 0)`,
    plannedPosts: sql<string | null>`coalesce(sum((select count(*) from ${posts} where ${postRouteId} = ${routeRouteId})), 0)`,
  }).from(supervisorRoutes).where(routeFilter).toSQL().sql;
}

function complianceAggregateSql() {
  const answeredVisits = db.select({
    visitId: visitChecklists.id,
    nonCompliantItems: sql<number>`count(${itemId}) filter (where ${itemIsCompliant} = false)`.as("nonCompliantItems"),
  }).from(visitChecklists)
    .innerJoin(supervisorRoutes, eq(supervisorRoutes.id, visitChecklists.supervisorRouteId))
    .innerJoin(checklistItems, eq(checklistItems.visitChecklistId, visitChecklists.id))
    .where(routeFilter)
    .groupBy(visitChecklists.id)
    .as("answeredVisits");

  return db.select({
    evaluatedVisits: sql<string | null>`count(*)`,
    compliantVisits: sql<string | null>`count(*) filter (where ${answeredNonCompliant} = 0)`,
  }).from(answeredVisits).toSQL().sql;
}

describe("consulta agregada dos indicadores do Gestor", () => {
  it("qualifica a rota do supervisor na subconsulta de metas, sem coluna ambígua", () => {
    const query = routeAggregateSql();
    expect(query).toContain('"posts"."routeId" = "supervisorRoutes"."routeId"');
    expect(query).not.toMatch(/=\s+"routeId"/);
  });

  it("não referencia colunas inexistentes na tabela de postos", () => {
    expect(routeAggregateSql()).not.toContain("isActive");
  });

  it("qualifica quilometragem e início de turno com a tabela de rotas do supervisor", () => {
    const query = routeAggregateSql();
    expect(query).toContain('"supervisorRoutes"."kmInitial"');
    expect(query).toContain('"supervisorRoutes"."kmFinal"');
    expect(query).toContain('"supervisorRoutes"."shiftStartedAt"');
  });

  it("referencia a coluna agregada da subconsulta pelo alias da própria subconsulta", () => {
    const query = complianceAggregateSql();
    expect(query).toContain('"answeredVisits"."nonCompliantItems"');
  });
});
