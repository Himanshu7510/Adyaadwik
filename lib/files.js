// Uploaded files: saved to the uploads/ folder on disk, or to Vercel Blob when BLOB_READ_WRITE_TOKEN is set.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { slugify } = require('./helpers');

const BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const PREFIX = 'uploads/';

function safeName(original) {
  const ext = path.extname(original).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 6);
  const base = slugify(path.basename(original, path.extname(original))).slice(0, 50);
  return `${base}-${crypto.randomBytes(3).toString('hex')}${ext}`;
}

// file = multer memory file { originalname, buffer, mimetype }
async function save(file, folder) {
  const d = new Date();
  const sub = folder || `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const name = safeName(file.originalname);
  if (BLOB) {
    const { put } = require('@vercel/blob');
    const r = await put(`${PREFIX}${sub}/${name}`, file.buffer, { access: 'public', contentType: file.mimetype });
    return r.url;
  }
  const dir = path.join(UPLOAD_DIR, sub);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), file.buffer);
  return `/uploads/${sub}/${name}`;
}

function walk(dir, base = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const rel = path.join(base, e.name);
    if (e.isDirectory()) return walk(path.join(dir, e.name), rel);
    if (e.name.startsWith('.')) return [];
    const st = fs.statSync(path.join(dir, e.name));
    return [{ url: '/uploads/' + rel.split(path.sep).join('/'), name: e.name, size: st.size, mtime: st.mtimeMs }];
  });
}

async function listAll() {
  if (BLOB) {
    const { list } = require('@vercel/blob');
    let cursor, out = [];
    do {
      const r = await list({ prefix: PREFIX, cursor, limit: 1000 });
      out = out.concat(r.blobs);
      cursor = r.hasMore ? r.cursor : null;
    } while (cursor);
    return out.map(b => ({ url: b.url, name: b.pathname.split('/').pop(), size: b.size, mtime: new Date(b.uploadedAt).getTime() }))
      .sort((a, b) => b.mtime - a.mtime);
  }
  return walk(UPLOAD_DIR).sort((a, b) => b.mtime - a.mtime);
}

async function remove(url) {
  if (BLOB) {
    if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/uploads\//i.test(url)) return;
    const { del } = require('@vercel/blob');
    return del(url);
  }
  const rel = String(url || '').replace(/^\/uploads\//, '');
  const full = path.resolve(UPLOAD_DIR, rel);
  if (full.startsWith(path.resolve(UPLOAD_DIR) + path.sep) && fs.existsSync(full)) fs.unlinkSync(full);
}

module.exports = { BLOB, UPLOAD_DIR, save, listAll, remove };
