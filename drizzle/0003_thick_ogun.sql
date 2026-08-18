ALTER TABLE `visitChecklists` MODIFY COLUMN `status` enum('pending','in_progress','visited','skipped') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `visitChecklists` ADD `arrivalLatitude` decimal(10,8);--> statement-breakpoint
ALTER TABLE `visitChecklists` ADD `arrivalLongitude` decimal(11,8);--> statement-breakpoint
ALTER TABLE `visitChecklists` ADD `departureLatitude` decimal(10,8);--> statement-breakpoint
ALTER TABLE `visitChecklists` ADD `departureLongitude` decimal(11,8);