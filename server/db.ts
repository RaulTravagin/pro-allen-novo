import { eq, desc, asc, and, or, gte, lte, lt, inArray, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../drizzle/schema";
import { InsertUser, users, routes, posts, supervisorRoutes, visitChecklists, checklistItems, supervisorLocations, postVisitHistory, supervisorSchedules, vehicles, fuelLogs } from "../drizzle/schema";
import { ENV } from './_core/env';
import { getCurrentOperationalPeriod, getOperationalPeriodForCalendarDate, getOperationalRangeForCalendarDates, getOperationalShift, type OperationShift } from "./operational-shifts";
import { buildSupervisorShiftReport } from "./supervisor-shift-report";

let _db: NodePgDatabase<typeof schema> | null = null;
let _pool: Pool | null = null;

const TRANSIENT_DATABASE_CODES = new Set([
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
  "08000", // connection_exception
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "08003", // connection_does_not_exist
  "08006", // connection_failure
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
]);

export function isTransientDatabaseError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown } | undefined;
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const message = typeof candidate?.message === "string" ? candidate.message.toLowerCase() : "";
  return TRANSIENT_DATABASE_CODES.has(code) || /connection terminated|connection closed|timeout|network|socket hang up/.test(message);
}

async function resetDatabasePool(reason: string) {
  const pool = _pool;
  _db = null;
  _pool = null;
  if (!pool) return;
  try {
    await pool.end();
  } catch (error) {
    console.warn(`[Database] Falha ao encerrar o pool após ${reason}:`, error);
  }
}

export async function closeDatabasePool() {
  await resetDatabasePool("encerramento controlado da aplicação");
}

/** Normaliza retornos PostgreSQL com cláusula RETURNING para obter o identificador inserido. */
export function getInsertedId(result: unknown) {
  const row = Array.isArray(result) ? result[0] : result;
  const insertId = Number((row as { id?: unknown; insertId?: unknown } | undefined)?.id ?? (row as { insertId?: unknown } | undefined)?.insertId);
  if (!Number.isSafeInteger(insertId) || insertId <= 0) {
    throw new Error("Não foi possível obter o identificador do registro criado");
  }
  return insertId;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (_db) return _db;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;

  try {
    const requiresSsl = process.env.DATABASE_SSL === "true" || databaseUrl.includes("neon.tech");
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
      max: 6,
      min: 0,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: false,
      keepAlive: true,
    });
    pool.on("error", (error) => {
      console.error("[Database] Erro em conexão ociosa do pool:", error);
      if (isTransientDatabaseError(error)) {
        void resetDatabasePool("falha transitória da conexão");
      }
    });
    await pool.query("SELECT 1");
    _pool = pool;
    _db = drizzle({ client: pool, schema });
  } catch (error) {
    console.warn("[Database] Banco indisponível; uma nova tentativa será feita na próxima operação:", error);
    await resetDatabasePool("falha de conexão inicial");
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function provisionLocalSupervisor(input: { username: string; name: string; passwordHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getUserByUsername(input.username);

  if (existing) {
    await db.update(users).set({
      username: input.username,
      passwordHash: input.passwordHash,
      mustChangePassword: true,
      isOperational: true,
    }).where(eq(users.id, existing.id));
    return (await getUserById(existing.id))!;
  }

  const result = await db.insert(users).values({
    openId: `local:${input.username}`,
    name: input.name,
    loginMethod: "local",
    username: input.username,
    passwordHash: input.passwordHash,
    mustChangePassword: true,
    isOperational: true,
    role: "user",
    lastSignedIn: new Date(),
  }).returning({ id: users.id });
  return (await getUserById(getInsertedId(result)))!;
}

export const SCHEDULE_ASSIGNMENTS = ["day", "night", "reliever", "off"] as const;
export type ScheduleAssignment = (typeof SCHEDULE_ASSIGNMENTS)[number];

function normalizeScheduleDate(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
}

export async function getGestorSchedule(scheduleDate = new Date()) {
  const db = await getDb();
  if (!db) return { scheduleDate: normalizeScheduleDate(scheduleDate), supervisors: [] };
  const normalizedDate = normalizeScheduleDate(scheduleDate);
  const [operationalSupervisors, overrides] = await Promise.all([
    db.select({ id: users.id, name: users.name, username: users.username, defaultShift: users.defaultShift })
      .from(users)
      .where(and(eq(users.role, "user"), eq(users.isOperational, true)))
      .orderBy(users.name),
    db.select({ supervisorId: supervisorSchedules.supervisorId, assignment: supervisorSchedules.assignment, note: supervisorSchedules.note, updatedAt: supervisorSchedules.updatedAt, updatedBy: supervisorSchedules.updatedBy })
      .from(supervisorSchedules)
      .where(eq(supervisorSchedules.scheduleDate, normalizedDate)),
  ]);
  const overridesBySupervisor = new Map(overrides.map((item) => [item.supervisorId, item]));
  const scheduledSupervisors = operationalSupervisors.filter((supervisor) => supervisor.defaultShift !== null);
  return {
    scheduleDate: normalizedDate,
    supervisors: scheduledSupervisors.map((supervisor) => {
      const override = overridesBySupervisor.get(supervisor.id);
      return {
        supervisorId: supervisor.id,
        supervisorName: supervisor.name ?? `Supervisor #${supervisor.id}`,
        username: supervisor.username,
        defaultShift: supervisor.defaultShift ?? "off",
        assignment: (override?.assignment ?? supervisor.defaultShift ?? "off") as ScheduleAssignment,
        note: override?.note ?? null,
        isOverride: Boolean(override),
        updatedAt: override?.updatedAt ?? null,
      };
    }),
  };
}

export async function replaceGestorSchedule(input: { scheduleDate: Date; entries: Array<{ supervisorId: number; assignment: ScheduleAssignment; note?: string | null }>; updatedBy?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const normalizedDate = normalizeScheduleDate(input.scheduleDate);
  const activeSupervisors = await db.select({ id: users.id, defaultShift: users.defaultShift })
    .from(users)
    .where(and(eq(users.role, "user"), eq(users.isOperational, true)));
  const validSupervisorIds = new Set(activeSupervisors.filter((supervisor) => supervisor.defaultShift !== null).map((supervisor) => supervisor.id));
  const receivedIds = new Set<number>();
  for (const entry of input.entries) {
    if (!validSupervisorIds.has(entry.supervisorId)) throw new Error("Supervisor operacional inválido para a escala");
    if (receivedIds.has(entry.supervisorId)) throw new Error("Um supervisor não pode receber duas atribuições na mesma data");
    receivedIds.add(entry.supervisorId);
  }

  await db.transaction(async (transaction) => {
    await transaction.delete(supervisorSchedules).where(eq(supervisorSchedules.scheduleDate, normalizedDate));
    if (input.entries.length) {
      await transaction.insert(supervisorSchedules).values(input.entries.map((entry) => ({
        scheduleDate: normalizedDate,
        supervisorId: entry.supervisorId,
        assignment: entry.assignment,
        note: entry.note?.trim() || null,
        updatedBy: input.updatedBy ?? null,
      })));
    }
  });
  return getGestorSchedule(normalizedDate);
}

// Routes queries
export async function getAllRoutes() {
  const db = await getDb();
  if (!db) return [];
  const [routeRows, postRows] = await Promise.all([
    db.select().from(routes),
    db.select().from(posts).orderBy(posts.routeId, posts.order),
  ]);
  const postsByRoute = new Map<number, typeof postRows>();
  for (const post of postRows) {
    const grouped = postsByRoute.get(post.routeId) ?? [];
    grouped.push(post);
    postsByRoute.set(post.routeId, grouped);
  }
  return routeRows.map((route) => {
    const routePosts = postsByRoute.get(route.id) ?? [];
    return { ...route, posts: routePosts, postCount: routePosts.length };
  });
}

export async function getRouteById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(routes).where(eq(routes.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// Posts queries
export async function getPostsByRouteId(routeId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(posts).where(eq(posts.routeId, routeId)).orderBy(posts.order);
}

export async function getPostById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getGestorPostsManagement() {
  return { routes: await getAllRoutes() };
}

export async function createGestorPost(input: { routeId: number; name: string; region: string; address: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const route = await getRouteById(input.routeId);
  if (!route) throw new Error("Rota não encontrada");
  const routePosts = await getPostsByRouteId(input.routeId);
  const order = routePosts.reduce((maximum, post) => Math.max(maximum, post.order), 0) + 1;
  const result = await db.insert(posts).values({
    routeId: input.routeId,
    name: input.name.trim(),
    region: input.region.trim(),
    address: input.address.trim(),
    order,
  }).returning({ id: posts.id });
  return getPostById(getInsertedId(result));
}

// Supervisor Routes queries
export async function createSupervisorRoute(supervisorId: number, routeId: number, date: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const shift = getOperationalShift(date);
  
  const result = await db.insert(supervisorRoutes).values({
    supervisorId,
    routeId,
    date,
    shiftType: shift.shiftType,
    shiftStartedAt: shift.shiftStartedAt,
    status: 'pending',
  }).returning({ id: supervisorRoutes.id });

  return getInsertedId(result);
}

function normalizeVehiclePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

export async function listActiveVehicles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vehicles).where(eq(vehicles.isActive, true)).orderBy(vehicles.plate);
}

export async function getVehicleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  return result[0] ?? null;
}

export async function upsertVehicle(input: { plate: string; model: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const plate = normalizeVehiclePlate(input.plate);
  const model = input.model.trim();
  if (plate.length < 7) throw new Error("Informe uma placa válida");
  if (model.length < 2) throw new Error("Informe o modelo da viatura");
  const existing = await db.select().from(vehicles).where(eq(vehicles.plate, plate)).limit(1);
  if (existing[0]) {
    await db.update(vehicles).set({ model, isActive: true }).where(eq(vehicles.id, existing[0].id));
    return (await getVehicleById(existing[0].id))!;
  }
  const result = await db.insert(vehicles).values({ plate, model, isActive: true }).returning({ id: vehicles.id });
  return (await getVehicleById(getInsertedId(result)))!;
}

type FuelMetrics = {
  distanceSincePrevious: number | null;
  consumptionKmPerLiter: number | null;
  costPerKm: number | null;
};

function calculateFuelMetrics(current: { odometerKm: unknown; liters: unknown; amount: unknown }, previous?: { odometerKm: unknown }): FuelMetrics {
  if (!previous) return { distanceSincePrevious: null, consumptionKmPerLiter: null, costPerKm: null };
  const distance = Number(current.odometerKm) - Number(previous.odometerKm);
  if (!Number.isFinite(distance) || distance <= 0) return { distanceSincePrevious: null, consumptionKmPerLiter: null, costPerKm: null };
  const liters = Number(current.liters);
  const amount = Number(current.amount);
  return {
    distanceSincePrevious: Number(distance.toFixed(2)),
    consumptionKmPerLiter: liters > 0 ? Number((distance / liters).toFixed(2)) : null,
    costPerKm: amount >= 0 ? Number((amount / distance).toFixed(2)) : null,
  };
}

/** Enriquece o histórico de uma viatura com o consumo calculado entre abastecimentos consecutivos. */
export function enrichFuelHistory<T extends { odometerKm: unknown; liters: unknown; amount: unknown; createdAt: Date }>(logs: T[]) {
  const chronological = [...logs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return chronological
    .map((log, index) => ({ ...log, ...calculateFuelMetrics(log, chronological[index - 1]) }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getVehicleFuelSummary(vehicleId: number) {
  const db = await getDb();
  if (!db) return null;
  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) return null;
  const logs = await db.select({
    id: fuelLogs.id,
    vehicleId: fuelLogs.vehicleId,
    supervisorRouteId: fuelLogs.supervisorRouteId,
    supervisorId: fuelLogs.supervisorId,
    odometerKm: fuelLogs.odometerKm,
    amount: fuelLogs.amount,
    liters: fuelLogs.liters,
    fuelType: fuelLogs.fuelType,
    createdAt: fuelLogs.createdAt,
  }).from(fuelLogs).where(eq(fuelLogs.vehicleId, vehicleId)).orderBy(desc(fuelLogs.createdAt));
  const history = enrichFuelHistory(logs);
  return {
    vehicle,
    history,
    latestMetrics: history[0] ? {
      consumptionKmPerLiter: history[0].consumptionKmPerLiter,
      costPerKm: history[0].costPerKm,
      distanceSincePrevious: history[0].distanceSincePrevious,
    } : null,
  };
}

export async function createFuelLog(input: { vehicleId: number; supervisorRouteId: number; supervisorId: number; odometerKm: number; amount: number; liters: number; fuelType: "gasoline" | "ethanol" | "diesel" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fuelLogs).values({
    ...input,
    odometerKm: input.odometerKm.toFixed(2),
    amount: input.amount.toFixed(2),
    liters: input.liters.toFixed(3),
  }).returning({ id: fuelLogs.id });
  return { id: getInsertedId(result), summary: await getVehicleFuelSummary(input.vehicleId) };
}

export async function getSupervisorRouteById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({
    id: supervisorRoutes.id,
    supervisorId: supervisorRoutes.supervisorId,
    routeId: supervisorRoutes.routeId,
    date: supervisorRoutes.date,
    shiftType: supervisorRoutes.shiftType,
    shiftStartedAt: supervisorRoutes.shiftStartedAt,
    status: supervisorRoutes.status,
    kmInitial: supervisorRoutes.kmInitial,
    kmFinal: supervisorRoutes.kmFinal,
    startedAt: supervisorRoutes.startedAt,
    completedAt: supervisorRoutes.completedAt,
    createdAt: supervisorRoutes.createdAt,
    updatedAt: supervisorRoutes.updatedAt,
    routeName: routes.name,
    routeRegion: routes.region,
    routeActivityType: routes.activityType,
    vehicleId: supervisorRoutes.vehicleId,
    vehiclePlate: vehicles.plate,
    vehicleModel: vehicles.model,
  }).from(supervisorRoutes)
    .innerJoin(routes, eq(routes.id, supervisorRoutes.routeId))
    .leftJoin(vehicles, eq(vehicles.id, supervisorRoutes.vehicleId))
    .where(eq(supervisorRoutes.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getSupervisorRoutesToday(supervisorId: number) {
  const db = await getDb();
  if (!db) return [];
  const period = getCurrentOperationalPeriod();
  
  return await db.select({
    id: supervisorRoutes.id,
    supervisorId: supervisorRoutes.supervisorId,
    routeId: supervisorRoutes.routeId,
    date: supervisorRoutes.date,
    shiftType: supervisorRoutes.shiftType,
    shiftStartedAt: supervisorRoutes.shiftStartedAt,
    status: supervisorRoutes.status,
    kmInitial: supervisorRoutes.kmInitial,
    kmFinal: supervisorRoutes.kmFinal,
    startedAt: supervisorRoutes.startedAt,
    completedAt: supervisorRoutes.completedAt,
    createdAt: supervisorRoutes.createdAt,
    updatedAt: supervisorRoutes.updatedAt,
    routeName: routes.name,
    routeRegion: routes.region,
    routeActivityType: routes.activityType,
    vehicleId: supervisorRoutes.vehicleId,
    vehiclePlate: vehicles.plate,
    vehicleModel: vehicles.model,
  }).from(supervisorRoutes)
    .innerJoin(routes, eq(routes.id, supervisorRoutes.routeId))
    .leftJoin(vehicles, eq(vehicles.id, supervisorRoutes.vehicleId))
    .where(and(
      eq(supervisorRoutes.supervisorId, supervisorId),
      or(
        and(gte(supervisorRoutes.shiftStartedAt, period.start), lt(supervisorRoutes.shiftStartedAt, period.end)),
        inArray(supervisorRoutes.status, ["pending", "in_progress"]),
      ),
    ));
}

export async function updateSupervisorRoute(id: number, updates: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(supervisorRoutes)
    .set(updates)
    .where(eq(supervisorRoutes.id, id));
}

/** Cancela uma preparação ainda pendente e remove os checklists ainda não utilizados dela. */
export async function cancelPendingSupervisorRoute(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (transaction) => {
    const preparedChecklists = await transaction.select({ id: visitChecklists.id })
      .from(visitChecklists)
      .where(eq(visitChecklists.supervisorRouteId, id));
    for (const checklist of preparedChecklists) {
      await transaction.delete(checklistItems).where(eq(checklistItems.visitChecklistId, checklist.id));
    }
    await transaction.delete(visitChecklists).where(eq(visitChecklists.supervisorRouteId, id));
    await transaction.update(supervisorRoutes).set({ status: "cancelled" }).where(eq(supervisorRoutes.id, id));
  });
}

// Visit Checklists queries
export async function createVisitChecklist(
  supervisorRouteId: number,
  postId: number,
  options: { isCoverage?: boolean; coverageReason?: string | null } = {},
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(visitChecklists).values({
    supervisorRouteId,
    postId,
    status: 'pending',
    isCoverage: options.isCoverage ?? false,
    coverageReason: options.coverageReason ?? null,
  }).returning({ id: visitChecklists.id });

  return getInsertedId(result);
}

export async function getVisitChecklistsByRoute(supervisorRouteId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(visitChecklists)
    .where(eq(visitChecklists.supervisorRouteId, supervisorRouteId));
}

/** Lista postos de outras rotas, elegíveis para cobertura excepcional. */
export async function getCoveragePostsBySupervisorRoute(supervisorRouteId: number) {
  const db = await getDb();
  if (!db) return [];
  const supervisorRoute = await getSupervisorRouteById(supervisorRouteId);
  if (!supervisorRoute) return [];

  return await db.select({
    id: posts.id,
    name: posts.name,
    address: posts.address,
    region: posts.region,
    routeId: posts.routeId,
    routeName: routes.name,
    routeActivityType: routes.activityType,
  })
    .from(posts)
    .innerJoin(routes, eq(routes.id, posts.routeId))
    .where(sql`${posts.routeId} <> ${supervisorRoute.routeId}`)
    .orderBy(routes.name, posts.order);
}

/** Garante um posto persistível para registrar atividade realizada na Base Operacional. */
export async function getOrCreateOperationalBasePost() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let baseRoute: typeof routes.$inferSelect | undefined = (await db.select().from(routes)
    .where(eq(routes.activityType, "operational_base"))
    .limit(1))[0];

  if (!baseRoute) {
    const result = await db.insert(routes).values({
      name: "Base Operacional",
      region: "Operação interna",
      description: "Atividade sem posto de cliente",
      activityType: "operational_base",
    }).returning({ id: routes.id });
    const baseRouteId = getInsertedId(result);
    baseRoute = await getRouteById(baseRouteId) ?? undefined;
  }

  if (!baseRoute) throw new Error("Não foi possível preparar a Base Operacional");

  let basePost: typeof posts.$inferSelect | undefined = (await db.select().from(posts)
    .where(and(eq(posts.routeId, baseRoute.id), eq(posts.name, "Base Operacional")))
    .limit(1))[0];

  if (!basePost) {
    const result = await db.insert(posts).values({
      routeId: baseRoute.id,
      name: "Base Operacional",
      region: "Operação interna",
      address: "Atividade interna sem posto de cliente",
      order: 1,
    }).returning({ id: posts.id });
    const basePostId = getInsertedId(result);
    basePost = await getPostById(basePostId) ?? undefined;
  }

  if (!basePost) throw new Error("Não foi possível preparar o posto da Base Operacional");
  return basePost;
}

export async function getVisitChecklistById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(visitChecklists).where(eq(visitChecklists.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateVisitChecklist(id: number, updates: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(visitChecklists)
    .set(updates)
    .where(eq(visitChecklists.id, id));
}

/** Marca a atividade da rota como atualizada quando um item ou uma auditoria é salvo. */
export async function touchSupervisorRouteFromChecklist(visitChecklistId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [checklist] = await db.select({ supervisorRouteId: visitChecklists.supervisorRouteId })
    .from(visitChecklists)
    .where(eq(visitChecklists.id, visitChecklistId))
    .limit(1);
  if (!checklist) return;
  await db.update(supervisorRoutes)
    .set({ updatedAt: new Date() })
    .where(eq(supervisorRoutes.id, checklist.supervisorRouteId));
}

// Checklist Items queries
export async function createChecklistItem(visitChecklistId: number, category: string, description: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(checklistItems).values({
    visitChecklistId,
    category,
    description,
  }).returning({ id: checklistItems.id });

  return getInsertedId(result);
}

export async function getChecklistItemsByVisit(visitChecklistId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(checklistItems)
    .where(eq(checklistItems.visitChecklistId, visitChecklistId));
}

export async function updateChecklistItem(id: number, updates: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [item] = await db.select({ visitChecklistId: checklistItems.visitChecklistId })
    .from(checklistItems)
    .where(eq(checklistItems.id, id))
    .limit(1);
  if (!item) throw new Error("Checklist item not found");
  const result = await db.update(checklistItems)
    .set(updates)
    .where(eq(checklistItems.id, id));
  await touchSupervisorRouteFromChecklist(item.visitChecklistId);
  return result;
}

// Supervisor Locations queries
export async function saveSupervisorLocation(supervisorId: number, supervisorRouteId: number | null, latitude: number, longitude: number, accuracy?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const values: any = {
    supervisorId,
    latitude: latitude.toString(),
    longitude: longitude.toString(),
  };
  
  if (supervisorRouteId !== null) {
    values.supervisorRouteId = supervisorRouteId;
  }
  
  if (accuracy !== undefined) {
    values.accuracy = accuracy.toString();
  }
  
  return await db.insert(supervisorLocations).values(values);
}

export async function getLatestSupervisorLocation(supervisorId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(supervisorLocations)
    .where(eq(supervisorLocations.supervisorId, supervisorId))
    .orderBy(desc(supervisorLocations.recordedAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function getAllSupervisorsLatestLocations() {
  const db = await getDb();
  if (!db) return [];
  // O mapa precisa de uma posição por supervisor; não carregue todo o histórico
  // de GPS para deduplicar em memória a cada ciclo de polling.
  try {
    return await db.selectDistinctOn([supervisorLocations.supervisorId])
      .from(supervisorLocations)
      .orderBy(supervisorLocations.supervisorId, desc(supervisorLocations.recordedAt), desc(supervisorLocations.id));
  } catch (error) {
    // GPS é complementar ao acompanhamento. Uma falha nessa consulta não deve
    // ocultar rotas e supervisores que continuam disponíveis no banco.
    console.error("[GPS] Falha ao consultar a última posição dos supervisores:", error);
    return [];
  }
}

// Post Visit History queries
export async function recordPostVisit(postId: number, supervisorId: number, observations?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const values: any = {
    postId,
    supervisorId,
    visitedAt: new Date(),
  };
  
  if (observations) {
    values.observations = observations;
  }
  
  return await db.insert(postVisitHistory).values(values);
}

export async function getLastPostVisit(postId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(postVisitHistory)
    .where(eq(postVisitHistory.postId, postId))
    .orderBy(desc(postVisitHistory.visitedAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function getPostVisitsByDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(postVisitHistory)
    .where(and(
      gte(postVisitHistory.visitedAt, startDate),
      lte(postVisitHistory.visitedAt, endDate)
    ))
    .orderBy(desc(postVisitHistory.visitedAt));
}

// Helper function to calculate visit priority
export function calculateVisitPriority(lastVisitDate: Date | null): { priority: 'red' | 'yellow' | 'green', daysSinceVisit: number } {
  if (!lastVisitDate) {
    return { priority: 'red', daysSinceVisit: 999 };
  }
  
  const now = new Date();
  const diffTime = Math.max(0, now.getTime() - lastVisitDate.getTime());
  const daysSinceVisit = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (daysSinceVisit > 10) {
    return { priority: 'red', daysSinceVisit };
  } else if (daysSinceVisit >= 5) {
    return { priority: 'yellow', daysSinceVisit };
  } else {
    return { priority: 'green', daysSinceVisit };
  }
}

// Get visit checklists with times for reporting
export async function getVisitChecklistsWithTimes(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select({
    id: visitChecklists.id,
    postId: visitChecklists.postId,
    postName: posts.name,
    postAddress: posts.address,
    supervisorRouteId: visitChecklists.supervisorRouteId,
    routeId: supervisorRoutes.routeId,
    routeName: routes.name,
    supervisorId: supervisorRoutes.supervisorId,
    supervisorName: users.name,
    arrivalTime: visitChecklists.arrivalTime,
    departureTime: visitChecklists.departureTime,
    visitedAt: visitChecklists.visitedAt,
    observations: visitChecklists.observations,
    status: visitChecklists.status,
  })
    .from(visitChecklists)
    .innerJoin(posts, eq(posts.id, visitChecklists.postId))
    .innerJoin(supervisorRoutes, eq(supervisorRoutes.id, visitChecklists.supervisorRouteId))
    .innerJoin(routes, eq(routes.id, supervisorRoutes.routeId))
    .leftJoin(users, eq(users.id, supervisorRoutes.supervisorId))
    .where(and(
      gte(visitChecklists.visitedAt, startDate),
      lte(visitChecklists.visitedAt, endDate),
      eq(visitChecklists.status, 'visited')
    ))
    .orderBy(desc(visitChecklists.visitedAt));
}


export async function getChecklistItemById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(checklistItems).where(eq(checklistItems.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}


export async function getChecklistConformanceSummary(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return { compliant: 0, nonCompliant: 0, unanswered: 0, total: 0 };

  const rows = await db.select({
    isCompliant: checklistItems.isCompliant,
  })
    .from(checklistItems)
    .innerJoin(visitChecklists, eq(visitChecklists.id, checklistItems.visitChecklistId))
    .where(and(
      gte(visitChecklists.visitedAt, startDate),
      lte(visitChecklists.visitedAt, endDate),
      eq(visitChecklists.status, 'visited'),
    ));

  const compliant = rows.filter((row) => row.isCompliant === true).length;
  const nonCompliant = rows.filter((row) => row.isCompliant === false).length;
  const unanswered = rows.filter((row) => row.isCompliant === null).length;
  return { compliant, nonCompliant, unanswered, total: rows.length };
}

type OperationalAlert = {
  code: "gps_missing" | "gps_stale" | "visit_extended" | "km_pending" | "route_pending";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
};

export function deriveAuditProgress(checklists: Array<{
  status: string;
  auditSubmittedAt?: Date | string | null;
  checklistSummary?: { total?: number; unanswered?: number };
}>) {
  const completedVisits = checklists.filter((checklist) => checklist.status === "visited").length;
  const auditedVisits = checklists.filter((checklist) => {
    if (checklist.auditSubmittedAt) return true;
    const total = Number(checklist.checklistSummary?.total ?? 0);
    const unanswered = Number(checklist.checklistSummary?.unanswered ?? total);
    return checklist.status === "visited" && total > 0 && unanswered < total;
  }).length;
  const pendingVisits = checklists.filter((checklist) => checklist.status === "pending").length;
  const skippedVisits = checklists.filter((checklist) => checklist.status === "skipped").length;
  return { completedVisits, auditedVisits, pendingVisits, skippedVisits, totalPosts: checklists.length };
}

/** Converte dados de rota em um estado legível e em alertas acionáveis para o Gestor. */
export function deriveGestorOperationalState(input: {
  routeStatus?: string | null;
  isOperationalBase?: boolean;
  hasKmInitial?: boolean;
  activeVisitArrival?: Date | null;
  latestGpsAt?: Date | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const alerts: OperationalAlert[] = [];
  const gpsAgeMinutes = input.latestGpsAt ? Math.max(0, Math.floor((now.getTime() - input.latestGpsAt.getTime()) / 60_000)) : null;
  const activeVisitMinutes = input.activeVisitArrival ? Math.max(0, Math.floor((now.getTime() - input.activeVisitArrival.getTime()) / 60_000)) : null;

  let status: "sem_rota" | "aguardando_km" | "em_deslocamento" | "em_atendimento" | "em_base_operacional" | "rota_concluida" | "base_concluida" | "rota_cancelada" = "sem_rota";
  if (input.routeStatus === "pending") {
    status = "aguardando_km";
    alerts.push({ code: "km_pending", severity: "info", title: "KM inicial pendente", description: "A rota foi preparada, mas a viatura ainda não iniciou a operação." });
  }
  if (input.routeStatus === "in_progress") {
    status = input.isOperationalBase ? "em_base_operacional" : input.activeVisitArrival ? "em_atendimento" : "em_deslocamento";
    if (!input.hasKmInitial) alerts.push({ code: "km_pending", severity: "warning", title: "KM inicial não informado", description: "A rota está em operação sem quilometragem inicial registrada." });
    if (!input.latestGpsAt) alerts.push({ code: "gps_missing", severity: "warning", title: "GPS não recebido", description: "Ainda não há localização registrada durante esta operação." });
    if (gpsAgeMinutes !== null && gpsAgeMinutes > 5) alerts.push({ code: "gps_stale", severity: "warning", title: "GPS desatualizado", description: `A última localização foi recebida há ${gpsAgeMinutes} min.` });
    if (activeVisitMinutes !== null && activeVisitMinutes > 90) alerts.push({ code: "visit_extended", severity: "warning", title: "Atendimento prolongado", description: `O posto está em atendimento há ${activeVisitMinutes} min.` });
  }
  if (input.routeStatus === "completed") status = input.isOperationalBase ? "base_concluida" : "rota_concluida";
  if (input.routeStatus === "cancelled") status = "rota_cancelada";

  return { status, alerts, gpsAgeMinutes, activeVisitMinutes };
}

/** Dados consolidados usados pelo painel protegido do Gestor. */
export async function getGestorOperationalSnapshot(reportDate?: Date, options: { includeHistoricalUsers?: boolean; shiftType?: OperationShift | null } = {}) {
  const db = await getDb();
  const emptySnapshot = {
    activeRoutes: [],
    operationalSupervisors: [],
    alerts: [],
    recentVisits: [],
    metrics: { supervisorsOnRoute: 0, activeRoutes: 0, visitsInProgress: 0, completedVisits: 0, pendingVisits: 0, totalKm: 0, gpsStale: 0, alerts: 0 },
    lastUpdatedAt: new Date(),
    reportDate: reportDate ?? new Date(),
  };
  if (!db) return emptySnapshot;

  const now = new Date();
  const period = reportDate ? getOperationalPeriodForCalendarDate(reportDate) : getCurrentOperationalPeriod(now);
  const periodRouteCondition = and(
    gte(supervisorRoutes.shiftStartedAt, period.start),
    lt(supervisorRoutes.shiftStartedAt, period.end),
    options.shiftType ? eq(supervisorRoutes.shiftType, options.shiftType) : undefined,
  );
  const routeWindowCondition = reportDate
    ? periodRouteCondition
    : or(
      periodRouteCondition,
      and(
        inArray(supervisorRoutes.status, ["pending", "in_progress"]),
        options.shiftType ? eq(supervisorRoutes.shiftType, options.shiftType) : undefined,
      ),
    );

  const [todayRoutes, todayChecklists, latestLocations, todayChecklistItems, allUsers] = await Promise.all([
    db.select({
      id: supervisorRoutes.id,
      routeId: supervisorRoutes.routeId,
      supervisorId: supervisorRoutes.supervisorId,
      supervisorName: users.name,
      supervisorUsername: users.username,
      routeName: routes.name,
      routeRegion: routes.region,
      routeActivityType: routes.activityType,
      shiftType: supervisorRoutes.shiftType,
      shiftStartedAt: supervisorRoutes.shiftStartedAt,
      status: supervisorRoutes.status,
      vehicleId: supervisorRoutes.vehicleId,
      vehiclePlate: vehicles.plate,
      vehicleModel: vehicles.model,
      kmInitial: supervisorRoutes.kmInitial,
      kmFinal: supervisorRoutes.kmFinal,
      startedAt: supervisorRoutes.startedAt,
      completedAt: supervisorRoutes.completedAt,
      updatedAt: supervisorRoutes.updatedAt,
    })
      .from(supervisorRoutes)
      .innerJoin(routes, eq(routes.id, supervisorRoutes.routeId))
      .leftJoin(vehicles, eq(vehicles.id, supervisorRoutes.vehicleId))
      .leftJoin(users, eq(users.id, supervisorRoutes.supervisorId))
      .where(routeWindowCondition)
      .orderBy(desc(supervisorRoutes.updatedAt)),
    db.select({
      id: visitChecklists.id,
      postId: visitChecklists.postId,
      supervisorRouteId: visitChecklists.supervisorRouteId,
      postName: posts.name,
      postRegion: posts.region,
      postAddress: posts.address,
      postOrder: posts.order,
      status: visitChecklists.status,
      arrivalTime: visitChecklists.arrivalTime,
      departureTime: visitChecklists.departureTime,
      visitedAt: visitChecklists.visitedAt,
      auditSubmittedAt: visitChecklists.auditSubmittedAt,
      observations: visitChecklists.observations,
      isCoverage: visitChecklists.isCoverage,
      coverageReason: visitChecklists.coverageReason,
      arrivalLatitude: visitChecklists.arrivalLatitude,
      arrivalLongitude: visitChecklists.arrivalLongitude,
      departureLatitude: visitChecklists.departureLatitude,
      departureLongitude: visitChecklists.departureLongitude,
    })
      .from(visitChecklists)
      .innerJoin(supervisorRoutes, eq(supervisorRoutes.id, visitChecklists.supervisorRouteId))
      .innerJoin(posts, eq(posts.id, visitChecklists.postId))
      .where(routeWindowCondition),
    getAllSupervisorsLatestLocations(),
    db.select({
      id: checklistItems.id,
      visitChecklistId: checklistItems.visitChecklistId,
      category: checklistItems.category,
      description: checklistItems.description,
      isCompliant: checklistItems.isCompliant,
      notes: checklistItems.notes,
    })
      .from(checklistItems)
      .innerJoin(visitChecklists, eq(visitChecklists.id, checklistItems.visitChecklistId))
      .innerJoin(supervisorRoutes, eq(supervisorRoutes.id, visitChecklists.supervisorRouteId))
      .where(routeWindowCondition),
    db.select({ id: users.id, name: users.name, username: users.username, role: users.role, isOperational: users.isOperational }).from(users),
  ]);

  const vehicleIds = Array.from(new Set(todayRoutes.map((route) => route.vehicleId).filter((vehicleId): vehicleId is number => vehicleId !== null)));
  const fuelLogsForVehicles = vehicleIds.length
    ? await db.select({
      id: fuelLogs.id,
      vehicleId: fuelLogs.vehicleId,
      supervisorRouteId: fuelLogs.supervisorRouteId,
      supervisorId: fuelLogs.supervisorId,
      odometerKm: fuelLogs.odometerKm,
      amount: fuelLogs.amount,
      liters: fuelLogs.liters,
      fuelType: fuelLogs.fuelType,
      createdAt: fuelLogs.createdAt,
    }).from(fuelLogs).where(inArray(fuelLogs.vehicleId, vehicleIds)).orderBy(fuelLogs.vehicleId, fuelLogs.createdAt)
    : [];
  const fuelHistoryByVehicle = new Map<number, Array<(typeof fuelLogsForVehicles)[number] & FuelMetrics>>();
  for (const vehicleId of vehicleIds) {
    fuelHistoryByVehicle.set(vehicleId, enrichFuelHistory(fuelLogsForVehicles.filter((log) => log.vehicleId === vehicleId)));
  }

  const locationBySupervisor = new Map<number, (typeof latestLocations)[number]>();
  for (const location of latestLocations) locationBySupervisor.set(location.supervisorId, location);

  const checklistItemsByVisit = new Map<number, Array<(typeof todayChecklistItems)[number]>>();
  for (const item of todayChecklistItems) {
    const collection = checklistItemsByVisit.get(item.visitChecklistId) ?? [];
    collection.push(item);
    checklistItemsByVisit.set(item.visitChecklistId, collection);
  }

  const routeViews = todayRoutes.map((route) => {
    const fuelHistory = route.vehicleId ? (fuelHistoryByVehicle.get(route.vehicleId) ?? []) : [];
    const latestFuel = fuelHistory[0] ?? null;
    const routeChecklists = todayChecklists
      .filter((checklist) => checklist.supervisorRouteId === route.id)
      .sort((a, b) => a.postOrder - b.postOrder)
      .map((checklist) => {
        const items = checklistItemsByVisit.get(checklist.id) ?? [];
        const compliantItems = items.filter((item) => item.isCompliant === true).length;
        const nonCompliantItems = items.filter((item) => item.isCompliant === false).length;
        const unansweredItems = items.filter((item) => item.isCompliant === null).length;
        const referenceTime = checklist.departureTime ?? now;
        const durationMinutes = checklist.arrivalTime ? Math.max(0, Math.floor((referenceTime.getTime() - checklist.arrivalTime.getTime()) / 60_000)) : null;
        return {
          ...checklist,
          durationMinutes,
          checklistSummary: { total: items.length, compliant: compliantItems, nonCompliant: nonCompliantItems, unanswered: unansweredItems },
          checklistItems: items.map((item) => ({
            id: item.id,
            category: item.category,
            description: item.description,
            isCompliant: item.isCompliant,
            notes: item.notes,
          })),
        };
      });
    const activeVisit = routeChecklists.find((checklist) => checklist.status === "in_progress") ?? null;
    const nextPost = routeChecklists.find((checklist) => checklist.status === "pending") ?? null;
    const auditProgress = deriveAuditProgress(routeChecklists);
    const latestLocation = locationBySupervisor.get(route.supervisorId) ?? null;
    const state = deriveGestorOperationalState({
      routeStatus: route.status,
      isOperationalBase: route.routeActivityType === "operational_base",
      hasKmInitial: route.kmInitial !== null,
      activeVisitArrival: activeVisit?.arrivalTime ?? null,
      latestGpsAt: latestLocation?.recordedAt ?? null,
      now,
    });
    const kmCovered = route.kmInitial !== null && route.kmFinal !== null ? Math.max(0, Number(route.kmFinal) - Number(route.kmInitial)) : null;

    return {
      ...route,
      routeStatus: route.status,
      vehicle: route.vehicleId ? { id: route.vehicleId, plate: route.vehiclePlate, model: route.vehicleModel } : null,
      fuelSummary: latestFuel ? {
        consumptionKmPerLiter: latestFuel.consumptionKmPerLiter,
        costPerKm: latestFuel.costPerKm,
        distanceSincePrevious: latestFuel.distanceSincePrevious,
        latestFuelAt: latestFuel.createdAt,
      } : null,
      fuelLogs: fuelHistory.filter((log) => log.supervisorRouteId === route.id),
      fuelHistory: fuelHistory.slice(0, 8),
      ...auditProgress,
      activeVisit,
      nextPost,
      checklistVisits: routeChecklists,
      latestLocation,
      kmCovered,
      operationalStatus: state.status,
      alerts: state.alerts,
      gpsAgeMinutes: state.gpsAgeMinutes,
      activeVisitMinutes: state.activeVisitMinutes,
    };
  });

  const activeOperationalUserIds = new Set(allUsers.filter((user) => user.role === "user" && user.isOperational).map((user) => user.id));
  const operationalRouteViews = options.includeHistoricalUsers
    ? routeViews
    : routeViews.filter((route) => activeOperationalUserIds.has(route.supervisorId));
  const routesBySupervisor = new Map<number, typeof operationalRouteViews>();
  for (const route of operationalRouteViews) {
    const routesForSupervisor = routesBySupervisor.get(route.supervisorId) ?? [];
    routesForSupervisor.push(route);
    routesBySupervisor.set(route.supervisorId, routesForSupervisor);
  }
  const supervisorsById = new Map(allUsers.map((user) => [user.id, user]));
  const supervisorIds = options.includeHistoricalUsers
    ? new Set<number>(operationalRouteViews.map((route) => route.supervisorId))
    : new Set<number>(activeOperationalUserIds);

  const operationalSupervisors = Array.from(supervisorIds).map((supervisorId) => {
    const activities = (routesBySupervisor.get(supervisorId) ?? []).sort((a, b) => (a.startedAt ?? a.updatedAt).getTime() - (b.startedAt ?? b.updatedAt).getTime());
    const route = activities.find((activity) => activity.routeStatus === "in_progress")
      ?? activities.find((activity) => activity.routeStatus === "pending")
      ?? activities.at(-1)
      ?? null;
    const supervisor = supervisorsById.get(supervisorId);
    return {
      supervisorId,
      supervisorName: supervisor?.name ?? route?.supervisorName ?? `Supervisor #${supervisorId}`,
      supervisorUsername: supervisor?.username ?? route?.supervisorUsername ?? null,
      status: route?.operationalStatus ?? "sem_rota",
      route,
      activities: activities.map((activity) => ({
        id: activity.id,
        routeName: activity.routeName,
        routeRegion: activity.routeRegion,
        routeActivityType: activity.routeActivityType,
        routeStatus: activity.routeStatus,
        startedAt: activity.startedAt,
        completedAt: activity.completedAt,
        kmInitial: activity.kmInitial,
        kmFinal: activity.kmFinal,
        kmCovered: activity.kmCovered,
        vehicle: activity.vehicle,
        fuelSummary: activity.fuelSummary,
        fuelLogs: activity.fuelLogs,
        totalPosts: activity.totalPosts,
        completedVisits: activity.completedVisits,
        pendingVisits: activity.pendingVisits,
      })),
      latestLocation: route?.latestLocation ?? locationBySupervisor.get(supervisorId) ?? null,
      alerts: route?.alerts ?? [],
    };
  }).sort((a, b) => (a.supervisorName ?? "").localeCompare(b.supervisorName ?? "", "pt-BR"));

  const alerts = operationalSupervisors.flatMap((supervisor) => supervisor.alerts.map((alert) => ({ ...alert, supervisorId: supervisor.supervisorId, supervisorName: supervisor.supervisorName, routeId: supervisor.route?.id ?? null })));
  const recentVisits = operationalRouteViews.flatMap((route) => route.checklistVisits
    .filter((checklist) => checklist.status === "visited" || checklist.status === "in_progress")
    .map((checklist) => ({ ...checklist, routeName: route.routeName, supervisorId: route.supervisorId, supervisorName: route.supervisorName ?? `Supervisor #${route.supervisorId}` })))
    .sort((a, b) => {
      const aTime = (a.departureTime ?? a.arrivalTime ?? a.visitedAt)?.getTime() ?? 0;
      const bTime = (b.departureTime ?? b.arrivalTime ?? b.visitedAt)?.getTime() ?? 0;
      return bTime - aTime;
    })
    .slice(0, 12);
  const totalKm = operationalRouteViews.reduce((total, route) => total + (route.kmCovered ?? 0), 0);

  return {
    activeRoutes: operationalRouteViews,
    operationalSupervisors,
    alerts,
    recentVisits,
    metrics: {
      supervisorsOnRoute: new Set(operationalRouteViews.filter((route) => route.status === "pending" || route.status === "in_progress").map((route) => route.supervisorId)).size,
      activeRoutes: operationalRouteViews.filter((route) => route.status === "in_progress").length,
      visitsInProgress: operationalRouteViews.reduce((total, route) => total + route.checklistVisits.filter((checklist) => checklist.status === "in_progress").length, 0),
      completedVisits: operationalRouteViews.reduce((total, route) => total + route.checklistVisits.filter((checklist) => checklist.status === "visited").length, 0),
      pendingVisits: operationalRouteViews.reduce((total, route) => total + route.checklistVisits.filter((checklist) => checklist.status === "pending").length, 0),
      totalKm: Number(totalKm.toFixed(2)),
      gpsStale: alerts.filter((alert) => alert.code === "gps_stale" || alert.code === "gps_missing").length,
      alerts: alerts.length,
    },
    lastUpdatedAt: now,
    reportDate: period.start,
  };
}

export type OperationalReportFilters = {
  startDate: Date;
  endDate: Date;
  supervisorId?: number | null;
  vehicleId?: number | null;
  shiftType?: OperationShift | null;
};

export type GestorKpiFilters = {
  startDate?: Date | null;
  endDate?: Date | null;
  shiftType?: OperationShift | null;
  supervisorId?: number | null;
};

export type GestorKpiSummary = {
  period: { start: Date; end: Date; shiftType: OperationShift | null; supervisorId: number | null };
  inspections: { completed: number; audited: number; target: number; completionRate: number | null };
  auditDuration: { averageMinutes: number | null; measuredVisits: number };
  fleet: { totalKm: number; routesWithKm: number; routesPendingKm: number };
  compliance: { rate: number | null; compliantVisits: number; evaluatedVisits: number; nonCompliantItems: number };
};

/**
 * Resultado neutro dos indicadores, usado quando o banco está indisponível
 * ou a consulta agregada falha. Mantém o mesmo formato do retorno normal.
 */
export function buildEmptyGestorKpis(filters: GestorKpiFilters = {}): GestorKpiSummary {
  const period = filters.startDate && filters.endDate
    ? getOperationalRangeForCalendarDates(filters.startDate, filters.endDate)
    : (() => {
      const current = getCurrentOperationalPeriod();
      return { start: current.start, end: current.end };
    })();
  return {
    period: { start: period.start, end: period.end, shiftType: filters.shiftType ?? null, supervisorId: filters.supervisorId ?? null },
    inspections: { completed: 0, audited: 0, target: 0, completionRate: null },
    auditDuration: { averageMinutes: null, measuredVisits: 0 },
    fleet: { totalKm: 0, routesWithKm: 0, routesPendingKm: 0 },
    compliance: { rate: null, compliantVisits: 0, evaluatedVisits: 0, nonCompliantItems: 0 },
  };
}

/**
 * Indicadores do painel do Gestor calculados por agregação no PostgreSQL.
 * Cada métrica é resolvida em uma única consulta agregada, evitando trazer linhas
 * de rotas, visitas e itens para a aplicação apenas para contá-las.
 * Toda coluna é referenciada pelo objeto de schema do Drizzle, que emite o nome
 * qualificado da tabela e elimina ambiguidade nas subconsultas correlacionadas.
 * Falhas de consulta retornam indicadores zerados em vez de propagar exceção.
 */
export async function getGestorOperationalKpis(filters: GestorKpiFilters = {}): Promise<GestorKpiSummary> {
  const period = filters.startDate && filters.endDate
    ? getOperationalRangeForCalendarDates(filters.startDate, filters.endDate)
    : (() => {
      const current = getCurrentOperationalPeriod();
      return { start: current.start, end: current.end };
    })();
  const shiftType = filters.shiftType ?? null;
  const supervisorId = filters.supervisorId ?? null;
  const empty = buildEmptyGestorKpis(filters);

  const db = await getDb();
  if (!db) return empty;

  const routeFilter = and(
    gte(supervisorRoutes.shiftStartedAt, period.start),
    lt(supervisorRoutes.shiftStartedAt, period.end),
    shiftType ? eq(supervisorRoutes.shiftType, shiftType) : undefined,
    supervisorId ? eq(supervisorRoutes.supervisorId, supervisorId) : undefined,
  );

  const toNumber = (value: string | number | null | undefined) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  let routeAggregate: Array<{ totalKm: string | null; routesWithKm: string | null; routesPendingKm: string | null; plannedPosts: string | null }> = [];
  let visitAggregate: Array<{ completed: string | null; audited: string | null; measuredVisits: string | null; averageMinutes: string | null }> = [];
  let complianceAggregate: Array<{ evaluatedVisits: string | null; compliantVisits: string | null; nonCompliantItems: string | null }> = [];

  // Colunas qualificadas manualmente: dentro de `sql` cru o Drizzle emite apenas o nome
  // da coluna, o que gera ambiguidade em subconsultas correlacionadas com `posts`.
  const routeKmInitial = sql`"supervisorRoutes"."kmInitial"`;
  const routeKmFinal = sql`"supervisorRoutes"."kmFinal"`;
  const routeRouteId = sql`"supervisorRoutes"."routeId"`;
  const postRouteId = sql`"posts"."routeId"`;
  const visitStatus = sql`"visitChecklists"."status"`;
  const visitAuditSubmittedAt = sql`"visitChecklists"."auditSubmittedAt"`;
  const visitArrival = sql`"visitChecklists"."arrivalTime"`;
  const visitDeparture = sql`"visitChecklists"."departureTime"`;
  const itemId = sql`"checklistItems"."id"`;
  const itemIsCompliant = sql`"checklistItems"."isCompliant"`;
  const answeredNonCompliant = sql`"answeredVisits"."nonCompliantItems"`;

  try {
    // Subconsulta agregada por visita: conta itens respondidos e não conformes de cada auditoria.
    const answeredVisits = db.select({
      visitId: visitChecklists.id,
      answeredItems: sql<number>`count(${itemId}) filter (where ${itemIsCompliant} is not null)`.as("answeredItems"),
      nonCompliantItems: sql<number>`count(${itemId}) filter (where ${itemIsCompliant} = false)`.as("nonCompliantItems"),
    }).from(visitChecklists)
      .innerJoin(supervisorRoutes, eq(supervisorRoutes.id, visitChecklists.supervisorRouteId))
      .innerJoin(checklistItems, eq(checklistItems.visitChecklistId, visitChecklists.id))
      .where(routeFilter)
      .groupBy(visitChecklists.id)
      .having(sql`count(${itemId}) filter (where ${itemIsCompliant} is not null) > 0`)
      .as("answeredVisits");

    [routeAggregate, visitAggregate, complianceAggregate] = await Promise.all([
      // Frota e meta das rotas: KM percorrido e total de postos previstos nas rotas do período.
      db.select({
        totalKm: sql<string | null>`coalesce(sum(greatest(${routeKmFinal} - ${routeKmInitial}, 0)) filter (where ${routeKmInitial} is not null and ${routeKmFinal} is not null), 0)`,
        routesWithKm: sql<string | null>`count(*) filter (where ${routeKmInitial} is not null and ${routeKmFinal} is not null)`,
        routesPendingKm: sql<string | null>`count(*) filter (where ${routeKmInitial} is not null and ${routeKmFinal} is null)`,
        plannedPosts: sql<string | null>`coalesce(sum((select count(*) from ${posts} where ${postRouteId} = ${routeRouteId})), 0)`,
      }).from(supervisorRoutes).where(routeFilter),
      // Vistorias e tempo médio por auditoria, medido entre chegada e saída do posto.
      db.select({
        completed: sql<string | null>`count(*) filter (where ${visitStatus} = 'visited')`,
        audited: sql<string | null>`count(*) filter (where ${visitAuditSubmittedAt} is not null or ${visitStatus} = 'visited')`,
        measuredVisits: sql<string | null>`count(*) filter (where ${visitArrival} is not null and ${visitDeparture} is not null and ${visitDeparture} >= ${visitArrival})`,
        averageMinutes: sql<string | null>`avg(extract(epoch from (${visitDeparture} - ${visitArrival})) / 60) filter (where ${visitArrival} is not null and ${visitDeparture} is not null and ${visitDeparture} >= ${visitArrival})`,
      }).from(visitChecklists)
        .innerJoin(supervisorRoutes, eq(supervisorRoutes.id, visitChecklists.supervisorRouteId))
        .where(routeFilter),
      // Índice de conformidade: percentual de auditorias respondidas sem nenhuma não conformidade.
      db.select({
        evaluatedVisits: sql<string | null>`count(*)`,
        compliantVisits: sql<string | null>`count(*) filter (where ${answeredNonCompliant} = 0)`,
        nonCompliantItems: sql<string | null>`coalesce(sum(${answeredNonCompliant}), 0)`,
      }).from(answeredVisits),
    ]);
  } catch (error) {
    console.error("[Indicadores] Falha ao calcular os indicadores operacionais do Gestor:", error);
    return empty;
  }

  const totalKm = Number(toNumber(routeAggregate[0]?.totalKm).toFixed(2));
  const target = toNumber(routeAggregate[0]?.plannedPosts);
  const completed = toNumber(visitAggregate[0]?.completed);
  const audited = toNumber(visitAggregate[0]?.audited);
  const measuredVisits = toNumber(visitAggregate[0]?.measuredVisits);
  const rawAverage = visitAggregate[0]?.averageMinutes;
  const evaluatedVisits = toNumber(complianceAggregate[0]?.evaluatedVisits);
  const compliantVisits = toNumber(complianceAggregate[0]?.compliantVisits);

  return {
    period: { start: period.start, end: period.end, shiftType, supervisorId },
    inspections: {
      completed,
      audited,
      target,
      completionRate: target > 0 ? Number(((audited / target) * 100).toFixed(1)) : null,
    },
    auditDuration: {
      averageMinutes: measuredVisits > 0 && rawAverage !== null && rawAverage !== undefined ? Number(Number(rawAverage).toFixed(1)) : null,
      measuredVisits,
    },
    fleet: {
      totalKm,
      routesWithKm: toNumber(routeAggregate[0]?.routesWithKm),
      routesPendingKm: toNumber(routeAggregate[0]?.routesPendingKm),
    },
    compliance: {
      rate: evaluatedVisits > 0 ? Number(((compliantVisits / evaluatedVisits) * 100).toFixed(1)) : null,
      compliantVisits,
      evaluatedVisits,
      nonCompliantItems: toNumber(complianceAggregate[0]?.nonCompliantItems),
    },
  };
}

/** Consolida o período solicitado pelo Gestor, sem depender do painel em tempo real. */
export async function getOperationalManagementReport(input: OperationalReportFilters) {
  const db = await getDb();
  const { start: startDate, end: endDate } = getOperationalRangeForCalendarDates(input.startDate, input.endDate);
  const empty = {
    filters: { startDate, endDate, supervisorId: input.supervisorId ?? null, vehicleId: input.vehicleId ?? null, shiftType: input.shiftType ?? null },
    filterOptions: { supervisors: [], vehicles: [] },
    summary: { totalKm: 0, totalFuelAmount: 0, averageConsumptionKmPerLiter: null as number | null, inspections: 0, plannedPosts: 0, auditedPosts: 0, compliantItems: 0, nonCompliantItems: 0, complianceRate: null as number | null },
    routes: [], fuelLogs: [], visits: [],
  };
  if (!db) return empty;

  const routeConditions = [gte(supervisorRoutes.shiftStartedAt, startDate), lt(supervisorRoutes.shiftStartedAt, endDate)];
  if (input.supervisorId) routeConditions.push(eq(supervisorRoutes.supervisorId, input.supervisorId));
  if (input.vehicleId) routeConditions.push(eq(supervisorRoutes.vehicleId, input.vehicleId));
  if (input.shiftType) routeConditions.push(eq(supervisorRoutes.shiftType, input.shiftType));

  const fuelConditions = [gte(fuelLogs.createdAt, startDate), lt(fuelLogs.createdAt, endDate)];
  if (input.supervisorId) fuelConditions.push(eq(fuelLogs.supervisorId, input.supervisorId));
  if (input.vehicleId) fuelConditions.push(eq(fuelLogs.vehicleId, input.vehicleId));

  const routeRows = await db.select({
      id: supervisorRoutes.id,
      routeId: supervisorRoutes.routeId,
      date: supervisorRoutes.date,
      shiftType: supervisorRoutes.shiftType,
      shiftStartedAt: supervisorRoutes.shiftStartedAt,
      status: supervisorRoutes.status,
      supervisorId: supervisorRoutes.supervisorId,
      supervisorName: users.name,
      supervisorUsername: users.username,
      routeName: routes.name,
      routeRegion: routes.region,
      kmInitial: supervisorRoutes.kmInitial,
      kmFinal: supervisorRoutes.kmFinal,
      startedAt: supervisorRoutes.startedAt,
      completedAt: supervisorRoutes.completedAt,
      vehicleId: supervisorRoutes.vehicleId,
      vehiclePlate: vehicles.plate,
      vehicleModel: vehicles.model,
    }).from(supervisorRoutes)
      .innerJoin(routes, eq(routes.id, supervisorRoutes.routeId))
      .leftJoin(users, eq(users.id, supervisorRoutes.supervisorId))
      .leftJoin(vehicles, eq(vehicles.id, supervisorRoutes.vehicleId))
      .where(and(...routeConditions))
      .orderBy(desc(supervisorRoutes.date), desc(supervisorRoutes.updatedAt));

  const reportRouteIds = new Set(routeRows.map((route) => route.id));
  fuelConditions.push(inArray(fuelLogs.supervisorRouteId, Array.from(reportRouteIds)));

  const [visitRows, itemRows, fuelRows, reportSupervisors, reportVehicles, postRows] = await Promise.all([
    db.select({
      id: visitChecklists.id,
      supervisorRouteId: visitChecklists.supervisorRouteId,
      postName: posts.name,
      postRegion: posts.region,
      status: visitChecklists.status,
      arrivalTime: visitChecklists.arrivalTime,
      departureTime: visitChecklists.departureTime,
      auditSubmittedAt: visitChecklists.auditSubmittedAt,
      observations: visitChecklists.observations,
      isCoverage: visitChecklists.isCoverage,
      coverageReason: visitChecklists.coverageReason,
      arrivalLatitude: visitChecklists.arrivalLatitude,
      arrivalLongitude: visitChecklists.arrivalLongitude,
      departureLatitude: visitChecklists.departureLatitude,
      departureLongitude: visitChecklists.departureLongitude,
      supervisorId: supervisorRoutes.supervisorId,
      supervisorName: users.name,
      vehiclePlate: vehicles.plate,
    }).from(visitChecklists)
      .innerJoin(supervisorRoutes, eq(supervisorRoutes.id, visitChecklists.supervisorRouteId))
      .innerJoin(posts, eq(posts.id, visitChecklists.postId))
      .leftJoin(users, eq(users.id, supervisorRoutes.supervisorId))
      .leftJoin(vehicles, eq(vehicles.id, supervisorRoutes.vehicleId))
      .where(and(...routeConditions))
      .orderBy(asc(visitChecklists.arrivalTime), asc(visitChecklists.auditSubmittedAt), asc(visitChecklists.createdAt)),
    db.select({
      visitChecklistId: checklistItems.visitChecklistId,
      isCompliant: checklistItems.isCompliant,
    }).from(checklistItems)
      .innerJoin(visitChecklists, eq(visitChecklists.id, checklistItems.visitChecklistId))
      .innerJoin(supervisorRoutes, eq(supervisorRoutes.id, visitChecklists.supervisorRouteId))
      .where(and(...routeConditions)),
    db.select({
      id: fuelLogs.id,
      vehicleId: fuelLogs.vehicleId,
      supervisorRouteId: fuelLogs.supervisorRouteId,
      supervisorId: fuelLogs.supervisorId,
      supervisorName: users.name,
      vehiclePlate: vehicles.plate,
      vehicleModel: vehicles.model,
      odometerKm: fuelLogs.odometerKm,
      amount: fuelLogs.amount,
      liters: fuelLogs.liters,
      fuelType: fuelLogs.fuelType,
      createdAt: fuelLogs.createdAt,
    }).from(fuelLogs)
      .leftJoin(users, eq(users.id, fuelLogs.supervisorId))
      .leftJoin(vehicles, eq(vehicles.id, fuelLogs.vehicleId))
      .where(fuelConditions.length ? and(...fuelConditions) : undefined)
      .orderBy(fuelLogs.vehicleId, fuelLogs.createdAt),
    db.select({ id: users.id, name: users.name, username: users.username }).from(users)
      .where(and(eq(users.role, "user"), eq(users.isOperational, true))).orderBy(users.name),
    db.select({ id: vehicles.id, plate: vehicles.plate, model: vehicles.model }).from(vehicles)
      .where(eq(vehicles.isActive, true)).orderBy(vehicles.plate),
    db.select({ routeId: posts.routeId }).from(posts),
  ]);

  const enrichedFuelRows = Array.from(new Set(fuelRows.map((row) => row.vehicleId))).flatMap((vehicleId) => enrichFuelHistory(fuelRows.filter((row) => row.vehicleId === vehicleId)));
  const periodFuelLogs = enrichedFuelRows.filter((row) => reportRouteIds.has(row.supervisorRouteId) && row.createdAt >= startDate && row.createdAt < endDate);
  const itemStatsByVisit = new Map<number, { compliant: number; nonCompliant: number }>();
  for (const item of itemRows) {
    const current = itemStatsByVisit.get(item.visitChecklistId) ?? { compliant: 0, nonCompliant: 0 };
    if (item.isCompliant === true) current.compliant += 1;
    if (item.isCompliant === false) current.nonCompliant += 1;
    itemStatsByVisit.set(item.visitChecklistId, current);
  }
  const visits = visitRows.map((visit) => ({ ...visit, ...(itemStatsByVisit.get(visit.id) ?? { compliant: 0, nonCompliant: 0 }) }));
  const totalKm = routeRows.reduce((total, route) => route.kmInitial !== null && route.kmFinal !== null ? total + Math.max(0, Number(route.kmFinal) - Number(route.kmInitial)) : total, 0);
  const totalFuelAmount = periodFuelLogs.reduce((total, log) => total + Number(log.amount), 0);
  const totalConsumptionDistance = periodFuelLogs.reduce((total, log) => total + (log.distanceSincePrevious ?? 0), 0);
  const totalConsumptionLiters = periodFuelLogs.reduce((total, log) => total + (log.distanceSincePrevious != null ? Number(log.liters) : 0), 0);
  const compliantItems = visits.reduce((total, visit) => total + visit.compliant, 0);
  const nonCompliantItems = visits.reduce((total, visit) => total + visit.nonCompliant, 0);
  const plannedPostsByRoute = new Map<number, number>();
  for (const post of postRows) {
    plannedPostsByRoute.set(post.routeId, (plannedPostsByRoute.get(post.routeId) ?? 0) + 1);
  }
  const plannedPosts = routeRows.reduce((total, route) => total + (plannedPostsByRoute.get(route.routeId) ?? 0), 0);
  const auditedPosts = visits.filter((visit) => visit.status === "visited" || visit.auditSubmittedAt !== null).length;

  return {
    filters: { startDate, endDate, supervisorId: input.supervisorId ?? null, vehicleId: input.vehicleId ?? null, shiftType: input.shiftType ?? null },
    filterOptions: { supervisors: reportSupervisors, vehicles: reportVehicles },
    summary: {
      totalKm: Number(totalKm.toFixed(2)),
      totalFuelAmount: Number(totalFuelAmount.toFixed(2)),
      averageConsumptionKmPerLiter: totalConsumptionLiters > 0 ? Number((totalConsumptionDistance / totalConsumptionLiters).toFixed(2)) : null,
      inspections: visits.filter((visit) => visit.status === "visited").length,
      plannedPosts,
      auditedPosts,
      compliantItems,
      nonCompliantItems,
      complianceRate: compliantItems + nonCompliantItems > 0 ? Number(((compliantItems / (compliantItems + nonCompliantItems)) * 100).toFixed(1)) : null,
    },
    routes: routeRows.map((route) => ({ ...route, kmCovered: route.kmInitial !== null && route.kmFinal !== null ? Number((Number(route.kmFinal) - Number(route.kmInitial)).toFixed(2)) : null })),
    fuelLogs: periodFuelLogs,
    visits,
  };
}

/** Consolida todas as atividades do período operacional para o encerramento de um turno individual. */
export async function getSupervisorShiftReport(supervisorId: number, supervisorRouteId: number) {
  const snapshot = await getGestorOperationalSnapshot(undefined, { includeHistoricalUsers: true });
  return buildSupervisorShiftReport(snapshot, supervisorId, supervisorRouteId);
}
