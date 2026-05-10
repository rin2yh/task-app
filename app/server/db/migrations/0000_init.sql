CREATE TABLE `users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `github_id` integer NOT NULL,
  `login` text NOT NULL,
  `name` text,
  `avatar_url` text,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_id_unique` ON `users` (`github_id`);
--> statement-breakpoint
CREATE TABLE `sessions` (
  `token` text PRIMARY KEY NOT NULL,
  `user_id` integer NOT NULL,
  `csrf_token` text NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_expires` ON `sessions` (`expires_at`);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);
--> statement-breakpoint
CREATE TABLE `projects` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` integer NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_projects_owner` ON `projects` (`owner_id`);
--> statement-breakpoint
CREATE TABLE `user_columns` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` integer NOT NULL,
  `name` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_columns_owner` ON `user_columns` (`owner_id`);
--> statement-breakpoint
CREATE TABLE `system_columns` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `system_columns` (`id`, `name`) VALUES ('no_status', 'ステータスなし');
--> statement-breakpoint
CREATE TABLE `project_columns` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `column_id` text NOT NULL,
  `position` real NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_project_columns_project_pos` ON `project_columns` (`project_id`, `position`);
--> statement-breakpoint
CREATE TABLE `tasks` (
  `id` text PRIMARY KEY NOT NULL,
  `project_column_id` text NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `priority` text DEFAULT 'medium' NOT NULL,
  `due_date` integer,
  `position` real NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`project_column_id`) REFERENCES `project_columns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_project_column_pos` ON `tasks` (`project_column_id`, `position`);
--> statement-breakpoint
CREATE TABLE `labels` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `name` text NOT NULL,
  `color` text NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_labels_project` ON `labels` (`project_id`);
--> statement-breakpoint
CREATE TABLE `task_labels` (
  `task_id` text NOT NULL,
  `label_id` text NOT NULL,
  PRIMARY KEY(`task_id`, `label_id`),
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE cascade
);
