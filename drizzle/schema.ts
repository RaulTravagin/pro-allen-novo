import { relations, sql } from "drizzle-orm";
import type { WorkSchedulePattern } from "../shared/personnel-schedules";
import { bigint, boolean, check, date, index, integer, jsonb, numeric, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

const updatedAt = () => timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull();

export const defaultShiftEnum = pgEnum("default_shift", ["day", "night", "reliever"]);
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const scheduleAssignmentEnum = pgEnum("schedule_assignment", ["day", "night", "reliever", "off"]);
export const routeActivityTypeEnum = pgEnum("route_activity_type", ["field_route", "operational_base"]);
export const supervisorRouteStatusEnum = pgEnum("supervisor_route_status", ["pending", "in_progress", "completed", "cancelled"]);
export const operationShiftEnum = pgEnum("operation_shift", ["day", "night"]);
export const visitChecklistStatusEnum = pgEnum("visit_checklist_status", ["pending", "in_progress", "visited", "skipped"]);
export const fuelTypeEnum = pgEnum("fuel_type", ["gasoline", "ethanol", "diesel"]);
export const personnelRoleEnum = pgEnum("personnel_role", ["SUPERVISOR", "RH", "FINANCEIRO", "ADM"]);
export const personnelApprovalStatusEnum = pgEnum("personnel_approval_status", ["PENDING", "APPROVED", "PAID", "REJECTED"]);
export const occurrenceTypeEnum = pgEnum("occurrence_type", ["FALTA_JUSTIFICADA", "FALTA_INJUSTIFICADA", "ATESTADO"]);

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
  personnelRole: personnelRoleEnum("personnelRole"),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: updatedAt(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const personnelEmployees = pgTable("personnel_employees", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  cpf: varchar("cpf", { length: 14 }).notNull(),
  position: varchar("position", { length: 255 }),
  postId: integer("postId"),
  pixKey: varchar("pixKey", { length: 255 }),
  post: varchar("post", { length: 255 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: updatedAt(),
}, (table) => ({
  cpfUnique: uniqueIndex("uq_personnel_employees_cpf").on(table.cpf),
  activeIdx: index("idx_personnel_employees_active").on(table.isActive),
}));

export type PersonnelEmployee = typeof personnelEmployees.$inferSelect;
export type InsertPersonnelEmployee = typeof personnelEmployees.$inferInsert;

export const personnelWorkSchedules = pgTable("personnel_work_schedules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  pattern: jsonb("pattern").$type<WorkSchedulePattern>().notNull(),
  weeklyHours: numeric("weeklyHours", { precision: 6, scale: 2 }).notNull(),
  createdBy: integer("createdBy"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  nameIdx: index("idx_personnel_work_schedules_name").on(table.name),
}));

export type PersonnelWorkSchedule = typeof personnelWorkSchedules.$inferSelect;
export type InsertPersonnelWorkSchedule = typeof personnelWorkSchedules.$inferInsert;

export const personnelEmployeeScheduleAssignments = pgTable("personnel_employee_schedule_assignments", {
  id: serial("id").primaryKey(),
  employeeId: integer("employeeId").notNull().references(() => personnelEmployees.id, { onDelete: "restrict" }),
  scheduleId: integer("scheduleId").notNull().references(() => personnelWorkSchedules.id, { onDelete: "restrict" }),
  startDate: date("startDate", { mode: "string" }).notNull(),
  endDate: date("endDate", { mode: "string" }),
  cycleAnchorDate: date("cycleAnchorDate", { mode: "string" }),
  assignedBy: integer("assignedBy"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  employeeStartUnique: uniqueIndex("uq_personnel_schedule_assignment_employee_start").on(table.employeeId, table.startDate),
  employeeStartIdx: index("idx_personnel_schedule_assignment_employee_start").on(table.employeeId, table.startDate),
  scheduleIdx: index("idx_personnel_schedule_assignment_schedule").on(table.scheduleId),
  validRange: check("chk_personnel_schedule_assignment_date_range", sql`${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`),
}));

export type PersonnelEmployeeScheduleAssignment = typeof personnelEmployeeScheduleAssignments.$inferSelect;
export type InsertPersonnelEmployeeScheduleAssignment = typeof personnelEmployeeScheduleAssignments.$inferInsert;

export type PersonnelWorkScheduleAssignmentAuditSnapshot = {
  id: number;
  employeeId: number;
  scheduleId: number;
  scheduleName: string;
  weeklyHours: string;
  pattern: WorkSchedulePattern;
  startDate: string;
  endDate: string | null;
  cycleAnchorDate: string | null;
  assignedBy: number | null;
  createdAt: string;
};

export const personnelEmployeeScheduleAssignmentAudit = pgTable("personnel_employee_schedule_assignment_audit", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignmentId").notNull(),
  employeeId: integer("employeeId").notNull(),
  action: varchar("action", { length: 16 }).notNull(),
  actorId: integer("actorId").notNull(),
  actorNameSnapshot: text("actorNameSnapshot").notNull(),
  actorUsernameSnapshot: varchar("actorUsernameSnapshot", { length: 64 }),
  changedAt: timestamp("changedAt", { withTimezone: true }).defaultNow().notNull(),
  transactionId: bigint("transactionId", { mode: "number" }).default(sql`txid_current()`).notNull(),
  reason: text("reason").notNull(),
  previousSnapshot: jsonb("previousSnapshot").$type<PersonnelWorkScheduleAssignmentAuditSnapshot | null>(),
  newSnapshot: jsonb("newSnapshot").$type<PersonnelWorkScheduleAssignmentAuditSnapshot>().notNull(),
}, (table) => ({
  assignmentAuditIdx: index("idx_personnel_schedule_assignment_audit_assignment_changed").on(table.assignmentId, table.changedAt),
  employeeAuditIdx: index("idx_personnel_schedule_assignment_audit_employee_changed").on(table.employeeId, table.changedAt),
  actionCheck: check("chk_personnel_schedule_assignment_audit_action", sql`${table.action} IN ('ASSIGN', 'CLOSE', 'EDIT')`),
  reasonCheck: check("chk_personnel_schedule_assignment_audit_reason", sql`length(btrim(${table.reason})) >= 5`),
}));

export type PersonnelEmployeeScheduleAssignmentAudit = typeof personnelEmployeeScheduleAssignmentAudit.$inferSelect;

export const personnelFts = pgTable("personnel_fts", {
  id: serial("id").primaryKey(),
  employeeId: integer("employeeId").notNull(),
  supervisorId: integer("supervisorId").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  civilDate: date("civilDate", { mode: "string" }),
  paymentDate: timestamp("data_prevista_pagamento", { withTimezone: true }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  status: personnelApprovalStatusEnum("status").default("PENDING").notNull(),
  reviewedBy: integer("reviewedBy"),
  reviewedAt: timestamp("reviewedAt", { withTimezone: true }),
  rejectionReason: text("rejectionReason"),
  paidBy: integer("paidBy"),
  paidAt: timestamp("paidAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: updatedAt(),
}, (table) => ({
  employeeDateIdx: index("idx_personnel_fts_employee_date").on(table.employeeId, table.date),
  statusIdx: index("idx_personnel_fts_status").on(table.status),
  supervisorIdx: index("idx_personnel_fts_supervisor").on(table.supervisorId),
}));

export type PersonnelFt = typeof personnelFts.$inferSelect;
export type InsertPersonnelFt = typeof personnelFts.$inferInsert;

export const personnelOccurrences = pgTable("personnel_occurrences", {
  id: serial("id").primaryKey(),
  employeeId: integer("employeeId").notNull(),
  supervisorId: integer("supervisorId").notNull(),
  type: occurrenceTypeEnum("type").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  documentKey: text("documentKey"),
  documentUrl: text("documentUrl"),
  documentName: varchar("documentName", { length: 255 }),
  observation: text("observation"),
  status: personnelApprovalStatusEnum("status").default("PENDING").notNull(),
  reviewedBy: integer("reviewedBy"),
  reviewedAt: timestamp("reviewedAt", { withTimezone: true }),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: updatedAt(),
}, (table) => ({
  employeeDateIdx: index("idx_personnel_occurrences_employee_date").on(table.employeeId, table.date),
  statusIdx: index("idx_personnel_occurrences_status").on(table.status),
  typeIdx: index("idx_personnel_occurrences_type").on(table.type),
}));

export type PersonnelOccurrence = typeof personnelOccurrences.$inferSelect;
export type InsertPersonnelOccurrence = typeof personnelOccurrences.$inferInsert;

export const personnelExtras = pgTable("personnel_extras", {
  id: serial("id").primaryKey(),
  employeeId: integer("employeeId").notNull(),
  supervisorId: integer("supervisorId").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  hoursOrDaily: numeric("hoursOrDaily", { precision: 10, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  status: personnelApprovalStatusEnum("status").default("PENDING").notNull(),
  reviewedBy: integer("reviewedBy"),
  reviewedAt: timestamp("reviewedAt", { withTimezone: true }),
  rejectionReason: text("rejectionReason"),
  paidBy: integer("paidBy"),
  paidAt: timestamp("paidAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: updatedAt(),
}, (table) => ({
  employeeDateIdx: index("idx_personnel_extras_employee_date").on(table.employeeId, table.date),
  statusIdx: index("idx_personnel_extras_status").on(table.status),
  supervisorIdx: index("idx_personnel_extras_supervisor").on(table.supervisorId),
}));

export type PersonnelExtra = typeof personnelExtras.$inferSelect;
export type InsertPersonnelExtra = typeof personnelExtras.$inferInsert;

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
  addressStreet: varchar("addressStreet", { length: 255 }),
  addressNumber: varchar("addressNumber", { length: 32 }),
  addressNeighborhood: varchar("addressNeighborhood", { length: 255 }),
  addressCity: varchar("addressCity", { length: 255 }),
  addressPostalCode: varchar("addressPostalCode", { length: 16 }),
  latitude: numeric("latitude", { precision: 10, scale: 8 }),
  longitude: numeric("longitude", { precision: 11, scale: 8 }),
  order: integer("order").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: updatedAt(),
}, (table) => ({
  routeIdIdx: index("idx_posts_routeId").on(table.routeId),
  routeActiveOrderIdx: index("idx_posts_route_active_order").on(table.routeId, table.isActive, table.order),
}));

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

export const postPopDocuments = pgTable("post_pop_documents", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  storageKey: varchar("storage_key", { length: 512 }).notNull().unique(),
  uploadedBy: integer("uploaded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  postIdIdx: index("idx_post_pop_documents_post_id").on(table.postId),
}));

export type PostPopDocument = typeof postPopDocuments.$inferSelect;
export type InsertPostPopDocument = typeof postPopDocuments.$inferInsert;

export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  plate: varchar("plate", { length: 10 }).notNull(),
  model: varchar("model", { length: 120 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: updatedAt(),
}, (table) => ({
  plateUnique: uniqueIndex("uq_vehicles_plate").on(table.plate),
  activeIdx: index("idx_vehicles_active").on(table.isActive),
}));

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;

export const supervisorRoutes = pgTable("supervisorRoutes", {
  id: serial("id").primaryKey(),
  supervisorId: integer("supervisorId").notNull(),
  routeId: integer("routeId").notNull(),
  vehicleId: integer("vehicleId"),
  date: timestamp("date", { withTimezone: true }).notNull(),
  shiftType: operationShiftEnum("shiftType").notNull(),
  shiftStartedAt: timestamp("shiftStartedAt", { withTimezone: true }).notNull(),
  status: supervisorRouteStatusEnum("status").default("pending").notNull(),
  kmInitial: numeric("kmInitial", { precision: 10, scale: 2 }),
  kmFinal: numeric("kmFinal", { precision: 10, scale: 2 }),
  startedAt: timestamp("startedAt", { withTimezone: true }),
  completedAt: timestamp("completedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: updatedAt(),
}, (table) => ({
  supervisorIdIdx: index("idx_supervisorRoutes_supervisorId").on(table.supervisorId),
  vehicleIdIdx: index("idx_supervisorRoutes_vehicleId").on(table.vehicleId),
  dateIdx: index("idx_supervisorRoutes_date").on(table.date),
  shiftWindowIdx: index("idx_supervisorRoutes_shift_window").on(table.shiftStartedAt, table.shiftType),
  supervisorShiftWindowIdx: index("idx_supervisorRoutes_supervisor_shift_window").on(table.supervisorId, table.shiftStartedAt, table.shiftType),
  statusIdx: index("idx_supervisorRoutes_status").on(table.status),
}));

export type SupervisorRoute = typeof supervisorRoutes.$inferSelect;
export type InsertSupervisorRoute = typeof supervisorRoutes.$inferInsert;

/** Fechamentos são eventos imutáveis; não armazenar justificativas no registro mutável da rota. */
export const supervisorRouteClosureExceptions = pgTable("supervisor_route_closure_exceptions", {
  id: serial("id").primaryKey(),
  supervisorRouteId: integer("supervisor_route_id").notNull(),
  supervisorId: integer("supervisor_id").notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }).notNull(),
  justification: text("justification"),
  pendingSummary: jsonb("pending_summary").notNull(),
}, (table) => ({
  routeClosedAtIdx: index("idx_route_closure_exceptions_route_closed_at").on(table.supervisorRouteId, table.closedAt),
  supervisorClosedAtIdx: index("idx_route_closure_exceptions_supervisor_closed_at").on(table.supervisorId, table.closedAt),
}));

export type SupervisorRouteClosureException = typeof supervisorRouteClosureExceptions.$inferSelect;

export const fuelLogs = pgTable("fuel_logs", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicleId").notNull(),
  supervisorRouteId: integer("supervisorRouteId").notNull(),
  supervisorId: integer("supervisorId").notNull(),
  odometerKm: numeric("odometerKm", { precision: 10, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  liters: numeric("liters", { precision: 10, scale: 3 }).notNull(),
  fuelType: fuelTypeEnum("fuelType").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  vehicleCreatedIdx: index("idx_fuel_logs_vehicle_created").on(table.vehicleId, table.createdAt),
  routeCreatedIdx: index("idx_fuel_logs_route_created").on(table.supervisorRouteId, table.createdAt),
  routeIdx: index("idx_fuel_logs_route").on(table.supervisorRouteId),
  supervisorIdx: index("idx_fuel_logs_supervisor").on(table.supervisorId),
}));

export type FuelLog = typeof fuelLogs.$inferSelect;
export type InsertFuelLog = typeof fuelLogs.$inferInsert;

export const visitChecklists = pgTable("visitChecklists", {
  id: serial("id").primaryKey(),
  supervisorRouteId: integer("supervisorRouteId").notNull(),
  postId: integer("postId").notNull(),
  arrivalTime: timestamp("arrivalTime", { withTimezone: true }),
  departureTime: timestamp("departureTime", { withTimezone: true }),
  visitedAt: timestamp("visitedAt", { withTimezone: true }),
  occurrenceSubmittedAt: timestamp("occurrenceSubmittedAt", { withTimezone: true }),
  occurrenceReport: text("occurrenceReport"),
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
  supervisorRouteStatusIdx: index("idx_visitChecklists_route_status").on(table.supervisorRouteId, table.status),
  visitedAtStatusIdx: index("idx_visitChecklists_visitedAt_status").on(table.visitedAt, table.status),
  occurrenceSubmittedAtIdx: index("idx_visitChecklists_occurrenceSubmittedAt").on(table.occurrenceSubmittedAt),
  postIdIdx: index("idx_visitChecklists_postId").on(table.postId),
  statusIdx: index("idx_visitChecklists_status").on(table.status),
}));

export type VisitChecklist = typeof visitChecklists.$inferSelect;
export type InsertVisitChecklist = typeof visitChecklists.$inferInsert;

export const supervisorLocations = pgTable("supervisorLocations", {
  id: serial("id").primaryKey(),
  supervisorId: integer("supervisorId").notNull(),
  supervisorRouteId: integer("supervisorRouteId"),
  latitude: numeric("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: numeric("longitude", { precision: 11, scale: 8 }).notNull(),
  accuracy: numeric("accuracy", { precision: 10, scale: 2 }),
  recordedAt: timestamp("recordedAt", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  supervisorRecordedAtIdx: index("idx_supervisorLocations_supervisor_recordedAt").on(table.supervisorId, table.recordedAt.desc(), table.id.desc()),
  routeRecordedAtIdx: index("idx_supervisorLocations_route_recordedAt").on(table.supervisorRouteId, table.recordedAt.desc(), table.id.desc()),
}));

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
  supervisorVisitedAtIdx: index("idx_postVisitHistory_supervisor_visitedAt").on(table.supervisorId, table.visitedAt),
  visitedAtIdx: index("idx_postVisitHistory_visitedAt").on(table.visitedAt),
}));

export type PostVisitHistory = typeof postVisitHistory.$inferSelect;
export type InsertPostVisitHistory = typeof postVisitHistory.$inferInsert;

export const usersRelations = relations(users, ({ many }) => ({ supervisorRoutes: many(supervisorRoutes), supervisorLocations: many(supervisorLocations), postVisitHistory: many(postVisitHistory), schedules: many(supervisorSchedules) }));
export const supervisorSchedulesRelations = relations(supervisorSchedules, ({ one }) => ({ supervisor: one(users, { fields: [supervisorSchedules.supervisorId], references: [users.id] }) }));
export const routesRelations = relations(routes, ({ many }) => ({ posts: many(posts), supervisorRoutes: many(supervisorRoutes) }));
export const postsRelations = relations(posts, ({ one, many }) => ({ route: one(routes, { fields: [posts.routeId], references: [routes.id] }), visitChecklists: many(visitChecklists), postVisitHistory: many(postVisitHistory), popDocuments: many(postPopDocuments) }));
export const vehiclesRelations = relations(vehicles, ({ many }) => ({ supervisorRoutes: many(supervisorRoutes), fuelLogs: many(fuelLogs) }));
export const supervisorRoutesRelations = relations(supervisorRoutes, ({ one, many }) => ({ supervisor: one(users, { fields: [supervisorRoutes.supervisorId], references: [users.id] }), route: one(routes, { fields: [supervisorRoutes.routeId], references: [routes.id] }), vehicle: one(vehicles, { fields: [supervisorRoutes.vehicleId], references: [vehicles.id] }), visitChecklists: many(visitChecklists), supervisorLocations: many(supervisorLocations), fuelLogs: many(fuelLogs) }));
export const fuelLogsRelations = relations(fuelLogs, ({ one }) => ({ vehicle: one(vehicles, { fields: [fuelLogs.vehicleId], references: [vehicles.id] }), supervisorRoute: one(supervisorRoutes, { fields: [fuelLogs.supervisorRouteId], references: [supervisorRoutes.id] }), supervisor: one(users, { fields: [fuelLogs.supervisorId], references: [users.id] }) }));
export const visitChecklistsRelations = relations(visitChecklists, ({ one }) => ({ supervisorRoute: one(supervisorRoutes, { fields: [visitChecklists.supervisorRouteId], references: [supervisorRoutes.id] }), post: one(posts, { fields: [visitChecklists.postId], references: [posts.id] }) }));
export const supervisorLocationsRelations = relations(supervisorLocations, ({ one }) => ({ supervisor: one(users, { fields: [supervisorLocations.supervisorId], references: [users.id] }), supervisorRoute: one(supervisorRoutes, { fields: [supervisorLocations.supervisorRouteId], references: [supervisorRoutes.id] }) }));
export const postVisitHistoryRelations = relations(postVisitHistory, ({ one }) => ({ post: one(posts, { fields: [postVisitHistory.postId], references: [posts.id] }), supervisor: one(users, { fields: [postVisitHistory.supervisorId], references: [users.id] }) }));
