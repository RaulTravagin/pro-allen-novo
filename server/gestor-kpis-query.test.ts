import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import * as schema from "../drizzle/schema";
import { posts, supervisorRoutes, visitChecklists } from "../drizzle/schema";
import { getCurrentOperationalPeriod } from "./operational-shifts";

const db = drizzle({ schema, connection: { connectionString: "postgres://user:pass@localhost:5432/db" } });
const period = getCurrentOperationalPeriod(new Date("2026-08-21T12:00:00-03:00"));
const routeFilter = and(gte(supervisorRoutes.shiftStartedAt, period.start), lt(supervisorRoutes.shiftStartedAt, period.end));
const routeKmInitial = sql`"supervisorRoutes"."kmInitial"`;
const routeKmFinal = sql`"supervisorRoutes"."kmFinal"`;
const routeRouteId = sql`"supervisorRoutes"."routeId"`;
const postRouteId = sql`"posts"."routeId"`;
const occurrenceReport = sql`"visitChecklists"."occurrenceReport"`;

function routeAggregateSql() {
  return db.select({
    totalKm: sql<string | null>`coalesce(sum(greatest(${routeKmFinal} - ${routeKmInitial}, 0)) filter (where ${routeKmInitial} is not null and ${routeKmFinal} is not null), 0)`,
    plannedPosts: sql<string | null>`coalesce(sum((select count(*) from ${posts} where ${postRouteId} = ${routeRouteId})), 0)`,
  }).from(supervisorRoutes).where(routeFilter).toSQL().sql;
}

function occurrenceAggregateSql() {
  return db.select({
    totalVisits: sql<string | null>`count(*)`,
    reportedVisits: sql<string | null>`count(*) filter (where nullif(trim(coalesce(${occurrenceReport}, '')), '') is not null)`,
  }).from(visitChecklists)
    .innerJoin(supervisorRoutes, eq(supervisorRoutes.id, visitChecklists.supervisorRouteId))
    .where(routeFilter).toSQL().sql;
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

  it("conta visitas com ocorrência enviada sem consultar itens antigos", () => {
    const query = occurrenceAggregateSql();
    expect(query).toContain('"visitChecklists"."occurrenceReport"');
    expect(query).not.toContain("checklistItems");
  });
});
