CREATE TABLE "personnel_freelancers" (
	"id" serial PRIMARY KEY NOT NULL,
	"collaboratorRaw" text DEFAULT '' NOT NULL,
	"jobFunction" text DEFAULT '' NOT NULL,
	"situation" text DEFAULT '' NOT NULL,
	"hours" text DEFAULT '' NOT NULL,
	"posts" text DEFAULT '' NOT NULL,
	"coverage" text DEFAULT '' NOT NULL,
	"pix" text DEFAULT '' NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"supervision" text DEFAULT '' NOT NULL,
	"observations" text DEFAULT '' NOT NULL,
	"sourceFileSha256" varchar(64),
	"sourceSheet" varchar(128),
	"sourceRow" integer,
	"sourceData" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_personnel_freelancers_source_row" ON "personnel_freelancers" USING btree ("sourceFileSha256","sourceSheet","sourceRow");