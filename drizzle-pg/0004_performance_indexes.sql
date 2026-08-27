CREATE INDEX "idx_checklistItems_visitChecklistId" ON "checklistItems" USING btree ("visitChecklistId");--> statement-breakpoint
CREATE INDEX "idx_fuel_logs_route_created" ON "fuel_logs" USING btree ("supervisorRouteId","createdAt");--> statement-breakpoint
CREATE INDEX "idx_postVisitHistory_supervisor_visitedAt" ON "postVisitHistory" USING btree ("supervisorId","visitedAt");--> statement-breakpoint
CREATE INDEX "idx_supervisorLocations_supervisor_recordedAt" ON "supervisorLocations" USING btree ("supervisorId","recordedAt" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_supervisorLocations_route_recordedAt" ON "supervisorLocations" USING btree ("supervisorRouteId","recordedAt" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_supervisorRoutes_supervisor_shift_window" ON "supervisorRoutes" USING btree ("supervisorId","shiftStartedAt","shiftType");--> statement-breakpoint
CREATE INDEX "idx_visitChecklists_route_status" ON "visitChecklists" USING btree ("supervisorRouteId","status");--> statement-breakpoint
CREATE INDEX "idx_visitChecklists_visitedAt_status" ON "visitChecklists" USING btree ("visitedAt","status");