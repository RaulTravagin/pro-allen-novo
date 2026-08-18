CREATE INDEX `idx_postVisitHistory_postId` ON `postVisitHistory` (`postId`);--> statement-breakpoint
CREATE INDEX `idx_postVisitHistory_supervisorId` ON `postVisitHistory` (`supervisorId`);--> statement-breakpoint
CREATE INDEX `idx_postVisitHistory_visitedAt` ON `postVisitHistory` (`visitedAt`);--> statement-breakpoint
CREATE INDEX `idx_posts_routeId` ON `posts` (`routeId`);--> statement-breakpoint
CREATE INDEX `idx_supervisorRoutes_supervisorId` ON `supervisorRoutes` (`supervisorId`);--> statement-breakpoint
CREATE INDEX `idx_supervisorRoutes_date` ON `supervisorRoutes` (`date`);--> statement-breakpoint
CREATE INDEX `idx_supervisorRoutes_status` ON `supervisorRoutes` (`status`);--> statement-breakpoint
CREATE INDEX `idx_visitChecklists_supervisorRouteId` ON `visitChecklists` (`supervisorRouteId`);--> statement-breakpoint
CREATE INDEX `idx_visitChecklists_postId` ON `visitChecklists` (`postId`);--> statement-breakpoint
CREATE INDEX `idx_visitChecklists_status` ON `visitChecklists` (`status`);