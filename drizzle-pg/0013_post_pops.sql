CREATE TABLE "post_pop_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"uploaded_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_pop_documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE INDEX "idx_post_pop_documents_post_id" ON "post_pop_documents" USING btree ("post_id");