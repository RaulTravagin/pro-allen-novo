import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, routes, posts, supervisorRoutes, visitChecklists, checklistItems, supervisorLocations, postVisitHistory } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
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

    await db.insert(users).values(values).onDuplicateKeyUpdate({
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
    role: "user",
    lastSignedIn: new Date(),
  });
  return (await getUserById(Number((result as unknown as { insertId: number }).insertId)))!;
}

// Routes queries
export async function getAllRoutes() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(routes);
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

// Supervisor Routes queries
export async function createSupervisorRoute(supervisorId: number, routeId: number, date: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(supervisorRoutes).values({
    supervisorId,
    routeId,
    date,
    status: 'pending',
  });
  
  return (result as any).insertId || 0;
}

export async function getSupervisorRouteById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(supervisorRoutes).where(eq(supervisorRoutes.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getSupervisorRoutesToday(supervisorId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return await db.select().from(supervisorRoutes)
    .where(and(
      eq(supervisorRoutes.supervisorId, supervisorId),
      gte(supervisorRoutes.date, today),
      lte(supervisorRoutes.date, tomorrow)
    ));
}

export async function updateSupervisorRoute(id: number, updates: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(supervisorRoutes)
    .set(updates)
    .where(eq(supervisorRoutes.id, id));
}

// Visit Checklists queries
export async function createVisitChecklist(supervisorRouteId: number, postId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(visitChecklists).values({
    supervisorRouteId,
    postId,
    status: 'pending',
  });
  
  return (result as any).insertId || 0;
}

export async function getVisitChecklistsByRoute(supervisorRouteId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(visitChecklists)
    .where(eq(visitChecklists.supervisorRouteId, supervisorRouteId));
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

// Checklist Items queries
export async function createChecklistItem(visitChecklistId: number, category: string, description: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(checklistItems).values({
    visitChecklistId,
    category,
    description,
  });
  
  return (result as any).insertId || 0;
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
  
  return await db.update(checklistItems)
    .set(updates)
    .where(eq(checklistItems.id, id));
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
  
  // Get the latest location for each supervisor
  const allLocations = await db.select().from(supervisorLocations)
    .orderBy(desc(supervisorLocations.recordedAt));
  
  // Group by supervisor and keep only the latest
  const latestBySuper: Record<number, any> = {};
  for (const loc of allLocations) {
    if (!latestBySuper[loc.supervisorId]) {
      latestBySuper[loc.supervisorId] = loc;
    }
  }
  
  return Object.values(latestBySuper);
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

/** Dados consolidados usados pelo painel protegido do Gestor. */
export async function getGestorOperationalSnapshot() {
  const db = await getDb();
  if (!db) {
    return {
      activeRoutes: [],
      recentVisits: [],
      metrics: { supervisorsOnRoute: 0, activeRoutes: 0, visitsInProgress: 0, completedVisits: 0, totalKm: 0 },
      lastUpdatedAt: new Date(),
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayRoutes, todayChecklists, latestLocations] = await Promise.all([
    db.select({
      id: supervisorRoutes.id,
      supervisorId: supervisorRoutes.supervisorId,
      routeName: routes.name,
      routeRegion: routes.region,
      status: supervisorRoutes.status,
      kmInitial: supervisorRoutes.kmInitial,
      kmFinal: supervisorRoutes.kmFinal,
      startedAt: supervisorRoutes.startedAt,
      completedAt: supervisorRoutes.completedAt,
      updatedAt: supervisorRoutes.updatedAt,
    })
      .from(supervisorRoutes)
      .innerJoin(routes, eq(routes.id, supervisorRoutes.routeId))
      .where(and(gte(supervisorRoutes.date, today), lte(supervisorRoutes.date, tomorrow)))
      .orderBy(desc(supervisorRoutes.updatedAt)),
    db.select({
      id: visitChecklists.id,
      supervisorRouteId: visitChecklists.supervisorRouteId,
      postName: posts.name,
      postRegion: posts.region,
      status: visitChecklists.status,
      arrivalTime: visitChecklists.arrivalTime,
      departureTime: visitChecklists.departureTime,
      visitedAt: visitChecklists.visitedAt,
    })
      .from(visitChecklists)
      .innerJoin(supervisorRoutes, eq(supervisorRoutes.id, visitChecklists.supervisorRouteId))
      .innerJoin(posts, eq(posts.id, visitChecklists.postId))
      .where(and(gte(supervisorRoutes.date, today), lte(supervisorRoutes.date, tomorrow))),
    getAllSupervisorsLatestLocations(),
  ]);

  const locationBySupervisor = new Map<number, (typeof latestLocations)[number]>();
  for (const location of latestLocations) locationBySupervisor.set(location.supervisorId, location);

  const activeRoutes = todayRoutes.map((route) => {
    const routeChecklists = todayChecklists.filter((checklist) => checklist.supervisorRouteId === route.id);
    const activeVisit = routeChecklists.find((checklist) => checklist.status === "in_progress") ?? null;
    const completedVisits = routeChecklists.filter((checklist) => checklist.status === "visited").length;
    const location = locationBySupervisor.get(route.supervisorId) ?? null;

    return {
      ...route,
      totalPosts: routeChecklists.length,
      completedVisits,
      activeVisit,
      latestLocation: location,
    };
  });

  const recentVisits = todayChecklists
    .filter((checklist) => checklist.status === "visited" || checklist.status === "in_progress")
    .sort((a, b) => {
      const aTime = (a.departureTime ?? a.arrivalTime ?? a.visitedAt)?.getTime() ?? 0;
      const bTime = (b.departureTime ?? b.arrivalTime ?? b.visitedAt)?.getTime() ?? 0;
      return bTime - aTime;
    })
    .slice(0, 8);

  const totalKm = activeRoutes.reduce((total, route) => {
    if (route.kmInitial === null || route.kmFinal === null) return total;
    return total + Math.max(0, Number(route.kmFinal) - Number(route.kmInitial));
  }, 0);

  return {
    activeRoutes,
    recentVisits,
    metrics: {
      supervisorsOnRoute: new Set(activeRoutes.filter((route) => route.status === "pending" || route.status === "in_progress").map((route) => route.supervisorId)).size,
      activeRoutes: activeRoutes.filter((route) => route.status === "in_progress").length,
      visitsInProgress: todayChecklists.filter((checklist) => checklist.status === "in_progress").length,
      completedVisits: todayChecklists.filter((checklist) => checklist.status === "visited").length,
      totalKm: Number(totalKm.toFixed(2)),
    },
    lastUpdatedAt: new Date(),
  };
}
