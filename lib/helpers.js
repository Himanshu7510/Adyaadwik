const slugifyLib = require('slugify');

const slugify = s => slugifyLib(String(s || ''), { lower: true, strict: true, trim: true }) || 'item';

function formatPrice(n, mode = 'indian') {
  const v = Number(n);
  if (!v) return '';
  if (mode === 'plain') return '₹' + v.toLocaleString('en-IN');
  if (v >= 1e7) return '₹' + trim(v / 1e7) + ' Cr';
  if (v >= 1e5) return '₹' + trim(v / 1e5) + ' L';
  return '₹' + v.toLocaleString('en-IN');
}
const trim = x => (Math.round(x * 100) / 100).toString();

// "a | b" lines → [[a,b], ...]
function lines(text) {
  if (Array.isArray(text)) return text;
  return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.split('|').map(p => p.trim()));
}
const list = text => lines(text).map(p => p[0]);

function stripHtml(html) { return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
function excerpt(html, n = 160) {
  const t = stripHtml(html);
  return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t;
}

function youtubeId(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}
function mapSrc(v) {
  if (!v) return '';
  const m = String(v).match(/src=["']([^"']+)["']/);
  const src = m ? m[1] : String(v).trim();
  return /^https:\/\/(www\.)?google\.[a-z.]+\/maps/.test(src) || /^https:\/\/maps\.google\./.test(src) ? src : '';
}
function tags(v) {
  if (Array.isArray(v)) return v;
  return String(v || '').split(',').map(s => s.trim()).filter(Boolean);
}
function gallery(v) {
  if (Array.isArray(v)) return v;
  return String(v || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}
function fmtDate(d) {
  if (!d) return '';
  const x = new Date(d);
  return isNaN(x) ? d : x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
const initials = name => String(name || '?').split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const SOCIAL = [
  ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['linkedin', 'LinkedIn'],
  ['twitter', 'X'], ['threads', 'Threads'], ['pinterest', 'Pinterest'], ['telegram', 'Telegram'],
  ['whatsappChannel', 'WhatsApp channel'], ['googleBusiness', 'Google reviews'],
];
const socialLinks = s => SOCIAL.filter(([k]) => /^https?:\/\//i.test(String((s || {})[k] || '').trim())).map(([key, label]) => ({ key, label, url: String(s[key]).trim() }));
const digits = s => String(s || '').replace(/\D/g, '');

module.exports = { slugify, formatPrice, lines, list, stripHtml, excerpt, youtubeId, mapSrc, tags, gallery, fmtDate, initials, digits, socialLinks, SOCIAL };
