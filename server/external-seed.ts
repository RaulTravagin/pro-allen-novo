import { and, eq } from "drizzle-orm";
import { postVisitHistory, posts, routes, users, visitChecklists } from "../drizzle/schema";
import { getDb, getInsertedId } from "./db";
import { hashSupervisorPassword } from "./local-supervisor-auth";

const routeCatalog = [
  { name: "Rota 1", region: "Jordanésia e Campo Limpo", posts: [["Kelvion", "Jordanésia"], ["Supertec", "Campo Limpo"], ["Comtec 2", "Campo Limpo"]] },
  { name: "Rota 2", region: "Jundiaí", posts: [["Condomínio Esmeralda", "Jundiaí"], ["Caminhos da Serra 1", "Jundiaí"], ["Caminhos da Serra 2", "Jundiaí"], ["Instituto Luiz Braille", "Jundiaí"], ["Flex 1", "Jundiaí"], ["Flex 2", "Jundiaí"], ["Cidade Vicentina", "Jundiaí"], ["Condomínio Tropical I", "Jundiaí"], ["Auto Posto Shell", "Jundiaí"], ["Galpão", "Jundiaí", "Av. das Indústrias, 655"]] },
  { name: "Rota 3", region: "Jundiaí", posts: [["Open View", "Jundiaí"], ["Terras de Gênova", "Jundiaí"], ["Reserva da Mata", "Jundiaí"], ["Metalúrgica Saff", "Jundiaí"], ["C.M.A", "Jundiaí"], ["São Francisco", "Jundiaí"]] },
  { name: "Rota 4", region: "Jundiaí e Cabreúva", posts: [["Brasimet", "Jundiaí"], ["Bottcher", "Jundiaí"], ["Magnera", "Jundiaí"], ["G.A.G", "Jundiaí"], ["Eco Village", "Jundiaí"], ["C.P.Q", "Jundiaí"], ["Carmel", "Cabreúva"]] },
] as const;

const supervisorCatalog = [
  { username: "paulo.murashita", name: "Paulo Murashita", shift: "reliever" as const, passwordEnv: "INITIAL_SUPERVISOR_PASSWORD" },
  { username: "rodrigo.ramos", name: "Rodrigo Ramos", shift: "day" as const, passwordEnv: "INITIAL_SUPERVISOR_PASSWORD" },
  { username: "aparecido.quirino", name: "Aparecido Quirino", shift: "night" as const, passwordEnv: "INITIAL_SUPERVISOR_PASSWORD" },
  { username: "raultravagin", name: "Raul Travagin", shift: "reliever" as const, passwordEnv: "RAULTRAVAGIN_INITIAL_PASSWORD" },
] as const;

async function seed() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL não configurada ou inacessível.");

  const routeRecords = new Map<string, typeof routes.$inferSelect>();
  for (const route of routeCatalog) {
    let [routeRecord] = await db.select().from(routes).where(eq(routes.name, route.name)).limit(1);
    if (!routeRecord) {
      await db.insert(routes).values({ name: route.name, region: route.region, description: "Rota operacional inicial", activityType: "field_route" });
      [routeRecord] = await db.select().from(routes).where(eq(routes.name, route.name)).limit(1);
    }
    if (!routeRecord) throw new Error(`Não foi possível provisionar ${route.name}.`);
    routeRecords.set(route.name, routeRecord);
  }

  const route2 = routeRecords.get("Rota 2");
  const route1 = routeRecords.get("Rota 1");
  if (route1 && route2) {
    const [route1Galpao] = await db.select().from(posts).where(and(eq(posts.routeId, route1.id), eq(posts.name, "Galpão"))).limit(1);
    const [route1CocoLeve] = await db.select().from(posts).where(and(eq(posts.routeId, route1.id), eq(posts.name, "Coco Leve"))).limit(1);
    if (route1Galpao && route1CocoLeve) {
      await db.update(visitChecklists).set({ postId: route1Galpao.id }).where(eq(visitChecklists.postId, route1CocoLeve.id));
      await db.update(postVisitHistory).set({ postId: route1Galpao.id }).where(eq(postVisitHistory.postId, route1CocoLeve.id));
      await db.delete(posts).where(eq(posts.id, route1CocoLeve.id));
    }
    const sourcePost = route1Galpao ?? route1CocoLeve;
    if (sourcePost) {
      const [route2Galpao] = await db.select().from(posts).where(and(eq(posts.routeId, route2.id), eq(posts.name, "Galpão"))).limit(1);
      if (route2Galpao && route2Galpao.id !== sourcePost.id) {
        await db.update(visitChecklists).set({ postId: route2Galpao.id }).where(eq(visitChecklists.postId, sourcePost.id));
        await db.update(postVisitHistory).set({ postId: route2Galpao.id }).where(eq(postVisitHistory.postId, sourcePost.id));
        await db.delete(posts).where(eq(posts.id, sourcePost.id));
      } else if (!route2Galpao) {
        await db.update(posts).set({ routeId: route2.id, region: "Jundiaí", address: "Av. das Indústrias, 655", order: 10, name: "Galpão" }).where(eq(posts.id, sourcePost.id));
      }
    }
  }

  for (const route of routeCatalog) {
    const routeRecord = routeRecords.get(route.name);
    if (!routeRecord) throw new Error(`Rota ${route.name} não encontrada após provisionamento.`);
    for (let index = 0; index < route.posts.length; index += 1) {
      const [postName, region, address] = route.posts[index];
      const [existingPost] = await db.select().from(posts).where(and(eq(posts.routeId, routeRecord.id), eq(posts.name, postName))).limit(1);
      if (!existingPost) {
        await db.insert(posts).values({ routeId: routeRecord.id, name: postName, region, address: address ?? "Endereço pendente de cadastro", order: index + 1 });
      } else if (postName === "Galpão" && route.name === "Rota 2") {
        await db.update(posts).set({ region: "Jundiaí", address: "Av. das Indústrias, 655", order: index + 1 }).where(eq(posts.id, existingPost.id));
      }
    }
  }

  let [base] = await db.select().from(routes).where(eq(routes.activityType, "operational_base")).limit(1);
  if (!base) {
    const result = await db.insert(routes).values({ name: "Base Operacional", region: "Operação interna", description: "Atividade sem posto de cliente", activityType: "operational_base" }).returning({ id: routes.id });
    [base] = await db.select().from(routes).where(eq(routes.id, getInsertedId(result))).limit(1);
  }
  if (base) {
    const [basePost] = await db.select().from(posts).where(and(eq(posts.routeId, base.id), eq(posts.name, "Base Operacional"))).limit(1);
    if (!basePost) {
      await db.insert(posts).values({ routeId: base.id, name: "Base Operacional", region: "Operação interna", address: "Atividade interna sem posto de cliente", order: 1 });
    }
  }

  for (const supervisor of supervisorCatalog) {
    const password = process.env[supervisor.passwordEnv];
    if (!password) throw new Error(`Defina ${supervisor.passwordEnv} antes de executar o seed externo.`);
    const [existingUser] = await db.select().from(users).where(eq(users.username, supervisor.username)).limit(1);
    if (!existingUser) {
      await db.insert(users).values({
        openId: `local:${supervisor.username}`,
        username: supervisor.username,
        name: supervisor.name,
        loginMethod: "local",
        passwordHash: await hashSupervisorPassword(password),
        mustChangePassword: true,
        isOperational: true,
        defaultShift: supervisor.shift,
        role: "user",
      });
    }
  }
  console.log("[External seed] Rotas, postos e supervisores iniciais verificados.");
}

seed().catch((error) => {
  console.error("[External seed] Falha:", error);
  process.exit(1);
});
