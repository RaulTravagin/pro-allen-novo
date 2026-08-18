import { relations } from "drizzle-orm";
import { boolean, index, integer, numeric, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

const updatedAt = () => timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull();

export const defaultShiftEnum = pgEnum("default_shift", ["day", "night", "reliever"]);
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const scheduleAssignmentEnum = pgEnum("schedule_assignment", ["day", "night", "reliever", "off"]);
export const routeActivityTypeEnum = pgEnum("route_activity_type", ["field_route", "operational_base"]);
export const supervisorRouteStatusEnum = pgEnum("supervisor_route_status", ["pending", "in_progress", "completed", "cancelled"]);
export const visitChecklistStatusEnum = pgEnum("visit_checklist_status", ["pending", "in_progress", "visited", "skipped"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  username: varchar("username", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  mustChangePassword: boolean("mustChangePassword").default(true).notNull(),
  isOperational: boolean("isOperational").default(true).notNull(),
  defaultShift: defaultShiftEnum("defaultShift"),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: updatedAt(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const supervisorSchedules = pgTable("supervisorSchedules", {
  id: serial("id").primaryKey(),
  scheduleDate: timestamp("scheduleDate", { withTimezone: true }).notNull(),
  supervisorId: integer("supervisorId").notNull(),
  assignment: scheduleAssignmentEnum("assignment").notNull(),
  note: text("note"),
  updatedBy: integer("updatedBy"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: updatedAt(),
}, (table) => ({
  scheduleDateIdx: index("idx_supervisorSchedules_date").on(table.scheduleDate),
  supervisorIdx: index("idx_supervisorSchedules_supervisor").on(table.supervisorId),
  dailySupervisorUnique: uniqueIndex("uq_supervisorSchedules_date_supervisor").on(table.scheduleDate, table.supervisorId),
}));

export type SupervisorSchedule = typeof supervisorSchedules.$inferSelect;
export type InsertSupervisorSchedule = typeof supervisorSchedules.$inferInsert;

export const routes = pgTable("routes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  region: varchar("region", { length: 255 }).notNull(),
  description: text("description"),
  activityType: routeActivityTypeEnum("activityType").default("field_route").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: updatedAt(),
});

export type Route = typeof routes.$inferSelect;
export type InsertRoute = typeof routes.$inferInsert;

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  routeId: integer("routeId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
  region: varchar("region", { length: 255 }).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 8 }),
  longitude: numeric("longitude", { precision: 11, scale: 8 }),
  order: integer("order").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: updatedAt(),
}, (table) => ({ routeIdIdx: index("idx_posts_routeId").on(table.routeId) }));

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

export const supervisorRoutes = pgTable("supervisorRoutes", {
  id: serial("id").primaryKey(),
  supervisorId: integer("supervisorId").notNull(),
  routeId: integer("routeId").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  status: supervisorRouteStatusEnum("status").default("pending").notNull(),
  kmInitial: numeric("kmInitial", { precision: 10, scale: 2 }),
  kmFinal: numeric("kmFinal", { precision: 10, scale: 2 }),
  startedAt: timestamp("startedAt", { withTimezone: true }),
  completedAt: timestamp("completedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: updatedAt(),
}, (table) => ({
  supervisorIdIdx: index("idx_supervisorRoutes_supervisorId").on(table.supervisorId),
  dateIdx: index("idx_supervisorRoutes_date").on(table.date),
  statusIdx: index("idx_supervisorRoutes_status").on(table.status),
}));

export type SupervisorRoute = typeof supervisorRoutes.$inferSelect;
export type InsertSupervisorRoute = typeof supervisorRoutes.$inferInsert;

export const visitChecklists = pgTable("visitChecklists", {
  id: serial("id").primaryKey(),
  supervisorRouteId: integer("supervisorRouteId").notNull(),
  postId: integer("postId").notNull(),
  arrivalTime: timestamp("arrivalTime", { withTimezone: true }),
  departureTime: timestamp("departureTime", { withTimezone: true }),
  visitedAt: timestamp("visitedAt", { withTimezone: true }),
  observations: text("observations"),
  isCoverage: boolean("isCoverage").default(false).notNull(),
  coverageReason: text("coverageReason"),
  status: visitChecklistStatusEnum("status").default("pending").notNull(),
  arrivalLatitude: numeric("arrivalLatitude", { precision: 10, scale: 8 }),
  arrivalLongitude: numeric("arrivalLongitude", { precision: 11, scale: 8 }),
  departureLatitude: numeric("departureLatitude", { precision: 10, scale: 8 }),
  departureLongitude: numeric("departureLongitude", { precision: 11, scale: 8 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: updatedAt(),
}, (table) => ({
  supervisorRouteIdIdx: index("idx_visitChecklists_supervisorRouteId").on(table.supervisorRouteId),
  postIdIdx: index("idx_visitChecklists_postId").on(table.postId),
  statusIdx: index("idx_visitChecklists_status").on(table.status),
}));

export type VisitChecklist = typeof visitChecklists.$inferSelect;
export type InsertVisitChecklist = typeof visitChecklists.$inferInsert;

export const checklistItems = pgTable("checklistItems", {
  id: serial("id").primaryKey(),
  visitChecklistId: integer("visitChecklistId").notNull(),
  category: varchar("category", { length: 255 }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  isCompliant: boolean("isCompliant"),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: updatedAt(),
});

export type ChecklistItem = typeof checklistItems.$inferSelect;
export type InsertChecklistItem = typeof checklistItems.$inferInsert;

export const supervisorLocations = pgTable("supervisorLocations", {
  id: serial("id").primaryKey(),
  supervisorId: integer("supervisorId").notNull(),
  supervisorRouteId: integer("supervisorRouteId"),
  latitude: numeric("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: numeric("longitude", { precision: 11, scale: 8 }).notNull(),
  accuracy: numeric("accuracy", { precision: 10, scale: 2 }),
  recordedAt: timestamp("recordedAt", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type SupervisorLocation = typeof supervisorLocations.$inferSelect;
export type InsertSupervisorLocation = typeof supervisorLocations.$inferInsert;

export const postVisitHistory = pgTable("postVisitHistory", {
  id: serial("id").primaryKey(),
  postId: integer("postId").notNull(),
  supervisorId: integer("supervisorId").notNull(),
  visitedAt: timestamp("visitedAt", { withTimezone: true }).notNull(),
  observations: text("observations"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  postIdIdx: index("idx_postVisitHistory_postId").on(table.postId),
  supervisorIdIdx: index("idx_postVisitHistory_supervisorId").on(table.supervisorId),
  visitedAtIdx: index("idx_postVisitHistory_visitedAt").on(table.visitedAt),
}));

export type PostVisitHistory = typeof postVisitHistory.$inferSelect;
export type InsertPostVisitHistory = typeof postVisitHistory.$inferInsert;

export const usersRelations = relations(users, ({ many }) => ({ supervisorRoutes: many(supervisorRoutes), supervisorLocations: many(supervisorLocations), postVisitHistory: many(postVisitHistory), schedules: many(supervisorSchedules) }));
export const supervisorSchedulesRelations = relations(supervisorSchedules, ({ one }) => ({ supervisor: one(users, { fields: [supervisorSchedules.supervisorId], references: [users.id] }) }));
export const routesRelations = relations(routes, ({ many }) => ({ posts: many(posts), supervisorRoutes: many(supervisorRoutes) }));
export const postsRelations = relations(posts, ({ one, many }) => ({ route: one(routes, { fields: [posts.routeId], references: [routes.id] }), visitChecklists: many(visitChecklists), postVisitHistory: many(postVisitHistory) }));
export const supervisorRoutesRelations = relations(supervisorRoutes, ({ one, many }) => ({ supervisor: one(users, { fields: [supervisorRoutes.supervisorId], references: [users.id] }), route: one(routes, { fields: [supervisorRoutes.routeId], references: [routes.id] }), visitChecklists: many(visitChecklists), supervisorLocations: many(supervisorLocations) }));
export const visitChecklistsRelations = relations(visitChecklists, ({ one, many }) => ({ supervisorRoute: one(supervisorRoutes, { fields: [visitChecklists.supervisorRouteId], references: [supervisorRoutes.id] }), post: one(posts, { fields: [visitChecklists.postId], references: [posts.id] }), checklistItems: many(checklistItems) }));
export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({ visitChecklist: one(visitChecklists, { fields: [checklistItems.visitChecklistId], references: [visitChecklists.id] }) }));
export const supervisorLocationsRelations = relations(supervisorLocations, ({ one }) => ({ supervisor: one(users, { fields: [supervisorLocations.supervisorId], references: [users.id] }), supervisorRoute: one(supervisorRoutes, { fields: [supervisorLocations.supervisorRouteId], references: [supervisorRoutes.id] }) }));
export const postVisitHistoryRelations = relations(postVisitHistory, ({ one }) => ({ post: one(posts, { fields: [postVisitHistory.postId], references: [posts.id] }), supervisor: one(users, { fields: [postVisitHistory.supervisorId], references: [users.id] }) }));
