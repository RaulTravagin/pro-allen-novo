import { and, eq } from "drizzle-orm";
import { posts, routes, users } from "../drizzle/schema";
import { getDb } from "./db";
import { hashSupervisorPassword } from "./local-supervisor-auth";

const routeCatalog = [
  { name: "Rota 1", region: "Jordanésia e Campo Limpo", posts: [["Kelvion", "Jordanésia"], ["Supertec", "Campo Limpo"], ["Comtec 2", "Campo Limpo"], ["Coco Leve", "Campo Limpo"]] },
  { name: "Rota 2", region: "Jundiaí", posts: [["Condomínio Esmeralda", "Jundiaí"], ["Caminhos da Serra 1", "Jundiaí"], ["Caminhos da Serra 2", "Jundiaí"], ["Instituto Luiz Braille", "Jundiaí"], ["Flex 1", "Jundiaí"], ["Flex 2", "Jundiaí"], ["Cidade Vicentina", "Jundiaí"], ["Condomínio Tropical I", "Jundiaí"], ["Auto Posto Shell", "Jundiaí"]] },
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

  for (const route of routeCatalog) {
    let [routeRecord] = await db.select().from(routes).where(eq(routes.name, route.name)).limit(1);
    if (!routeRecord) {
      await db.insert(routes).values({ name: route.name, region: route.region, description: "Rota operacional inicial", activityType: "field_route" });
      [routeRecord] = await db.select().from(routes).where(eq(routes.name, route.name)).limit(1);
    }
    for (let index = 0; index < route.posts.length; index += 1) {
      const [postName, region] = route.posts[index];
      const [existingPost] = await db.select().from(posts).where(and(eq(posts.routeId, routeRecord.id), eq(posts.name, postName))).limit(1);
      if (!existingPost) {
        await db.insert(posts).values({ routeId: routeRecord.id, name: postName, region, address: "Endereço pendente de cadastro", order: index + 1 });
      }
    }
  }

  const [base] = await db.select().from(routes).where(eq(routes.name, "Base Operacional")).limit(1);
  if (!base) await db.insert(routes).values({ name: "Base Operacional", region: "Operação interna", description: "Atividade sem posto de cliente", activityType: "operational_base" });

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
