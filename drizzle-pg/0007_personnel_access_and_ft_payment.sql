ALTER TABLE "personnel_employees" ADD COLUMN "position" varchar(255);--> statement-breakpoint
ALTER TABLE "personnel_employees" ADD COLUMN "postId" integer;--> statement-breakpoint
ALTER TABLE "personnel_fts" ADD COLUMN "data_prevista_pagamento" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_personnel_employees_post" ON "personnel_employees" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "idx_personnel_fts_payment_status" ON "personnel_fts" USING btree ("data_prevista_pagamento", "status");
