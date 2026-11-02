-- Migration: Tambah satuan pcs dan paket
INSERT OR IGNORE INTO `units` (`id`, `nama`, `created_at`) VALUES ('unit-pcs', 'pcs', 1792763456053);
--> statement-breakpoint
INSERT OR IGNORE INTO `units` (`id`, `nama`, `created_at`) VALUES ('unit-paket', 'paket', 1792763456053);
