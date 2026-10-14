function dashboard_() {
  const stock = stockReport_({});
  const receipts = rows_('RECEIPTS').filter(function (r) { return r.STATUS === APP.STATUS.POSTED; });
  const issues = rows_('ISSUES').filter(function (r) { return r.STATUS === APP.STATUS.POSTED; });
  const month = today_().slice(0, 7);
  return {
    itemCount: stock.length,
    stockQuantity: stock.reduce(function (s, r) { return s + r.quantity; }, 0),
    stockValue: stock.reduce(function (s, r) { return s + r.value; }, 0),
    lowStockCount: stock.filter(function (r) { return r.quantity <= r.minimum; }).length,
    receiptCountThisMonth: receipts.filter(function (r) { return String(r.TANGGAL).slice(0, 7) === month; }).length,
    issueCountThisMonth: issues.filter(function (r) { return String(r.TANGGAL).slice(0, 7) === month; }).length,
    lowStock: stock.filter(function (r) { return r.quantity <= r.minimum; }).slice(0, 8)
  };
}

function stockReport_(filters) {
  const layers = rows_('FIFO').filter(function (r) { return num_(r.SISA) > 0; });
  const categories = indexBy_(rows_('CATEGORIES'), 'ID');
  const units = indexBy_(rows_('UNITS'), 'ID');
  return rows_('ITEMS').filter(function (item) {
    return item.STATUS === APP.STATUS.ACTIVE && (!filters.itemId || item.ID === filters.itemId) && (!filters.categoryId || item.KATEGORI_ID === filters.categoryId);
  }).map(function (item) {
    const own = layers.filter(function (l) { return l.BARANG_ID === item.ID; });
    const quantity = own.reduce(function (s, l) { return s + num_(l.SISA); }, 0);
    const value = own.reduce(function (s, l) { return s + num_(l.SISA) * num_(l.HARGA_SATUAN); }, 0);
    const prices = own.reduce(function (out, l) { const price = num_(l.HARGA_SATUAN); if (out.indexOf(price) < 0) out.push(price); return out; }, []);
    return {
      id: item.ID, code: item.KODE, name: item.NAMA,
      category: categories[item.KATEGORI_ID] ? categories[item.KATEGORI_ID].NAMA : '-',
      unit: units[item.SATUAN_ID] ? units[item.SATUAN_ID].NAMA : '-',
      minimum: num_(item.STOK_MINIMUM), quantity: quantity, value: value,
      unitPrice: quantity ? value / quantity : 0, priceLayerCount: prices.length,
      layers: own.map(function (l) { return { date: l.TANGGAL, quantity: num_(l.SISA), price: num_(l.HARGA_SATUAN), value: num_(l.SISA) * num_(l.HARGA_SATUAN) }; })
    };
  }).sort(function (a, b) { return a.name.localeCompare(b.name, 'id'); });
}

function itemCard_(filters) {
  if (!filters.itemId) throw new Error('Barang wajib dipilih.');
  const start = filters.start || '1900-01-01'; const end = filters.end || '2999-12-31';
  const item = findOne_('ITEMS', function (r) { return r.ID === filters.itemId; });
  if (!item) throw new Error('Barang tidak ditemukan.');
  const receipts = indexBy_(rows_('RECEIPTS'), 'ID'); const issues = indexBy_(rows_('ISSUES'), 'ID'); const adjustments = indexBy_(optionalRows_('ADJUSTMENTS'), 'ID');
  const usageByDetail = groupBy_(rows_('FIFO_USAGE'), 'PENGELUARAN_DETAIL_ID');
  const events = [];
  rows_('RECEIPT_DETAILS').filter(function (d) { const h = receipts[d.PENERIMAAN_ID]; return d.BARANG_ID === item.ID && h && h.STATUS === APP.STATUS.POSTED; }).forEach(function (d) {
    const h = receipts[d.PENERIMAAN_ID]; events.push({ date: h.TANGGAL, kind: 'IN', quantity: num_(d.JUMLAH), unitPrice: num_(d.HARGA_SATUAN), value: num_(d.JUMLAH_HARGA), document: h.NO_FAKTUR || h.NO_BA || h.ID });
  });
  rows_('ISSUE_DETAILS').filter(function (d) { const h = issues[d.PENGELUARAN_ID]; return d.BARANG_ID === item.ID && h && h.STATUS === APP.STATUS.POSTED; }).forEach(function (d) {
    const h = issues[d.PENGELUARAN_ID]; const value = (usageByDetail[d.ID] || []).reduce(function (s, u) { return s + num_(u.NILAI); }, 0);
    events.push({ date: h.TANGGAL, kind: 'OUT', quantity: num_(d.JUMLAH), unitPrice: num_(d.JUMLAH) ? value / num_(d.JUMLAH) : 0, value: value, document: h.NO_DOKUMEN || h.ID });
  });
  optionalRows_('ADJUSTMENT_DETAILS').filter(function (d) { const h = adjustments[d.PENYESUAIAN_ID]; return d.BARANG_ID === item.ID && h && h.STATUS === APP.STATUS.POSTED; }).forEach(function (d) {
    const h = adjustments[d.PENYESUAIAN_ID]; events.push({ date: h.TANGGAL, kind: 'OUT', quantity: num_(d.JUMLAH), unitPrice: num_(d.JUMLAH) ? num_(d.NILAI_FIFO) / num_(d.JUMLAH) : 0, value: num_(d.NILAI_FIFO), document: 'Penyesuaian ' + h.ALASAN + ': ' + h.KETERANGAN });
  });
  events.sort(sortEvents_);
  let openingQty = 0, openingValue = 0;
  events.filter(function (e) { return e.date < start; }).forEach(function (e) { const sign = e.kind === 'IN' ? 1 : -1; openingQty += sign * e.quantity; openingValue += sign * e.value; });
  let qty = openingQty; let value = openingValue;
  const lines = events.filter(function (e) { return e.date >= start && e.date <= end; }).map(function (e) {
    const sign = e.kind === 'IN' ? 1 : -1; qty += sign * e.quantity; value += sign * e.value;
    return Object.assign({}, e, { inQty: e.kind === 'IN' ? e.quantity : 0, outQty: e.kind === 'OUT' ? e.quantity : 0, balanceQty: qty, balanceValue: value });
  });
  const unit = findOne_('UNITS', function (r) { return r.ID === item.SATUAN_ID; });
  return { item: { id: item.ID, code: item.KODE, name: item.NAMA, unit: unit ? unit.NAMA : '-' }, start: start, end: end, openingQuantity: openingQty, openingValue: openingValue, closingQuantity: qty, closingValue: value, lines: lines, layers: fifoAtDate_(item.ID, end) };
}

function itemCards_(filters) {
  const start = filters.start; const end = filters.end;
  if (!start || !end || start > end) throw new Error('Periode laporan tidak valid.');
  const selected = Array.isArray(filters.itemIds) ? filters.itemIds.filter(String) : [];
  const units = indexBy_(rows_('UNITS'), 'ID');
  const items = rows_('ITEMS').filter(function (r) { return r.STATUS === APP.STATUS.ACTIVE && (!selected.length || selected.indexOf(r.ID) >= 0); }).sort(function (a, b) { return String(a.NAMA).localeCompare(String(b.NAMA), 'id'); });
  if (!items.length) throw new Error('Tidak ada barang yang dipilih.');
  const itemSet = items.reduce(function (out, r) { out[r.ID] = true; return out; }, {});
  const receipts = indexBy_(rows_('RECEIPTS'), 'ID'); const issues = indexBy_(rows_('ISSUES'), 'ID'); const adjustments = indexBy_(optionalRows_('ADJUSTMENTS'), 'ID');
  const usage = groupBy_(rows_('FIFO_USAGE'), 'PENGELUARAN_DETAIL_ID'); const events = {};
  items.forEach(function (r) { events[r.ID] = []; });
  rows_('RECEIPT_DETAILS').forEach(function (d) { const h = receipts[d.PENERIMAAN_ID]; if (itemSet[d.BARANG_ID] && h && h.STATUS === APP.STATUS.POSTED) events[d.BARANG_ID].push({ date: h.TANGGAL, kind: 'IN', quantity: num_(d.JUMLAH), unitPrice: num_(d.HARGA_SATUAN), value: num_(d.JUMLAH_HARGA), document: h.NO_FAKTUR || h.NO_BA || h.ID }); });
  rows_('ISSUE_DETAILS').forEach(function (d) { const h = issues[d.PENGELUARAN_ID]; if (itemSet[d.BARANG_ID] && h && h.STATUS === APP.STATUS.POSTED) { const value = (usage[d.ID] || []).reduce(function (s, u) { return s + num_(u.NILAI); }, 0); events[d.BARANG_ID].push({ date: h.TANGGAL, kind: 'OUT', quantity: num_(d.JUMLAH), unitPrice: num_(d.JUMLAH) ? value / num_(d.JUMLAH) : 0, value: value, document: h.NO_DOKUMEN || h.ID }); } });
  optionalRows_('ADJUSTMENT_DETAILS').forEach(function (d) { const h = adjustments[d.PENYESUAIAN_ID]; if (itemSet[d.BARANG_ID] && h && h.STATUS === APP.STATUS.POSTED) events[d.BARANG_ID].push({ date: h.TANGGAL, kind: 'OUT', quantity: num_(d.JUMLAH), unitPrice: num_(d.JUMLAH) ? num_(d.NILAI_FIFO) / num_(d.JUMLAH) : 0, value: num_(d.NILAI_FIFO), document: 'Penyesuaian ' + h.ALASAN }); });
  return { type: 'cards', start: start, end: end, cards: items.map(function (item, index) { return buildBatchCard_(item, units[item.SATUAN_ID], events[item.ID], start, end, index + 1); }) };
}

function buildBatchCard_(item, unit, events, start, end, number) {
  events.sort(sortEvents_); let openingQty = 0; let openingValue = 0; let qty = 0; let value = 0; const layers = [];
  events.filter(function (e) { return e.date <= end; }).forEach(function (e) { if (e.kind === 'IN') layers.push({ date: e.date, quantity: e.quantity, price: e.unitPrice }); else { let left = e.quantity; for (let i = 0; i < layers.length && left > 0; i++) { const used = Math.min(layers[i].quantity, left); layers[i].quantity -= used; left -= used; } } });
  events.filter(function (e) { return e.date < start; }).forEach(function (e) { const sign = e.kind === 'IN' ? 1 : -1; openingQty += sign * e.quantity; openingValue += sign * e.value; });
  qty = openingQty; value = openingValue;
  const lines = events.filter(function (e) { return e.date >= start && e.date <= end; }).map(function (e) { const sign = e.kind === 'IN' ? 1 : -1; qty += sign * e.quantity; value += sign * e.value; return Object.assign({}, e, { inQty: e.kind === 'IN' ? e.quantity : 0, outQty: e.kind === 'OUT' ? e.quantity : 0, balanceQty: qty, balanceValue: value }); });
  const incoming = lines.filter(function (e) { return e.kind === 'IN'; }); const outgoing = lines.filter(function (e) { return e.kind === 'OUT'; });
  return { number: number, item: { id: item.ID, code: item.KODE, name: item.NAMA, unit: unit ? unit.NAMA : '-' }, openingQuantity: openingQty, openingValue: openingValue, incomingQuantity: incoming.reduce(function (s, e) { return s + e.quantity; }, 0), incomingValue: incoming.reduce(function (s, e) { return s + e.value; }, 0), outgoingQuantity: outgoing.reduce(function (s, e) { return s + e.quantity; }, 0), outgoingValue: outgoing.reduce(function (s, e) { return s + e.value; }, 0), closingQuantity: qty, closingValue: value, lines: lines, layers: layers.filter(function (l) { return l.quantity > 0; }).map(function (l) { return Object.assign(l, { value: l.quantity * l.price }); }) };
}

function mutationReport_(filters) {
  const start = filters.start; const end = filters.end;
  if (!start || !end || start > end) throw new Error('Periode laporan tidak valid.');
  const units = indexBy_(rows_('UNITS'), 'ID');
  const items = rows_('ITEMS').filter(function (r) { return r.STATUS === APP.STATUS.ACTIVE && (!filters.categoryId || r.KATEGORI_ID === filters.categoryId); });
  const itemSet = items.reduce(function (out, item) { out[item.ID] = true; return out; }, {});
  const totals = items.reduce(function (out, item) { out[item.ID] = { openingQuantity: 0, openingValue: 0, incomingQuantity: 0, incomingValue: 0, outgoingQuantity: 0, outgoingValue: 0 }; return out; }, {});
  const receipts = indexBy_(rows_('RECEIPTS'), 'ID'); const issues = indexBy_(rows_('ISSUES'), 'ID'); const adjustments = indexBy_(optionalRows_('ADJUSTMENTS'), 'ID');
  const add = function (itemId, date, kind, quantity, value) { if (!itemSet[itemId] || date > end) return; const t = totals[itemId], q = num_(quantity), v = num_(value); if (date < start) { const sign = kind === 'IN' ? 1 : -1; t.openingQuantity += sign * q; t.openingValue += sign * v; } else if (kind === 'IN') { t.incomingQuantity += q; t.incomingValue += v; } else { t.outgoingQuantity += q; t.outgoingValue += v; } };
  rows_('RECEIPT_DETAILS').forEach(function (d) { const h = receipts[d.PENERIMAAN_ID]; if (h && h.STATUS === APP.STATUS.POSTED) add(d.BARANG_ID, h.TANGGAL, 'IN', d.JUMLAH, d.JUMLAH_HARGA); });
  rows_('ISSUE_DETAILS').forEach(function (d) { const h = issues[d.PENGELUARAN_ID]; if (h && h.STATUS === APP.STATUS.POSTED) add(d.BARANG_ID, h.TANGGAL, 'OUT', d.JUMLAH, d.NILAI_FIFO); });
  optionalRows_('ADJUSTMENT_DETAILS').forEach(function (d) { const h = adjustments[d.PENYESUAIAN_ID]; if (h && h.STATUS === APP.STATUS.POSTED) add(d.BARANG_ID, h.TANGGAL, 'OUT', d.JUMLAH, d.NILAI_FIFO); });
  return items.map(function (item) { const t = totals[item.ID]; return { id: item.ID, code: item.KODE, name: item.NAMA, unit: units[item.SATUAN_ID] ? units[item.SATUAN_ID].NAMA : '-', openingQuantity: t.openingQuantity, openingValue: t.openingValue, incomingQuantity: t.incomingQuantity, incomingValue: t.incomingValue, outgoingQuantity: t.outgoingQuantity, outgoingValue: t.outgoingValue, closingQuantity: t.openingQuantity + t.incomingQuantity - t.outgoingQuantity, closingValue: t.openingValue + t.incomingValue - t.outgoingValue }; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'id'); });
}

function fifoAtDate_(itemId, end) {
  const cardEvents = [];
  const rh = indexBy_(rows_('RECEIPTS'), 'ID'); const ih = indexBy_(rows_('ISSUES'), 'ID'); const ah = indexBy_(optionalRows_('ADJUSTMENTS'), 'ID');
  rows_('RECEIPT_DETAILS').forEach(function (d) { const h = rh[d.PENERIMAAN_ID]; if (d.BARANG_ID === itemId && h && h.STATUS === APP.STATUS.POSTED && h.TANGGAL <= end) cardEvents.push({ kind: 'IN', date: h.TANGGAL, qty: num_(d.JUMLAH), price: num_(d.HARGA_SATUAN) }); });
  rows_('ISSUE_DETAILS').forEach(function (d) { const h = ih[d.PENGELUARAN_ID]; if (d.BARANG_ID === itemId && h && h.STATUS === APP.STATUS.POSTED && h.TANGGAL <= end) cardEvents.push({ kind: 'OUT', date: h.TANGGAL, qty: num_(d.JUMLAH) }); });
  optionalRows_('ADJUSTMENT_DETAILS').forEach(function (d) { const h = ah[d.PENYESUAIAN_ID]; if (d.BARANG_ID === itemId && h && h.STATUS === APP.STATUS.POSTED && h.TANGGAL <= end) cardEvents.push({ kind: 'OUT', date: h.TANGGAL, qty: num_(d.JUMLAH) }); });
  cardEvents.sort(sortEvents_); const layers = [];
  cardEvents.forEach(function (e) { if (e.kind === 'IN') layers.push({ date: e.date, quantity: e.qty, price: e.price }); else { let left = e.qty; for (let i = 0; i < layers.length && left > 0; i++) { const use = Math.min(layers[i].quantity, left); layers[i].quantity -= use; left -= use; } } });
  return layers.filter(function (l) { return l.quantity > 0; }).map(function (l) { return Object.assign(l, { value: l.quantity * l.price }); });
}

function indexBy_(rows, key) { return rows.reduce(function (out, row) { out[row[key]] = row; return out; }, {}); }
function groupBy_(rows, key) { return rows.reduce(function (out, row) { (out[row[key]] = out[row[key]] || []).push(row); return out; }, {}); }
function sortEvents_(a, b) { const d = String(a.date).localeCompare(String(b.date)); if (d) return d; if (a.kind !== b.kind) return a.kind === 'IN' ? -1 : 1; return 0; }
