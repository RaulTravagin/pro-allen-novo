CREATE TABLE `supervisorSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleDate` timestamp NOT NULL,
	`supervisorId` int NOT NULL,
	`assignment` enum('day','night','reliever','off') NOT NULL,
	`note` text,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supervisorSchedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_supervisorSchedules_date_supervisor` UNIQUE(`scheduleDate`,`supervisorId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `defaultShift` enum('day','night','reliever');--> statement-breakpoint
CREATE INDEX `idx_supervisorSchedules_date` ON `supervisorSchedules` (`scheduleDate`);--> statement-breakpoint
CREATE INDEX `idx_supervisorSchedules_supervisor` ON `supervisorSchedules` (`supervisorId`);