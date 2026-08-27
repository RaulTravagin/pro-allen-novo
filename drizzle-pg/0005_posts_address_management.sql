ALTER TABLE "posts" ADD COLUMN "addressStreet" varchar(255);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "addressNumber" varchar(32);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "addressNeighborhood" varchar(255);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "addressCity" varchar(255);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "addressPostalCode" varchar(16);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "isActive" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_posts_route_active_order" ON "posts" USING btree ("routeId","isActive","order");