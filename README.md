# Avyaadwik — Real Estate & Construction Website

A complete website for Avyaadwik with an admin panel that controls every piece of content: property listings (flats, plots, villas, builder floors, commercial), construction projects, services, the construction cost calculator, the "sell your property" flow, blog, pages, banners, testimonials, FAQs, team, menus, SEO and all tracking integrations.

Built with Node.js + Express. No database server is needed — content is stored in `data/db.json` with hourly automatic backups.

---

## 1. Run it on your computer

Requires **Node.js 18 or newer** (https://nodejs.org).

```bash
cd avyaadwik
npm install
cp .env.example .env      # then edit SESSION_SECRET and ADMIN_PASSWORD
npm start
```

- Website: http://localhost:3000
- Admin panel: http://localhost:3000/admin
- First login: the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (default `admin@avyaadwik.com` / `Avyaadwik@2026`). **Change the password immediately** under *My account*.

On first start the site fills itself with sample listings, projects and articles so you can see every section. Edit or delete them in the admin.

---

## 2. What the admin panel manages

| Section | What you control |
|---|---|
| **Dashboard** | New leads, leads per day, live listings, setup checklist for integrations |
| **Leads** | Every form submission (site visit, contact, construction quote, sell property, callback, requirement). Status pipeline (New → Contacted → Site visit → Negotiation → Won/Lost), follow-up date, notes, CSV export, UTM/Google Ads/Facebook source. Sell requests can be turned into a draft listing in one click. |
| **Properties** | Sale / rent / lease, type, price (₹ L / Cr formatting), area & unit (sq ft, sq yd, gaj, acre, bigha), BHK, floor, facing, furnishing, possession, city & locality, Google Map, RERA no., cover + photo gallery (drag to reorder), YouTube video, brochure PDF, amenities, featured flag, SEO fields |
| **Projects** | Ongoing / upcoming / completed construction projects with progress %, gallery, brochure, highlights |
| **Services** | Construction, buy, sell, plot development, renovation, legal — each with its own page and enquiry form |
| **Home banners** | Hero slider images, headlines and buttons |
| **Blog, Pages** | Rich-text editor; pages can be linked in the footer (privacy policy, terms, etc.) |
| **Testimonials, FAQs, Team, Partners** | Shown on home, about, construction and sell pages |
| **Media library** | Upload / copy URL / delete images, PDFs and videos; pick from it in any image field |
| **Site settings** | Business details, logo, phone, WhatsApp, address, social links, home page text and stats, about page, construction calculator rates, sell-page steps, cities, property types, budget filters, menu, footer, announcement bar, brand colours |
| **SEO** | Live URL, title template, default meta description, share image, schema.org business type, indexing on/off, robots.txt rules, 301 redirects |
| **Integrations** | Google Search Console, Bing, Yandex, Pinterest verification · Google Analytics 4 · Google Tag Manager · Meta Pixel · Google Ads conversion · Microsoft Clarity · Hotjar · LinkedIn Insight · reCAPTCHA · lead webhook (Zapier / Make / Pabbly / CRM) · custom code in head / body |
| **Email alerts** | SMTP settings, who receives new-lead emails, optional thank-you email to the customer, "send test email" |
| **Users** | Admins (everything) and Editors (content, listings, leads — no settings) |
| **Backup** | Download / restore the full site content |

---

## 3. Connecting Google & Meta (after the site is live)

1. **Admin → SEO** → set *Live website URL* to your domain (e.g. `https://www.avyaadwik.com`).
2. **Google Search Console** → Add property → *URL prefix* → *HTML tag*. Copy the code (or the whole meta tag) into **Admin → Integrations → Google Search Console verification code**, save, then click *Verify* in Search Console. Then submit `https://your-domain/sitemap.xml` under *Sitemaps*.
3. **Google Analytics 4** → Admin → Data streams → copy the `G-XXXXXXX` ID into **Integrations**.
4. **Google Tag Manager** → copy the `GTM-XXXXXXX` ID. If you set up GA4 or the Pixel *inside* GTM, leave those fields empty in the admin so nothing is counted twice.
5. **Meta Pixel** → Events Manager → copy the Pixel ID.
6. **Google Ads** → Goals → Conversions → create a "Submit lead form" conversion → copy the `AW-…` ID and the conversion label.

Events the website sends automatically:

| Event | When | Where |
|---|---|---|
| `page_view` / `PageView` | every page | GA4, GTM, Meta |
| `generate_lead` (with `lead_type`) | after any form is submitted (on `/thank-you`) | GA4, GTM dataLayer, Google Ads conversion |
| `Lead` | after any form is submitted | Meta Pixel |
| `form_start` | first keystroke in a form | GA4, GTM |
| `click_call`, `click_whatsapp`, `click_brochure` | button clicks | GA4, GTM; `Contact` on Meta |

Tip: in Google Ads or Meta you can also use the URL `/thank-you` as a destination-based conversion.

---

## 4. Putting it online

The app is a single Node.js process. Run **one instance only** (content is held in one JSON file).

### Option A — VPS (Hostinger VPS, DigitalOcean, AWS Lightsail…) — recommended

```bash
# on the server (Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs nginx
sudo npm i -g pm2
# upload the project folder, then:
cd avyaadwik && npm install --omit=dev
cp .env.example .env && nano .env        # set SESSION_SECRET, ADMIN_PASSWORD, COOKIE_SECURE=true
pm2 start ecosystem.config.js && pm2 save && pm2 startup
```

Nginx (`/etc/nginx/sites-available/avyaadwik`):

```nginx
server {
  server_name avyaadwik.com www.avyaadwik.com;
  client_max_body_size 30M;
  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
}
```

Then `sudo certbot --nginx -d avyaadwik.com -d www.avyaadwik.com` for free HTTPS.

### Option B — cPanel / Hostinger shared hosting with "Setup Node.js App"

1. Upload the folder (without `node_modules`), create a Node.js app pointing to it, startup file `server.js`, Node 18+.
2. Click *Run NPM Install*, add the `.env` values as environment variables, start the app.

### Option C — Render / Railway

Create a web service from the folder, build `npm install`, start `npm start`, and **attach a persistent disk** mounted at e.g. `/var/data`, then set `DATA_DIR=/var/data/data` and `UPLOAD_DIR=/var/data/uploads` so content and uploads survive redeploys.

### Option D — Vercel + GitHub (how this site is hosted now)

The app detects Vercel automatically: when the `BLOB_READ_WRITE_TOKEN` variable exists (added when a Vercel Blob store is connected to the project), content is saved as encrypted versions in Blob storage and uploads go to Blob as well. Admin logins use signed cookies.

Project environment variables: `SESSION_SECRET`, `DATA_KEY` (encrypts the content — never change it once set), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `COOKIE_SECURE=true`, plus `BLOB_READ_WRITE_TOKEN` from the Blob store.

Every push to the `main` branch on GitHub redeploys the site. Notes for the free Hobby plan: each upload request is limited to about 4.5 MB, and an admin change can take up to a minute to appear on public pages.

---

## 5. Backups

- Automatic: a copy of `data/db.json` every hour in `data/backups/` (last 48 kept).
- Manual: **Admin → Backup → Download backup**.
- Also back up the `uploads/` folder (your photos and PDFs).

## 6. Folder map

```
server.js            website routes, lead capture, sitemap, robots.txt
lib/schema.js        all admin-editable fields (add a field here and it appears in the admin)
lib/admin.js         admin panel routes
lib/seed.js          first-run sample content
lib/leads.js         lead saving, email alerts, webhook, reCAPTCHA
views/site/          website templates
views/admin/         admin templates
public/              CSS, JS, logo
data/                database file + backups (created on first run)
uploads/             uploaded images and files
```
