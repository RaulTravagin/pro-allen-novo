CREATE TABLE "supervisor_route_cancellations" (
	"id" serial PRIMARY KEY NOT NULL,
	"supervisor_route_id" integer NOT NULL,
	"cancelled_by_user_id" integer NOT NULL,
	"previous_status" "supervisor_route_status" NOT NULL,
	"cancelled_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	CONSTRAINT "chk_supervisor_route_cancellations_previous_status" CHECK ("supervisor_route_cancellations"."previous_status" = 'in_progress'),
	CONSTRAINT "chk_supervisor_route_cancellations_reason_length" CHECK (char_length(btrim("supervisor_route_cancellations"."reason")) >= 8 AND char_length("supervisor_route_cancellations"."reason") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "supervisor_route_cancellations" ADD CONSTRAINT "supervisor_route_cancellations_supervisor_route_id_supervisorRoutes_id_fk" FOREIGN KEY ("supervisor_route_id") REFERENCES "public"."supervisorRoutes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_route_cancellations" ADD CONSTRAINT "supervisor_route_cancellations_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_supervisor_route_cancellations_route" ON "supervisor_route_cancellations" USING btree ("supervisor_route_id");--> statement-breakpoint
CREATE INDEX "idx_supervisor_route_cancellations_actor_at" ON "supervisor_route_cancellations" USING btree ("cancelled_by_user_id","cancelled_at");