const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('./db');
const h = require('./helpers');
const { collections, settingsTabs } = require('./schema');
const { LEAD_TYPES, sendMail } = require('./leads');
const files = require('./files');

const LEAD_STATUSES = ['New', 'Contacted', 'Site visit', 'Negotiation', 'Won', 'Lost'];

module.exports = function adminRouter({ UPLOAD_DIR }) {
  const r = express.Router();

  // ---- uploads ----
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024, files: 40 },
    fileFilter: (req, file, cb) => cb(null, /^(image\/(jpe?g|png|webp|gif|avif|x-icon|vnd\.microsoft\.icon)|application\/pdf|video\/mp4)$/.test(file.mimetype)),
  });
  // Save uploaded files (disk or Vercel Blob) → [{ fieldname, url }]
  const storeAll = async (list) => {
    const out = [];
    for (const f of list || []) out.push({ fieldname: f.fieldname, url: await files.save(f) });
    return out;
  };

  // ---- locals, auth, csrf ----
  r.use((req, res, next) => {
    if (!req.session.csrf) req.session.csrf = crypto.randomBytes(16).toString('hex');
    res.locals.csrf = req.session.csrf;
    res.locals.user = req.session.userId ? db.get('users', req.session.userId) : null;
    res.locals.collections = collections;
    res.locals.settingsTabs = settingsTabs;
    res.locals.LEAD_TYPES = LEAD_TYPES;
    res.locals.LEAD_STATUSES = LEAD_STATUSES;
    res.locals.newLeads = db.filter('leads', l => l.status === 'New').length;
    res.locals.adminPath = req.path;
    res.locals.fieldOptions = fieldOptions;
    next();
  });
  const flash = (req, type, msg) => { req.session.flash = { [type]: msg }; };

  const attempts = new Map();
  r.get('/login', (req, res) => res.locals.user ? res.redirect('/admin') : res.render('admin/login', { error: null, email: '' }));
  r.post('/login', (req, res) => {
    const key = req.ip;
    const a = (attempts.get(key) || []).filter(t => Date.now() - t < 15 * 60 * 1000);
    if (a.length >= 8) return res.status(429).render('admin/login', { error: 'Too many attempts. Try again in 15 minutes.', email: req.body.email });
    const u = db.findOne('users', x => x.email.toLowerCase() === String(req.body.email || '').toLowerCase().trim());
    if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.passwordHash)) {
      attempts.set(key, [...a, Date.now()]);
      return res.status(401).render('admin/login', { error: 'Email or password is incorrect.', email: req.body.email });
    }
    attempts.delete(key);
    req.session.userId = u.id;
    req.session.csrf = crypto.randomBytes(16).toString('hex');
    db.update('users', u.id, { lastLogin: new Date().toISOString() });
    res.redirect(req.query.next && req.query.next.startsWith('/admin') ? req.query.next : '/admin');
  });

  r.use((req, res, next) => {
    if (!res.locals.user) return res.redirect('/admin/login?next=' + encodeURIComponent(req.originalUrl));
    next();
  });
  r.use((req, res, next) => {
    if (req.method !== 'POST') return next();
    // multipart bodies are parsed by multer per route; check after parsing
    if (req.is('multipart/form-data')) return next();
    if ((req.body || {})._csrf !== req.session.csrf) return res.status(403).send('Session expired. Go back, refresh the page and try again.');
    next();
  });
  const csrfAfterUpload = (req, res, next) => (req.body || {})._csrf === req.session.csrf ? next() : res.status(403).send('Session expired. Go back, refresh the page and try again.');
  const adminOnly = (req, res, next) => res.locals.user.role === 'admin' ? next() : res.status(403).render('admin/denied');

  r.post('/logout', (req, res) => { req.session = null; res.redirect('/admin/login'); });

  // ---- dashboard ----
  r.get('/', (req, res) => {
    const leads = db.all('leads').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const props = db.all('properties');
    const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return d.toISOString().slice(0, 10); });
    const perDay = days.map(d => ({ d, n: leads.filter(l => l.createdAt.slice(0, 10) === d).length }));
    const s = db.settings();
    const integrations = [
      ['Live site URL', s.siteUrl && !/localhost/.test(s.siteUrl), 'seo'],
      ['Search Console', !!s.gscVerification, 'integrations'],
      ['Google Analytics 4', !!s.ga4Id, 'integrations'],
      ['Tag Manager', !!s.gtmId, 'integrations'],
      ['Meta Pixel', !!s.metaPixelId, 'integrations'],
      ['Google Ads', !!s.googleAdsId, 'integrations'],
      ['Lead email alerts', !!(s.smtpHost && s.notifyEmails), 'email'],
      ['reCAPTCHA', !!s.recaptchaSiteKey, 'integrations'],
      ['Search indexing on', !!s.allowIndexing, 'seo'],
    ];
    res.render('admin/dashboard', {
      leads: leads.slice(0, 8),
      stats: {
        leadsNew: leads.filter(l => l.status === 'New').length,
        leadsWeek: leads.filter(l => Date.now() - new Date(l.createdAt) < 7 * 864e5).length,
        available: props.filter(p => p.status === 'Available').length,
        sold: props.filter(p => p.status === 'Sold').length,
        projects: db.all('projects').length,
        posts: db.all('posts').length,
      },
      byType: Object.keys(LEAD_TYPES).map(t => [LEAD_TYPES[t], leads.filter(l => l.type === t).length]),
      perDay, integrations,
    });
  });

  // ---- generic collections ----
  const getCol = (req, res, next) => {
    const c = collections[req.params.col];
    if (!c) return res.status(404).render('admin/denied', { message: 'Unknown section.' });
    req.colName = req.params.col; req.col = c; res.locals.colName = req.params.col; res.locals.col = c;
    next();
  };

  r.get('/c/:col', getCol, (req, res) => {
    const q = String(req.query.q || '').toLowerCase();
    let items = db.all(req.colName);
    if (q) items = items.filter(x => JSON.stringify(x).toLowerCase().includes(q));
    const sortKey = req.col.fields.some(f => f.name === 'order') ? 'order' : null;
    items.sort(sortKey ? (a, b) => (a.order || 0) - (b.order || 0) : (a, b) => b.createdAt.localeCompare(a.createdAt));
    res.render('admin/list', { items, q: req.query.q || '' });
  });

  function fieldOptions(f) {
    const s = db.settings();
    if (f.optionsFrom) { const l = h.list(s[f.optionsFrom]); if (l.length) return ['', ...l]; }
    if (f.type === 'relation') return [['', '— none —'], ...db.all(f.collection).map(x => [x.id, x.title || x.name])];
    return f.options || [];
  }

  r.get('/c/:col/new', getCol, (req, res) => {
    const item = Object.fromEntries(req.col.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default]));
    res.render('admin/form', { item, isNew: true });
  });
  r.get('/c/:col/:id', getCol, (req, res) => {
    const item = db.get(req.colName, req.params.id);
    if (!item) return res.redirect('/admin/c/' + req.colName);
    res.render('admin/form', { item, isNew: false });
  });

  function readFields(fields, body, stored, existing = {}) {
    const out = {};
    const fileMap = {};
    (stored || []).forEach(f => { (fileMap[f.fieldname] = fileMap[f.fieldname] || []).push(f.url); });
    for (const f of fields) {
      const v = body[f.name];
      switch (f.type) {
        case 'checkbox': out[f.name] = v === 'on' || v === 'true'; break;
        case 'number': out[f.name] = v === '' || v == null ? '' : Number(v); break;
        case 'image': case 'file': out[f.name] = (fileMap[f.name + '__file'] || [])[0] || String(v || '').trim(); break;
        case 'gallery': out[f.name] = [...h.gallery(v), ...(fileMap[f.name + '__files'] || [])]; break;
        case 'password': out[f.name] = v ? v : (existing[f.name] || ''); break;
        default: out[f.name] = typeof v === 'string' ? v.trim() : (v ?? '');
      }
    }
    return out;
  }

  r.post('/c/:col{/:id}', upload.any(), csrfAfterUpload, getCol, async (req, res) => {
    const existing = req.params.id ? db.get(req.colName, req.params.id) : null;
    const data = readFields(req.col.fields, req.body, await storeAll(req.files), existing || {});
    const slugField = req.col.fields.find(f => f.type === 'slug');
    if (slugField) {
      let base = h.slugify(data.slug || data[slugField.from]);
      let slug = base, n = 2;
      while (db.findOne(req.colName, x => x.slug === slug && x.id !== req.params.id)) slug = `${base}-${n++}`;
      data.slug = slug;
    }
    const missing = req.col.fields.filter(f => f.required && !data[f.name]);
    if (missing.length) {
      res.locals.flash = { error: `Please fill in: ${missing.map(f => f.label).join(', ')}` };
      return res.render('admin/form', { item: { ...existing, ...data }, isNew: !existing });
    }
    const saved = existing ? db.update(req.colName, existing.id, data) : db.insert(req.colName, data);
    flash(req, 'success', `${req.col.singular} saved.`);
    res.redirect(req.body._after === 'list' ? `/admin/c/${req.colName}` : `/admin/c/${req.colName}/${saved.id}`);
  });

  r.post('/c/:col/:id/delete', getCol, (req, res) => {
    db.remove(req.colName, req.params.id);
    flash(req, 'success', `${req.col.singular} deleted.`);
    res.redirect('/admin/c/' + req.colName);
  });
  r.post('/c/:col/:id/duplicate', getCol, (req, res) => {
    const item = db.get(req.colName, req.params.id);
    if (!item) return res.redirect('/admin/c/' + req.colName);
    const { id, createdAt, updatedAt, ...rest } = item;
    const titleKey = rest.title !== undefined ? 'title' : (rest.name !== undefined ? 'name' : 'heading');
    const copy = { ...rest, [titleKey]: rest[titleKey] + ' (copy)', published: false };
    if (copy.slug) copy.slug = copy.slug + '-copy-' + crypto.randomBytes(2).toString('hex');
    const saved = db.insert(req.colName, copy);
    flash(req, 'success', 'Duplicated as an unpublished draft.');
    res.redirect(`/admin/c/${req.colName}/${saved.id}`);
  });
  r.post('/c/:col/:id/toggle', getCol, (req, res) => {
    const item = db.get(req.colName, req.params.id);
    if (item) db.update(req.colName, item.id, { published: !item.published });
    res.redirect(req.get('referer') || '/admin/c/' + req.colName);
  });

  // ---- leads ----
  const filterLeads = (q) => {
    let l = db.all('leads').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (q.type) l = l.filter(x => x.type === q.type);
    if (q.status) l = l.filter(x => x.status === q.status);
    if (q.q) { const t = q.q.toLowerCase(); l = l.filter(x => JSON.stringify(x).toLowerCase().includes(t)); }
    return l;
  };
  r.get('/leads', (req, res) => res.render('admin/leads', { leads: filterLeads(req.query), q: req.query }));
  r.get('/leads.csv', (req, res) => {
    const rows = filterLeads(req.query);
    const cols = ['createdAt', 'type', 'status', 'name', 'phone', 'email', 'message', 'propertyTitle', 'details', 'source', 'utm', 'notes'];
    const cell = v => `"${String(typeof v === 'object' && v ? JSON.stringify(v) : (v ?? '')).replace(/"/g, '""')}"`;
    res.setHeader('Content-Disposition', `attachment; filename="avyaadwik-leads-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.type('text/csv').send('﻿' + [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n'));
  });
  r.get('/leads/:id', (req, res) => {
    const lead = db.get('leads', req.params.id);
    if (!lead) return res.redirect('/admin/leads');
    res.render('admin/lead', { lead });
  });
  r.post('/leads/:id', (req, res) => {
    db.update('leads', req.params.id, { status: req.body.status, notes: req.body.notes, followUp: req.body.followUp });
    flash(req, 'success', 'Lead updated.');
    res.redirect('/admin/leads/' + req.params.id);
  });
  r.post('/leads/:id/delete', (req, res) => { db.remove('leads', req.params.id); flash(req, 'success', 'Lead deleted.'); res.redirect('/admin/leads'); });
  r.post('/leads/:id/to-listing', (req, res) => {
    const l = db.get('leads', req.params.id);
    if (!l) return res.redirect('/admin/leads');
    const d = l.details || {};
    const title = [d.bhk ? d.bhk + ' BHK' : '', d.propertyType || 'Property', d.locality ? 'in ' + d.locality : ''].filter(Boolean).join(' ');
    const p = db.insert('properties', {
      title, slug: h.slugify(title) + '-' + crypto.randomBytes(2).toString('hex'), purpose: 'Sale', type: d.propertyType || '', status: 'Available',
      price: Number(d.expectedPrice) || '', area: Number(d.area) || '', areaUnit: d.areaUnit || 'sq ft', bedrooms: Number(d.bhk) || '',
      city: d.city || '', locality: d.locality || '', cover: (l.photos || [])[0] || '', gallery: l.photos || [],
      summary: l.message || '', published: false, sourceLead: l.id,
    });
    db.update('leads', l.id, { status: l.status === 'New' ? 'Contacted' : l.status, notes: (l.notes ? l.notes + '\n' : '') + `Draft listing created ${new Date().toLocaleDateString('en-IN')}.` });
    flash(req, 'success', 'Draft listing created from this submission. Review and publish it.');
    res.redirect('/admin/c/properties/' + p.id);
  });

  // ---- settings ----
  r.get('/settings', adminOnly, (req, res) => res.redirect('/admin/settings/general'));
  r.get('/settings/:tab', adminOnly, (req, res) => {
    const tab = settingsTabs[req.params.tab];
    if (!tab) return res.redirect('/admin/settings/general');
    res.render('admin/settings', { tabKey: req.params.tab, tab, item: db.settings() });
  });
  r.post('/settings/:tab', adminOnly, upload.any(), csrfAfterUpload, async (req, res) => {
    const tab = settingsTabs[req.params.tab];
    if (!tab) return res.redirect('/admin/settings/general');
    const data = readFields(tab.fields, req.body, await storeAll(req.files), db.settings());
    for (const k of ['gtmId', 'ga4Id', 'metaPixelId', 'googleAdsId', 'clarityId', 'hotjarId', 'linkedinPartnerId']) if (data[k] !== undefined) data[k] = String(data[k]).trim();
    if (data.gscVerification) { const m = data.gscVerification.match(/content=["']([^"']+)/); if (m) data.gscVerification = m[1]; }
    if (data.bingVerification) { const m = data.bingVerification.match(/content=["']([^"']+)/); if (m) data.bingVerification = m[1]; }
    db.setSettings(data);
    flash(req, 'success', `${tab.label} saved.`);
    res.redirect('/admin/settings/' + req.params.tab);
  });
  r.post('/test-email', adminOnly, async (req, res) => {
    const s = db.settings();
    const to = s.notifyEmails || res.locals.user.email;
    const result = await sendMail({ to, subject: 'Avyaadwik test email', html: '<p>Your SMTP settings work. New lead alerts will arrive at this address.</p>' });
    flash(req, result.ok ? 'success' : 'error', result.ok ? `Test email sent to ${to}.` : `Email failed: ${result.error}`);
    res.redirect('/admin/settings/email');
  });

  // ---- media ----
  r.get('/media', async (req, res, next) => {
    try { res.render('admin/media', { files: await files.listAll(), pick: req.query.pick || '' }); } catch (e) { next(e); }
  });
  r.post('/media', upload.array('files', 40), csrfAfterUpload, async (req, res) => {
    await storeAll(req.files);
    flash(req, 'success', `${(req.files || []).length} file(s) uploaded.`);
    res.redirect('/admin/media');
  });
  r.post('/media/delete', async (req, res) => {
    await files.remove(String(req.body.url || '')).catch(e => console.error(e.message));
    flash(req, 'success', 'File deleted.');
    res.redirect('/admin/media');
  });

  // ---- users ----
  r.get('/users', adminOnly, (req, res) => res.render('admin/users', { users: db.all('users') }));
  r.get('/users/:id', adminOnly, (req, res) => res.render('admin/user', { u: req.params.id === 'new' ? { role: 'editor' } : db.get('users', req.params.id) || {}, isNew: req.params.id === 'new' }));
  r.post('/users/:id', adminOnly, (req, res) => {
    const { name, email, role, password } = req.body;
    const isNew = req.params.id === 'new';
    const clash = db.findOne('users', x => x.email.toLowerCase() === String(email).toLowerCase() && x.id !== req.params.id);
    if (!email || clash) { flash(req, 'error', clash ? 'Another user already has that email.' : 'Email is required.'); return res.redirect('/admin/users/' + req.params.id); }
    if (isNew && (!password || password.length < 8)) { flash(req, 'error', 'Password must be at least 8 characters.'); return res.redirect('/admin/users/new'); }
    const data = { name, email: email.trim(), role: role === 'admin' ? 'admin' : 'editor' };
    if (password) data.passwordHash = bcrypt.hashSync(password, 10);
    if (isNew) db.insert('users', data); else db.update('users', req.params.id, data);
    flash(req, 'success', 'User saved.');
    res.redirect('/admin/users');
  });
  r.post('/users/:id/delete', adminOnly, (req, res) => {
    if (req.params.id === res.locals.user.id) flash(req, 'error', 'You cannot delete your own account.');
    else { db.remove('users', req.params.id); flash(req, 'success', 'User deleted.'); }
    res.redirect('/admin/users');
  });

  r.get('/account', (req, res) => res.render('admin/account'));
  r.post('/account', (req, res) => {
    const u = res.locals.user;
    const { current, password, confirm, name } = req.body;
    if (password) {
      if (!bcrypt.compareSync(current || '', u.passwordHash)) { flash(req, 'error', 'Current password is incorrect.'); return res.redirect('/admin/account'); }
      if (password.length < 8 || password !== confirm) { flash(req, 'error', 'New passwords must match and be at least 8 characters.'); return res.redirect('/admin/account'); }
      db.update('users', u.id, { passwordHash: bcrypt.hashSync(password, 10) });
    }
    if (name) db.update('users', u.id, { name });
    flash(req, 'success', 'Account updated.');
    res.redirect('/admin/account');
  });

  // ---- backup ----
  r.get('/backup', adminOnly, (req, res) => res.render('admin/backup'));
  r.get('/backup/download', adminOnly, (req, res) => {
    res.setHeader('Content-Disposition', `attachment; filename="avyaadwik-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.type('application/json').send(JSON.stringify(db.raw(), null, 2));
  });
  const restoreUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
  r.post('/backup/restore', adminOnly, restoreUpload.single('file'), csrfAfterUpload, (req, res) => {
    try {
      const data = JSON.parse(req.file.buffer.toString('utf8'));
      if (!data.settings || !data.collections || !Array.isArray(data.collections.users)) throw new Error('Not an Avyaadwik backup file');
      db.replaceAll(data);
      flash(req, 'success', 'Backup restored.');
    } catch (e) { flash(req, 'error', 'Restore failed: ' + e.message); }
    res.redirect('/admin/backup');
  });

  return r;
};
