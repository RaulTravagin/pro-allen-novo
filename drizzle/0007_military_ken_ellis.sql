ALTER TABLE `visitChecklists` ADD `isCoverage` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `visitChecklists` ADD `coverageReason` text;