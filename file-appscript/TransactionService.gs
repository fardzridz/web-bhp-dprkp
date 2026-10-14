function saveTransaction_(type, data) {
  if (['receipt', 'issue'].indexOf(type) < 0) throw new Error('Jenis transaksi tidak valid.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    validateTransactionInput_(type, data);
    assertPeriodOpen_(data.TANGGAL);
    const existing = data.ID ? getTransactionRaw_(type, data.ID) : null;
    if (existing && existing.header.STATUS === APP.STATUS.CANCELLED) throw new Error('Transaksi yang sudah dibatalkan tidak dapat diubah.');
    if (existing) assertPeriodOpen_(existing.header.TANGGAL);

    const snapshot = existing ? JSON.parse(JSON.stringify(existing)) : null;
    const id = data.ID || makeId_(type === 'receipt' ? 'TRM' : 'KLR');
    const headerKey = type === 'receipt' ? 'RECEIPTS' : 'ISSUES';
    const detailKey = type === 'receipt' ? 'RECEIPT_DETAILS' : 'ISSUE_DETAILS';
    const header = buildHeader_(type, id, data, existing && existing.header);

    if (existing) {
      updateRow_(headerKey, existing.header._row, header);
      deleteRowsByParent_(detailKey, type === 'receipt' ? 'PENERIMAAN_ID' : 'PENGELUARAN_ID', id);
    } else insert_(headerKey, header);

    data.details.forEach(function (line) {
      const qty = num_(line.JUMLAH);
      const price = type === 'receipt' ? num_(line.HARGA_SATUAN) : 0;
      if (type === 'receipt') insert_(detailKey, { ID: makeId_('DTR'), PENERIMAAN_ID: id, BARANG_ID: line.BARANG_ID, JUMLAH: qty, HARGA_SATUAN: price, JUMLAH_HARGA: qty * price });
      else insert_(detailKey, { ID: makeId_('DKL'), PENGELUARAN_ID: id, BARANG_ID: line.BARANG_ID, JUMLAH: qty, NILAI_FIFO: 0 });
    });

    try {
      rebuildInventory_();
    } catch (err) {
      restoreTransaction_(type, id, snapshot);
      rebuildInventory_();
      throw err;
    }
    const result = getTransaction_(type, id);
    audit_(existing ? 'UBAH' : 'TAMBAH', headerKey, id, snapshot, result);
    return result;
  } finally { lock.releaseLock(); }
}

function cancelTransaction_(type, id) {
  if (['receipt', 'issue'].indexOf(type) < 0) throw new Error('Jenis transaksi tidak valid.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const key = type === 'receipt' ? 'RECEIPTS' : 'ISSUES';
    const row = findOne_(key, function (r) { return r.ID === id; });
    if (!row) throw new Error('Transaksi tidak ditemukan.');
    if (row.STATUS === APP.STATUS.CANCELLED) return { id: id, status: APP.STATUS.CANCELLED };
    assertPeriodOpen_(row.TANGGAL);
    const before = publicRow_(row);
    updateRow_(key, row._row, { STATUS: APP.STATUS.CANCELLED, DIUBAH_PADA: now_() });
    try { rebuildInventory_(); }
    catch (err) { updateRow_(key, row._row, { STATUS: APP.STATUS.POSTED, DIUBAH_PADA: row.DIUBAH_PADA }); rebuildInventory_(); throw err; }
    audit_('BATALKAN', key, id, before, Object.assign({}, before, { STATUS: APP.STATUS.CANCELLED }));
    return { id: id, status: APP.STATUS.CANCELLED };
  } finally { lock.releaseLock(); }
}

function validateTransactionInput_(type, data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.TANGGAL || ''))) throw new Error('Tanggal transaksi wajib diisi.');
  if (!Array.isArray(data.details) || !data.details.length) throw new Error('Minimal satu barang harus ditambahkan.');
  if (type === 'receipt' && !data.VENDOR_ID) throw new Error('Vendor wajib dipilih.');
  if (!data.UNIT_ID) throw new Error(type === 'receipt' ? 'Unit/kegiatan wajib dipilih.' : 'Unit tujuan wajib dipilih.');
  const seen = {};
  data.details.forEach(function (line) {
    if (!line.BARANG_ID || !findOne_('ITEMS', function (r) { return r.ID === line.BARANG_ID && r.STATUS === APP.STATUS.ACTIVE; })) throw new Error('Barang tidak valid atau tidak aktif.');
    if (seen[line.BARANG_ID]) throw new Error('Barang yang sama tidak boleh muncul dua kali dalam satu transaksi.');
    seen[line.BARANG_ID] = true;
    if (num_(line.JUMLAH) <= 0) throw new Error('Jumlah barang harus lebih dari nol.');
    if (type === 'receipt' && num_(line.HARGA_SATUAN) < 0) throw new Error('Harga satuan tidak boleh negatif.');
  });
}

function buildHeader_(type, id, data, before) {
  const base = {
    ID: id, TANGGAL: data.TANGGAL, UNIT_ID: data.UNIT_ID, KETERANGAN: data.KETERANGAN || '',
    STATUS: APP.STATUS.POSTED, DIBUAT_OLEH: before ? before.DIBUAT_OLEH : currentEmail_(),
    DIBUAT_PADA: before ? before.DIBUAT_PADA : now_(), DIUBAH_PADA: now_()
  };
  if (type === 'receipt') return Object.assign(base, { VENDOR_ID: data.VENDOR_ID, NO_FAKTUR: data.NO_FAKTUR || '', TGL_FAKTUR: data.TGL_FAKTUR || '', NO_BA: data.NO_BA || '', TGL_BA: data.TGL_BA || '' });
  return Object.assign(base, { NO_DOKUMEN: data.NO_DOKUMEN || '', TGL_PENYERAHAN: data.TGL_PENYERAHAN || data.TANGGAL });
}

function listTransactions_(type, filters) {
  const key = type === 'receipt' ? 'RECEIPTS' : type === 'issue' ? 'ISSUES' : null;
  if (!key) throw new Error('Jenis transaksi tidak valid.');
  return rows_(key).filter(function (r) {
    return (!filters.start || r.TANGGAL >= filters.start) && (!filters.end || r.TANGGAL <= filters.end) && (!filters.status || r.STATUS === filters.status);
  }).sort(function (a, b) { return String(b.TANGGAL + b.ID).localeCompare(String(a.TANGGAL + a.ID)); }).map(publicRow_);
}

function getTransaction_(type, id) {
  const raw = getTransactionRaw_(type, id);
  return { header: publicRow_(raw.header), details: raw.details.map(publicRow_) };
}

function getTransactionRaw_(type, id) {
  const hk = type === 'receipt' ? 'RECEIPTS' : 'ISSUES';
  const dk = type === 'receipt' ? 'RECEIPT_DETAILS' : 'ISSUE_DETAILS';
  const fk = type === 'receipt' ? 'PENERIMAAN_ID' : 'PENGELUARAN_ID';
  const header = findOne_(hk, function (r) { return r.ID === id; });
  if (!header) throw new Error('Transaksi tidak ditemukan.');
  return { header: header, details: rows_(dk).filter(function (r) { return r[fk] === id; }) };
}

function deleteRowsByParent_(key, field, id) {
  rows_(key).filter(function (r) { return r[field] === id; }).sort(function (a, b) { return b._row - a._row; }).forEach(function (r) { sheet_(key).deleteRow(r._row); });
}

function restoreTransaction_(type, id, snapshot) {
  const hk = type === 'receipt' ? 'RECEIPTS' : 'ISSUES';
  const dk = type === 'receipt' ? 'RECEIPT_DETAILS' : 'ISSUE_DETAILS';
  const fk = type === 'receipt' ? 'PENERIMAAN_ID' : 'PENGELUARAN_ID';
  const current = findOne_(hk, function (r) { return r.ID === id; });
  if (current) sheet_(hk).deleteRow(current._row);
  deleteRowsByParent_(dk, fk, id);
  if (snapshot) {
    insert_(hk, snapshot.header);
    snapshot.details.forEach(function (d) { insert_(dk, d); });
  }
}

function adjustStock_(data) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.TANGGAL || ''))) throw new Error('Tanggal penyesuaian wajib diisi.');
    if (!data.BARANG_ID || !findOne_('ITEMS', function (r) { return r.ID === data.BARANG_ID && r.STATUS === APP.STATUS.ACTIVE; })) throw new Error('Barang tidak valid atau tidak aktif.');
    const qty = num_(data.JUMLAH);
    if (qty <= 0) throw new Error('Jumlah barang rusak harus lebih dari nol.');
    if (['RUSAK', 'HILANG', 'KOREKSI'].indexOf(data.ALASAN) < 0) throw new Error('Alasan penyesuaian tidak valid.');
    if (!String(data.KETERANGAN || '').trim()) throw new Error('Keterangan penyesuaian wajib diisi.');
    assertPeriodOpen_(data.TANGGAL);
    const available = stockReport_({ itemId: data.BARANG_ID })[0];
    if (!available || qty > available.quantity) throw new Error('Stok tidak cukup. Tersedia ' + (available ? available.quantity : 0) + ' ' + (available ? available.unit : '') + '.');
    const id = makeId_('ADJ');
    insert_('ADJUSTMENTS', { ID: id, TANGGAL: data.TANGGAL, ALASAN: data.ALASAN, KETERANGAN: String(data.KETERANGAN).trim(), STATUS: APP.STATUS.POSTED, DIBUAT_OLEH: currentEmail_(), DIBUAT_PADA: now_() });
    insert_('ADJUSTMENT_DETAILS', { ID: makeId_('DAD'), PENYESUAIAN_ID: id, BARANG_ID: data.BARANG_ID, JUMLAH: qty, NILAI_FIFO: 0 });
    try { rebuildInventory_(); }
    catch (err) { deleteRowsByParent_('ADJUSTMENT_DETAILS', 'PENYESUAIAN_ID', id); const header = findOne_('ADJUSTMENTS', function (r) { return r.ID === id; }); if (header) sheet_('ADJUSTMENTS').deleteRow(header._row); rebuildInventory_(); throw err; }
    const detail = findOne_('ADJUSTMENT_DETAILS', function (r) { return r.PENYESUAIAN_ID === id; });
    const result = { ID: id, TANGGAL: data.TANGGAL, BARANG_ID: data.BARANG_ID, JUMLAH: qty, NILAI_FIFO: detail ? num_(detail.NILAI_FIFO) : 0, ALASAN: data.ALASAN, KETERANGAN: String(data.KETERANGAN).trim() };
    audit_('KURANGI_STOK', 'PENYESUAIAN_STOK', id, { quantity: available.quantity, value: available.value }, result);
    return result;
  } finally { lock.releaseLock(); }
}

function rebuildInventory_() {
  clearData_('FIFO'); clearData_('FIFO_USAGE');
  const issueSheet = sheet_('ISSUE_DETAILS');
  if (issueSheet.getLastRow() > 1) issueSheet.getRange(2, 5, issueSheet.getLastRow() - 1, 1).clearContent();
  const adjustmentSheet = sheet_('ADJUSTMENT_DETAILS');
  if (adjustmentSheet.getLastRow() > 1) adjustmentSheet.getRange(2, 5, adjustmentSheet.getLastRow() - 1, 1).clearContent();
  const receipts = rows_('RECEIPTS').filter(function (r) { return r.STATUS === APP.STATUS.POSTED; });
  const issues = rows_('ISSUES').filter(function (r) { return r.STATUS === APP.STATUS.POSTED; });
  const adjustments = rows_('ADJUSTMENTS').filter(function (r) { return r.STATUS === APP.STATUS.POSTED; });
  const rd = rows_('RECEIPT_DETAILS'); const id = rows_('ISSUE_DETAILS'); const ad = rows_('ADJUSTMENT_DETAILS');
  const events = [];
  receipts.forEach(function (h) { rd.filter(function (d) { return d.PENERIMAAN_ID === h.ID; }).forEach(function (d) { events.push({ kind: 'IN', date: h.TANGGAL, created: h.DIBUAT_PADA, detail: d }); }); });
  issues.forEach(function (h) { id.filter(function (d) { return d.PENGELUARAN_ID === h.ID; }).forEach(function (d) { events.push({ kind: 'OUT', date: h.TANGGAL, created: h.DIBUAT_PADA, detail: d, valueSheet: issueSheet }); }); });
  adjustments.forEach(function (h) { ad.filter(function (d) { return d.PENYESUAIAN_ID === h.ID; }).forEach(function (d) { events.push({ kind: 'OUT', date: h.TANGGAL, created: h.DIBUAT_PADA, detail: d, valueSheet: adjustmentSheet }); }); });
  events.sort(function (a, b) { const x = a.date.localeCompare(b.date); if (x) return x; if (a.kind !== b.kind) return a.kind === 'IN' ? -1 : 1; return String(a.created).localeCompare(String(b.created)); });
  const layers = {};
  events.forEach(function (event) {
    const d = event.detail; layers[d.BARANG_ID] = layers[d.BARANG_ID] || [];
    if (event.kind === 'IN') {
      layers[d.BARANG_ID].push({ ID: makeId_('FIFO'), BARANG_ID: d.BARANG_ID, PENERIMAAN_DETAIL_ID: d.ID, TANGGAL: event.date, HARGA_SATUAN: num_(d.HARGA_SATUAN), JUMLAH_AWAL: num_(d.JUMLAH), SISA: num_(d.JUMLAH), STATUS: APP.STATUS.ACTIVE });
    } else {
      let remaining = num_(d.JUMLAH); let value = 0;
      for (let i = 0; i < layers[d.BARANG_ID].length && remaining > 0; i++) {
        const layer = layers[d.BARANG_ID][i]; if (layer.SISA <= 0) continue;
        const used = Math.min(layer.SISA, remaining); layer.SISA -= used; remaining -= used; value += used * layer.HARGA_SATUAN;
        insert_('FIFO_USAGE', { ID: makeId_('USE'), PENGELUARAN_DETAIL_ID: d.ID, FIFO_LAYER_ID: layer.ID, JUMLAH: used, HARGA_SATUAN: layer.HARGA_SATUAN, NILAI: used * layer.HARGA_SATUAN });
      }
      if (remaining > 0) throw new Error('Stok tidak cukup untuk barang ' + itemName_(d.BARANG_ID) + ' pada tanggal ' + event.date + '. Kekurangan: ' + remaining + '.');
      event.valueSheet.getRange(d._row, 5).setValue(value);
    }
  });
  Object.keys(layers).forEach(function (itemId) { layers[itemId].forEach(function (layer) { insert_('FIFO', layer); }); });
}

function clearData_(key) { const s = sheet_(key); if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, TABLES[key].headers.length).clearContent(); }
function itemName_(id) { const r = findOne_('ITEMS', function (x) { return x.ID === id; }); return r ? r.NAMA : id; }

function assertPeriodOpen_(date) {
  const parts = String(date).split('-');
  const locked = findOne_('PERIODS', function (r) { return String(r.TAHUN) === parts[0] && String(r.BULAN).padStart(2, '0') === parts[1] && r.STATUS === 'TERKUNCI'; });
  if (locked) throw new Error('Periode ' + parts[1] + '/' + parts[0] + ' sudah dikunci.');
}

function setPeriodLock_(year, month, locked) {
  const y = String(year); const m = String(month).padStart(2, '0');
  if (!/^\d{4}$/.test(y) || !/^(0[1-9]|1[0-2])$/.test(m)) throw new Error('Tahun atau bulan tidak valid.');
  const row = findOne_('PERIODS', function (r) { return String(r.TAHUN) === y && String(r.BULAN).padStart(2, '0') === m; });
  const data = { ID: row ? row.ID : makeId_('PRD'), TAHUN: y, BULAN: m, STATUS: locked ? 'TERKUNCI' : 'TERBUKA', DIKUNCI_OLEH: locked ? currentEmail_() : '', DIKUNCI_PADA: locked ? now_() : '' };
  if (row) updateRow_('PERIODS', row._row, data); else insert_('PERIODS', data);
  audit_(locked ? 'KUNCI' : 'BUKA', 'PERIODE', y + '-' + m, row && publicRow_(row), data);
  return data;
}
