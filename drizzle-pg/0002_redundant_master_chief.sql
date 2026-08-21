CREATE TYPE "public"."operation_shift" AS ENUM('day', 'night');--> statement-breakpoint
ALTER TABLE "supervisorRoutes" ADD COLUMN "shiftType" "operation_shift";--> statement-breakpoint
ALTER TABLE "supervisorRoutes" ADD COLUMN "shiftStartedAt" timestamp with time zone;--> statement-breakpoint
WITH classified AS (
  SELECT
    id,
    CASE
      WHEN EXTRACT(HOUR FROM (COALESCE("startedAt", "createdAt", "date") AT TIME ZONE 'America/Sao_Paulo')) >= 6
       AND EXTRACT(HOUR FROM (COALESCE("startedAt", "createdAt", "date") AT TIME ZONE 'America/Sao_Paulo')) < 18
      THEN 'day'::"operation_shift"
      ELSE 'night'::"operation_shift"
    END AS shift_type,
    (
      CASE
        WHEN EXTRACT(HOUR FROM (COALESCE("startedAt", "createdAt", "date") AT TIME ZONE 'America/Sao_Paulo')) >= 6
         AND EXTRACT(HOUR FROM (COALESCE("startedAt", "createdAt", "date") AT TIME ZONE 'America/Sao_Paulo')) < 18
        THEN date_trunc('day', COALESCE("startedAt", "createdAt", "date") AT TIME ZONE 'America/Sao_Paulo') + interval '6 hours'
        WHEN EXTRACT(HOUR FROM (COALESCE("startedAt", "createdAt", "date") AT TIME ZONE 'America/Sao_Paulo')) >= 18
        THEN date_trunc('day', COALESCE("startedAt", "createdAt", "date") AT TIME ZONE 'America/Sao_Paulo') + interval '18 hours'
        ELSE date_trunc('day', COALESCE("startedAt", "createdAt", "date") AT TIME ZONE 'America/Sao_Paulo') - interval '6 hours'
      END AT TIME ZONE 'America/Sao_Paulo'
    ) AS shift_started_at
  FROM "supervisorRoutes"
)
UPDATE "supervisorRoutes" AS route
SET "shiftType" = classified.shift_type, "shiftStartedAt" = classified.shift_started_at
FROM classified
WHERE route.id = classified.id;--> statement-breakpoint
ALTER TABLE "supervisorRoutes" ALTER COLUMN "shiftType" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "supervisorRoutes" ALTER COLUMN "shiftStartedAt" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_supervisorRoutes_shift_window" ON "supervisorRoutes" USING btree ("shiftStartedAt","shiftType");
