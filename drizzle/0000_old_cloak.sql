CREATE TABLE `agency_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bidang` (
	`id` text PRIMARY KEY NOT NULL,
	`nama` text NOT NULL,
	`kode` text NOT NULL,
	`deskripsi` text,
	`nama_atasan` text,
	`nip_atasan` text,
	`jabatan_atasan` text,
	`pangkat_atasan` text,
	`nama_pengurus` text,
	`nip_pengurus` text,
	`jabatan_pengurus` text,
	`pangkat_pengurus` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bidang_kode_unique` ON `bidang` (`kode`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`bidang_id` text NOT NULL,
	`nama` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`bidang_id`) REFERENCES `bidang`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fifo_layers` (
	`id` text PRIMARY KEY NOT NULL,
	`bidang_id` text NOT NULL,
	`item_id` text NOT NULL,
	`receipt_item_id` text,
	`tanggal` text NOT NULL,
	`harga_satuan` real NOT NULL,
	`jumlah_awal` real NOT NULL,
	`sisa` real NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	FOREIGN KEY (`bidang_id`) REFERENCES `bidang`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receipt_item_id`) REFERENCES `receipt_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fifo_usages` (
	`id` text PRIMARY KEY NOT NULL,
	`issue_item_id` text NOT NULL,
	`fifo_layer_id` text NOT NULL,
	`jumlah` real NOT NULL,
	`harga_satuan` real NOT NULL,
	`nilai` real NOT NULL,
	FOREIGN KEY (`issue_item_id`) REFERENCES `issue_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fifo_layer_id`) REFERENCES `fifo_layers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `issue_items` (
	`id` text PRIMARY KEY NOT NULL,
	`issue_id` text NOT NULL,
	`item_id` text NOT NULL,
	`jumlah` real NOT NULL,
	`total_nilai_fifo` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `issues` (
	`id` text PRIMARY KEY NOT NULL,
	`bidang_id` text NOT NULL,
	`nomor_dokumen` text NOT NULL,
	`tanggal` text NOT NULL,
	`tgl_penyerahan` text,
	`penerima` text NOT NULL,
	`keperluan` text,
	`keterangan` text,
	`nama_penyerah` text,
	`nip_penyerah` text,
	`jabatan_penyerah` text,
	`nama_penerima` text,
	`nip_penerima` text,
	`jabatan_penerima` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`bidang_id`) REFERENCES `bidang`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`bidang_id` text NOT NULL,
	`kode` text NOT NULL,
	`nama` text NOT NULL,
	`kategori_id` text,
	`satuan_id` text,
	`stok_minimum` real DEFAULT 0,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`bidang_id`) REFERENCES `bidang`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`kategori_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`satuan_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `receipt_items` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`item_id` text NOT NULL,
	`jumlah` real NOT NULL,
	`harga_satuan` real NOT NULL,
	`jumlah_harga` real NOT NULL,
	FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`bidang_id` text NOT NULL,
	`nomor_dokumen` text NOT NULL,
	`tanggal` text NOT NULL,
	`vendor_id` text,
	`vendor_nama` text,
	`no_faktur` text,
	`tgl_faktur` text,
	`no_ba` text,
	`tgl_ba` text,
	`keterangan` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`bidang_id`) REFERENCES `bidang`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`nama` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `units_nama_unique` ON `units` (`nama`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`nama` text NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`role` text NOT NULL,
	`bidang_id` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`bidang_id`) REFERENCES `bidang`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`nama` text NOT NULL,
	`alamat` text,
	`telepon` text,
	`created_at` integer NOT NULL
);
