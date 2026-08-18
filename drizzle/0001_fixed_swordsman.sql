CREATE TABLE `checklistItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitChecklistId` int NOT NULL,
	`category` varchar(255) NOT NULL,
	`description` varchar(255) NOT NULL,
	`isCompliant` boolean,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checklistItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `postVisitHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`supervisorId` int NOT NULL,
	`visitedAt` timestamp NOT NULL,
	`observations` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `postVisitHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routeId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` varchar(255) NOT NULL,
	`region` varchar(255) NOT NULL,
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`order` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `routes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`region` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `routes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supervisorLocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supervisorId` int NOT NULL,
	`supervisorRouteId` int,
	`latitude` decimal(10,8) NOT NULL,
	`longitude` decimal(11,8) NOT NULL,
	`accuracy` decimal(10,2),
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supervisorLocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supervisorRoutes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supervisorId` int NOT NULL,
	`routeId` int NOT NULL,
	`date` timestamp NOT NULL,
	`status` enum('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
	`kmInitial` decimal(10,2),
	`kmFinal` decimal(10,2),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supervisorRoutes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `visitChecklists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supervisorRouteId` int NOT NULL,
	`postId` int NOT NULL,
	`visitedAt` timestamp,
	`observations` text,
	`status` enum('pending','visited','skipped') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visitChecklists_id` PRIMARY KEY(`id`)
);
