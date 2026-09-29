import { eq, desc, asc, and, or, gte, lte, lt, inArray, isNull, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../drizzle/schema";
import { InsertUser, users, routes, posts, supervisorRoutes, visitChecklists, supervisorLocations, postVisitHistory, supervisorSchedules, vehicles, fuelLogs, personnelEmployees, personnelFts, personnelOccurrences, personnelExtras, personnelWorkSchedules, personnelEmployeeScheduleAssignments, personnelEmployeeScheduleAssignmentAudit, supervisorRouteClosureExceptions, type InsertPersonnelEmployee, type InsertPersonnelFt, type InsertPersonnelOccurrence, type InsertPersonnelExtra, type PersonnelEmployee, type InsertPersonnelWorkSchedule, type PersonnelWorkScheduleAssignmentAuditSnapshot } from "../drizzle/schema";
import { addCivilDays, assertFtAllowedForScheduleDay, classifyScheduleDay, getFtSettlementPeriod, hasOverlappingScheduleAssignment, isCivilDate, isCivilMonth, monthCalendarDays, validateWorkSchedulePattern, weeklyHoursFromPattern, type ScheduleAssignment as PersonnelScheduleAssignment, type WorkSchedulePattern } from "../shared/personnel-schedules";
import { getPersonnelMovementWindow, type MovementPeriod } from "../shared/personnel-movement-report";
import { ENV } from './_core/env';
import { getCurrentOperationalPeriod, getOperationalPeriodForCalendarDate, getOperationalRangeForCalendarDates, getOperationalShift, type OperationShift } from "./operational-shifts";
import { buildSupervisorShiftReport } from "./supervisor-shift-report";
import { makeRequest, type GeocodingResult } from "./_core/map";
import { storagePut } from "./storage";
import { randomUUID } from "node:crypto";
import { hasRouteClosurePendencies, RouteClosureError, summarizeRouteClosure } from "./route-closure";
import { withLockedSupervisorRoute } from "./route-checklist-lock";

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
    console.warn("[Database] Falha ao encerrar o pool após %s:", reason, error);
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
      ssl: requiresSsl ? { rejectUnauthorized: true } : undefined,
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
    db.select().from(posts).where(eq(posts.isActive, true)).orderBy(posts.routeId, posts.order),
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
  return await db.select().from(posts).where(and(eq(posts.routeId, routeId), eq(posts.isActive, true))).orderBy(posts.order);
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

export type GestorPostInput = {
  routeId: number;
  name: string;
  addressStreet: string;
  addressNumber: string;
  addressNeighborhood: string;
  addressCity: string;
  addressPostalCode: string;
};

function normalizePostInput(input: GestorPostInput) {
  const name = input.name.trim();
  const addressStreet = input.addressStreet.trim();
  const addressNumber = input.addressNumber.trim();
  const addressNeighborhood = input.addressNeighborhood.trim();
  const addressCity = input.addressCity.trim();
  const postalDigits = input.addressPostalCode.replace(/\D/g, "");
  if (postalDigits.length !== 8) throw new Error("Informe um CEP válido com 8 dígitos");
  const addressPostalCode = `${postalDigits.slice(0, 5)}-${postalDigits.slice(5)}`;
  const address = `${addressStreet}, ${addressNumber} — ${addressNeighborhood}, ${addressCity} — CEP ${addressPostalCode}`;
  if (name.length < 2) throw new Error("Informe o nome do posto");
  if (addressStreet.length < 2) throw new Error("Informe a rua do posto");
  if (addressNumber.length < 1) throw new Error("Informe o número do posto");
  if (addressNeighborhood.length < 2) throw new Error("Informe o bairro do posto");
  if (addressCity.length < 2) throw new Error("Informe a cidade do posto");
  if (address.length > 255) throw new Error("O endereço completo excede o limite permitido");
  return { name, addressStreet, addressNumber, addressNeighborhood, addressCity, addressPostalCode, address };
}

export function buildPostAddress(input: Pick<GestorPostInput, "addressStreet" | "addressNumber" | "addressNeighborhood" | "addressCity" | "addressPostalCode">) {
  return normalizePostInput({ routeId: 1, name: "Posto", ...input }).address;
}

async function geocodePostAddress(address: string) {
  try {
    const response = await makeRequest<GeocodingResult>("/maps/api/geocode/json", { address, region: "br" });
    const location = response.status === "OK" ? response.results[0]?.geometry.location : undefined;
    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null;
    return { latitude: location.lat.toFixed(8), longitude: location.lng.toFixed(8) };
  } catch (error) {
    console.warn("[Postos] Não foi possível geocodificar o endereço; o posto ficará pendente de localização:", error);
    return null;
  }
}

async function getNextPostOrder(routeId: number) {
  const routePosts = await getPostsByRouteId(routeId);
  return routePosts.reduce((maximum, post) => Math.max(maximum, post.order), 0) + 1;
}

export async function createGestorPost(input: GestorPostInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const route = await getRouteById(input.routeId);
  if (!route) throw new Error("Rota não encontrada");
  const normalized = normalizePostInput(input);
  const coordinates = await geocodePostAddress(normalized.address);
  const result = await db.insert(posts).values({
    routeId: input.routeId,
    name: normalized.name,
    region: normalized.addressCity,
    address: normalized.address,
    addressStreet: normalized.addressStreet,
    addressNumber: normalized.addressNumber,
    addressNeighborhood: normalized.addressNeighborhood,
    addressCity: normalized.addressCity,
    addressPostalCode: normalized.addressPostalCode,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    order: await getNextPostOrder(input.routeId),
  }).returning({ id: posts.id });
  const post = await getPostById(getInsertedId(result));
  return post ? { ...post, geocodingStatus: coordinates ? "updated" as const : "pending" as const } : null;
}

export async function updateGestorPost(id: number, input: GestorPostInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const current = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  const post = current[0];
  if (!post || !post.isActive) throw new Error("Posto não encontrado");
  const route = await getRouteById(input.routeId);
  if (!route) throw new Error("Rota não encontrada");
  if (route.activityType === "operational_base" || post.name === "Base Operacional") {
    throw new Error("O posto da Base Operacional não pode ser editado por este formulário");
  }
  const normalized = normalizePostInput(input);
  const coordinates = await geocodePostAddress(normalized.address);
  const order = post.routeId === input.routeId ? post.order : await getNextPostOrder(input.routeId);
  await db.update(posts).set({
    routeId: input.routeId,
    name: normalized.name,
    region: normalized.addressCity,
    address: normalized.address,
    addressStreet: normalized.addressStreet,
    addressNumber: normalized.addressNumber,
    addressNeighborhood: normalized.addressNeighborhood,
    addressCity: normalized.addressCity,
    addressPostalCode: normalized.addressPostalCode,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    order,
    updatedAt: new Date(),
  }).where(eq(posts.id, id));
  const updated = await getPostById(id);
  return updated ? { ...updated, geocodingStatus: coordinates ? "updated" as const : "pending" as const } : null;
}

export async function deleteGestorPost(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const current = await db.select({ id: posts.id, name: posts.name, isActive: posts.isActive, routeId: posts.routeId }).from(posts).where(eq(posts.id, id)).limit(1);
  const post = current[0];
  if (!post || !post.isActive) throw new Error("Posto não encontrado");
  const route = await getRouteById(post.routeId);
  if (route?.activityType === "operational_base" || post.name === "Base Operacional") {
    throw new Error("O posto da Base Operacional não pode ser excluído");
  }
  await db.update(posts).set({ isActive: false, updatedAt: new Date() }).where(eq(posts.id, id));
  return { id, deleted: true as const };
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

export async function updateFuelLogAmount(id: number, amount: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Informe um valor de abastecimento válido");
  const current = await db.select({ id: fuelLogs.id, vehicleId: fuelLogs.vehicleId }).from(fuelLogs).where(eq(fuelLogs.id, id)).limit(1);
  const fuelLog = current[0];
  if (!fuelLog) throw new Error("Abastecimento não encontrado");
  await db.update(fuelLogs).set({ amount: amount.toFixed(2) }).where(eq(fuelLogs.id, id));
  return { id, amount: Number(amount.toFixed(2)), summary: await getVehicleFuelSummary(fuelLog.vehicleId) };
}

function fuelUnitPrice(amount: number, liters: number) {
  return liters > 0 ? amount / liters : null;
}

export async function updateSupervisorFuelLog(input: {
  id: number;
  supervisorId: number;
  odometerKm: number;
  amount: number;
  liters: number;
  fuelType: "gasoline" | "ethanol" | "diesel";
  confirmPriceVariation?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (const [label, value] of [["KM", input.odometerKm], ["valor", input.amount], ["litros", input.liters]] as const) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Informe um ${label} válido`);
  }

  const current = await db.select({
    id: fuelLogs.id,
    vehicleId: fuelLogs.vehicleId,
    supervisorId: fuelLogs.supervisorId,
    odometerKm: fuelLogs.odometerKm,
    amount: fuelLogs.amount,
    liters: fuelLogs.liters,
    fuelType: fuelLogs.fuelType,
    createdAt: fuelLogs.createdAt,
  }).from(fuelLogs).where(eq(fuelLogs.id, input.id)).limit(1);
  const fuelLog = current[0];
  if (!fuelLog) throw new Error("Abastecimento não encontrado");
  if (fuelLog.supervisorId !== input.supervisorId) throw new Error("Você só pode editar seus próprios abastecimentos");

  const vehicleLogs = await db.select({
    id: fuelLogs.id,
    odometerKm: fuelLogs.odometerKm,
    amount: fuelLogs.amount,
    liters: fuelLogs.liters,
    createdAt: fuelLogs.createdAt,
  }).from(fuelLogs).where(eq(fuelLogs.vehicleId, fuelLog.vehicleId)).orderBy(asc(fuelLogs.createdAt), asc(fuelLogs.id));
  const position = vehicleLogs.findIndex((log) => log.id === input.id);
  const previous = position > 0 ? vehicleLogs[position - 1] : undefined;
  const next = position >= 0 ? vehicleLogs[position + 1] : undefined;
  const candidateKm = input.odometerKm;
  if (previous && candidateKm < Number(previous.odometerKm)) {
    throw new Error(`O KM informado não pode ser inferior ao abastecimento anterior (${Number(previous.odometerKm).toLocaleString("pt-BR")} km)`);
  }
  if (next && candidateKm > Number(next.odometerKm)) {
    throw new Error(`O KM informado não pode superar o próximo abastecimento (${Number(next.odometerKm).toLocaleString("pt-BR")} km)`);
  }

  const candidatePrice = fuelUnitPrice(input.amount, input.liters);
  const neighboringPrices = [previous, next]
    .map((log) => log && fuelUnitPrice(Number(log.amount), Number(log.liters)))
    .filter((price): price is number => price != null && price > 0);
  const warnings = neighboringPrices.length && candidatePrice != null
    ? neighboringPrices.filter((price) => candidatePrice > price * 1.5 || candidatePrice < price * 0.5).map((price) => `Preço por litro de R$ ${candidatePrice.toFixed(2).replace(".", ",")} difere significativamente do abastecimento próximo (aprox. R$ ${price.toFixed(2).replace(".", ",")}/L).`)
    : [];
  if (warnings.length && !input.confirmPriceVariation) {
    return { updated: false as const, requiresConfirmation: true as const, warnings, candidate: { id: input.id, odometerKm: candidateKm, amount: input.amount, liters: input.liters, fuelType: input.fuelType } };
  }

  await db.update(fuelLogs).set({
    odometerKm: candidateKm.toFixed(2),
    amount: input.amount.toFixed(2),
    liters: input.liters.toFixed(3),
    fuelType: input.fuelType,
  }).where(eq(fuelLogs.id, input.id));
  return { updated: true as const, requiresConfirmation: false as const, id: input.id, summary: await getVehicleFuelSummary(fuelLog.vehicleId) };
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

/** Fecha somente a rota ativa do supervisor autenticado; atualiza rota e trilha excepcional na mesma transação. */
export async function closeSupervisorRoute(input: {
  supervisorRouteId: number;
  supervisorId: number;
  kmFinal: number;
  exceptionJustification?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction((transaction) => withLockedSupervisorRoute(transaction, {
    supervisorRouteId: input.supervisorRouteId,
    supervisorId: input.supervisorId,
    allowedStatuses: ["in_progress"],
    statusMessage: "Somente uma rota ativa do supervisor pode ser encerrada",
  }, async (route) => {
    if (!Number.isFinite(input.kmFinal) || input.kmFinal < 0 || (route.kmInitial != null && input.kmFinal < Number(route.kmInitial))) {
      throw new RouteClosureError("BAD_REQUEST", "O KM final informado é inválido ou menor que o KM inicial");
    }

    const [routeCatalog] = await transaction.select({ activityType: routes.activityType }).from(routes)
      .where(eq(routes.id, route.routeId)).limit(1);
    const [activePosts, checklistRows] = await Promise.all([
      transaction.select({ id: posts.id, name: posts.name }).from(posts)
        .where(and(eq(posts.routeId, route.routeId), eq(posts.isActive, true))),
      transaction.select({
        id: visitChecklists.id,
        postId: visitChecklists.postId,
        postName: posts.name,
        status: visitChecklists.status,
        isCoverage: visitChecklists.isCoverage,
        arrivalTime: visitChecklists.arrivalTime,
        departureTime: visitChecklists.departureTime,
        occurrenceReport: visitChecklists.occurrenceReport,
        occurrenceSubmittedAt: visitChecklists.occurrenceSubmittedAt,
      }).from(visitChecklists)
        .leftJoin(posts, eq(posts.id, visitChecklists.postId))
        .where(eq(visitChecklists.supervisorRouteId, input.supervisorRouteId)),
    ]);
    const pendingSummary = summarizeRouteClosure({
      posts: routeCatalog?.activityType === "operational_base" ? [] : activePosts,
      checklists: routeCatalog?.activityType === "operational_base" ? [] : checklistRows,
    });
    const hasPendencies = hasRouteClosurePendencies(pendingSummary);
    const justification = input.exceptionJustification?.trim();

    if (hasPendencies && !justification) {
      return { closed: false as const, requiresExceptionJustification: true as const, pendingSummary };
    }
    if (hasPendencies && (justification!.length < 8 || justification!.length > 2000)) {
      throw new RouteClosureError("BAD_REQUEST", "A justificativa da exceção deve ter entre 8 e 2000 caracteres");
    }

    const closedAt = new Date();
    await transaction.update(supervisorRoutes)
      .set({ kmFinal: input.kmFinal.toFixed(2), status: "completed", completedAt: closedAt })
      .where(and(
        eq(supervisorRoutes.id, input.supervisorRouteId),
        eq(supervisorRoutes.supervisorId, input.supervisorId),
        eq(supervisorRoutes.status, "in_progress"),
      ));

    if (hasPendencies) {
      await transaction.insert(supervisorRouteClosureExceptions).values({
        supervisorRouteId: input.supervisorRouteId,
        supervisorId: input.supervisorId,
        closedAt,
        justification: justification!,
        pendingSummary,
      });
      return {
        closed: true as const,
        exceptionAudit: { supervisorRouteId: input.supervisorRouteId, supervisorId: input.supervisorId, closedAt, justification: justification!, pendingSummary },
      };
    }

    return { closed: true as const, exceptionAudit: null };
  }));
}

/** Cancela uma preparação ainda pendente e remove os checklists ainda não utilizados dela. */
export async function cancelPendingSupervisorRoute(id: number, supervisorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction((transaction) => withLockedSupervisorRoute(transaction, {
    supervisorRouteId: id,
    supervisorId,
    allowedStatuses: ["pending"],
    statusMessage: "Somente uma rota ainda não iniciada pode ser cancelada",
  }, async (route) => {
    if (route.kmInitial != null || route.startedAt != null) {
      throw new RouteClosureError("CONFLICT", "Somente uma rota ainda não iniciada pode ser cancelada");
    }
    await transaction.delete(visitChecklists).where(eq(visitChecklists.supervisorRouteId, id));
    await transaction.update(supervisorRoutes).set({ status: "cancelled" })
      .where(and(eq(supervisorRoutes.id, id), eq(supervisorRoutes.supervisorId, supervisorId), eq(supervisorRoutes.status, "pending")));
    return { cancelled: true as const, supervisorRouteId: id };
  }));
}

// Visit Checklists queries
async function insertVisitChecklist(
  transaction: any,
  supervisorRouteId: number,
  postId: number,
  options: { isCoverage?: boolean; coverageReason?: string | null } = {},
) {
  const result = await transaction.insert(visitChecklists).values({
    supervisorRouteId,
    postId,
    status: "pending",
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

/** Cria checklists planejados sob o mesmo lock que serializa com o fechamento. */
export async function createRouteChecklists(supervisorRouteId: number, supervisorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction((transaction) => withLockedSupervisorRoute(transaction, {
    supervisorRouteId,
    supervisorId,
    allowedStatuses: ["pending", "in_progress"],
  }, async (route) => {
    const existing = await transaction.select({ id: visitChecklists.id, isCoverage: visitChecklists.isCoverage })
      .from(visitChecklists).where(eq(visitChecklists.supervisorRouteId, supervisorRouteId));
    if (existing.some((item) => !item.isCoverage)) return existing.map((item) => item.id);

    const routePosts = await transaction.select({ id: posts.id }).from(posts)
      .where(and(eq(posts.routeId, route.routeId), eq(posts.isActive, true)))
      .orderBy(posts.order);
    const checklistIds: number[] = [];
    for (const post of routePosts) {
      checklistIds.push(await insertVisitChecklist(transaction, supervisorRouteId, post.id));
    }
    return checklistIds;
  }));
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
    .where(and(sql`${posts.routeId} <> ${supervisorRoute.routeId}`, eq(posts.isActive, true)))
    .orderBy(routes.name, posts.order);
}

/** Garante o posto operacional na mesma transação da cobertura, depois do lock/validação da rota. */
async function getOrCreateOperationalBasePostInTransaction(transaction: any) {
  // Coberturas de supervisores diferentes bloqueiam linhas de rota distintas; serializar a criação global evita duplicatas.
  await transaction.execute(sql`SELECT pg_advisory_xact_lock(6072619, 1)`);
  let [baseRoute] = await transaction.select({ id: routes.id }).from(routes)
    .where(eq(routes.activityType, "operational_base")).limit(1);
  if (!baseRoute) {
    const result = await transaction.insert(routes).values({
      name: "Base Operacional",
      region: "Operação interna",
      description: "Atividade sem posto de cliente",
      activityType: "operational_base",
    }).returning({ id: routes.id });
    baseRoute = { id: getInsertedId(result) };
  }

  let [basePost] = await transaction.select({ id: posts.id }).from(posts)
    .where(and(eq(posts.routeId, baseRoute.id), eq(posts.name, "Base Operacional"))).limit(1);
  if (!basePost) {
    const result = await transaction.insert(posts).values({
      routeId: baseRoute.id,
      name: "Base Operacional",
      region: "Operação interna",
      address: "Atividade interna sem posto de cliente",
      order: 1,
    }).returning({ id: posts.id });
    basePost = { id: getInsertedId(result) };
  }
  return basePost;
}

export async function getVisitChecklistById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(visitChecklists).where(eq(visitChecklists.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

async function getChecklistRouteReference(database: any, checklistId: number) {
  const [reference] = await database.select({ supervisorRouteId: visitChecklists.supervisorRouteId })
    .from(visitChecklists).where(eq(visitChecklists.id, checklistId)).limit(1);
  if (!reference) throw new RouteClosureError("NOT_FOUND", "Visita não encontrada");
  return reference.supervisorRouteId as number;
}

async function getChecklistInRouteTransaction(transaction: any, checklistId: number, supervisorRouteId: number) {
  const [checklist] = await transaction.select().from(visitChecklists)
    .where(and(eq(visitChecklists.id, checklistId), eq(visitChecklists.supervisorRouteId, supervisorRouteId)))
    .for("update").limit(1);
  if (!checklist) throw new RouteClosureError("NOT_FOUND", "Visita não encontrada para esta rota");
  return checklist;
}

/** Começa uma visita (ou cria uma nova ocorrência para posto já visitado) sob o lock comum da rota. */
export async function startNewVisitForRoute(input: { checklistId: number; supervisorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const supervisorRouteId = await getChecklistRouteReference(db, input.checklistId);

  return db.transaction((transaction) => withLockedSupervisorRoute(transaction, {
    supervisorRouteId,
    supervisorId: input.supervisorId,
    allowedStatuses: ["in_progress"],
    statusMessage: "A rota precisa estar em andamento para iniciar uma nova visita",
  }, async (route) => {
    const checklist = await getChecklistInRouteTransaction(transaction, input.checklistId, route.id);
    if (checklist.status !== "visited") {
      throw new RouteClosureError("CONFLICT", "Somente uma visita concluída pode ser reiniciada");
    }
    const [activeVisit] = await transaction.select({ id: visitChecklists.id }).from(visitChecklists)
      .where(and(eq(visitChecklists.supervisorRouteId, route.id), eq(visitChecklists.status, "in_progress"))).limit(1);
    if (activeVisit) throw new RouteClosureError("CONFLICT", "Finalize a visita ativa antes de iniciar outro posto");

    const checklistId = await insertVisitChecklist(transaction, route.id, checklist.postId, {
      isCoverage: checklist.isCoverage,
      coverageReason: checklist.coverageReason,
    });
    return { checklistId };
  }));
}

/** Registra cobertura sob lock da rota e valida novamente o posto antes do insert. */
export async function createCoverageVisit(input: {
  supervisorRouteId: number;
  supervisorId: number;
  postId: number | "operational_base";
  coverageReason: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction((transaction) => withLockedSupervisorRoute(transaction, {
    supervisorRouteId: input.supervisorRouteId,
    supervisorId: input.supervisorId,
    allowedStatuses: ["in_progress"],
    statusMessage: "Inicie a rota pelo KM inicial antes de registrar uma cobertura",
  }, async (route) => {
    const postId = input.postId === "operational_base"
      ? (await getOrCreateOperationalBasePostInTransaction(transaction)).id
      : input.postId;
    const [post] = await transaction.select({ id: posts.id, routeId: posts.routeId }).from(posts)
      .where(eq(posts.id, postId)).limit(1);
    if (!post) throw new RouteClosureError("NOT_FOUND", "Posto não encontrado");
    if (post.routeId === route.routeId) {
      throw new RouteClosureError("BAD_REQUEST", "Este posto já faz parte da rota planejada");
    }
    const [activeVisit] = await transaction.select({ id: visitChecklists.id }).from(visitChecklists)
      .where(and(eq(visitChecklists.supervisorRouteId, route.id), eq(visitChecklists.status, "in_progress"))).limit(1);
    if (activeVisit) throw new RouteClosureError("CONFLICT", "Finalize a visita ativa antes de registrar uma cobertura");

    const checklistId = await insertVisitChecklist(transaction, route.id, post.id, {
      isCoverage: true,
      coverageReason: input.coverageReason,
    });
    return { checklistId };
  }));
}

/** Registra chegada com verificação serializada de rota, checklist e demais visitas ativas. */
export async function checkInVisitForRoute(input: {
  checklistId: number;
  supervisorId: number;
  latitude?: number;
  longitude?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const supervisorRouteId = await getChecklistRouteReference(db, input.checklistId);

  return db.transaction((transaction) => withLockedSupervisorRoute(transaction, {
    supervisorRouteId,
    supervisorId: input.supervisorId,
    allowedStatuses: ["pending", "in_progress"],
    statusMessage: "Não é possível registrar chegada depois do encerramento da rota",
  }, async (route) => {
    const checklist = await getChecklistInRouteTransaction(transaction, input.checklistId, route.id);
    if (checklist.status !== "pending" && checklist.status !== "visited") {
      throw new RouteClosureError("CONFLICT", "Esta visita já está em andamento");
    }
    const [activeVisit] = await transaction.select({ id: visitChecklists.id }).from(visitChecklists)
      .where(and(eq(visitChecklists.supervisorRouteId, route.id), eq(visitChecklists.status, "in_progress"))).limit(1);
    if (activeVisit) throw new RouteClosureError("CONFLICT", "Finalize a visita ativa antes de iniciar outro posto");

    const targetChecklistId = checklist.status === "visited"
      ? await insertVisitChecklist(transaction, route.id, checklist.postId, {
          isCoverage: checklist.isCoverage,
          coverageReason: checklist.coverageReason,
        })
      : checklist.id;
    const arrivalTime = new Date();
    await transaction.update(visitChecklists).set({
      status: "in_progress",
      arrivalTime,
      arrivalLatitude: input.latitude?.toString() ?? null,
      arrivalLongitude: input.longitude?.toString() ?? null,
    }).where(and(eq(visitChecklists.id, targetChecklistId), eq(visitChecklists.supervisorRouteId, route.id)));
    await transaction.update(supervisorRoutes).set({ updatedAt: arrivalTime }).where(eq(supervisorRoutes.id, route.id));
    return { success: true as const, checklistId: targetChecklistId, arrivalTime };
  }));
}

/** Registra saída e histórico na mesma transação protegida pelo row lock da rota. */
export async function checkOutVisitForRoute(input: {
  checklistId: number;
  supervisorId: number;
  latitude?: number;
  longitude?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const supervisorRouteId = await getChecklistRouteReference(db, input.checklistId);

  return db.transaction((transaction) => withLockedSupervisorRoute(transaction, {
    supervisorRouteId,
    supervisorId: input.supervisorId,
    allowedStatuses: ["pending", "in_progress"],
    statusMessage: "Não é possível registrar saída depois do encerramento da rota",
  }, async (route) => {
    const checklist = await getChecklistInRouteTransaction(transaction, input.checklistId, route.id);
    if (checklist.status !== "in_progress") {
      throw new RouteClosureError("CONFLICT", "Só é possível registrar saída de uma visita em andamento");
    }
    if (!checklist.occurrenceReport?.trim()) {
      throw new RouteClosureError("CONFLICT", "Envie o registro obrigatório da ocorrência antes de registrar a saída");
    }

    const completedAt = new Date();
    await transaction.update(visitChecklists).set({
      status: "visited",
      departureTime: completedAt,
      visitedAt: completedAt,
      departureLatitude: input.latitude?.toString() ?? null,
      departureLongitude: input.longitude?.toString() ?? null,
    }).where(and(eq(visitChecklists.id, input.checklistId), eq(visitChecklists.supervisorRouteId, route.id)));
    await transaction.insert(postVisitHistory).values({
      postId: checklist.postId,
      supervisorId: input.supervisorId,
      visitedAt: completedAt,
      observations: checklist.occurrenceReport,
    });
    await transaction.update(supervisorRoutes).set({ updatedAt: completedAt }).where(eq(supervisorRoutes.id, route.id));
    return { success: true as const, departureTime: completedAt };
  }));
}

/** Salva o relato obrigatório e seu timestamp do servidor dentro do lock da rota. */
export async function submitOccurrenceForActiveRoute(input: { checklistId: number; supervisorId: number; occurrenceReport: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const normalizedReport = input.occurrenceReport.trim();
  if (normalizedReport.length < 8 || normalizedReport.length > 5000) {
    throw new RouteClosureError("BAD_REQUEST", "O relato da ocorrência deve ter entre 8 e 5000 caracteres");
  }
  const supervisorRouteId = await getChecklistRouteReference(db, input.checklistId);

  return db.transaction((transaction) => withLockedSupervisorRoute(transaction, {
    supervisorRouteId,
    supervisorId: input.supervisorId,
    allowedStatuses: ["pending", "in_progress"],
    statusMessage: "Não é possível enviar ou alterar relatos depois do encerramento da rota",
  }, async (route) => {
    const checklist = await getChecklistInRouteTransaction(transaction, input.checklistId, route.id);
    if (checklist.status !== "in_progress" && checklist.status !== "visited") {
      throw new RouteClosureError("CONFLICT", "Registre a chegada antes de enviar a ocorrência");
    }
    const submittedAt = new Date();
    await transaction.update(visitChecklists).set({ occurrenceReport: normalizedReport, occurrenceSubmittedAt: submittedAt })
      .where(and(eq(visitChecklists.id, input.checklistId), eq(visitChecklists.supervisorRouteId, route.id)));
    await transaction.update(supervisorRoutes).set({ updatedAt: submittedAt }).where(eq(supervisorRoutes.id, route.id));
    return { success: true as const, occurrenceSubmittedAt: submittedAt };
  }));
}

/** Caminho legado mantido com timestamps do servidor e o mesmo lock compartilhado com o fechamento. */
export async function markVisitVisitedForActiveRoute(input: { checklistId: number; supervisorId: number; occurrenceReport: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const occurrenceReport = input.occurrenceReport.trim();
  if (occurrenceReport.length < 8 || occurrenceReport.length > 5000) {
    throw new RouteClosureError("BAD_REQUEST", "O relato deve ter entre 8 e 5000 caracteres");
  }
  const supervisorRouteId = await getChecklistRouteReference(db, input.checklistId);

  return db.transaction((transaction) => withLockedSupervisorRoute(transaction, {
    supervisorRouteId,
    supervisorId: input.supervisorId,
    allowedStatuses: ["in_progress"],
    statusMessage: "Não é possível alterar visitas depois do encerramento da rota",
  }, async (route) => {
    const checklist = await getChecklistInRouteTransaction(transaction, input.checklistId, route.id);
    if (checklist.status !== "pending" && checklist.status !== "in_progress") {
      throw new RouteClosureError("CONFLICT", "Somente uma visita pendente ou em atendimento pode ser concluída por este caminho");
    }
    const completedAt = new Date();
    await transaction.update(visitChecklists).set({
      status: "visited",
      visitedAt: completedAt,
      occurrenceReport,
      occurrenceSubmittedAt: completedAt,
      arrivalTime: checklist.arrivalTime ?? completedAt,
      departureTime: completedAt,
    }).where(and(eq(visitChecklists.id, input.checklistId), eq(visitChecklists.supervisorRouteId, route.id)));
    await transaction.insert(postVisitHistory).values({
      postId: checklist.postId,
      supervisorId: input.supervisorId,
      visitedAt: completedAt,
      observations: occurrenceReport,
    });
    await transaction.update(supervisorRoutes).set({ updatedAt: completedAt }).where(eq(supervisorRoutes.id, route.id));
    return { success: true as const, completedAt };
  }));
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
export function getReportQueryPeriod(startDate: Date, endDate: Date) {
  return getOperationalRangeForCalendarDates(startDate, endDate);
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
  const period = getReportQueryPeriod(startDate, endDate);
  
  return await db.select().from(postVisitHistory)
    .where(and(
      gte(postVisitHistory.visitedAt, period.start),
      lt(postVisitHistory.visitedAt, period.end)
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
export async function getVisitsWithTimes(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  const period = getReportQueryPeriod(startDate, endDate);
  
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
    occurrenceSubmittedAt: visitChecklists.occurrenceSubmittedAt,
    occurrenceReport: visitChecklists.occurrenceReport,
    observations: visitChecklists.observations,
    status: visitChecklists.status,
  })
    .from(visitChecklists)
    .innerJoin(posts, eq(posts.id, visitChecklists.postId))
    .innerJoin(supervisorRoutes, eq(supervisorRoutes.id, visitChecklists.supervisorRouteId))
    .innerJoin(routes, eq(routes.id, supervisorRoutes.routeId))
    .leftJoin(users, eq(users.id, supervisorRoutes.supervisorId))
    .where(and(
      gte(visitChecklists.visitedAt, period.start),
      lt(visitChecklists.visitedAt, period.end),
      eq(visitChecklists.status, 'visited')
    ))
    .orderBy(desc(visitChecklists.visitedAt));
}

export async function getVisitOccurrenceSummary(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return { total: 0, reported: 0, pending: 0 };
  const period = getReportQueryPeriod(startDate, endDate);
  const result = await db.select({
    total: sql<string>`count(*)`,
    reported: sql<string>`count(*) filter (where nullif(trim(coalesce(${visitChecklists.occurrenceReport}, '')), '') is not null)`,
  }).from(visitChecklists)
    .where(and(
      gte(visitChecklists.visitedAt, period.start),
      lt(visitChecklists.visitedAt, period.end),
      eq(visitChecklists.status, "visited"),
    ));
  const total = Number(result[0]?.total ?? 0);
  const reported = Number(result[0]?.reported ?? 0);
  return { total, reported, pending: Math.max(0, total - reported) };
}

type OperationalAlert = {
  code: "gps_missing" | "gps_stale" | "visit_extended" | "km_pending" | "route_pending";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
};

export function deriveVisitProgress(checklists: Array<{
  status: string;
  occurrenceSubmittedAt?: Date | string | null;
  occurrenceReport?: string | null;
}>) {
  const completedVisits = checklists.filter((checklist) => checklist.status === "visited").length;
  const reportedVisits = checklists.filter((checklist) => Boolean(checklist.occurrenceSubmittedAt || checklist.occurrenceReport?.trim())).length;
  const pendingVisits = checklists.filter((checklist) => checklist.status === "pending").length;
  const skippedVisits = checklists.filter((checklist) => checklist.status === "skipped").length;
  return { completedVisits, reportedVisits, pendingVisits, skippedVisits, totalPosts: checklists.length };
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

  const [todayRoutes, todayChecklists, latestLocations, allUsers] = await Promise.all([
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
      occurrenceSubmittedAt: visitChecklists.occurrenceSubmittedAt,
      occurrenceReport: visitChecklists.occurrenceReport,
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

  const routeViews = todayRoutes.map((route) => {
    const fuelHistory = route.vehicleId ? (fuelHistoryByVehicle.get(route.vehicleId) ?? []) : [];
    const latestFuel = fuelHistory[0] ?? null;
    const routeChecklists = todayChecklists
      .filter((checklist) => checklist.supervisorRouteId === route.id)
      .sort((a, b) => a.postOrder - b.postOrder)
      .map((checklist) => {
        const referenceTime = checklist.departureTime ?? now;
        const durationMinutes = checklist.arrivalTime ? Math.max(0, Math.floor((referenceTime.getTime() - checklist.arrivalTime.getTime()) / 60_000)) : null;
        return {
          ...checklist,
          durationMinutes,
        };
      });
    const activeVisit = routeChecklists.find((checklist) => checklist.status === "in_progress") ?? null;
    const nextPost = routeChecklists.find((checklist) => checklist.status === "pending") ?? null;
    const visitProgress = deriveVisitProgress(routeChecklists);
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
      ...visitProgress,
      activeVisit,
      nextPost,
      visits: routeChecklists,
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
  const recentVisits = operationalRouteViews.flatMap((route) => route.visits
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
      visitsInProgress: operationalRouteViews.reduce((total, route) => total + route.visits.filter((checklist) => checklist.status === "in_progress").length, 0),
      completedVisits: operationalRouteViews.reduce((total, route) => total + route.visits.filter((checklist) => checklist.status === "visited").length, 0),
      pendingVisits: operationalRouteViews.reduce((total, route) => total + route.visits.filter((checklist) => checklist.status === "pending").length, 0),
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
  inspections: { completed: number; reported: number; target: number; completionRate: number | null };
  visitDuration: { averageMinutes: number | null; measuredVisits: number };
  fleet: { totalKm: number; routesWithKm: number; routesPendingKm: number };
  occurrences: { reportedVisits: number; totalVisits: number; pendingReports: number };
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
    inspections: { completed: 0, reported: 0, target: 0, completionRate: null },
    visitDuration: { averageMinutes: null, measuredVisits: 0 },
    fleet: { totalKm: 0, routesWithKm: 0, routesPendingKm: 0 },
    occurrences: { reportedVisits: 0, totalVisits: 0, pendingReports: 0 },
  };
}

/**
 * Indicadores do painel do Gestor calculados por agregação no PostgreSQL.
 * Cada métrica é resolvida em uma única consulta agregada, evitando trazer linhas
 * de rotas e visitas para a aplicação apenas para contá-las.
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
  let visitAggregate: Array<{ completed: string | null; reported: string | null; total: string | null; measuredVisits: string | null; averageMinutes: string | null }> = [];

  // Colunas qualificadas manualmente: dentro de `sql` cru o Drizzle emite apenas o nome
  // da coluna, o que gera ambiguidade em subconsultas correlacionadas com `posts`.
  const routeKmInitial = sql`"supervisorRoutes"."kmInitial"`;
  const routeKmFinal = sql`"supervisorRoutes"."kmFinal"`;
  const routeRouteId = sql`"supervisorRoutes"."routeId"`;
  const postRouteId = sql`"posts"."routeId"`;
  const visitStatus = sql`"visitChecklists"."status"`;
  const visitOccurrenceReport = sql`"visitChecklists"."occurrenceReport"`;
  const visitArrival = sql`"visitChecklists"."arrivalTime"`;
  const visitDeparture = sql`"visitChecklists"."departureTime"`;
  try {
    [routeAggregate, visitAggregate] = await Promise.all([
      // Frota e meta das rotas: KM percorrido e total de postos previstos nas rotas do período.
      db.select({
        totalKm: sql<string | null>`coalesce(sum(greatest(${routeKmFinal} - ${routeKmInitial}, 0)) filter (where ${routeKmInitial} is not null and ${routeKmFinal} is not null), 0)`,
        routesWithKm: sql<string | null>`count(*) filter (where ${routeKmInitial} is not null and ${routeKmFinal} is not null)`,
        routesPendingKm: sql<string | null>`count(*) filter (where ${routeKmInitial} is not null and ${routeKmFinal} is null)`,
        plannedPosts: sql<string | null>`coalesce(sum((select count(*) from ${posts} where ${postRouteId} = ${routeRouteId})), 0)`,
      }).from(supervisorRoutes).where(routeFilter),
      // Visitas, ocorrências enviadas e tempo médio medido entre chegada e saída.
      db.select({
        completed: sql<string | null>`count(*) filter (where ${visitStatus} = 'visited')`,
        reported: sql<string | null>`count(*) filter (where nullif(trim(coalesce(${visitOccurrenceReport}, '')), '') is not null)`,
        total: sql<string | null>`count(*)`,
        measuredVisits: sql<string | null>`count(*) filter (where ${visitArrival} is not null and ${visitDeparture} is not null and ${visitDeparture} >= ${visitArrival})`,
        averageMinutes: sql<string | null>`avg(extract(epoch from (${visitDeparture} - ${visitArrival})) / 60) filter (where ${visitArrival} is not null and ${visitDeparture} is not null and ${visitDeparture} >= ${visitArrival})`,
      }).from(visitChecklists)
        .innerJoin(supervisorRoutes, eq(supervisorRoutes.id, visitChecklists.supervisorRouteId))
        .where(routeFilter),
    ]);
  } catch (error) {
    console.error("[Indicadores] Falha ao calcular os indicadores operacionais do Gestor:", error);
    return empty;
  }

  const totalKm = Number(toNumber(routeAggregate[0]?.totalKm).toFixed(2));
  const target = toNumber(routeAggregate[0]?.plannedPosts);
  const completed = toNumber(visitAggregate[0]?.completed);
  const reported = toNumber(visitAggregate[0]?.reported);
  const totalVisits = toNumber(visitAggregate[0]?.total);
  const measuredVisits = toNumber(visitAggregate[0]?.measuredVisits);
  const rawAverage = visitAggregate[0]?.averageMinutes;

  return {
    period: { start: period.start, end: period.end, shiftType, supervisorId },
    inspections: {
      completed,
      reported,
      target,
      completionRate: target > 0 ? Number(((reported / target) * 100).toFixed(1)) : null,
    },
    visitDuration: {
      averageMinutes: measuredVisits > 0 && rawAverage !== null && rawAverage !== undefined ? Number(Number(rawAverage).toFixed(1)) : null,
      measuredVisits,
    },
    fleet: {
      totalKm,
      routesWithKm: toNumber(routeAggregate[0]?.routesWithKm),
      routesPendingKm: toNumber(routeAggregate[0]?.routesPendingKm),
    },
    occurrences: {
      reportedVisits: reported,
      totalVisits,
      pendingReports: Math.max(0, totalVisits - reported),
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
    summary: { totalKm: 0, totalFuelAmount: 0, averageConsumptionKmPerLiter: null as number | null, inspections: 0, plannedPosts: 0, reportedVisits: 0, pendingReports: 0 },
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

  const [visitRows, fuelRows, reportSupervisors, reportVehicles, postRows] = await Promise.all([
    db.select({
      id: visitChecklists.id,
      supervisorRouteId: visitChecklists.supervisorRouteId,
      postName: posts.name,
      postRegion: posts.region,
      status: visitChecklists.status,
      arrivalTime: visitChecklists.arrivalTime,
      departureTime: visitChecklists.departureTime,
      occurrenceSubmittedAt: visitChecklists.occurrenceSubmittedAt,
      occurrenceReport: visitChecklists.occurrenceReport,
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
      .orderBy(asc(visitChecklists.arrivalTime), asc(visitChecklists.occurrenceSubmittedAt), asc(visitChecklists.createdAt)),
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
  const visits = visitRows;
  const totalKm = routeRows.reduce((total, route) => route.kmInitial !== null && route.kmFinal !== null ? total + Math.max(0, Number(route.kmFinal) - Number(route.kmInitial)) : total, 0);
  const totalFuelAmount = periodFuelLogs.reduce((total, log) => total + Number(log.amount), 0);
  const totalConsumptionDistance = periodFuelLogs.reduce((total, log) => total + (log.distanceSincePrevious ?? 0), 0);
  const totalConsumptionLiters = periodFuelLogs.reduce((total, log) => total + (log.distanceSincePrevious != null ? Number(log.liters) : 0), 0);
  const plannedPostsByRoute = new Map<number, number>();
  for (const post of postRows) {
    plannedPostsByRoute.set(post.routeId, (plannedPostsByRoute.get(post.routeId) ?? 0) + 1);
  }
  const plannedPosts = routeRows.reduce((total, route) => total + (plannedPostsByRoute.get(route.routeId) ?? 0), 0);
  const reportedVisits = visits.filter((visit) => Boolean(visit.occurrenceSubmittedAt || visit.occurrenceReport?.trim())).length;

  return {
    filters: { startDate, endDate, supervisorId: input.supervisorId ?? null, vehicleId: input.vehicleId ?? null, shiftType: input.shiftType ?? null },
    filterOptions: { supervisors: reportSupervisors, vehicles: reportVehicles },
    summary: {
      totalKm: Number(totalKm.toFixed(2)),
      totalFuelAmount: Number(totalFuelAmount.toFixed(2)),
      averageConsumptionKmPerLiter: totalConsumptionLiters > 0 ? Number((totalConsumptionDistance / totalConsumptionLiters).toFixed(2)) : null,
      inspections: visits.filter((visit) => visit.status === "visited").length,
      plannedPosts,
      reportedVisits,
      pendingReports: Math.max(0, visits.length - reportedVisits),
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


// Personnel and financial operations
export const PERSONNEL_ROLES = ["SUPERVISOR", "RH", "FINANCEIRO", "ADM"] as const;
export type PersonnelRole = (typeof PERSONNEL_ROLES)[number];
export type PersonnelApprovalStatus = "PENDING" | "APPROVED" | "PAID" | "REJECTED";

/** Calcula a data prevista sem alterar a regra de fechamento quinzenal. */
export function calculateFtPaymentDate(referenceDate: Date) {
  if (!(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) {
    throw new Error("Data de referência inválida");
  }
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  return referenceDate.getDate() <= 15
    ? new Date(year, month, 20, 12, 0, 0, 0)
    : new Date(year, month + 1, 15, 12, 0, 0, 0);
}

export function getPersonnelRole(user: Pick<NonNullable<TrpcContextUser>, "role" | "personnelRole">): PersonnelRole {
  if (user.role === "admin") return "ADM";
  return user.personnelRole ?? "SUPERVISOR";
}

type TrpcContextUser = {
  role: "user" | "admin";
  personnelRole: PersonnelRole | null;
};

function personnelScope(supervisorId: number, role: PersonnelRole) {
  return role === "SUPERVISOR" ? eq(personnelFts.supervisorId, supervisorId) : undefined;
}

function occurrenceScope(supervisorId: number, role: PersonnelRole) {
  return role === "SUPERVISOR" ? eq(personnelOccurrences.supervisorId, supervisorId) : undefined;
}

function extraScope(supervisorId: number, role: PersonnelRole) {
  return role === "SUPERVISOR" ? eq(personnelExtras.supervisorId, supervisorId) : undefined;
}

export async function listPersonnelEmployees(includeInactive = false, includeSensitive = false) {
  const db = await getDb();
  if (!db) return [];
  const where = includeInactive ? undefined : eq(personnelEmployees.isActive, true);
  const publicFields = {
    id: personnelEmployees.id,
    name: personnelEmployees.name,
    position: personnelEmployees.position,
    postId: personnelEmployees.postId,
    post: personnelEmployees.post,
    isActive: personnelEmployees.isActive,
  };
  return includeSensitive
    ? db.select({ ...publicFields, cpf: personnelEmployees.cpf, pixKey: personnelEmployees.pixKey })
      .from(personnelEmployees).where(where).orderBy(personnelEmployees.name)
    : db.select(publicFields).from(personnelEmployees).where(where).orderBy(personnelEmployees.name);
}

export async function listPersonnelPosts() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: posts.id, name: posts.name, address: posts.address, region: posts.region })
    .from(posts)
    .where(eq(posts.isActive, true))
    .orderBy(posts.region, posts.name);
}

export async function createPersonnelEmployee(input: InsertPersonnelEmployee) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(personnelEmployees).values(input).returning({ id: personnelEmployees.id });
  return getPersonnelEmployeeById(getInsertedId(result));
}

export async function updatePersonnelEmployee(id: number, input: Partial<InsertPersonnelEmployee>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(personnelEmployees).set({ ...input, updatedAt: new Date() }).where(eq(personnelEmployees.id, id));
  return getPersonnelEmployeeById(id);
}

export async function getPersonnelEmployeeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(personnelEmployees).where(eq(personnelEmployees.id, id)).limit(1);
  return result[0];
}

export async function listPersonnelUsers(includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({ id: users.id, name: users.name, username: users.username, role: users.role, personnelRole: users.personnelRole, isOperational: users.isOperational, mustChangePassword: users.mustChangePassword }).from(users);
  return includeInactive ? query.orderBy(users.name) : query.where(eq(users.isOperational, true)).orderBy(users.name);
}

export async function updatePersonnelUserRole(id: number, personnelRole: PersonnelRole) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ personnelRole, role: personnelRole === "ADM" ? "admin" : "user", updatedAt: new Date() }).where(eq(users.id, id));
  return getUserById(id);
}

export async function createPersonnelUser(input: {
  name: string;
  username: string;
  passwordHash: string;
  personnelRole: PersonnelRole;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const username = input.username.trim().toLowerCase();
  const existing = await getUserByUsername(username);
  if (existing) throw new Error("Este usuário já existe");
  const result = await db.insert(users).values({
    openId: `local:${username}`,
    name: input.name.trim(),
    loginMethod: "local",
    username,
    passwordHash: input.passwordHash,
    mustChangePassword: true,
    isOperational: true,
    personnelRole: input.personnelRole,
    role: input.personnelRole === "ADM" ? "admin" : "user",
    lastSignedIn: new Date(),
  }).returning({ id: users.id });
  return getUserById(getInsertedId(result));
}

function toScheduleAssignment(row: {
  id?: number;
  startDate: string;
  endDate: string | null;
  cycleAnchorDate: string | null;
  assignedBy?: number | null;
  createdAt?: Date;
  scheduleId: number;
  scheduleName: string;
  weeklyHours: string;
  pattern: WorkSchedulePattern;
}): PersonnelScheduleAssignment {
  return {
    id: row.id,
    startDate: row.startDate,
    endDate: row.endDate,
    cycleAnchorDate: row.cycleAnchorDate,
    assignedBy: row.assignedBy,
    createdAt: row.createdAt,
    schedule: { id: row.scheduleId, name: row.scheduleName, weeklyHours: row.weeklyHours, pattern: row.pattern },
  };
}

export async function listPersonnelWorkSchedules() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(personnelWorkSchedules).orderBy(asc(personnelWorkSchedules.name));
}

export async function createPersonnelWorkSchedule(input: { name: string; pattern: WorkSchedulePattern; createdBy: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) throw new Error("O nome da jornada deve ter entre 2 e 120 caracteres");
  const patternError = validateWorkSchedulePattern(input.pattern);
  if (patternError) throw new Error(patternError);
  const duplicate = await db.select({ id: personnelWorkSchedules.id }).from(personnelWorkSchedules)
    .where(sql`lower(${personnelWorkSchedules.name}) = ${name.toLocaleLowerCase("pt-BR")}`).limit(1);
  if (duplicate.length) throw new Error("Já existe uma jornada com esse nome");
  const values: InsertPersonnelWorkSchedule = {
    name,
    pattern: input.pattern,
    weeklyHours: weeklyHoursFromPattern(input.pattern).toFixed(2),
    createdBy: input.createdBy,
  };
  const inserted = await db.insert(personnelWorkSchedules).values(values).returning({ id: personnelWorkSchedules.id });
  const id = getInsertedId(inserted);
  return (await db.select().from(personnelWorkSchedules).where(eq(personnelWorkSchedules.id, id)).limit(1))[0];
}

export async function listPersonnelEmployeeScheduleAssignments(employeeId: number): Promise<PersonnelScheduleAssignment[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: personnelEmployeeScheduleAssignments.id,
    startDate: personnelEmployeeScheduleAssignments.startDate,
    endDate: personnelEmployeeScheduleAssignments.endDate,
    cycleAnchorDate: personnelEmployeeScheduleAssignments.cycleAnchorDate,
    assignedBy: personnelEmployeeScheduleAssignments.assignedBy,
    createdAt: personnelEmployeeScheduleAssignments.createdAt,
    scheduleId: personnelWorkSchedules.id,
    scheduleName: personnelWorkSchedules.name,
    weeklyHours: personnelWorkSchedules.weeklyHours,
    pattern: personnelWorkSchedules.pattern,
  }).from(personnelEmployeeScheduleAssignments)
    .innerJoin(personnelWorkSchedules, eq(personnelWorkSchedules.id, personnelEmployeeScheduleAssignments.scheduleId))
    .where(eq(personnelEmployeeScheduleAssignments.employeeId, employeeId))
    .orderBy(asc(personnelEmployeeScheduleAssignments.startDate));
  return rows.map(toScheduleAssignment);
}

export async function assignPersonnelWorkSchedule(input: {
  employeeId: number;
  scheduleId: number;
  startDate: string;
  cycleAnchorDate: string | null;
  assignedBy: number;
  actorName: string;
  actorUsername: string | null;
  reason: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!isCivilDate(input.startDate)) throw new Error("Informe uma data inicial válida no formato AAAA-MM-DD");
  if (input.cycleAnchorDate !== null && !isCivilDate(input.cycleAnchorDate)) throw new Error("Informe uma data âncora válida no formato AAAA-MM-DD");
  if (input.reason.trim().length < 5) throw new Error("Informe um motivo com pelo menos 5 caracteres");

  const reason = input.reason.trim();
  const actorNameSnapshot = input.actorName.trim() || input.actorUsername || `Usuário #${input.assignedBy}`;
  const auditIdentity = { actorId: input.assignedBy, actorNameSnapshot, actorUsernameSnapshot: input.actorUsername };

  return db.transaction(async (transaction) => {
    const lockedEmployee = await transaction.execute(sql`SELECT id FROM personnel_employees WHERE id = ${input.employeeId} FOR UPDATE`);
    if (!lockedEmployee.rows?.length) throw new Error("Funcionário não encontrado");
    const scheduleRows = await transaction.select().from(personnelWorkSchedules).where(eq(personnelWorkSchedules.id, input.scheduleId)).limit(1);
    const schedule = scheduleRows[0];
    if (!schedule) throw new Error("Jornada não encontrada");
    if (schedule.pattern.kind === "CYCLE") {
      if (!input.cycleAnchorDate) throw new Error("Informe a data âncora do ciclo; o primeiro dia da regra define trabalho ou folga");
      if (input.cycleAnchorDate > input.startDate) throw new Error("A data âncora deve ser igual ou anterior ao início da vigência");
    } else if (input.cycleAnchorDate) {
      throw new Error("A grade semanal não usa data âncora de ciclo");
    }

    const existing = await transaction.select().from(personnelEmployeeScheduleAssignments)
      .where(eq(personnelEmployeeScheduleAssignments.employeeId, input.employeeId))
      .orderBy(asc(personnelEmployeeScheduleAssignments.startDate));
    if (existing.some((row) => row.startDate === input.startDate)) {
      throw new Error("Já existe uma atribuição com essa data inicial; use uma nova data para preservar o histórico");
    }
    const covering = existing.filter((row) => row.startDate < input.startDate && (!row.endDate || row.endDate >= input.startDate));
    if (covering.length > 1) throw new Error("Há atribuições sobrepostas; revise o histórico antes de atribuir outra jornada");
    const next = existing.find((row) => row.startDate > input.startDate);
    let endDate = next ? addCivilDays(next.startDate, -1) : null;
    if (covering[0]) {
      const previousEnd = covering[0].endDate;
      endDate = previousEnd && (!next || previousEnd < next.startDate)
        ? previousEnd
        : next ? addCivilDays(next.startDate, -1) : null;
      const previousScheduleRows = await transaction.select().from(personnelWorkSchedules)
        .where(eq(personnelWorkSchedules.id, covering[0].scheduleId)).limit(1);
      const previousSchedule = previousScheduleRows[0];
      if (!previousSchedule) throw new Error("A jornada anterior não foi encontrada");
      const closedAssignment = { ...covering[0], endDate: addCivilDays(input.startDate, -1) };
      await transaction.update(personnelEmployeeScheduleAssignments)
        .set({ endDate: closedAssignment.endDate })
        .where(eq(personnelEmployeeScheduleAssignments.id, covering[0].id));
      await transaction.insert(personnelEmployeeScheduleAssignmentAudit).values({
        assignmentId: covering[0].id,
        employeeId: input.employeeId,
        action: "CLOSE",
        ...auditIdentity,
        reason,
        previousSnapshot: scheduleAssignmentAuditSnapshot(covering[0], previousSchedule),
        newSnapshot: scheduleAssignmentAuditSnapshot(closedAssignment, previousSchedule),
      });
    }
    if (endDate && next && endDate >= next.startDate) throw new Error("A nova vigência conflita com uma atribuição futura existente");
    const inserted = await transaction.insert(personnelEmployeeScheduleAssignments).values({
      employeeId: input.employeeId,
      scheduleId: input.scheduleId,
      startDate: input.startDate,
      endDate,
      cycleAnchorDate: input.cycleAnchorDate,
      assignedBy: input.assignedBy,
    }).returning();
    const newAssignment = inserted[0];
    if (!newAssignment) throw new Error("Não foi possível registrar a nova vigência");
    await transaction.insert(personnelEmployeeScheduleAssignmentAudit).values({
      assignmentId: newAssignment.id,
      employeeId: input.employeeId,
      action: "ASSIGN",
      ...auditIdentity,
      reason,
      previousSnapshot: null,
      newSnapshot: scheduleAssignmentAuditSnapshot(newAssignment, schedule),
    });
    return { id: newAssignment.id, endDate };
  });
}

function scheduleAssignmentAuditSnapshot(
  assignment: Pick<typeof personnelEmployeeScheduleAssignments.$inferSelect, "id" | "employeeId" | "scheduleId" | "startDate" | "endDate" | "cycleAnchorDate" | "assignedBy" | "createdAt">,
  schedule: Pick<typeof personnelWorkSchedules.$inferSelect, "name" | "weeklyHours" | "pattern">,
): PersonnelWorkScheduleAssignmentAuditSnapshot {
  return {
    id: assignment.id,
    employeeId: assignment.employeeId,
    scheduleId: assignment.scheduleId,
    scheduleName: schedule.name,
    weeklyHours: schedule.weeklyHours,
    pattern: schedule.pattern,
    startDate: assignment.startDate,
    endDate: assignment.endDate,
    cycleAnchorDate: assignment.cycleAnchorDate,
    assignedBy: assignment.assignedBy,
    createdAt: assignment.createdAt.toISOString(),
  };
}

export async function editPersonnelWorkScheduleAssignment(input: {
  assignmentId: number;
  employeeId: number;
  scheduleId: number;
  startDate: string;
  endDate: string | null;
  cycleAnchorDate: string | null;
  actorId: number;
  actorName: string;
  actorUsername: string | null;
  reason: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!isCivilDate(input.startDate)) throw new Error("Informe uma data inicial válida no formato AAAA-MM-DD");
  if (input.endDate !== null && !isCivilDate(input.endDate)) throw new Error("Informe uma data final válida no formato AAAA-MM-DD");
  if (input.endDate && input.endDate < input.startDate) throw new Error("O fim da vigência não pode anteceder o início");
  if (input.cycleAnchorDate !== null && !isCivilDate(input.cycleAnchorDate)) throw new Error("Informe uma data âncora válida no formato AAAA-MM-DD");
  if (input.reason.trim().length < 5) throw new Error("Informe um motivo com pelo menos 5 caracteres");

  const reason = input.reason.trim();
  const actorNameSnapshot = input.actorName.trim() || input.actorUsername || `Usuário #${input.actorId}`;
  const auditIdentity = { actorId: input.actorId, actorNameSnapshot, actorUsernameSnapshot: input.actorUsername };

  return db.transaction(async (transaction) => {
    const initialRows = await transaction.select({ employeeId: personnelEmployeeScheduleAssignments.employeeId })
      .from(personnelEmployeeScheduleAssignments).where(eq(personnelEmployeeScheduleAssignments.id, input.assignmentId)).limit(1);
    const initial = initialRows[0];
    if (!initial) throw new Error("A atribuição de jornada não foi encontrada");

    const employeeIds = Array.from(new Set([initial.employeeId, input.employeeId])).sort((left, right) => left - right);
    const lockedEmployees = await transaction.select({ id: personnelEmployees.id }).from(personnelEmployees)
      .where(inArray(personnelEmployees.id, employeeIds)).orderBy(asc(personnelEmployees.id)).for("update");
    if (lockedEmployees.length !== employeeIds.length) throw new Error("Funcionário não encontrado");

    const currentRows = await transaction.select().from(personnelEmployeeScheduleAssignments)
      .where(eq(personnelEmployeeScheduleAssignments.id, input.assignmentId)).for("update").limit(1);
    const current = currentRows[0];
    if (!current) throw new Error("A atribuição de jornada não foi encontrada");
    if (current.employeeId !== initial.employeeId) throw new Error("Este período foi alterado em paralelo; recarregue o histórico e tente novamente");

    const scheduleRows = await transaction.select().from(personnelWorkSchedules)
      .where(eq(personnelWorkSchedules.id, input.scheduleId)).limit(1);
    const schedule = scheduleRows[0];
    if (!schedule) throw new Error("Jornada não encontrada");
    if (schedule.pattern.kind === "CYCLE") {
      if (!input.cycleAnchorDate) throw new Error("Informe a data âncora do ciclo; o primeiro dia da regra define trabalho ou folga");
      if (input.cycleAnchorDate > input.startDate) throw new Error("A data âncora deve ser igual ou anterior ao início da vigência");
    } else if (input.cycleAnchorDate) {
      throw new Error("A grade semanal não usa data âncora de ciclo");
    }

    const targetAssignments = await transaction.select().from(personnelEmployeeScheduleAssignments)
      .where(eq(personnelEmployeeScheduleAssignments.employeeId, input.employeeId))
      .orderBy(asc(personnelEmployeeScheduleAssignments.startDate));
    if (hasOverlappingScheduleAssignment({ startDate: input.startDate, endDate: input.endDate }, targetAssignments, current.id)) {
      throw new Error("As novas datas conflitam com outra jornada vigente; ajuste os períodos antes de salvar");
    }

    const previousScheduleRows = await transaction.select().from(personnelWorkSchedules)
      .where(eq(personnelWorkSchedules.id, current.scheduleId)).limit(1);
    const previousSchedule = previousScheduleRows[0];
    if (!previousSchedule) throw new Error("A jornada anterior não foi encontrada");
    const nextAssignment = {
      ...current,
      employeeId: input.employeeId,
      scheduleId: input.scheduleId,
      startDate: input.startDate,
      endDate: input.endDate,
      cycleAnchorDate: input.cycleAnchorDate,
    };
    await transaction.update(personnelEmployeeScheduleAssignments).set({
      employeeId: input.employeeId,
      scheduleId: input.scheduleId,
      startDate: input.startDate,
      endDate: input.endDate,
      cycleAnchorDate: input.cycleAnchorDate,
    }).where(eq(personnelEmployeeScheduleAssignments.id, current.id));
    await transaction.insert(personnelEmployeeScheduleAssignmentAudit).values({
      assignmentId: current.id,
      employeeId: input.employeeId,
      action: "EDIT",
      ...auditIdentity,
      reason,
      previousSnapshot: scheduleAssignmentAuditSnapshot(current, previousSchedule),
      newSnapshot: scheduleAssignmentAuditSnapshot(nextAssignment, schedule),
    });
    return { id: current.id, employeeId: input.employeeId, scheduleId: input.scheduleId, startDate: input.startDate, endDate: input.endDate };
  });
}

export async function listPersonnelWorkScheduleAssignmentAudits(assignmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(personnelEmployeeScheduleAssignmentAudit)
    .where(eq(personnelEmployeeScheduleAssignmentAudit.assignmentId, assignmentId))
    .orderBy(desc(personnelEmployeeScheduleAssignmentAudit.changedAt), desc(personnelEmployeeScheduleAssignmentAudit.id));
}

export async function getPersonnelScheduleDay(employeeId: number, civilDate: string) {
  if (!isCivilDate(civilDate)) throw new Error("Informe uma data válida no formato AAAA-MM-DD");
  return classifyScheduleDay(await listPersonnelEmployeeScheduleAssignments(employeeId), civilDate);
}

export async function getPersonnelEmployeeScheduleCalendar(employeeId: number, month: string) {
  if (!isCivilMonth(month)) throw new Error("Informe um mês válido no formato AAAA-MM");
  const assignments = await listPersonnelEmployeeScheduleAssignments(employeeId);
  return {
    employeeId,
    month,
    assignments,
    days: monthCalendarDays(month).map((date) => ({ date, ...classifyScheduleDay(assignments, date) })),
  };
}

export async function listPersonnelFts(supervisorId: number, role: PersonnelRole) {
  const db = await getDb();
  if (!db) return [];
  const scope = personnelScope(supervisorId, role);
  return db.select({
    id: personnelFts.id,
    employeeId: personnelFts.employeeId,
    employeeName: personnelEmployees.name,
    supervisorId: personnelFts.supervisorId,
    supervisorName: users.name,
    date: personnelFts.date,
    civilDate: personnelFts.civilDate,
    paymentDate: personnelFts.paymentDate,
    amount: personnelFts.amount,
    reason: personnelFts.reason,
    status: personnelFts.status,
    rejectionReason: personnelFts.rejectionReason,
    reviewedAt: personnelFts.reviewedAt,
    paidAt: personnelFts.paidAt,
    createdAt: personnelFts.createdAt,
  }).from(personnelFts)
    .innerJoin(personnelEmployees, eq(personnelEmployees.id, personnelFts.employeeId))
    .leftJoin(users, eq(users.id, personnelFts.supervisorId))
    .where(scope)
    .orderBy(desc(personnelFts.createdAt));
}

/** Retorno completo, somente leitura, para a sessão separada do Gestor. */
export async function getGestorPersonnelOverview() {
  const [employees, usersList, fts, occurrences, extras] = await Promise.all([
    listPersonnelEmployees(true),
    listPersonnelUsers(true),
    listPersonnelFts(0, "RH"),
    listPersonnelOccurrences(0, "FINANCEIRO"),
    listPersonnelExtras(0, "RH"),
  ]);
  const entries = [...fts, ...occurrences, ...extras];
  return {
    summary: {
      employees: employees.length,
      activeEmployees: employees.filter((employee) => employee.isActive).length,
      users: usersList.length,
      pending: entries.filter((entry) => entry.status === "PENDING").length,
      approved: entries.filter((entry) => entry.status === "APPROVED").length,
      paid: entries.filter((entry) => entry.status === "PAID").length,
    },
  };
}

function civilDateTimestamp(civilDate: string) {
  const [year, month, day] = civilDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

export function calculateFtPaymentDateForCivilDate(civilDate: string) {
  if (!isCivilDate(civilDate)) throw new Error("Informe uma data válida no formato AAAA-MM-DD");
  const period = getFtSettlementPeriod(civilDate);
  const [year, month] = civilDate.split("-").map(Number);
  const dueYear = period.half === "FIRST_HALF" || month < 12 ? year : year + 1;
  const dueMonth = period.half === "FIRST_HALF" ? month : month === 12 ? 1 : month + 1;
  const dueDay = period.half === "FIRST_HALF" ? 20 : 15;
  return new Date(Date.UTC(dueYear, dueMonth - 1, dueDay, 12, 0, 0, 0));
}

export async function createPersonnelFt(input: Omit<InsertPersonnelFt, "date" | "civilDate" | "paymentDate"> & { civilDate: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!isCivilDate(input.civilDate)) throw new Error("Informe uma data válida no formato AAAA-MM-DD");
  const id = await db.transaction(async (transaction) => {
    const employeeRows = await transaction.select({ id: personnelEmployees.id, isActive: personnelEmployees.isActive })
      .from(personnelEmployees)
      .where(eq(personnelEmployees.id, input.employeeId))
      .for("update")
      .limit(1);
    const employee = employeeRows[0];
    if (!employee?.isActive) throw new Error("Funcionário inválido ou inativo");

    const assignmentRows = await transaction.select({
      startDate: personnelEmployeeScheduleAssignments.startDate,
      endDate: personnelEmployeeScheduleAssignments.endDate,
      cycleAnchorDate: personnelEmployeeScheduleAssignments.cycleAnchorDate,
      scheduleId: personnelWorkSchedules.id,
      scheduleName: personnelWorkSchedules.name,
      weeklyHours: personnelWorkSchedules.weeklyHours,
      pattern: personnelWorkSchedules.pattern,
    }).from(personnelEmployeeScheduleAssignments)
      .innerJoin(personnelWorkSchedules, eq(personnelWorkSchedules.id, personnelEmployeeScheduleAssignments.scheduleId))
      .where(eq(personnelEmployeeScheduleAssignments.employeeId, input.employeeId))
      .orderBy(asc(personnelEmployeeScheduleAssignments.startDate));
    assertFtAllowedForScheduleDay(classifyScheduleDay(assignmentRows.map(toScheduleAssignment), input.civilDate));

    const result = await transaction.insert(personnelFts).values({
      ...input,
      date: civilDateTimestamp(input.civilDate),
      paymentDate: calculateFtPaymentDateForCivilDate(input.civilDate),
    }).returning({ id: personnelFts.id });
    return getInsertedId(result);
  });
  return getPersonnelFtById(id);
}

export async function getPersonnelFtById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({
    id: personnelFts.id,
    employeeId: personnelFts.employeeId,
    employeeName: personnelEmployees.name,
    supervisorId: personnelFts.supervisorId,
    supervisorName: users.name,
    date: personnelFts.date,
    civilDate: personnelFts.civilDate,
    paymentDate: personnelFts.paymentDate,
    amount: personnelFts.amount,
    reason: personnelFts.reason,
    status: personnelFts.status,
    rejectionReason: personnelFts.rejectionReason,
    reviewedAt: personnelFts.reviewedAt,
    paidAt: personnelFts.paidAt,
    createdAt: personnelFts.createdAt,
  }).from(personnelFts)
    .innerJoin(personnelEmployees, eq(personnelEmployees.id, personnelFts.employeeId))
    .leftJoin(users, eq(users.id, personnelFts.supervisorId))
    .where(eq(personnelFts.id, id)).limit(1);
  return result[0];
}

export async function reviewPersonnelFt(input: { id: number; status: "APPROVED" | "REJECTED"; reviewedBy: number; rejectionReason?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const current = await db.select({ status: personnelFts.status }).from(personnelFts).where(eq(personnelFts.id, input.id)).limit(1);
  if (!current[0]) throw new Error("Lançamento não encontrado");
  if (current[0].status !== "PENDING") throw new Error("Este lançamento já foi revisado");
  await db.update(personnelFts).set({ status: input.status, reviewedBy: input.reviewedBy, reviewedAt: new Date(), rejectionReason: input.status === "REJECTED" ? input.rejectionReason ?? null : null, updatedAt: new Date() }).where(and(eq(personnelFts.id, input.id), eq(personnelFts.status, "PENDING")));
  return getPersonnelFtById(input.id);
}

export async function payPersonnelFt(id: number, paidBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(personnelFts).set({ status: "PAID", paidBy, paidAt: new Date(), updatedAt: new Date() }).where(and(eq(personnelFts.id, id), eq(personnelFts.status, "APPROVED")));
  return getPersonnelFtById(id);
}

export async function listPersonnelOccurrences(supervisorId: number, role: PersonnelRole) {
  const db = await getDb();
  if (!db) return [];
  const scope = occurrenceScope(supervisorId, role);
  const fields = {
    id: personnelOccurrences.id,
    employeeId: personnelOccurrences.employeeId,
    employeeName: personnelEmployees.name,
    supervisorId: personnelOccurrences.supervisorId,
    supervisorName: users.name,
    type: personnelOccurrences.type,
    date: personnelOccurrences.date,
    observation: personnelOccurrences.observation,
    status: personnelOccurrences.status,
    rejectionReason: personnelOccurrences.rejectionReason,
    reviewedAt: personnelOccurrences.reviewedAt,
    createdAt: personnelOccurrences.createdAt,
  };
  const query = role === "RH" || role === "ADM"
    ? db.select({ ...fields, documentUrl: personnelOccurrences.documentUrl, documentName: personnelOccurrences.documentName })
    : db.select(fields);
  return query.from(personnelOccurrences)
    .innerJoin(personnelEmployees, eq(personnelEmployees.id, personnelOccurrences.employeeId))
    .leftJoin(users, eq(users.id, personnelOccurrences.supervisorId))
    .where(scope)
    .orderBy(desc(personnelOccurrences.createdAt));
}

export async function createPersonnelOccurrence(input: InsertPersonnelOccurrence) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const employee = await getPersonnelEmployeeById(input.employeeId);
  if (!employee?.isActive) throw new Error("Funcionário inválido ou inativo");
  const result = await db.insert(personnelOccurrences).values(input).returning({ id: personnelOccurrences.id });
  return getPersonnelOccurrenceById(getInsertedId(result));
}

export async function getPersonnelOccurrenceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(personnelOccurrences).where(eq(personnelOccurrences.id, id)).limit(1);
  return result[0];
}

/** Confirma que o documento pertence a um registro de ocorrência e que sua chave mantém o proprietário. */
export async function isAuthorizedPersonnelOccurrenceDocument(key: string) {
  const keyMatch = /^personnel\/occurrences\/([1-9]\d*)\/[A-Za-z0-9._-]+$/.exec(key);
  if (!keyMatch || !Number.isSafeInteger(Number(keyMatch[1]))) return false;
  const database = await getDb();
  if (!database) return false;
  const result = await database.select({
    supervisorId: personnelOccurrences.supervisorId,
    documentUrl: personnelOccurrences.documentUrl,
  }).from(personnelOccurrences)
    .where(eq(personnelOccurrences.documentKey, key))
    .limit(1);
  const occurrence = result[0];
  return Boolean(
    occurrence &&
    occurrence.supervisorId === Number(keyMatch[1]) &&
    occurrence.documentUrl === `/manus-storage/${key}`
  );
}

export async function reviewPersonnelOccurrence(input: { id: number; status: "APPROVED" | "REJECTED"; reviewedBy: number; rejectionReason?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const current = await db.select({ status: personnelOccurrences.status }).from(personnelOccurrences).where(eq(personnelOccurrences.id, input.id)).limit(1);
  if (!current[0]) throw new Error("Ocorrência não encontrada");
  if (current[0].status !== "PENDING") throw new Error("Esta ocorrência já foi revisada");
  await db.update(personnelOccurrences).set({ status: input.status, reviewedBy: input.reviewedBy, reviewedAt: new Date(), rejectionReason: input.status === "REJECTED" ? input.rejectionReason ?? null : null, updatedAt: new Date() }).where(and(eq(personnelOccurrences.id, input.id), eq(personnelOccurrences.status, "PENDING")));
  return getPersonnelOccurrenceById(input.id);
}

export async function listPersonnelExtras(supervisorId: number, role: PersonnelRole) {
  const db = await getDb();
  if (!db) return [];
  const scope = extraScope(supervisorId, role);
  return db.select({
    id: personnelExtras.id,
    employeeId: personnelExtras.employeeId,
    employeeName: personnelEmployees.name,
    supervisorId: personnelExtras.supervisorId,
    supervisorName: users.name,
    date: personnelExtras.date,
    hoursOrDaily: personnelExtras.hoursOrDaily,
    amount: personnelExtras.amount,
    description: personnelExtras.description,
    status: personnelExtras.status,
    rejectionReason: personnelExtras.rejectionReason,
    reviewedAt: personnelExtras.reviewedAt,
    paidAt: personnelExtras.paidAt,
    createdAt: personnelExtras.createdAt,
  }).from(personnelExtras)
    .innerJoin(personnelEmployees, eq(personnelEmployees.id, personnelExtras.employeeId))
    .leftJoin(users, eq(users.id, personnelExtras.supervisorId))
    .where(scope)
    .orderBy(desc(personnelExtras.createdAt));
}

export async function createPersonnelExtra(input: InsertPersonnelExtra) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const employee = await getPersonnelEmployeeById(input.employeeId);
  if (!employee?.isActive) throw new Error("Funcionário inválido ou inativo");
  const result = await db.insert(personnelExtras).values(input).returning({ id: personnelExtras.id });
  return getPersonnelExtraById(getInsertedId(result));
}

export async function getPersonnelExtraById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(personnelExtras).where(eq(personnelExtras.id, id)).limit(1);
  return result[0];
}

export async function reviewPersonnelExtra(input: { id: number; status: "APPROVED" | "REJECTED"; reviewedBy: number; rejectionReason?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const current = await db.select({ status: personnelExtras.status }).from(personnelExtras).where(eq(personnelExtras.id, input.id)).limit(1);
  if (!current[0]) throw new Error("Serviço extra não encontrado");
  if (current[0].status !== "PENDING") throw new Error("Este serviço extra já foi revisado");
  await db.update(personnelExtras).set({ status: input.status, reviewedBy: input.reviewedBy, reviewedAt: new Date(), rejectionReason: input.status === "REJECTED" ? input.rejectionReason ?? null : null, updatedAt: new Date() }).where(and(eq(personnelExtras.id, input.id), eq(personnelExtras.status, "PENDING")));
  return getPersonnelExtraById(input.id);
}

export async function payPersonnelExtra(id: number, paidBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(personnelExtras).set({ status: "PAID", paidBy, paidAt: new Date(), updatedAt: new Date() }).where(and(eq(personnelExtras.id, id), eq(personnelExtras.status, "APPROVED")));
  return getPersonnelExtraById(id);
}

export async function uploadPersonnelDocument(userId: number, file: { name: string; mimeType: string; base64: string }) {
  const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  if (!allowedMimeTypes.has(file.mimeType)) throw new Error("Formato de atestado não suportado");
  const bytes = Buffer.from(file.base64, "base64");
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) throw new Error("O arquivo deve ter entre 1 byte e 10 MB");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "atestado";
  const result = await storagePut(`personnel/occurrences/${userId}/${randomUUID()}-${safeName}`, bytes, file.mimeType);
  return { ...result, name: safeName };
}

export async function getPersonnelDashboardData(supervisorId: number, role: PersonnelRole) {
  const [employees, posts, fts, occurrences, extras] = await Promise.all([
    listPersonnelEmployees(role !== "SUPERVISOR", role === "RH" || role === "ADM"),
    listPersonnelPosts(),
    listPersonnelFts(supervisorId, role),
    role === "FINANCEIRO" ? Promise.resolve([]) : listPersonnelOccurrences(supervisorId, role),
    listPersonnelExtras(supervisorId, role),
  ]);
  const payable = [...fts, ...extras].filter((item) => item.status === "APPROVED");
  const pending = [...fts, ...extras, ...occurrences].filter((item) => item.status === "PENDING");
  return {
    employees,
    posts,
    fts,
    occurrences,
    extras,
    summary: {
      pendingCount: pending.length,
      pendingFinancialCount: payable.length,
      approvedAmount: payable.reduce((total, item) => total + Number(item.amount), 0),
      paidAmount: [...fts, ...extras].filter((item) => item.status === "PAID").reduce((total, item) => total + Number(item.amount), 0),
      employeesCount: employees.filter((employee) => employee.isActive).length,
    },
  };
}


function personnelFtCivilDateExpression() {
  return sql<string>`COALESCE(${personnelFts.civilDate}::text, to_char(${personnelFts.date} AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'))`;
}

function personnelExtraCivilDateExpression() {
  return sql<string>`to_char(${personnelExtras.date} AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')`;
}

function personnelFtWindowCondition(startDate: string, endDate: string) {
  return or(
    and(gte(personnelFts.civilDate, startDate), lte(personnelFts.civilDate, endDate)),
    and(
      isNull(personnelFts.civilDate),
      sql`(${personnelFts.date} AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${startDate}::date AND ${endDate}::date`,
    ),
  );
}

function personnelExtraWindowCondition(startDate: string, endDate: string) {
  return sql`(${personnelExtras.date} AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${startDate}::date AND ${endDate}::date`;
}

/** Relatório para RH, Financeiro e ADM: as consultas já chegam limitadas à janela civil solicitada. */
export async function getPersonnelMovementReport(month: string, period: MovementPeriod, role: PersonnelRole) {
  const window = getPersonnelMovementWindow(month, period);
  const database = await getDb();
  if (!database) return { window, rows: [] };

  const ftDate = personnelFtCivilDateExpression();
  const extraDate = personnelExtraCivilDateExpression();
  const ftRows = role === "FINANCEIRO"
    ? await database.select({
      kind: sql<"FT">`'FT'`,
      civilDate: ftDate,
      employeeName: personnelEmployees.name,
      status: personnelFts.status,
      amount: personnelFts.amount,
      paymentDate: personnelFts.paymentDate,
    }).from(personnelFts)
      .innerJoin(personnelEmployees, eq(personnelEmployees.id, personnelFts.employeeId))
      .where(personnelFtWindowCondition(window.startDate, window.endDate))
      .orderBy(asc(ftDate))
    : await database.select({
      kind: sql<"FT">`'FT'`,
      civilDate: ftDate,
      employeeName: personnelEmployees.name,
      position: personnelEmployees.position,
      post: personnelEmployees.post,
      status: personnelFts.status,
      amount: personnelFts.amount,
      reason: personnelFts.reason,
    }).from(personnelFts)
      .innerJoin(personnelEmployees, eq(personnelEmployees.id, personnelFts.employeeId))
      .where(personnelFtWindowCondition(window.startDate, window.endDate))
      .orderBy(asc(ftDate));
  const extraRows = role === "FINANCEIRO"
    ? await database.select({
      kind: sql<"EXTRA">`'EXTRA'`,
      civilDate: extraDate,
      employeeName: personnelEmployees.name,
      status: personnelExtras.status,
      amount: personnelExtras.amount,
    }).from(personnelExtras)
      .innerJoin(personnelEmployees, eq(personnelEmployees.id, personnelExtras.employeeId))
      .where(personnelExtraWindowCondition(window.startDate, window.endDate))
      .orderBy(asc(extraDate))
    : await database.select({
      kind: sql<"EXTRA">`'EXTRA'`,
      civilDate: extraDate,
      employeeName: personnelEmployees.name,
      position: personnelEmployees.position,
      post: personnelEmployees.post,
      status: personnelExtras.status,
      amount: personnelExtras.amount,
      hoursOrDaily: personnelExtras.hoursOrDaily,
      description: personnelExtras.description,
    }).from(personnelExtras)
      .innerJoin(personnelEmployees, eq(personnelEmployees.id, personnelExtras.employeeId))
      .where(personnelExtraWindowCondition(window.startDate, window.endDate))
      .orderBy(asc(extraDate));
  const rows = [...ftRows, ...extraRows].sort((left, right) =>
    left.civilDate.localeCompare(right.civilDate) || left.kind.localeCompare(right.kind),
  );
  return { window, rows };
}

/** O relatório do Gestor só retorna contagens por dia e tipo, nunca linhas individuais ou dados financeiros. */
export async function getGestorPersonnelMovementReport(month: string, period: MovementPeriod) {
  const window = getPersonnelMovementWindow(month, period);
  const database = await getDb();
  if (!database) return { window, rows: [] };
  const ftDate = personnelFtCivilDateExpression();
  const extraDate = personnelExtraCivilDateExpression();
  const [ftCounts, extraCounts] = await Promise.all([
    database.select({ civilDate: ftDate, count: sql<number>`count(*)::int` })
      .from(personnelFts)
      .where(personnelFtWindowCondition(window.startDate, window.endDate))
      .groupBy(ftDate)
      .orderBy(asc(ftDate)),
    database.select({ civilDate: extraDate, count: sql<number>`count(*)::int` })
      .from(personnelExtras)
      .where(personnelExtraWindowCondition(window.startDate, window.endDate))
      .groupBy(extraDate)
      .orderBy(asc(extraDate)),
  ]);
  const rows = [
    ...ftCounts.map((row) => ({ civilDate: row.civilDate, kind: "FT" as const, count: row.count })),
    ...extraCounts.map((row) => ({ civilDate: row.civilDate, kind: "EXTRA" as const, count: row.count })),
  ].sort((left, right) => left.civilDate.localeCompare(right.civilDate) || left.kind.localeCompare(right.kind));
  return { window, rows };
}
