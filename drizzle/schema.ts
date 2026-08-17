import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, index, uniqueIndex } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  username: varchar("username", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  mustChangePassword: boolean("mustChangePassword").default(true).notNull(),
  isOperational: boolean("isOperational").default(true).notNull(),
  defaultShift: mysqlEnum("defaultShift", ["day", "night", "reliever"]),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Daily work schedule maintained by the Gestor. It stores only the selected
 * date overrides; each supervisor's standard shift remains on the user record.
 */
export const supervisorSchedules = mysqlTable("supervisorSchedules", {
  id: int("id").autoincrement().primaryKey(),
  scheduleDate: timestamp("scheduleDate").notNull(),
  supervisorId: int("supervisorId").notNull(),
  assignment: mysqlEnum("assignment", ["day", "night", "reliever", "off"]).notNull(),
  note: text("note"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  scheduleDateIdx: index("idx_supervisorSchedules_date").on(table.scheduleDate),
  supervisorIdx: index("idx_supervisorSchedules_supervisor").on(table.supervisorId),
  dailySupervisorUnique: uniqueIndex("uq_supervisorSchedules_date_supervisor").on(table.scheduleDate, table.supervisorId),
}));

export type SupervisorSchedule = typeof supervisorSchedules.$inferSelect;
export type InsertSupervisorSchedule = typeof supervisorSchedules.$inferInsert;

/**
 * Routes table - stores all supervisor routes
 */
export const routes = mysqlTable("routes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  region: varchar("region", { length: 255 }).notNull(),
  description: text("description"),
  activityType: mysqlEnum("activityType", ["field_route", "operational_base"]).default("field_route").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Route = typeof routes.$inferSelect;
export type InsertRoute = typeof routes.$inferInsert;

/**
 * Posts table - stores all posts/locations to be visited
 */
export const posts = mysqlTable("posts", {
  id: int("id").autoincrement().primaryKey(),
  routeId: int("routeId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
  region: varchar("region", { length: 255 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  order: int("order").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  routeIdIdx: index("idx_posts_routeId").on(table.routeId),
}))

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

/**
 * Supervisor Routes - tracks which supervisor is assigned to which route on which day
 */
export const supervisorRoutes = mysqlTable("supervisorRoutes", {
  id: int("id").autoincrement().primaryKey(),
  supervisorId: int("supervisorId").notNull(),
  routeId: int("routeId").notNull(),
  date: timestamp("date").notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "cancelled"]).default("pending").notNull(),
  kmInitial: decimal("kmInitial", { precision: 10, scale: 2 }),
  kmFinal: decimal("kmFinal", { precision: 10, scale: 2 }),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  supervisorIdIdx: index("idx_supervisorRoutes_supervisorId").on(table.supervisorId),
  dateIdx: index("idx_supervisorRoutes_date").on(table.date),
  statusIdx: index("idx_supervisorRoutes_status").on(table.status),
}))

export type SupervisorRoute = typeof supervisorRoutes.$inferSelect;
export type InsertSupervisorRoute = typeof supervisorRoutes.$inferInsert;

/**
 * Visit Checklists - stores checklist items for each post visit
 */
export const visitChecklists = mysqlTable("visitChecklists", {
  id: int("id").autoincrement().primaryKey(),
  supervisorRouteId: int("supervisorRouteId").notNull(),
  postId: int("postId").notNull(),
  arrivalTime: timestamp("arrivalTime"),
  departureTime: timestamp("departureTime"),
  visitedAt: timestamp("visitedAt"),
  observations: text("observations"),
  isCoverage: boolean("isCoverage").default(false).notNull(),
  coverageReason: text("coverageReason"),
  status: mysqlEnum("status", ["pending", "in_progress", "visited", "skipped"]).default("pending").notNull(),
  arrivalLatitude: decimal("arrivalLatitude", { precision: 10, scale: 8 }),
  arrivalLongitude: decimal("arrivalLongitude", { precision: 11, scale: 8 }),
  departureLatitude: decimal("departureLatitude", { precision: 10, scale: 8 }),
  departureLongitude: decimal("departureLongitude", { precision: 11, scale: 8 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  supervisorRouteIdIdx: index("idx_visitChecklists_supervisorRouteId").on(table.supervisorRouteId),
  postIdIdx: index("idx_visitChecklists_postId").on(table.postId),
  statusIdx: index("idx_visitChecklists_status").on(table.status),
}))

export type VisitChecklist = typeof visitChecklists.$inferSelect;
export type InsertVisitChecklist = typeof visitChecklists.$inferInsert;

/**
 * Checklist Items - predefined items to verify during each visit
 */
export const checklistItems = mysqlTable("checklistItems", {
  id: int("id").autoincrement().primaryKey(),
  visitChecklistId: int("visitChecklistId").notNull(),
  category: varchar("category", { length: 255 }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  isCompliant: boolean("isCompliant"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChecklistItem = typeof checklistItems.$inferSelect;
export type InsertChecklistItem = typeof checklistItems.$inferInsert;

/**
 * Supervisor Locations - stores GPS coordinates for real-time tracking
 */
export const supervisorLocations = mysqlTable("supervisorLocations", {
  id: int("id").autoincrement().primaryKey(),
  supervisorId: int("supervisorId").notNull(),
  supervisorRouteId: int("supervisorRouteId"),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  accuracy: decimal("accuracy", { precision: 10, scale: 2 }),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SupervisorLocation = typeof supervisorLocations.$inferSelect;
export type InsertSupervisorLocation = typeof supervisorLocations.$inferInsert;

/**
 * Post Visit History - tracks when each post was last visited
 */
export const postVisitHistory = mysqlTable("postVisitHistory", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  supervisorId: int("supervisorId").notNull(),
  visitedAt: timestamp("visitedAt").notNull(),
  observations: text("observations"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  postIdIdx: index("idx_postVisitHistory_postId").on(table.postId),
  supervisorIdIdx: index("idx_postVisitHistory_supervisorId").on(table.supervisorId),
  visitedAtIdx: index("idx_postVisitHistory_visitedAt").on(table.visitedAt),
}))

export type PostVisitHistory = typeof postVisitHistory.$inferSelect;
export type InsertPostVisitHistory = typeof postVisitHistory.$inferInsert;

// Relations for better query performance
export const usersRelations = relations(users, ({ many }) => ({
  supervisorRoutes: many(supervisorRoutes),
  supervisorLocations: many(supervisorLocations),
  postVisitHistory: many(postVisitHistory),
  schedules: many(supervisorSchedules),
}));

export const supervisorSchedulesRelations = relations(supervisorSchedules, ({ one }) => ({
  supervisor: one(users, {
    fields: [supervisorSchedules.supervisorId],
    references: [users.id],
  }),
}));

export const routesRelations = relations(routes, ({ many }) => ({
  posts: many(posts),
  supervisorRoutes: many(supervisorRoutes),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  route: one(routes, {
    fields: [posts.routeId],
    references: [routes.id],
  }),
  visitChecklists: many(visitChecklists),
  postVisitHistory: many(postVisitHistory),
}));

export const supervisorRoutesRelations = relations(supervisorRoutes, ({ one, many }) => ({
  supervisor: one(users, {
    fields: [supervisorRoutes.supervisorId],
    references: [users.id],
  }),
  route: one(routes, {
    fields: [supervisorRoutes.routeId],
    references: [routes.id],
  }),
  visitChecklists: many(visitChecklists),
  supervisorLocations: many(supervisorLocations),
}));

export const visitChecklistsRelations = relations(visitChecklists, ({ one, many }) => ({
  supervisorRoute: one(supervisorRoutes, {
    fields: [visitChecklists.supervisorRouteId],
    references: [supervisorRoutes.id],
  }),
  post: one(posts, {
    fields: [visitChecklists.postId],
    references: [posts.id],
  }),
  checklistItems: many(checklistItems),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  visitChecklist: one(visitChecklists, {
    fields: [checklistItems.visitChecklistId],
    references: [visitChecklists.id],
  }),
}));

export const supervisorLocationsRelations = relations(supervisorLocations, ({ one }) => ({
  supervisor: one(users, {
    fields: [supervisorLocations.supervisorId],
    references: [users.id],
  }),
  supervisorRoute: one(supervisorRoutes, {
    fields: [supervisorLocations.supervisorRouteId],
    references: [supervisorRoutes.id],
  }),
}));

export const postVisitHistoryRelations = relations(postVisitHistory, ({ one }) => ({
  post: one(posts, {
    fields: [postVisitHistory.postId],
    references: [posts.id],
  }),
  supervisor: one(users, {
    fields: [postVisitHistory.supervisorId],
    references: [users.id],
  }),
}));
