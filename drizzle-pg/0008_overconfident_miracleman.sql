TRUNCATE TABLE "checklistItems", "visitChecklists" CASCADE;
--> statement-breakpoint
DROP TABLE "checklistItems" CASCADE;
--> statement-breakpoint
ALTER TABLE "visitChecklists" ADD COLUMN "occurrenceSubmittedAt" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "visitChecklists" ADD COLUMN "occurrenceReport" text;
--> statement-breakpoint
ALTER TABLE "visitChecklists" DROP COLUMN "auditSubmittedAt";
