import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json } from "drizzle-orm/mysql-core";
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
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Routes table - stores all supervisor routes
 */
export const routes = mysqlTable("routes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  region: varchar("region", { length: 255 }).notNull(),
  description: text("description"),
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
});

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
});

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
  status: mysqlEnum("status", ["pending", "in_progress", "visited", "skipped"]).default("pending").notNull(),
  arrivalLatitude: decimal("arrivalLatitude", { precision: 10, scale: 8 }),
  arrivalLongitude: decimal("arrivalLongitude", { precision: 11, scale: 8 }),
  departureLatitude: decimal("departureLatitude", { precision: 10, scale: 8 }),
  departureLongitude: decimal("departureLongitude", { precision: 11, scale: 8 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
});

export type PostVisitHistory = typeof postVisitHistory.$inferSelect;
export type InsertPostVisitHistory = typeof postVisitHistory.$inferInsert;