CREATE TYPE "public"."occurrence_type" AS ENUM('FALTA_JUSTIFICADA', 'FALTA_INJUSTIFICADA', 'ATESTADO');--> statement-breakpoint
CREATE TYPE "public"."personnel_approval_status" AS ENUM('PENDING', 'APPROVED', 'PAID', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."personnel_role" AS ENUM('SUPERVISOR', 'RH', 'FINANCEIRO', 'ADM');--> statement-breakpoint
CREATE TABLE "personnel_employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"cpf" varchar(14) NOT NULL,
	"pixKey" varchar(255),
	"post" varchar(255) NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personnel_extras" (
	"id" serial PRIMARY KEY NOT NULL,
	"employeeId" integer NOT NULL,
	"supervisorId" integer NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"hoursOrDaily" numeric(10, 2) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"status" "personnel_approval_status" DEFAULT 'PENDING' NOT NULL,
	"reviewedBy" integer,
	"reviewedAt" timestamp with time zone,
	"rejectionReason" text,
	"paidBy" integer,
	"paidAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personnel_fts" (
	"id" serial PRIMARY KEY NOT NULL,
	"employeeId" integer NOT NULL,
	"supervisorId" integer NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" text NOT NULL,
	"status" "personnel_approval_status" DEFAULT 'PENDING' NOT NULL,
	"reviewedBy" integer,
	"reviewedAt" timestamp with time zone,
	"rejectionReason" text,
	"paidBy" integer,
	"paidAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personnel_occurrences" (
	"id" serial PRIMARY KEY NOT NULL,
	"employeeId" integer NOT NULL,
	"supervisorId" integer NOT NULL,
	"type" "occurrence_type" NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"documentKey" text,
	"documentUrl" text,
	"documentName" varchar(255),
	"observation" text,
	"status" "personnel_approval_status" DEFAULT 'PENDING' NOT NULL,
	"reviewedBy" integer,
	"reviewedAt" timestamp with time zone,
	"rejectionReason" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "personnelRole" "personnel_role";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_personnel_employees_cpf" ON "personnel_employees" USING btree ("cpf");--> statement-breakpoint
CREATE INDEX "idx_personnel_employees_active" ON "personnel_employees" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "idx_personnel_extras_employee_date" ON "personnel_extras" USING btree ("employeeId","date");--> statement-breakpoint
CREATE INDEX "idx_personnel_extras_status" ON "personnel_extras" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_personnel_extras_supervisor" ON "personnel_extras" USING btree ("supervisorId");--> statement-breakpoint
CREATE INDEX "idx_personnel_fts_employee_date" ON "personnel_fts" USING btree ("employeeId","date");--> statement-breakpoint
CREATE INDEX "idx_personnel_fts_status" ON "personnel_fts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_personnel_fts_supervisor" ON "personnel_fts" USING btree ("supervisorId");--> statement-breakpoint
CREATE INDEX "idx_personnel_occurrences_employee_date" ON "personnel_occurrences" USING btree ("employeeId","date");--> statement-breakpoint
CREATE INDEX "idx_personnel_occurrences_status" ON "personnel_occurrences" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_personnel_occurrences_type" ON "personnel_occurrences" USING btree ("type");