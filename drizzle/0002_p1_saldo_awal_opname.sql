CREATE TABLE `opening_balances` (
	`id` text PRIMARY KEY NOT NULL,
	`bidang_id` text NOT NULL,
	`item_id` text NOT NULL,
	`tanggal` text NOT NULL,
	`jumlah` real NOT NULL,
	`harga_satuan` real NOT NULL,
	`keterangan` text,
	`fifo_layer_id` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`bidang_id`) REFERENCES `bidang`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opening_balances_bidang_item_tanggal_unique` ON `opening_balances` (`bidang_id`,`item_id`,`tanggal`);--> statement-breakpoint
CREATE TABLE `stock_adjustment_items` (
	`id` text PRIMARY KEY NOT NULL,
	`adjustment_id` text NOT NULL,
	`item_id` text NOT NULL,
	`stok_sistem` real NOT NULL,
	`nilai_sistem` real NOT NULL,
	`harga_satuan_sistem` real DEFAULT 0 NOT NULL,
	`jumlah_fisik` real NOT NULL,
	`nilai_fisik` real DEFAULT 0 NOT NULL,
	`selisih_jumlah` real NOT NULL,
	`selisih_nilai` real DEFAULT 0 NOT NULL,
	`kondisi` text,
	`keterangan` text,
	FOREIGN KEY (`adjustment_id`) REFERENCES `stock_adjustments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stock_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`bidang_id` text NOT NULL,
	`nomor_dokumen` text NOT NULL,
	`tanggal` text NOT NULL,
	`keterangan` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`bidang_id`) REFERENCES `bidang`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_adjustments_bidang_nomor_unique` ON `stock_adjustments` (`bidang_id`,`nomor_dokumen`);--> statement-breakpoint
ALTER TABLE `issues` ADD `jenis` text DEFAULT 'BAST' NOT NULL;--> statement-breakpoint
ALTER TABLE `vendors` ADD `npwp` text;