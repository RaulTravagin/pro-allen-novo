CREATE TYPE "public"."default_shift" AS ENUM('day', 'night', 'reliever');--> statement-breakpoint
CREATE TYPE "public"."route_activity_type" AS ENUM('field_route', 'operational_base');--> statement-breakpoint
CREATE TYPE "public"."schedule_assignment" AS ENUM('day', 'night', 'reliever', 'off');--> statement-breakpoint
CREATE TYPE "public"."supervisor_route_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."visit_checklist_status" AS ENUM('pending', 'in_progress', 'visited', 'skipped');--> statement-breakpoint
CREATE TABLE "checklistItems" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitChecklistId" integer NOT NULL,
	"category" varchar(255) NOT NULL,
	"description" varchar(255) NOT NULL,
	"isCompliant" boolean,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "postVisitHistory" (
	"id" serial PRIMARY KEY NOT NULL,
	"postId" integer NOT NULL,
	"supervisorId" integer NOT NULL,
	"visitedAt" timestamp with time zone NOT NULL,
	"observations" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"routeId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" varchar(255) NOT NULL,
	"region" varchar(255) NOT NULL,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"order" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"region" varchar(255) NOT NULL,
	"description" text,
	"activityType" "route_activity_type" DEFAULT 'field_route' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supervisorLocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"supervisorId" integer NOT NULL,
	"supervisorRouteId" integer,
	"latitude" numeric(10, 8) NOT NULL,
	"longitude" numeric(11, 8) NOT NULL,
	"accuracy" numeric(10, 2),
	"recordedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supervisorRoutes" (
	"id" serial PRIMARY KEY NOT NULL,
	"supervisorId" integer NOT NULL,
	"routeId" integer NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"status" "supervisor_route_status" DEFAULT 'pending' NOT NULL,
	"kmInitial" numeric(10, 2),
	"kmFinal" numeric(10, 2),
	"startedAt" timestamp with time zone,
	"completedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supervisorSchedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"scheduleDate" timestamp with time zone NOT NULL,
	"supervisorId" integer NOT NULL,
	"assignment" "schedule_assignment" NOT NULL,
	"note" text,
	"updatedBy" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"username" varchar(64),
	"passwordHash" varchar(255),
	"mustChangePassword" boolean DEFAULT true NOT NULL,
	"isOperational" boolean DEFAULT true NOT NULL,
	"defaultShift" "default_shift",
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "visitChecklists" (
	"id" serial PRIMARY KEY NOT NULL,
	"supervisorRouteId" integer NOT NULL,
	"postId" integer NOT NULL,
	"arrivalTime" timestamp with time zone,
	"departureTime" timestamp with time zone,
	"visitedAt" timestamp with time zone,
	"observations" text,
	"isCoverage" boolean DEFAULT false NOT NULL,
	"coverageReason" text,
	"status" "visit_checklist_status" DEFAULT 'pending' NOT NULL,
	"arrivalLatitude" numeric(10, 8),
	"arrivalLongitude" numeric(11, 8),
	"departureLatitude" numeric(10, 8),
	"departureLongitude" numeric(11, 8),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_postVisitHistory_postId" ON "postVisitHistory" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "idx_postVisitHistory_supervisorId" ON "postVisitHistory" USING btree ("supervisorId");--> statement-breakpoint
CREATE INDEX "idx_postVisitHistory_visitedAt" ON "postVisitHistory" USING btree ("visitedAt");--> statement-breakpoint
CREATE INDEX "idx_posts_routeId" ON "posts" USING btree ("routeId");--> statement-breakpoint
CREATE INDEX "idx_supervisorRoutes_supervisorId" ON "supervisorRoutes" USING btree ("supervisorId");--> statement-breakpoint
CREATE INDEX "idx_supervisorRoutes_date" ON "supervisorRoutes" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_supervisorRoutes_status" ON "supervisorRoutes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_supervisorSchedules_date" ON "supervisorSchedules" USING btree ("scheduleDate");--> statement-breakpoint
CREATE INDEX "idx_supervisorSchedules_supervisor" ON "supervisorSchedules" USING btree ("supervisorId");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_supervisorSchedules_date_supervisor" ON "supervisorSchedules" USING btree ("scheduleDate","supervisorId");--> statement-breakpoint
CREATE INDEX "idx_visitChecklists_supervisorRouteId" ON "visitChecklists" USING btree ("supervisorRouteId");--> statement-breakpoint
CREATE INDEX "idx_visitChecklists_postId" ON "visitChecklists" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "idx_visitChecklists_status" ON "visitChecklists" USING btree ("status");