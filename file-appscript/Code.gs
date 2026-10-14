const APP = Object.freeze({
  NAME: 'SIPERSEDIA',
  VERSION: '1.0.0',
  TZ: 'Asia/Jakarta',
  PROP_DB: 'SPREADSHEET_ID',
  ROLES: Object.freeze({ ADMIN: 'ADMIN', OPERATOR: 'OPERATOR', VIEWER: 'VIEWER' }),
  STATUS: Object.freeze({ ACTIVE: 'AKTIF', INACTIVE: 'NONAKTIF', POSTED: 'AKTIF', CANCELLED: 'DIBATALKAN' })
});

const TABLES = Object.freeze({
  SETTINGS: { name: 'PENGATURAN', headers: ['KUNCI', 'NILAI'] },
  USERS: { name: 'PENGGUNA', headers: ['ID', 'EMAIL', 'NAMA', 'PERAN', 'STATUS', 'DIBUAT_PADA', 'DIUBAH_PADA'] },
  CATEGORIES: { name: 'KATEGORI', headers: ['ID', 'NAMA', 'STATUS', 'DIBUAT_PADA', 'DIUBAH_PADA'] },
  UNITS: { name: 'SATUAN', headers: ['ID', 'NAMA', 'STATUS', 'DIBUAT_PADA', 'DIUBAH_PADA'] },
  ORG_UNITS: { name: 'UNIT_KERJA', headers: ['ID', 'NAMA', 'STATUS', 'DIBUAT_PADA', 'DIUBAH_PADA'] },
  VENDORS: { name: 'VENDOR', headers: ['ID', 'NAMA', 'ALAMAT', 'TELEPON', 'STATUS', 'DIBUAT_PADA', 'DIUBAH_PADA'] },
  ITEMS: { name: 'BARANG', headers: ['ID', 'KODE', 'NAMA', 'KATEGORI_ID', 'SATUAN_ID', 'STOK_MINIMUM', 'STATUS', 'DIBUAT_PADA', 'DIUBAH_PADA'] },
  RECEIPTS: { name: 'PENERIMAAN', headers: ['ID', 'TANGGAL', 'VENDOR_ID', 'NO_FAKTUR', 'TGL_FAKTUR', 'NO_BA', 'TGL_BA', 'UNIT_ID', 'KETERANGAN', 'STATUS', 'DIBUAT_OLEH', 'DIBUAT_PADA', 'DIUBAH_PADA'] },
  RECEIPT_DETAILS: { name: 'DETAIL_PENERIMAAN', headers: ['ID', 'PENERIMAAN_ID', 'BARANG_ID', 'JUMLAH', 'HARGA_SATUAN', 'JUMLAH_HARGA'] },
  ISSUES: { name: 'PENGELUARAN', headers: ['ID', 'TANGGAL', 'UNIT_ID', 'NO_DOKUMEN', 'TGL_PENYERAHAN', 'KETERANGAN', 'STATUS', 'DIBUAT_OLEH', 'DIBUAT_PADA', 'DIUBAH_PADA'] },
  ISSUE_DETAILS: { name: 'DETAIL_PENGELUARAN', headers: ['ID', 'PENGELUARAN_ID', 'BARANG_ID', 'JUMLAH', 'NILAI_FIFO'] },
  ADJUSTMENTS: { name: 'PENYESUAIAN_STOK', headers: ['ID', 'TANGGAL', 'ALASAN', 'KETERANGAN', 'STATUS', 'DIBUAT_OLEH', 'DIBUAT_PADA'] },
  ADJUSTMENT_DETAILS: { name: 'DETAIL_PENYESUAIAN', headers: ['ID', 'PENYESUAIAN_ID', 'BARANG_ID', 'JUMLAH', 'NILAI_FIFO'] },
  FIFO: { name: 'FIFO_LAYER', headers: ['ID', 'BARANG_ID', 'PENERIMAAN_DETAIL_ID', 'TANGGAL', 'HARGA_SATUAN', 'JUMLAH_AWAL', 'SISA', 'STATUS'] },
  FIFO_USAGE: { name: 'FIFO_USAGE', headers: ['ID', 'PENGELUARAN_DETAIL_ID', 'FIFO_LAYER_ID', 'JUMLAH', 'HARGA_SATUAN', 'NILAI'] },
  PERIODS: { name: 'PERIODE_KUNCI', headers: ['ID', 'TAHUN', 'BULAN', 'STATUS', 'DIKUNCI_OLEH', 'DIKUNCI_PADA'] },
  AUDIT: { name: 'AUDIT_LOG', headers: ['ID', 'WAKTU', 'EMAIL', 'AKSI', 'ENTITAS', 'ENTITAS_ID', 'SEBELUM', 'SESUDAH'] }
});

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle(APP.NAME + ' — Persediaan Barang')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include_(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}

function setupSystem(spreadsheetId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const id = String(spreadsheetId || '').trim();
    const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create(APP.NAME + ' - Database');
    PropertiesService.getScriptProperties().setProperty(APP.PROP_DB, ss.getId());
    Object.keys(TABLES).forEach(function (key) { ensureSheet_(ss, TABLES[key]); });
    seedDefaults_();
    const email = currentEmail_();
    if (!email) throw new Error('Email akun tidak terbaca. Jalankan setup dari akun Google Workspace atau tambahkan pengguna secara manual pada sheet PENGGUNA.');
    if (!findOne_('USERS', function (r) { return normalize_(r.EMAIL) === normalize_(email); })) {
      insert_('USERS', { ID: makeId_('USR'), EMAIL: email, NAMA: email.split('@')[0], PERAN: APP.ROLES.ADMIN, STATUS: APP.STATUS.ACTIVE, DIBUAT_PADA: now_(), DIUBAH_PADA: now_() });
    }
    const defaults = {
      NAMA_INSTANSI: 'DINAS PERUMAHAN RAKYAT DAN KAWASAN PERMUKIMAN', KAB_KOTA: 'PASURUAN', PROVINSI: 'JAWA TIMUR', TEMPAT_TTD: 'Pasuruan',
      JABATAN_ATASAN: 'ATASAN LANGSUNG', NAMA_ATASAN: '', NIP_ATASAN: '', PANGKAT_ATASAN: '',
      JABATAN_PENGURUS: 'PENGURUS BARANG', NAMA_PENGURUS: '', NIP_PENGURUS: '', PANGKAT_PENGURUS: '',
      JABATAN_KEPALA: 'KEPALA DINAS PERUMAHAN RAKYAT DAN KAWASAN PERMUKIMAN', NAMA_KEPALA: '', NIP_KEPALA: '', PANGKAT_KEPALA: ''
    };
    const current = settingsObject_();
    Object.keys(defaults).forEach(function (key) { if (current[key] === undefined) setSetting_(key, defaults[key]); });
    return { spreadsheetId: ss.getId(), spreadsheetUrl: ss.getUrl(), message: 'Sistem berhasil disiapkan.' };
  } finally { lock.releaseLock(); }
}

function api(action, payload) {
  const input = payload || {};
  try {
    switch (action) {
      case 'bootstrap': return ok_(bootstrap_());
      case 'dashboard': requireRole_(['ADMIN', 'OPERATOR', 'VIEWER']); return ok_(dashboard_());
      case 'listMaster': requireRole_(['ADMIN', 'OPERATOR', 'VIEWER']); return ok_(listMaster_(input.type, input.includeInactive));
      case 'saveMaster': requireRole_(['ADMIN']); return ok_(saveMaster_(input.type, input.data || {}));
      case 'deleteMaster': requireRole_(['ADMIN']); return ok_(deleteMaster_(input.type, input.id));
      case 'listTransactions': requireRole_(['ADMIN', 'OPERATOR', 'VIEWER']); return ok_(listTransactions_(input.type, input.filters || {}));
      case 'getTransaction': requireRole_(['ADMIN', 'OPERATOR', 'VIEWER']); return ok_(getTransaction_(input.type, input.id));
      case 'saveTransaction': requireRole_(['ADMIN', 'OPERATOR']); return ok_(saveTransaction_(input.type, input.data || {}));
      case 'cancelTransaction': requireRole_(['ADMIN', 'OPERATOR']); return ok_(cancelTransaction_(input.type, input.id));
      case 'stock': requireRole_(['ADMIN', 'OPERATOR', 'VIEWER']); return ok_(stockReport_(input.filters || {}));
      case 'adjustStock': requireRole_(['ADMIN', 'OPERATOR']); return ok_(adjustStock_(input.data || {}));
      case 'card': requireRole_(['ADMIN', 'OPERATOR', 'VIEWER']); return ok_(itemCard_(input.filters || {}));
      case 'cards': requireRole_(['ADMIN', 'OPERATOR', 'VIEWER']); return ok_(itemCards_(input.filters || {}));
      case 'mutation': requireRole_(['ADMIN', 'OPERATOR', 'VIEWER']); return ok_(mutationReport_(input.filters || {}));
      case 'officialReport': requireRole_(['ADMIN', 'OPERATOR', 'VIEWER']); return ok_(officialReport_(input.type, input.filters || {}));
      case 'saveReportSettings': requireRole_(['ADMIN']); return ok_(saveReportSettings_(input.data || {}));
      case 'lockPeriod': requireRole_(['ADMIN']); return ok_(setPeriodLock_(input.year, input.month, true));
      case 'unlockPeriod': requireRole_(['ADMIN']); return ok_(setPeriodLock_(input.year, input.month, false));
      default: throw new Error('Aksi tidak dikenali: ' + action);
    }
  } catch (err) {
    console.error(action, err && err.stack ? err.stack : err);
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

function bootstrap_() {
  const user = requireRole_(['ADMIN', 'OPERATOR', 'VIEWER']);
  return {
    app: { name: APP.NAME, version: APP.VERSION }, user: user,
    masters: {
      items: listMaster_('items', false), categories: listMaster_('categories', false),
      units: listMaster_('units', false), orgUnits: listMaster_('orgUnits', false),
      vendors: listMaster_('vendors', false)
    },
    settings: settingsObject_()
  };
}

function db_() {
  const id = PropertiesService.getScriptProperties().getProperty(APP.PROP_DB);
  if (!id) throw new Error('Sistem belum disiapkan. Jalankan setupSystem() satu kali dari editor Apps Script.');
  return SpreadsheetApp.openById(id);
}

function ensureSheet_(ss, table) {
  let sheet = ss.getSheetByName(table.name);
  if (!sheet) sheet = ss.insertSheet(table.name);
  if (sheet.getMaxColumns() < table.headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), table.headers.length - sheet.getMaxColumns());
  sheet.getRange(1, 1, 1, table.headers.length).setValues([table.headers])
    .setFontWeight('bold').setBackground('#153f35').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  return sheet;
}

function sheet_(key) {
  const table = TABLES[key];
  if (!table) throw new Error('Tabel tidak tersedia: ' + key);
  const sheet = db_().getSheetByName(table.name);
  if (!sheet) throw new Error('Sheet ' + table.name + ' belum tersedia. Jalankan setupSystem().');
  return sheet;
}

function rows_(key) {
  const table = TABLES[key];
  const sheet = sheet_(key);
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const values = sheet.getRange(2, 1, last - 1, table.headers.length).getValues();
  return values.map(function (row, i) {
    const obj = { _row: i + 2 };
    table.headers.forEach(function (h, j) { obj[h] = serializeValue_(row[j]); });
    return obj;
  });
}
function optionalRows_(key) {
  const table = TABLES[key];
  if (!table) return [];
  const sheet = db_().getSheetByName(table.name);
  if (!sheet) return [];
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const values = sheet.getRange(2, 1, last - 1, table.headers.length).getValues();
  return values.map(function (row, i) { const obj = { _row: i + 2 }; table.headers.forEach(function (h, j) { obj[h] = serializeValue_(row[j]); }); return obj; });
}

function insert_(key, obj) {
  const table = TABLES[key];
  const row = table.headers.map(function (h) { return obj[h] === undefined ? '' : obj[h]; });
  sheet_(key).appendRow(row);
  return obj;
}

function updateRow_(key, rowNumber, obj) {
  const table = TABLES[key];
  const sheet = sheet_(key);
  const current = sheet.getRange(rowNumber, 1, 1, table.headers.length).getValues()[0];
  const next = table.headers.map(function (h, i) { return obj[h] === undefined ? current[i] : obj[h]; });
  sheet.getRange(rowNumber, 1, 1, table.headers.length).setValues([next]);
  return obj;
}

function findOne_(key, predicate) {
  const all = rows_(key);
  for (let i = 0; i < all.length; i++) if (predicate(all[i])) return all[i];
  return null;
}

function now_() { return Utilities.formatDate(new Date(), APP.TZ, "yyyy-MM-dd'T'HH:mm:ss"); }
function today_() { return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd'); }
function makeId_(prefix) { return prefix + '-' + Utilities.formatDate(new Date(), APP.TZ, 'yyyyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 6).toUpperCase(); }
function normalize_(value) { return String(value || '').trim().toLowerCase(); }
function num_(value) { const n = Number(value); return isFinite(n) ? n : 0; }
function serializeValue_(value) { return value instanceof Date ? Utilities.formatDate(value, APP.TZ, 'yyyy-MM-dd') : value; }
function ok_(data) { return { ok: true, data: data }; }
function currentEmail_() { return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || ''; }
function publicRow_(row) { const copy = Object.assign({}, row); delete copy._row; return copy; }

function requireRole_(roles) {
  const email = currentEmail_();
  if (!email) throw new Error('Akun Google tidak terdeteksi. Buka aplikasi menggunakan akun yang telah didaftarkan.');
  const user = findOne_('USERS', function (r) { return normalize_(r.EMAIL) === normalize_(email) && r.STATUS === APP.STATUS.ACTIVE; });
  if (!user) throw new Error('Akun ' + email + ' belum terdaftar atau tidak aktif.');
  if (roles.indexOf(user.PERAN) < 0) throw new Error('Anda tidak memiliki izin untuk tindakan ini.');
  return publicRow_(user);
}

function audit_(action, entity, id, before, after) {
  insert_('AUDIT', {
    ID: makeId_('LOG'), WAKTU: now_(), EMAIL: currentEmail_(), AKSI: action,
    ENTITAS: entity, ENTITAS_ID: id, SEBELUM: JSON.stringify(before || null), SESUDAH: JSON.stringify(after || null)
  });
}

function seedDefaults_() {
  if (!rows_('CATEGORIES').length) ['Alat Tulis Kantor', 'Bahan Komputer', 'Kertas dan Cover', 'Alat Listrik dan Elektronik', 'Perabot Kantor', 'Lainnya'].forEach(function (name) { seedMaster_('CATEGORIES', 'KTG', name); });
  if (!rows_('UNITS').length) ['buah', 'pak', 'box', 'rim', 'botol', 'lembar', 'unit', 'lusin'].forEach(function (name) { seedMaster_('UNITS', 'STN', name); });
  if (!rows_('ORG_UNITS').length) ['Sekretariat', 'UPT Rusunawa', 'Bidang Perumahan', 'Bidang Permukiman', 'UPT Pemakaman'].forEach(function (name) { seedMaster_('ORG_UNITS', 'UNT', name); });
}

function seedMaster_(key, prefix, name) {
  insert_(key, { ID: makeId_(prefix), NAMA: name, STATUS: APP.STATUS.ACTIVE, DIBUAT_PADA: now_(), DIUBAH_PADA: now_() });
}

function setSetting_(key, value) {
  const found = findOne_('SETTINGS', function (r) { return r.KUNCI === key; });
  if (found) updateRow_('SETTINGS', found._row, { NILAI: value });
  else insert_('SETTINGS', { KUNCI: key, NILAI: value });
}

function settingsObject_() {
  return rows_('SETTINGS').reduce(function (out, row) { out[row.KUNCI] = row.NILAI; return out; }, {});
}
