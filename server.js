require('./lib/env');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieSession = require('cookie-session');
const compression = require('compression');
const helmet = require('helmet');
const multer = require('multer');

const db = require('./lib/db');
const h = require('./lib/helpers');
const { seed } = require('./lib/seed');
const { createLead, verifyRecaptcha, LEAD_TYPES } = require('./lib/leads');
const files = require('./lib/files');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = files.UPLOAD_DIR;
if (!files.BLOB) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(compression());
// CSP is off on purpose: GA4, GTM, Meta Pixel and custom scripts added from the admin must be able to load.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: false }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.json({ limit: '5mb' }));
app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d' }));

// Signed-cookie sessions: work the same on a single server and on Vercel's serverless functions.
app.use(cookieSession({
  name: 'avy',
  keys: [process.env.SESSION_SECRET || 'change-this-secret-in-.env'],
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === 'true',
  maxAge: 1000 * 60 * 60 * 12,
}));

// Load the database (and create demo content on the very first run).
// On Vercel, re-check for newer content every 30 s on the website and on every admin request.
let seeded = false;
app.use(async (req, res, next) => {
  try {
    const isAdmin = req.path.startsWith('/admin') || req.method === 'POST';
    await db.refresh(isAdmin ? 0 : 30000);
    if (!seeded) { await seed(); seeded = true; }
    next();
  } catch (e) { next(e); }
});
// Make sure every change is written to storage before the response is sent.
app.use((req, res, next) => {
  const end = res.end;
  res.end = function (...args) {
    db.flush().then(() => end.apply(this, args), () => end.apply(this, args));
    return this;
  };
  next();
});

// ---------- shared view locals ----------
app.use((req, res, next) => {
  const s = db.settings();
  res.locals.s = s;
  res.locals.h = h;
  res.locals.req = req;
  res.locals.path = req.path;
  res.locals.year = new Date().getFullYear();
  res.locals.price = (p) => p.priceLabel || h.formatPrice(p.price, s.currencyFormat) || 'Price on request';
  res.locals.menu = h.lines(s.menu).map(([label, href]) => ({ label, href }));
  res.locals.footerPages = db.filter('pages', p => p.published && p.showInFooter);
  res.locals.services = db.filter('services', x => x.published).sort((a, b) => (a.order || 0) - (b.order || 0));
  res.locals.cities = h.list(s.cities);
  res.locals.propertyTypes = h.list(s.propertyTypes);
  res.locals.flash = req.session.flash; if (req.session.flash) req.session.flash = null;
  res.locals.meta = {};
  next();
});

// remember UTM params for lead attribution
app.use((req, res, next) => {
  if (req.query.utm_source || req.query.gclid || req.query.fbclid) {
    req.session.utm = Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].filter(k => req.query[k]).map(k => [k, String(req.query[k]).slice(0, 200)]));
  }
  next();
});

// 301 redirects managed in Admin → Settings → SEO
app.use((req, res, next) => {
  const r = h.lines(db.settings().redirects).find(([from]) => from && from === req.path);
  if (r && r[1]) return res.redirect(301, r[1]);
  next();
});

function siteBase(req) {
  const u = db.settings().siteUrl;
  return (u && !/localhost/.test(u) ? u : `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}
function setMeta(res, m) {
  const s = res.locals.s;
  const base = siteBase(res.locals.req);
  const title = m.title ? (s.titleTemplate || '%s').replace('%s', m.title) : (s.defaultTitle || s.siteName);
  let image = m.image || s.ogImage || '/public/img/logo-full.jpg';
  if (image.startsWith('/')) image = base + image;
  res.locals.meta = {
    title,
    description: m.description || s.defaultDescription || '',
    image,
    canonical: base + (m.path || res.locals.req.originalUrl.split('?')[0]),
    noindex: m.noindex || !s.allowIndexing,
    type: m.type || 'website',
    jsonld: m.jsonld || null,
  };
}
const pub = name => db.filter(name, x => x.published);
const byOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0);
const newest = (a, b) => String(b.date || b.createdAt).localeCompare(String(a.date || a.createdAt));

// ---------- public pages ----------
app.get('/', (req, res) => {
  const s = res.locals.s;
  setMeta(res, { path: '/', jsonld: orgSchema(s, siteBase(req)) });
  const props = pub('properties');
  res.render('site/home', {
    slides: pub('slides').sort(byOrder),
    featured: props.filter(p => p.featured && p.status !== 'Sold').slice(0, 6),
    latest: props.sort(newest).slice(0, 6),
    projects: pub('projects').filter(p => p.featured).slice(0, 3),
    testimonials: pub('testimonials'),
    posts: pub('posts').sort(newest).slice(0, 3),
    partners: pub('partners').sort(byOrder),
    counts: Object.fromEntries(res.locals.propertyTypes.map(t => [t, props.filter(p => p.type === t && p.status !== 'Sold').length])),
  });
});

app.get('/properties', (req, res) => {
  const s = res.locals.s;
  const q = req.query;
  const budgets = h.lines(s.budgets);
  let list = pub('properties');
  if (q.q) {
    const t = String(q.q).toLowerCase();
    list = list.filter(p => [p.title, p.locality, p.city, p.type, p.summary].join(' ').toLowerCase().includes(t));
  }
  if (q.purpose) list = list.filter(p => p.purpose === q.purpose);
  if (q.type) list = list.filter(p => p.type === q.type);
  if (q.city) list = list.filter(p => p.city === q.city);
  if (q.bhk) list = list.filter(p => q.bhk === '4' ? Number(p.bedrooms) >= 4 : String(p.bedrooms) === q.bhk);
  if (q.possession) list = list.filter(p => p.possession === q.possession);
  if (q.budget !== undefined && q.budget !== '' && budgets[q.budget]) {
    const [min, max] = budgets[q.budget].map(Number);
    list = list.filter(p => Number(p.price) >= (min || 0) && (!max || Number(p.price) <= max));
  }
  if (q.status !== 'all') list = list.filter(p => p.status !== 'Sold' && p.status !== 'Rented');
  const sorters = {
    newest, 'price-asc': (a, b) => (a.price || 0) - (b.price || 0), 'price-desc': (a, b) => (b.price || 0) - (a.price || 0),
    'area-desc': (a, b) => (b.area || 0) - (a.area || 0),
  };
  list.sort(sorters[q.sort] || ((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || newest(a, b)));
  const perPage = Number(s.perPage) || 9;
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  const page = Math.min(pages, Math.max(1, parseInt(q.page) || 1));
  const heading = [q.bhk ? (q.bhk === '4' ? '4+ BHK' : q.bhk + ' BHK') : '', q.type || 'Properties', q.purpose === 'Rent' ? 'for rent' : q.purpose ? 'for ' + q.purpose.toLowerCase() : '', q.city ? 'in ' + q.city : ''].filter(Boolean).join(' ');
  setMeta(res, { title: heading, description: `Browse ${list.length} verified ${heading.toLowerCase()} listed by Avyaadwik. Filter by city, budget, BHK and possession.`, path: '/properties' });
  const qs = (patch) => '/properties?' + new URLSearchParams(Object.entries({ ...q, ...patch }).filter(([, v]) => v !== '' && v != null)).toString();
  res.render('site/properties', { list: list.slice((page - 1) * perPage, page * perPage), total: list.length, page, pages, q, budgets, heading, qs });
});

app.get('/properties/:slug', (req, res, next) => {
  const p = db.findOne('properties', x => x.slug === req.params.slug && x.published);
  if (!p) return next();
  const s = res.locals.s;
  const base = siteBase(req);
  setMeta(res, {
    title: p.seoTitle || `${p.title}, ${[p.locality, p.city].filter(Boolean).join(', ')}`,
    description: p.seoDescription || p.summary || h.excerpt(p.description),
    image: p.ogImage || p.cover, noindex: p.noindex,
    jsonld: {
      '@context': 'https://schema.org', '@type': 'RealEstateListing', name: p.title, url: base + '/properties/' + p.slug,
      image: [p.cover, ...h.gallery(p.gallery)].filter(Boolean), description: p.summary,
      datePosted: p.createdAt,
      offers: p.price ? { '@type': 'Offer', price: p.price, priceCurrency: 'INR', availability: p.status === 'Available' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut' } : undefined,
      address: { '@type': 'PostalAddress', addressLocality: p.locality, addressRegion: p.city, addressCountry: 'IN' },
    },
  });
  const similar = pub('properties').filter(x => x.id !== p.id && x.status !== 'Sold' && (x.type === p.type || x.city === p.city)).slice(0, 3);
  res.render('site/property', { p, similar });
});

app.get('/projects', (req, res) => {
  const stage = req.query.stage;
  let list = pub('projects');
  if (stage) list = list.filter(p => p.stage === stage);
  const order = { Ongoing: 0, Upcoming: 1, Completed: 2 };
  list.sort((a, b) => order[a.stage] - order[b.stage]);
  setMeta(res, { title: stage ? `${stage} projects` : 'Our projects', description: 'Residential, commercial and turnkey construction projects by Avyaadwik — ongoing, upcoming and delivered.' });
  res.render('site/projects', { list, stage });
});
app.get('/projects/:slug', (req, res, next) => {
  const p = db.findOne('projects', x => x.slug === req.params.slug && x.published);
  if (!p) return next();
  setMeta(res, { title: p.seoTitle || p.title, description: p.seoDescription || p.summary, image: p.ogImage || p.cover, noindex: p.noindex });
  const units = pub('properties').filter(x => x.project === p.id);
  res.render('site/project', { p, units });
});

app.get('/services', (req, res) => {
  setMeta(res, { title: 'Services', description: 'House construction, buying and selling flats and plots, plot development, renovation, and legal and loan assistance.' });
  res.render('site/services');
});
app.get('/services/:slug', (req, res, next) => {
  const p = db.findOne('services', x => x.slug === req.params.slug && x.published);
  if (!p) return next();
  if (p.ctaType === 'construction' && /construction/i.test(p.slug) && !/renovation/i.test(p.slug)) return res.redirect(301, '/construction');
  if (p.ctaType === 'sell' && /sell/i.test(p.slug)) return res.redirect(301, '/sell-property');
  setMeta(res, { title: p.seoTitle || p.title, description: p.seoDescription || p.summary, image: p.ogImage || p.cover, noindex: p.noindex });
  res.render('site/service', { p, faqs: pub('faqs').sort(byOrder).slice(0, 4) });
});

app.get('/construction', (req, res) => {
  const s = res.locals.s;
  setMeta(res, { title: s.constructionHeading || 'House construction', description: s.constructionIntro, image: s.constructionImage });
  res.render('site/construction', {
    rates: h.lines(s.constructionRates),
    projects: pub('projects').slice(0, 3),
    faqs: pub('faqs').filter(f => f.category === 'Construction').sort(byOrder),
  });
});

app.get('/sell-property', (req, res) => {
  const s = res.locals.s;
  setMeta(res, { title: 'Sell your property', description: s.sellIntro, image: s.sellImage });
  res.render('site/sell', { faqs: pub('faqs').filter(f => f.category === 'Selling').sort(byOrder) });
});

app.get('/about', (req, res) => {
  const s = res.locals.s;
  setMeta(res, { title: 'About us', description: s.mission, image: s.aboutPageBanner });
  res.render('site/about', { team: pub('team').sort(byOrder), testimonials: pub('testimonials') });
});

app.get('/contact', (req, res) => {
  setMeta(res, { title: 'Contact us', description: `Call, WhatsApp or visit ${res.locals.s.siteName}. ${res.locals.s.address || ''}` });
  res.render('site/contact');
});

app.get('/faqs', (req, res) => {
  const faqs = pub('faqs').sort(byOrder);
  setMeta(res, {
    title: 'Frequently asked questions', description: 'Answers about buying, selling and building property with Avyaadwik.',
    jsonld: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) },
  });
  res.render('site/faqs', { faqs });
});

app.get('/blog', (req, res) => {
  let list = pub('posts').sort(newest);
  if (req.query.category) list = list.filter(p => p.category === req.query.category);
  const categories = [...new Set(pub('posts').map(p => p.category).filter(Boolean))];
  setMeta(res, { title: 'Property guides & news', description: 'Practical guides on construction costs, property documents, buying and selling in India.' });
  res.render('site/blog', { list, categories, category: req.query.category });
});
app.get('/blog/:slug', (req, res, next) => {
  const p = db.findOne('posts', x => x.slug === req.params.slug && x.published);
  if (!p) return next();
  const s = res.locals.s;
  setMeta(res, {
    title: p.seoTitle || p.title, description: p.seoDescription || p.excerpt, image: p.ogImage || p.cover, noindex: p.noindex, type: 'article',
    jsonld: { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, image: p.cover, datePublished: p.date, author: { '@type': 'Organization', name: p.author || s.siteName } },
  });
  res.render('site/post', { p, more: pub('posts').filter(x => x.id !== p.id).sort(newest).slice(0, 3) });
});

app.get('/p/:slug', (req, res, next) => {
  const p = db.findOne('pages', x => x.slug === req.params.slug && x.published);
  if (!p) return next();
  setMeta(res, { title: p.seoTitle || p.title, description: p.seoDescription || h.excerpt(p.body), image: p.ogImage || p.cover, noindex: p.noindex });
  res.render('site/page', { p });
});

app.get('/thank-you', (req, res) => {
  setMeta(res, { title: 'Thank you', noindex: true });
  res.render('site/thanks', { type: req.query.type || 'enquiry', typeLabel: LEAD_TYPES[req.query.type] || 'enquiry' });
});

// ---------- lead capture ----------
const leadUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpe?g|png|webp)$/.test(file.mimetype)),
});
const hits = new Map();
app.post('/lead', leadUpload.array('photos', 8), async (req, res) => {
  const wantsJson = req.get('accept')?.includes('application/json');
  const fail = (msg, code = 400) => wantsJson ? res.status(code).json({ ok: false, error: msg }) : (req.session.flash = { error: msg }, res.redirect(req.get('referer') || '/contact'));
  const b = req.body;
  if (b.website) return wantsJson ? res.json({ ok: true }) : res.redirect('/thank-you'); // honeypot
  const ip = req.ip;
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  if (recent.length >= 8) return fail('Too many submissions. Please call us instead.', 429);
  hits.set(ip, [...recent, now]);
  const phone = String(b.phone || '').trim();
  if (!b.name || h.digits(phone).length < 10) return fail('Please enter your name and a valid 10-digit phone number.');
  if (!(await verifyRecaptcha(b['g-recaptcha-response'], ip))) return fail('Please tick "I\'m not a robot" and try again.');
  const type = LEAD_TYPES[b.type] ? b.type : 'enquiry';
  const known = ['name', 'phone', 'email', 'message', 'type', 'propertyId', 'website', 'g-recaptcha-response', 'source'];
  const details = Object.fromEntries(Object.entries(b).filter(([k, v]) => !known.includes(k) && v !== ''));
  const property = b.propertyId ? db.get('properties', b.propertyId) : null;
  const photos = [];
  for (const f of req.files || []) photos.push(await files.save(f, 'submissions'));
  await createLead({
    type, name: String(b.name).slice(0, 120), phone: phone.slice(0, 20), email: String(b.email || '').slice(0, 160),
    message: String(b.message || '').slice(0, 4000),
    propertyId: property?.id || '', propertyTitle: property?.title || '',
    details, photos,
    source: String(b.source || req.get('referer') || '').slice(0, 300),
    utm: req.session.utm || null, ip,
  });
  if (wantsJson) return res.json({ ok: true, redirect: '/thank-you?type=' + type });
  res.redirect('/thank-you?type=' + type);
});

// ---------- SEO files ----------
app.get('/robots.txt', (req, res) => {
  const s = db.settings();
  const base = siteBase(req);
  res.type('text/plain').send(s.allowIndexing
    ? `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /thank-you\n${s.robotsExtra || ''}\nSitemap: ${base}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n');
});
app.get('/sitemap.xml', (req, res) => {
  const s = db.settings();
  const base = siteBase(req);
  const urls = [['/', 1.0], ['/properties', 0.9], ['/construction', 0.9], ['/sell-property', 0.9], ['/projects', 0.8], ['/services', 0.7], ['/about', 0.6], ['/contact', 0.6], ['/faqs', 0.5], ['/blog', 0.6]]
    .map(([u, p]) => ({ loc: u, priority: p }));
  const add = (name, prefix, pr) => pub(name).filter(x => !x.noindex).forEach(x => urls.push({ loc: prefix + x.slug, lastmod: x.updatedAt, priority: pr }));
  add('properties', '/properties/', 0.8); add('projects', '/projects/', 0.7); add('services', '/services/', 0.7); add('posts', '/blog/', 0.6); add('pages', '/p/', 0.3);
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => `  <url><loc>${base}${encodeURI(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n') + '\n</urlset>';
  res.type('application/xml').send(xml);
});

function orgSchema(s, base) {
  return {
    '@context': 'https://schema.org', '@type': s.businessType || 'RealEstateAgent', name: s.siteName, url: base,
    logo: base + (s.logo || '/public/img/logo-full.jpg'), telephone: s.phone, email: s.email,
    address: { '@type': 'PostalAddress', streetAddress: s.address, addressCountry: 'IN' },
    sameAs: [s.facebook, s.instagram, s.youtube, s.linkedin, s.twitter].filter(Boolean),
  };
}

// ---------- admin ----------
app.use('/admin', require('./lib/admin')({ UPLOAD_DIR }));

// ---------- 404 / errors ----------
app.use((req, res) => {
  setMeta(res, { title: 'Page not found', noindex: true });
  res.status(404).render('site/404');
});
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong. Please try again.');
});

module.exports = app;
if (require.main === module) {
  db.init().then(seed).then(() => { seeded = true; app.listen(PORT, () => console.log(`Avyaadwik running on http://localhost:${PORT}  (admin: /admin)`)); });
}
