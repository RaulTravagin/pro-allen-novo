CREATE TABLE "supervisor_route_closure_exceptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"supervisor_route_id" integer NOT NULL,
	"supervisor_id" integer NOT NULL,
	"closed_at" timestamp with time zone NOT NULL,
	"justification" text NOT NULL,
	"pending_summary" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_route_closure_exceptions_route_closed_at" ON "supervisor_route_closure_exceptions" USING btree ("supervisor_route_id","closed_at");--> statement-breakpoint
CREATE INDEX "idx_route_closure_exceptions_supervisor_closed_at" ON "supervisor_route_closure_exceptions" USING btree ("supervisor_id","closed_at");