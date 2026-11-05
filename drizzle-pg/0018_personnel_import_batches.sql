CREATE TABLE "personnel_import_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"fileSha256" varchar(64) NOT NULL,
	"summary" jsonb NOT NULL,
	"sourceData" jsonb NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_personnel_import_batches_file_sha256" ON "personnel_import_batches" USING btree ("fileSha256");