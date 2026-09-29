CREATE TABLE "personnel_employee_schedule_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"employeeId" integer NOT NULL,
	"scheduleId" integer NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date,
	"cycleAnchorDate" date,
	"assignedBy" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_personnel_schedule_assignment_date_range" CHECK ("personnel_employee_schedule_assignments"."endDate" IS NULL OR "personnel_employee_schedule_assignments"."endDate" >= "personnel_employee_schedule_assignments"."startDate")
);
--> statement-breakpoint
CREATE TABLE "personnel_work_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"pattern" jsonb NOT NULL,
	"weeklyHours" numeric(6, 2) NOT NULL,
	"createdBy" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personnel_work_schedules_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "personnel_fts" ADD COLUMN "civilDate" date;--> statement-breakpoint
ALTER TABLE "personnel_employee_schedule_assignments" ADD CONSTRAINT "personnel_employee_schedule_assignments_employeeId_personnel_employees_id_fk" FOREIGN KEY ("employeeId") REFERENCES "public"."personnel_employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_employee_schedule_assignments" ADD CONSTRAINT "personnel_employee_schedule_assignments_scheduleId_personnel_work_schedules_id_fk" FOREIGN KEY ("scheduleId") REFERENCES "public"."personnel_work_schedules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_personnel_schedule_assignment_employee_start" ON "personnel_employee_schedule_assignments" USING btree ("employeeId","startDate");--> statement-breakpoint
CREATE INDEX "idx_personnel_schedule_assignment_employee_start" ON "personnel_employee_schedule_assignments" USING btree ("employeeId","startDate");--> statement-breakpoint
CREATE INDEX "idx_personnel_schedule_assignment_schedule" ON "personnel_employee_schedule_assignments" USING btree ("scheduleId");--> statement-breakpoint
CREATE INDEX "idx_personnel_work_schedules_name" ON "personnel_work_schedules" USING btree ("name");