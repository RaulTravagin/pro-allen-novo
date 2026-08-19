CREATE TYPE "public"."fuel_type" AS ENUM('gasoline', 'ethanol', 'diesel');--> statement-breakpoint
CREATE TABLE "fuel_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicleId" integer NOT NULL,
	"supervisorRouteId" integer NOT NULL,
	"supervisorId" integer NOT NULL,
	"odometerKm" numeric(10, 2) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"liters" numeric(10, 3) NOT NULL,
	"fuelType" "fuel_type" NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"plate" varchar(10) NOT NULL,
	"model" varchar(120) NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supervisorRoutes" ADD COLUMN "vehicleId" integer;--> statement-breakpoint
CREATE INDEX "idx_fuel_logs_vehicle_created" ON "fuel_logs" USING btree ("vehicleId","createdAt");--> statement-breakpoint
CREATE INDEX "idx_fuel_logs_route" ON "fuel_logs" USING btree ("supervisorRouteId");--> statement-breakpoint
CREATE INDEX "idx_fuel_logs_supervisor" ON "fuel_logs" USING btree ("supervisorId");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_vehicles_plate" ON "vehicles" USING btree ("plate");--> statement-breakpoint
CREATE INDEX "idx_vehicles_active" ON "vehicles" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "idx_supervisorRoutes_vehicleId" ON "supervisorRoutes" USING btree ("vehicleId");