-- Preserva os registros antigos de visitas/checklists e adiciona o modelo de ocorrência.
-- Esta migration é idempotente para instalações novas ou parcialmente migradas.
ALTER TABLE "visitChecklists" ADD COLUMN IF NOT EXISTS "occurrenceSubmittedAt" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "visitChecklists" ADD COLUMN IF NOT EXISTS "occurrenceReport" text;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'visitChecklists'
      AND column_name = 'auditSubmittedAt'
  ) THEN
    EXECUTE 'UPDATE "visitChecklists" SET "occurrenceSubmittedAt" = "auditSubmittedAt" WHERE "occurrenceSubmittedAt" IS NULL AND "auditSubmittedAt" IS NOT NULL';
  END IF;
END $$;
