# SIPERSEDIA — Google Apps Script MVP

Web app persediaan berbasis Google Apps Script dan Google Spreadsheet.

## File yang disalin ke Apps Script

Buat project Apps Script baru, lalu buat file dengan nama yang sama:

- `Code.gs`
- `MasterService.gs`
- `TransactionService.gs`
- `ReportService.gs`
- `MasterData.gs` — master barang dan vendor hasil ekstraksi Excel
- `OfficialReportService.gs` — dataset laporan resmi dan pengaturan TTD
- `PrintTemplates.html` — format cetak laporan resmi
- `Index.html`
- `Styles.html`
- `Scripts.html`
- `appsscript.json` melalui **Project Settings → Show appsscript.json manifest file**

## Instalasi

1. Buat Google Spreadsheet kosong. Salin ID dari URL:
   `https://docs.google.com/spreadsheets/d/ID_SPREADSHEET/edit`
2. Buka project Apps Script, salin seluruh file di folder ini.
3. Tambahkan fungsi sementara berikut pada editor Apps Script:

   ```javascript
   function install() {
     const setup = setupSystem('ID_SPREADSHEET_ANDA');
     const master = importExcelMasterData();
     Logger.log({ setup: setup, master: master });
   }
   ```

4. Jalankan `install` dan berikan izin Google. Fungsi aman dijalankan ulang; barang dan vendor bernama sama akan dilewati.
5. Hapus fungsi sementara `install` setelah berhasil.
6. Pastikan sheet database terbentuk dan akun pemasang tercatat sebagai `ADMIN` pada sheet `PENGGUNA`.
7. Pilih **Deploy → New deployment → Web app**:
   - Execute as: **User accessing the web app**
   - Who has access: sesuaikan domain/organisasi
8. Buka URL deployment menggunakan akun yang terdaftar.

> Jika akun Google pribadi tidak memberikan email pengguna pada mode tertentu, gunakan akun Google Workspace dan batasi deployment ke domain. Aplikasi menolak akun yang tidak terbaca atau tidak terdaftar.

## Urutan penggunaan

1. Admin membuka **Master data** dan memeriksa hasil impor.
2. Importer memuat 408 nama barang dan 21 vendor unik dari workbook sumber.
3. Periksa kategori, satuan, unit kerja, serta ejaan barang yang berasal dari Excel.
4. Tambah operator/viewer pada tab Pengguna.
5. Uji **Barang masuk** untuk satu barang dengan jumlah dan harga satuan.
6. Pastikan jumlah stok dan nilai persediaan bertambah.
7. Uji **Barang keluar** dengan jumlah lebih kecil dari stok.
8. Pastikan stok berkurang dan Kartu Barang serta Mutasi menampilkan kedua transaksi.
9. Uji jumlah keluar melebihi stok; sistem harus menolak penyimpanan.

## Koreksi salah input

- Master data: **Ubah** atau **Nonaktifkan**.
- Transaksi aktif: buka **Lihat**, perbaiki, lalu simpan.
- Transaksi yang tidak boleh dipakai: **Batalkan**.
- Transaksi tidak dihapus permanen. Audit tersimpan pada `AUDIT_LOG`.
- Setiap perubahan transaksi menghitung ulang stok dan FIFO.
- Perubahan ditolak jika menyebabkan stok negatif pada tanggal transaksi mana pun.
- Form Barang Keluar hanya menawarkan barang yang memiliki stok, menampilkan jumlah tersedia, dan menolak jumlah yang melebihi stok baik di browser maupun server.
- Stok fisik yang rusak, hilang, atau berbeda saat stok opname dikurangi melalui **Stok barang → Kurangi stok**. Jangan mengubah angka langsung di Spreadsheet karena penyesuaian resmi mengurangi lapisan FIFO, nilai persediaan, kartu barang, mutasi, dan mencatat `AUDIT_LOG`.

## Hak akses

- `ADMIN`: seluruh CRUD master, pengguna, transaksi, laporan, dan periode.
- `OPERATOR`: tambah/ubah/batalkan transaksi dan melihat laporan.
- `VIEWER`: melihat dashboard, stok, transaksi, dan laporan.

## Laporan dan tanda tangan

Menu **Laporan** menyediakan:

- Kartu Barang
- Laporan Mutasi Barang Persediaan beserta TTD
- Lampiran 8 — Buku Penerimaan Barang
- Lampiran 9 — Buku Pengeluaran Barang
- Lampiran 11 — Buku Barang Pakai Habis
- Lampiran 15 — Laporan Semester Barang Pakai Habis
- Lampiran 16 — Bukti Pengambilan Barang dari Gudang
### Mencetak Kartu Barang massal

1. Buka **Laporan → Kartu Barang**.
2. Untuk mencetak seluruh barang, biarkan **Cetak semua barang aktif** tercentang.
3. Untuk memilih barang tertentu, matikan centang tersebut. Cari berdasarkan kode/nama, saring kategori, lalu centang satu atau beberapa barang. Tombol **Pilih semua hasil** memilih seluruh hasil filter tanpa menghapus pilihan dari filter sebelumnya; **Hapus pilihan** mengosongkan semuanya.
4. Tentukan periode dan klik **Tampilkan**, lalu klik **Cetak / PDF**. Format menggunakan A4 portrait dengan dua kartu per halaman seperti formulir fisik. Barang dengan lebih dari delapan baris transaksi dibuatkan kartu lanjutan agar data tidak terpotong.

Kartu memuat transaksi masuk/keluar, saldo berjalan, ringkasan saldo awal–akhir, rincian lapisan FIFO, serta beban persediaan. Dataset semua kartu dibaca dalam satu permintaan agar pencetakan banyak barang tidak memanggil server satu per satu.

### Mencetak Buku Pengeluaran Barang

Buka **Laporan → Buku Pengeluaran**, tentukan periode, lalu klik **Tampilkan**. Laporan dikelompokkan berdasarkan kategori, memakai penomoran transaksi berlanjut dan halaman lanjutan otomatis. Gunakan **Cetak / PDF** dengan kertas **F4 landscape (330 × 215 mm)**; tanda tangan ditampilkan pada halaman terakhir.

### Mencetak Buku Barang Pakai Habis

Buka **Laporan → Buku Barang Pakai Habis**, tentukan periode, lalu klik **Tampilkan**. Formulir memakai 14 kolom penerimaan/pengeluaran, kelompok kategori, halaman lanjutan, dan kertas **F4 landscape (330 × 215 mm)**. Kolom Merk/Ukuran dan Tahun Pembuatan kosong karena belum menjadi data master; sistem tidak mengarang nilai tersebut.


Sebelum mencetak, Admin membuka **Laporan → Pengaturan TTD** dan mengisi identitas instansi, kota, provinsi, atasan langsung, pengurus/penyimpan barang, kepala dinas, NIP, serta pangkat. Tombol **Cetak / PDF** membuka dialog cetak browser; pilih **Save as PDF** untuk menyimpan.

## Sheet internal

Jangan mengubah langsung sheet transaksi berikut saat aplikasi sudah digunakan:

- `PENERIMAAN`, `DETAIL_PENERIMAAN`
- `PENGELUARAN`, `DETAIL_PENGELUARAN`
- `FIFO_LAYER`, `FIFO_USAGE`
- `PENYESUAIAN_STOK`, `DETAIL_PENYESUAIAN`
- `AUDIT_LOG`

Perubahan manual dapat membuat stok dan jejak audit tidak konsisten.

## Batas MVP

- Format laporan mengikuti struktur kolom, identitas instansi, dan blok TTD pada workbook sumber. Perbedaan pagination dapat terjadi karena mesin cetak browser berbeda dari Excel; gunakan A4 landscape, margin minimum, dan skala `Fit to page` untuk lampiran lebar.
- Lampiran 10 dan Lampiran 14 belum dimasukkan karena merupakan laporan barang inventaris/aset dan memerlukan merk, tahun pembuatan, nomor register, kontrak/SPK, serta berita acara pemeriksaan yang tidak tersedia dalam model persediaan MVP.
- Master barang dan vendor sudah dapat diimpor otomatis. Saldo awal dan transaksi historis belum diimpor karena workbook sumber mengandung `#REF!` dan relasi yang tidak konsisten; data transaksi perlu rekonsiliasi tersendiri.
