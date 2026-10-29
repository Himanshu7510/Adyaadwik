// Datastore with two backends:
//  • Local disk (default): data/db.json, atomic writes, hourly backups. Use on a VPS / cPanel.
//  • Vercel Blob (when BLOB_READ_WRITE_TOKEN is set): every save writes a new, encrypted,
//    unguessable version of the database to Blob storage; the newest version is the live one.
//    Older versions are kept as automatic backups (last 40).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const PREFIX = 'db/';
const KEEP = 40;

let state = null;
let loadedAt = 0;
let lastBackup = 0;
let pending = Promise.resolve();
let saves = 0;
let muted = false;

const empty = () => ({ settings: {}, collections: {} });
const normalise = s => { s = s || empty(); s.settings = s.settings || {}; s.collections = s.collections || {}; return s; };

// ---- encryption for the Blob copy (the Blob store is public, so data is encrypted at rest) ----
function key() {
  const secret = process.env.DATA_KEY || process.env.SESSION_SECRET;
  if (!secret) throw new Error('Set DATA_KEY (or SESSION_SECRET) to use Blob storage');
  return crypto.createHash('sha256').update('avyaadwik-db:' + secret).digest();
}
function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([Buffer.from('AVY1'), iv, c.getAuthTag(), body]);
}
function decrypt(buf) {
  if (buf.subarray(0, 4).toString() !== 'AVY1') return JSON.parse(buf.toString('utf8'));
  const iv = buf.subarray(4, 16), tag = buf.subarray(16, 32), body = buf.subarray(32);
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(body), d.final()]).toString('utf8'));
}

async function blobVersions() {
  const { list } = require('@vercel/blob');
  let cursor, out = [];
  do {
    const r = await list({ prefix: PREFIX, cursor, limit: 1000 });
    out = out.concat(r.blobs);
    cursor = r.hasMore ? r.cursor : null;
  } while (cursor);
  return out.sort((a, b) => b.pathname.localeCompare(a.pathname)); // newest first (timestamped names)
}

async function loadBlob() {
  const versions = await blobVersions();
  if (!versions.length) return empty();
  const r = await fetch(versions[0].url, { cache: 'no-store' });
  if (!r.ok) throw new Error('Could not read database from Blob: ' + r.status);
  return decrypt(Buffer.from(await r.arrayBuffer()));
}

async function writeBlob(snapshot) {
  const { put, del } = require('@vercel/blob');
  const name = `${PREFIX}${String(Date.now()).padStart(15, '0')}.bin`;
  await put(name, encrypt(snapshot), { access: 'public', addRandomSuffix: true, contentType: 'application/octet-stream' });
  if (++saves % 10 === 1) {
    const versions = await blobVersions();
    const old = versions.slice(KEEP).map(v => v.url);
    if (old.length) await del(old).catch(() => {});
  }
}

// ---- public API ----
async function init(force = false) {
  if (state && !force) return state;
  if (BLOB) {
    await pending;
    state = normalise(await loadBlob());
  } else {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    state = normalise(fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : null);
  }
  loadedAt = Date.now();
  return state;
}

// Re-read the newest version if ours is older than maxAgeMs (only matters on Vercel, where
// several server instances may be running at once).
async function refresh(maxAgeMs) {
  if (!BLOB) return init();
  if (!state || Date.now() - loadedAt > maxAgeMs) return init(true);
  return state;
}

function load() {
  if (!state) {
    if (BLOB) throw new Error('Database not initialised');
    initSyncLocal();
  }
  return state;
}
function initSyncLocal() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  state = normalise(fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : null);
}

function save() {
  if (muted) return Promise.resolve();
  if (BLOB) {
    const snapshot = JSON.parse(JSON.stringify(state));
    pending = pending.then(() => writeBlob(snapshot)).catch(e => console.error('Blob save failed:', e.message));
    loadedAt = Date.now();
    return pending;
  }
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DB_FILE);
  if (Date.now() - lastBackup > 3600 * 1000) {
    lastBackup = Date.now();
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(DB_FILE, path.join(BACKUP_DIR, `db-${stamp}.json`));
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort();
    while (files.length > 48) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  }
  return Promise.resolve();
}
const flush = () => pending;

const id = () => crypto.randomBytes(6).toString('hex');
function col(name) {
  load();
  if (!state.collections[name]) state.collections[name] = [];
  return state.collections[name];
}

module.exports = {
  BLOB, DATA_DIR,
  init, refresh, flush, load, save,
  all(name) { return col(name).slice(); },
  get(name, itemId) { return col(name).find(x => x.id === itemId) || null; },
  findOne(name, fn) { return col(name).find(fn) || null; },
  filter(name, fn) { return col(name).filter(fn); },
  insert(name, data) {
    const now = new Date().toISOString();
    const item = { id: id(), createdAt: now, updatedAt: now, ...data };
    col(name).push(item);
    save();
    return item;
  },
  update(name, itemId, data) {
    const list = col(name);
    const i = list.findIndex(x => x.id === itemId);
    if (i === -1) return null;
    list[i] = { ...list[i], ...data, id: itemId, updatedAt: new Date().toISOString() };
    save();
    return list[i];
  },
  remove(name, itemId) {
    const list = col(name);
    const i = list.findIndex(x => x.id === itemId);
    if (i > -1) { list.splice(i, 1); save(); }
  },
  settings() { load(); return state.settings; },
  setSettings(patch) { load(); state.settings = { ...state.settings, ...patch }; save(); return state.settings; },
  raw() { load(); return state; },
  batch(fn) { muted = true; try { fn(); } finally { muted = false; } return save(); },
  replaceAll(newState) { state = normalise(newState); save(); },
};
