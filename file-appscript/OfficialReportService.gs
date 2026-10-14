const REPORT_SETTING_KEYS = Object.freeze([
  'NAMA_INSTANSI','KAB_KOTA','PROVINSI','TEMPAT_TTD',
  'JABATAN_ATASAN','NAMA_ATASAN','NIP_ATASAN','PANGKAT_ATASAN',
  'JABATAN_PENGURUS','NAMA_PENGURUS','NIP_PENGURUS','PANGKAT_PENGURUS',
  'JABATAN_KEPALA','NAMA_KEPALA','NIP_KEPALA','PANGKAT_KEPALA'
]);

function saveReportSettings_(data) {
  REPORT_SETTING_KEYS.forEach(function (key) { setSetting_(key, String(data[key] || '').trim()); });
  audit_('UBAH', 'PENGATURAN_LAPORAN', 'TTD', null, data);
  return settingsObject_();
}
function officialReport_(type, filters) {
  const allowed = ['mutation', 'receiptBook', 'issueBook', 'consumableBook', 'semesterConsumable', 'warehouseSlip'];
  if (allowed.indexOf(type) < 0) throw new Error('Jenis laporan resmi tidak valid.');
  const start = filters.start; const end = filters.end;
  if (!start || !end || start > end) throw new Error('Periode laporan tidak valid.');
  const common = reportCommon_(start, end, filters.signDate || end);
  if (type === 'mutation') return Object.assign(common, { type: type, title: 'LAPORAN MUTASI BARANG PERSEDIAAN', appendix: '', rows: mutationReport_(filters) });
  if (type === 'receiptBook') return Object.assign(common, { type: type, title: 'BUKU PENERIMAAN BARANG', appendix: 'LAMPIRAN 8', rows: receiptBookRows_(start, end) });
  if (type === 'issueBook') return Object.assign(common, { type: type, title: 'BUKU PENGELUARAN BARANG', appendix: 'LAMPIRAN 9', rows: issueBookRows_(start, end) });
  if (type === 'consumableBook') return Object.assign(common, { type: type, title: 'BUKU BARANG PAKAI HABIS', appendix: 'LAMPIRAN 11', rows: consumableRows_(start, end) });
  if (type === 'semesterConsumable') return Object.assign(common, { type: type, title: 'LAPORAN SEMESTER TENTANG PENERIMAAN DAN PENGELUARAN BARANG PAKAI HABIS', appendix: 'LAMPIRAN 15', rows: semesterRows_(start, end) });
  if (!filters.transactionId) throw new Error('Transaksi pengeluaran wajib dipilih untuk Bukti Pengambilan Barang.');
  return Object.assign(common, { type: type, title: 'BUKTI PENGAMBILAN BARANG DARI GUDANG', appendix: 'LAMPIRAN 16', document: warehouseSlip_(filters.transactionId) });
}

function reportCommon_(start, end, signDate) {
  const s = settingsObject_();
  return {
    start: start, end: end, signDate: signDate,
    identity: { agency: s.NAMA_INSTANSI || '', city: s.KAB_KOTA || '', province: s.PROVINSI || '', place: s.TEMPAT_TTD || '' },
    officials: {
      supervisor: official_(s.JABATAN_ATASAN, s.NAMA_ATASAN, s.NIP_ATASAN, s.PANGKAT_ATASAN),
      custodian: official_(s.JABATAN_PENGURUS, s.NAMA_PENGURUS, s.NIP_PENGURUS, s.PANGKAT_PENGURUS),
      head: official_(s.JABATAN_KEPALA, s.NAMA_KEPALA, s.NIP_KEPALA, s.PANGKAT_KEPALA)
    }
  };
}
function official_(position, name, nip, rank) { return { position: position || '', name: name || '', nip: nip || '', rank: rank || '' }; }

function receiptBookRows_(start, end) {
  const vendors = indexBy_(rows_('VENDORS'), 'ID'), items = indexBy_(rows_('ITEMS'), 'ID'), units = indexBy_(rows_('UNITS'), 'ID'), categories = indexBy_(rows_('CATEGORIES'), 'ID'), details = groupBy_(rows_('RECEIPT_DETAILS'), 'PENERIMAAN_ID');
  const out = [];
  rows_('RECEIPTS').filter(function (h) { return h.STATUS === APP.STATUS.POSTED && h.TANGGAL >= start && h.TANGGAL <= end; }).sort(byDate_).forEach(function (h) {
    (details[h.ID] || []).forEach(function (d) { const item = items[d.BARANG_ID] || {}, unit = units[item.SATUAN_ID] || {}, category = categories[item.KATEGORI_ID] || {}; out.push({ transactionId: h.ID, itemId: d.BARANG_ID, date: h.TANGGAL, vendor: (vendors[h.VENDOR_ID] || {}).NAMA || '', invoiceNo: h.NO_FAKTUR, invoiceDate: h.TGL_FAKTUR, item: item.NAMA || d.BARANG_ID, category: category.NAMA || 'Tanpa Kategori', quantity: num_(d.JUMLAH), unit: unit.NAMA || '', unitPrice: num_(d.HARGA_SATUAN), amount: num_(d.JUMLAH_HARGA), receiptNo: h.NO_BA, receiptDate: h.TGL_BA, note: h.KETERANGAN }); });
  });
  return out.sort(function (a, b) { const c = a.category.localeCompare(b.category, 'id'); return c || String(a.date + a.transactionId).localeCompare(String(b.date + b.transactionId)); });
}

function issueBookRows_(start, end) {
  const orgs = indexBy_(rows_('ORG_UNITS'), 'ID'), items = indexBy_(rows_('ITEMS'), 'ID'), units = indexBy_(rows_('UNITS'), 'ID'), categories = indexBy_(rows_('CATEGORIES'), 'ID'), details = groupBy_(rows_('ISSUE_DETAILS'), 'PENGELUARAN_ID');
  const out = [];
  rows_('ISSUES').filter(function (h) { return h.STATUS === APP.STATUS.POSTED && h.TANGGAL >= start && h.TANGGAL <= end; }).sort(byDate_).forEach(function (h) {
    (details[h.ID] || []).forEach(function (d) { const item = items[d.BARANG_ID] || {}, unit = units[item.SATUAN_ID] || {}, category = categories[item.KATEGORI_ID] || {}; out.push({ transactionId: h.ID, itemId: d.BARANG_ID, date: h.TANGGAL, documentNo: h.NO_DOKUMEN, item: item.NAMA || d.BARANG_ID, category: category.NAMA || 'Tanpa Kategori', quantity: num_(d.JUMLAH), unit: unit.NAMA || '', unitPrice: num_(d.JUMLAH) ? num_(d.NILAI_FIFO) / num_(d.JUMLAH) : 0, amount: num_(d.NILAI_FIFO), destination: (orgs[h.UNIT_ID] || {}).NAMA || '', deliveryDate: h.TGL_PENYERAHAN, note: h.KETERANGAN }); });
  });
  return out.sort(function (a, b) { const c = a.category.localeCompare(b.category, 'id'); return c || String(a.date + a.transactionId).localeCompare(String(b.date + b.transactionId)); });
}

function consumableRows_(start, end) {
  const incoming = receiptBookRows_(start, end).map(function (r) { return { date: r.date, direction: 'IN', itemId: r.itemId, category: r.category, item: r.item, quantity: r.quantity, unit: r.unit, unitPrice: r.unitPrice, contractDate: r.invoiceDate, contractNo: r.invoiceNo, inspectionDate: r.receiptDate, inspectionNo: r.receiptNo, party: r.vendor, note: r.note }; });
  const outgoing = issueBookRows_(start, end).map(function (r) { return { date: r.date, direction: 'OUT', itemId: r.itemId, category: r.category, item: r.item, quantity: r.quantity, unit: r.unit, unitPrice: r.unitPrice, documentNo: r.documentNo, documentDate: r.deliveryDate, party: r.destination, note: r.note }; });
  return incoming.concat(outgoing).sort(function (a, b) { const c = String(a.category).localeCompare(String(b.category), 'id'); return c || String(a.item).localeCompare(String(b.item), 'id') || String(a.date).localeCompare(String(b.date)) || (a.direction === 'IN' ? -1 : 1); });
}

function semesterRows_(start, end) {
  return consumableRows_(start, end).map(function (r, i) { return Object.assign({ number: i + 1, amount: r.quantity * r.unitPrice }, r); });
}

function warehouseSlip_(id) {
  const trx = getTransaction_('issue', id), orgs = indexBy_(rows_('ORG_UNITS'), 'ID'), items = indexBy_(rows_('ITEMS'), 'ID'), units = indexBy_(rows_('UNITS'), 'ID');
  if (trx.header.STATUS !== APP.STATUS.POSTED) throw new Error('Bukti hanya tersedia untuk transaksi aktif.');
  return {
    id: trx.header.ID, date: trx.header.TANGGAL, documentNo: trx.header.NO_DOKUMEN, destination: (orgs[trx.header.UNIT_ID] || {}).NAMA || '', note: trx.header.KETERANGAN,
    rows: trx.details.map(function (d) { const item = items[d.BARANG_ID] || {}, unit = units[item.SATUAN_ID] || {}; return { code: item.KODE || '', item: item.NAMA || d.BARANG_ID, unit: unit.NAMA || '', quantity: num_(d.JUMLAH), unitPrice: num_(d.JUMLAH) ? num_(d.NILAI_FIFO) / num_(d.JUMLAH) : 0, amount: num_(d.NILAI_FIFO) }; })
  };
}

function byDate_(a, b) { return String(a.TANGGAL + a.ID).localeCompare(String(b.TANGGAL + b.ID)); }
