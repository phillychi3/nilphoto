CREATE TABLE `album_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`album_id` text NOT NULL,
	`photo_id` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`added_at` integer,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `album_photos_album_idx` ON `album_photos` (`album_id`);--> statement-breakpoint
CREATE INDEX `album_photos_photo_idx` ON `album_photos` (`photo_id`);--> statement-breakpoint
CREATE TABLE `albums` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_public` integer DEFAULT false NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`share_token` text,
	`cover_photo_id` text,
	`owner_id` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `albums_share_token_unique` ON `albums` (`share_token`);--> statement-breakpoint
CREATE INDEX `albums_owner_idx` ON `albums` (`owner_id`);--> statement-breakpoint
CREATE INDEX `albums_public_idx` ON `albums` (`is_public`);--> statement-breakpoint
CREATE TABLE `backup_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_config_id` text NOT NULL,
	`enabled` integer DEFAULT true,
	`frequency` text NOT NULL,
	`retention_days` integer DEFAULT 30,
	`last_run_at` integer,
	`next_run_at` integer,
	`created_at` integer,
	FOREIGN KEY (`storage_config_id`) REFERENCES `storage_configs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `backups` (
	`id` text PRIMARY KEY NOT NULL,
	`photo_id` text NOT NULL,
	`storage_config_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`backup_path` text,
	`error_message` text,
	`created_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`storage_config_id`) REFERENCES `storage_configs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `backups_photo_idx` ON `backups` (`photo_id`);--> statement-breakpoint
CREATE TABLE `invite_code_uses` (
	`id` text PRIMARY KEY NOT NULL,
	`invite_code_id` text NOT NULL,
	`user_id` text NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`invite_code_id`) REFERENCES `invite_codes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invite_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`created_by` text NOT NULL,
	`max_uses` integer DEFAULT 1,
	`used_count` integer DEFAULT 0,
	`expires_at` integer,
	`is_active` integer DEFAULT true,
	`created_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invite_codes_code_unique` ON `invite_codes` (`code`);--> statement-breakpoint
CREATE TABLE `photo_exif` (
	`id` text PRIMARY KEY NOT NULL,
	`photo_id` text NOT NULL,
	`camera_make` text,
	`camera_model` text,
	`lens_model` text,
	`aperture` real,
	`shutter_speed` text,
	`iso` integer,
	`focal_length` real,
	`focal_length_35mm` real,
	`latitude` real,
	`longitude` real,
	`altitude` real,
	`taken_at` integer,
	`raw_exif` text,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photo_exif_photo_id_unique` ON `photo_exif` (`photo_id`);--> statement-breakpoint
CREATE INDEX `photo_exif_photo_idx` ON `photo_exif` (`photo_id`);--> statement-breakpoint
CREATE INDEX `photo_exif_location_idx` ON `photo_exif` (`latitude`,`longitude`);--> statement-breakpoint
CREATE TABLE `photo_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`photo_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `photo_tags_photo_idx` ON `photo_tags` (`photo_id`);--> statement-breakpoint
CREATE INDEX `photo_tags_tag_idx` ON `photo_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`uploaded_by` text NOT NULL,
	`filename` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage_path` text NOT NULL,
	`thumbnail_path` text,
	`storage_provider` text NOT NULL,
	`width` integer,
	`height` integer,
	`aspect_ratio` real,
	`is_hdr` integer DEFAULT false,
	`title` text,
	`description` text,
	`media_type` text DEFAULT 'photo' NOT NULL,
	`video_duration` integer,
	`video_preview_path` text,
	`sort_order` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `photos_uploaded_by_idx` ON `photos` (`uploaded_by`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `storage_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false,
	`config` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);