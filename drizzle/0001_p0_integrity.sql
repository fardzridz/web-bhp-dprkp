CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`user_name` text NOT NULL,
	`user_role` text NOT NULL,
	`bidang_id` text,
	`bidang_nama` text,
	`action` text NOT NULL,
	`description` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `issues_bidang_nomor_unique` ON `issues` (`bidang_id`,`nomor_dokumen`);--> statement-breakpoint
CREATE UNIQUE INDEX `items_bidang_kode_unique` ON `items` (`bidang_id`,`kode`);--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_bidang_nomor_unique` ON `receipts` (`bidang_id`,`nomor_dokumen`);