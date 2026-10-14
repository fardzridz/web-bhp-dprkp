const MASTER_MAP = Object.freeze({
  categories: { key: 'CATEGORIES', prefix: 'KTG', fields: ['NAMA'] },
  units: { key: 'UNITS', prefix: 'STN', fields: ['NAMA'] },
  orgUnits: { key: 'ORG_UNITS', prefix: 'UNT', fields: ['NAMA'] },
  vendors: { key: 'VENDORS', prefix: 'VND', fields: ['NAMA', 'ALAMAT', 'TELEPON'] },
  items: { key: 'ITEMS', prefix: 'BRG', fields: ['KODE', 'NAMA', 'KATEGORI_ID', 'SATUAN_ID', 'STOK_MINIMUM'] },
  users: { key: 'USERS', prefix: 'USR', fields: ['EMAIL', 'NAMA', 'PERAN'] }
});

function masterSpec_(type) {
  const spec = MASTER_MAP[type];
  if (!spec) throw new Error('Jenis master tidak tersedia: ' + type);
  return spec;
}

function listMaster_(type, includeInactive) {
  const spec = masterSpec_(type);
  let data = rows_(spec.key);
  if (!includeInactive) data = data.filter(function (r) { return r.STATUS === APP.STATUS.ACTIVE; });
  return data.map(publicRow_).sort(function (a, b) { return String(a.NAMA || a.EMAIL || '').localeCompare(String(b.NAMA || b.EMAIL || ''), 'id'); });
}

function saveMaster_(type, data) {
  const spec = masterSpec_(type);
  const before = data.ID ? findOne_(spec.key, function (r) { return r.ID === data.ID; }) : null;
  const entity = before ? Object.assign({}, before) : { ID: makeId_(spec.prefix), DIBUAT_PADA: now_() };
  spec.fields.forEach(function (field) { entity[field] = data[field] === undefined ? (entity[field] || '') : data[field]; });
  entity.STATUS = data.STATUS || entity.STATUS || APP.STATUS.ACTIVE;
  entity.DIUBAH_PADA = now_();
  validateMaster_(type, entity);
  if (before) updateRow_(spec.key, before._row, entity); else insert_(spec.key, entity);
  audit_(before ? 'UBAH' : 'TAMBAH', spec.key, entity.ID, before && publicRow_(before), publicRow_(entity));
  return publicRow_(entity);
}

function validateMaster_(type, entity) {
  if (!String(entity.NAMA || '').trim() && type !== 'users') throw new Error('Nama wajib diisi.');
  if (type === 'users') {
    if (!String(entity.EMAIL || '').trim()) throw new Error('Email wajib diisi.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entity.EMAIL)) throw new Error('Format email tidak valid.');
    if (['ADMIN', 'OPERATOR', 'VIEWER'].indexOf(entity.PERAN) < 0) throw new Error('Peran pengguna tidak valid.');
  }
  if (type === 'items') {
    if (!entity.KATEGORI_ID || !findOne_('CATEGORIES', function (r) { return r.ID === entity.KATEGORI_ID && r.STATUS === APP.STATUS.ACTIVE; })) throw new Error('Kategori wajib dipilih.');
    if (!entity.SATUAN_ID || !findOne_('UNITS', function (r) { return r.ID === entity.SATUAN_ID && r.STATUS === APP.STATUS.ACTIVE; })) throw new Error('Satuan wajib dipilih.');
    if (num_(entity.STOK_MINIMUM) < 0) throw new Error('Stok minimum tidak boleh negatif.');
    entity.STOK_MINIMUM = num_(entity.STOK_MINIMUM);
  }
  const spec = masterSpec_(type);
  const duplicate = findOne_(spec.key, function (r) {
    if (r.ID === entity.ID) return false;
    if (type === 'users') return normalize_(r.EMAIL) === normalize_(entity.EMAIL);
    if (type === 'items' && entity.KODE) return normalize_(r.KODE) === normalize_(entity.KODE);
    return normalize_(r.NAMA) === normalize_(entity.NAMA);
  });
  if (duplicate) throw new Error(type === 'users' ? 'Email sudah terdaftar.' : 'Data dengan nama/kode yang sama sudah tersedia.');
}

function deleteMaster_(type, id) {
  const spec = masterSpec_(type);
  const row = findOne_(spec.key, function (r) { return r.ID === id; });
  if (!row) throw new Error('Data tidak ditemukan.');
  if (type === 'users' && normalize_(row.EMAIL) === normalize_(currentEmail_())) throw new Error('Akun yang sedang digunakan tidak dapat dinonaktifkan sendiri.');
  const before = publicRow_(row);
  updateRow_(spec.key, row._row, { STATUS: APP.STATUS.INACTIVE, DIUBAH_PADA: now_() });
  audit_('NONAKTIFKAN', spec.key, id, before, Object.assign({}, before, { STATUS: APP.STATUS.INACTIVE }));
  return { id: id, status: APP.STATUS.INACTIVE };
}
