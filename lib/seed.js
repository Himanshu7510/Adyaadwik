// First-run content so the site looks complete. Everything here is editable in the admin.
const bcrypt = require('bcryptjs');
const db = require('./db');
const { slugify } = require('./helpers');
const { PROPERTY_TYPES } = require('./schema');

const U = (id, w = 1600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;
const IMG = {
  villa: U('photo-1600596542815-ffad4c1539a9'),
  modern: U('photo-1600585154340-be6161a56a0c'),
  luxury: U('photo-1512917774080-9991f1c4c750'),
  tower: U('photo-1545324418-cc1a3fa10c00'),
  interior: U('photo-1560448204-e02f11c3d0e2'),
  living: U('photo-1502672260266-1c1ef2d93688'),
  living2: U('photo-1600607687939-ce8a6c25118c'),
  blueprint: U('photo-1503387762-592deb58ef4e'),
  crane: U('photo-1541888946425-d81bb19240f5'),
  workers: U('photo-1504307651254-35680f356dfd'),
  highrise: U('photo-1486406146926-c627a92ad1ab'),
  land: U('photo-1500382017468-9049fed747ef'),
  house: U('photo-1564013799919-ab600027ffc6'),
  house2: U('photo-1580587771525-78b9dba3b914'),
  house3: U('photo-1568605114967-8130f3a36994'),
  apts: U('photo-1460317442991-0ec209397118'),
  office: U('photo-1497366216548-37526070297c'),
};

const settings = {
  siteName: 'Avyaadwik',
  tagline: 'Build. Buy. Belong.',
  phone: '+91 99999 99999',
  phone2: '',
  whatsapp: '919999999999',
  email: 'info@avyaadwik.com',
  address: 'Office address, Sector —, New Delhi 110001',
  hours: 'Mon–Sat, 10:00 am – 7:00 pm',
  mapEmbed: '',
  reraAgentNo: '',
  facebook: '', instagram: '', youtube: '', linkedin: '', twitter: '', threads: '', pinterest: '', telegram: '', whatsappChannel: '', googleBusiness: '',
  socialHeader: true, socialFooter: true, socialContact: true, shareButtons: true,

  heroKicker: 'Construction · Flats · Plots',
  heroHeading: 'From the first brick to the final registry.',
  heroText: 'Avyaadwik builds homes, sells verified flats and plots, and buys property directly from owners across Delhi NCR — one accountable team for every step.',
  heroImage: IMG.villa,
  stats: '18+ | Years in construction\n1,200+ | Families housed\n45 | Projects delivered\n₹0 | Hidden charges',
  aboutHeading: 'A builder and a broker, under one roof',
  aboutText: '<p>Most families deal with a contractor to build, a broker to sell, and a lawyer to check papers — and nobody owns the outcome. Avyaadwik was set up to change that.</p><p>Our engineers build to an agreed drawing and bill of quantities. Our sales desk lists only properties whose title we have checked. And when you want to sell, we can buy the property ourselves or market it for you.</p>',
  aboutImage: IMG.blueprint,
  whyUs: 'Title-checked listings | Every flat and plot we list has its chain of documents reviewed before it goes live.\nFixed-price construction | A signed BOQ and stage-wise payments. No surprise bills halfway through the slab.\nDirect purchase from owners | Need to sell fast? We make a written offer within 72 hours of a site visit.\nLoan and registry support | Tie-ups with major banks, plus help with stamp duty, mutation and registry.',
  process: 'Site visit & soil check | We inspect the plot, check bylaws and note setbacks.\nDesign & approvals | Architectural and structural drawings, then sanction from the authority.\nFixed quote | Itemised BOQ with brand-wise materials and a stage-wise payment plan.\nBuild | Weekly photo updates, third-party cube tests and a site engineer on every slab.\nHandover | Snag list closed, completion documents and a one-year structural warranty.',
  ctaHeading: 'Planning to build, buy or sell?',
  ctaText: 'Tell us what you have in mind. A property advisor will call you back within one working day.',
  showProjects: true, showTestimonials: true, showBlog: true, showPartners: true,

  aboutPageHeading: 'About Avyaadwik',
  aboutPageBanner: IMG.highrise,
  aboutPageBody: '<p>Avyaadwik began as a civil construction firm building independent houses and builder floors across Delhi NCR. Over the years, the families we built for kept asking the same question: can you help us buy, or sell, the next one?</p><p>Today we run three desks that work together — <strong>construction</strong>, <strong>sales</strong> and <strong>acquisitions</strong>. That means the people who list a flat understand how it was built, and the people who build a house know what it will be worth.</p><h3>How we work</h3><ul><li>Written quotes and agreements, always.</li><li>No listing goes live without a document check.</li><li>Stage-wise construction payments linked to photo-verified progress.</li></ul>',
  mission: 'To make building, buying and selling property in India transparent, documented and fair for every family we work with.',
  vision: 'To be the most trusted single-window property company in North India.',
  values: 'Integrity | We put every promise in writing.\nCraft | Good concrete, straight walls, clean finishes.\nClarity | Plain-language contracts and honest timelines.',

  constructionHeading: 'House construction at a fixed, itemised price',
  constructionIntro: 'Turnkey construction of independent houses, villas and builder floors. One contract covers drawings, approvals, structure, finishing and handover.',
  constructionImage: IMG.workers,
  constructionRates: 'Standard | 1850 | ISI-marked steel and cement, vitrified tiles, standard CP fittings, flush doors\nPremium | 2350 | Fe 550D steel, large-format tiles, Jaquar or equivalent fittings, UPVC windows, false ceiling\nLuxury | 3100 | Italian marble, imported fittings, home automation, designer façade, modular kitchen',
  sellHeading: 'Sell your property to us — or through us',
  sellIntro: 'Share a few details about your flat, house, plot or shop. We will visit, check the documents and give you a written offer, or list it for you with professional photos.',
  sellImage: IMG.house2,
  sellSteps: 'Share details | Fill the form below with photos if you have them.\nSite visit | We inspect the property and review the documents.\nWritten offer | You receive a written purchase offer or a marketing plan within 72 hours.\nClose | Agreement, payment and registry — handled by our legal desk.',
  cities: 'New Delhi\nNoida\nGreater Noida\nGurugram\nGhaziabad\nFaridabad',
  propertyTypes: PROPERTY_TYPES.join('\n'),
  budgets: '0 | 2500000 | Under ₹25 L\n2500000 | 5000000 | ₹25 L – ₹50 L\n5000000 | 10000000 | ₹50 L – ₹1 Cr\n10000000 | 20000000 | ₹1 Cr – ₹2 Cr\n20000000 | | Above ₹2 Cr',
  perPage: 9,
  currencyFormat: 'indian',

  menu: 'Buy | /properties?purpose=Sale\nRent | /properties?purpose=Rent\nSell to us | /sell-property\nConstruction | /construction\nProjects | /projects\nAbout | /about\nContact | /contact',
  headerCta: 'Free consultation | /contact',
  footerAbout: 'Avyaadwik is a construction and real-estate company building homes, selling verified flats and plots, and buying property directly from owners.',
  footerLinks: 'Flats for sale | /properties?type=Flat+%2F+Apartment\nPlots for sale | /properties?type=Residential+Plot\nHouse construction | /construction\nSell your property | /sell-property\nBlog | /blog\nFAQs | /faqs',
  copyright: '© {year} Avyaadwik. All rights reserved.',
  disclaimer: 'Images are for representation only. Prices, availability and specifications are subject to change. Please verify all details and documents before any transaction.',
  announcement: '',
  announcementLink: '',

  siteUrl: '',
  titleTemplate: '%s | Avyaadwik',
  defaultTitle: 'Avyaadwik — Construction, Flats & Plots in Delhi NCR',
  defaultDescription: 'Avyaadwik builds homes, sells title-verified flats and plots, and buys property directly from owners in Delhi NCR. Get a free construction quote or property valuation.',
  keywords: 'real estate Delhi NCR, house construction, flats for sale, plots for sale, sell property, builder floor',
  ogImage: '',
  businessType: 'RealEstateAgent',
  allowIndexing: true,
  robotsExtra: '',
  redirects: '',

  gscVerification: '', bingVerification: '', yandexVerification: '', pinterestVerification: '',
  ga4Id: '', gtmId: '', clarityId: '', hotjarId: '',
  metaPixelId: '', googleAdsId: '', googleAdsLeadLabel: '', linkedinPartnerId: '',
  recaptchaSiteKey: '', recaptchaSecret: '', leadWebhook: '',
  customHead: '', customBodyStart: '', customBodyEnd: '',

  notifyEmails: '', smtpHost: '', smtpPort: 465, smtpUser: '', smtpPass: '', smtpFrom: '', autoReply: false,

  colorGold: '#A9802F', colorInk: '#2E1C10', colorPaper: '#FFFFFF', colorStone: '#F3EDE3',
};

const properties = [
  { title: '3 BHK Apartment with Park View', purpose: 'Sale', type: 'Flat / Apartment', status: 'Available', possession: 'Ready to move', price: 14500000, area: 1650, areaUnit: 'sq ft', bedrooms: 3, bathrooms: 3, parking: '1 covered', floor: '7th of 14', facing: 'East', furnishing: 'Semi-furnished', city: 'Noida', locality: 'Sector 137', cover: IMG.tower, gallery: [IMG.living, IMG.interior, IMG.living2], amenities: 'Lift, Power backup, Club house, Gym, Swimming pool, 24×7 security, Kids play area', summary: 'East-facing 3 BHK overlooking the central park, a short walk from the Sector 137 metro station.', featured: true },
  { title: '200 sq yd Residential Plot in Gated Society', purpose: 'Sale', type: 'Residential Plot', status: 'Available', possession: 'Not applicable', price: 9800000, area: 200, areaUnit: 'sq yd', facing: 'North', city: 'Greater Noida', locality: 'Omega II', cover: IMG.land, gallery: [IMG.land], amenities: 'Gated entry, Wide internal roads, Park facing, Registry ready', summary: 'Freehold north-facing plot on a 12 m road, registry ready with clear title.', featured: true },
  { title: '4 BHK Independent Villa with Terrace Garden', purpose: 'Sale', type: 'Independent House / Villa', status: 'Available', possession: 'Ready to move', price: 32500000, area: 3200, areaUnit: 'sq ft', bedrooms: 4, bathrooms: 5, parking: '2 covered', facing: 'North-East', furnishing: 'Fully furnished', city: 'Gurugram', locality: 'Sector 57', cover: IMG.villa, gallery: [IMG.modern, IMG.living2, IMG.interior], amenities: 'Terrace garden, Modular kitchen, Servant room, Solar panels, Rainwater harvesting', summary: 'A villa we built in 2023 — corner plot, double-height living room and a landscaped terrace.', featured: true },
  { title: 'Stilt + 4 Builder Floor, 3 BHK', purpose: 'Sale', type: 'Builder Floor', status: 'Available', possession: 'Under construction', price: 21000000, area: 1800, areaUnit: 'sq ft', bedrooms: 3, bathrooms: 3, parking: 'Stilt parking', floor: '2nd', facing: 'East', furnishing: 'Unfurnished', city: 'New Delhi', locality: 'Saket', cover: IMG.house, gallery: [IMG.house2, IMG.living], amenities: 'Lift, Italian marble, Modular kitchen, Stilt parking', summary: 'Our own construction — RCC frame, lift, Italian marble. Possession in 8 months.', featured: true },
  { title: '2 BHK Flat Near Metro', purpose: 'Rent', type: 'Flat / Apartment', status: 'Available', possession: 'Ready to move', price: 28000, priceLabel: '₹28,000 / month', area: 1050, areaUnit: 'sq ft', bedrooms: 2, bathrooms: 2, parking: '1 open', floor: '3rd of 10', facing: 'West', furnishing: 'Semi-furnished', city: 'Ghaziabad', locality: 'Indirapuram', cover: IMG.apts, gallery: [IMG.interior], amenities: 'Lift, Power backup, Security', summary: 'Well-kept 2 BHK, five minutes from Vaishali metro station.', featured: true },
  { title: 'Ground Floor Retail Shop on Main Road', purpose: 'Sale', type: 'Commercial Shop', status: 'Available', possession: 'Ready to move', price: 7500000, area: 420, areaUnit: 'sq ft', city: 'Faridabad', locality: 'Sector 15', cover: IMG.office, gallery: [], amenities: 'Main road frontage, Power backup, Parking', summary: 'Main-road shop with 18 ft frontage in an established market.', featured: true },
  { title: '1 Acre Farm Land with Boundary', purpose: 'Sale', type: 'Farm House / Land', status: 'Available', possession: 'Not applicable', price: 18000000, area: 1, areaUnit: 'acre', city: 'Gurugram', locality: 'Sohna Road', cover: IMG.land, gallery: [], amenities: 'Boundary wall, Borewell, Approach road', summary: 'Walled farm land with borewell and an approach road, suitable for a farmhouse.' },
  { title: '3 BHK House with Basement', purpose: 'Sale', type: 'Independent House / Villa', status: 'Sold', possession: 'Ready to move', price: 26000000, area: 2400, areaUnit: 'sq ft', bedrooms: 3, bathrooms: 4, city: 'Noida', locality: 'Sector 50', cover: IMG.house3, gallery: [], amenities: 'Basement, Lawn, Modular kitchen', summary: 'Sold — a family home with basement and front lawn.' },
];

const projects = [
  { title: 'Avyaadwik Residency', stage: 'Ongoing', category: 'Residential', location: 'Sector 137, Noida', year: '2026', builtUpArea: '1,40,000 sq ft', units: '112 flats, G+14', progress: 62, cover: IMG.crane, gallery: [IMG.crane, IMG.workers], summary: '2 and 3 BHK homes with a central park, club house and EV charging in every basement.', highlights: 'Earthquake-resistant RCC frame, 70% open area, EV charging, IGBC pre-certified', featured: true },
  { title: 'Saket Builder Floors', stage: 'Ongoing', category: 'Turnkey construction', location: 'Saket, New Delhi', year: '2026', builtUpArea: '7,200 sq ft', units: 'Stilt + 4', progress: 40, cover: IMG.house, gallery: [IMG.house], summary: 'Turnkey construction of stilt-plus-four builder floors for a private plot owner.', highlights: 'Lift, Italian marble, Fire NOC, Completion certificate', featured: true },
  { title: 'Green Meadows Villas', stage: 'Completed', category: 'Residential', location: 'Sector 57, Gurugram', year: '2023', builtUpArea: '48,000 sq ft', units: '14 villas', progress: 100, cover: IMG.villa, gallery: [IMG.villa, IMG.modern], summary: 'Fourteen independent villas, each with a terrace garden and solar rooftop.', highlights: 'Solar rooftop, Rainwater harvesting, Handed over on schedule', featured: true },
  { title: 'Omega Enclave Plots', stage: 'Upcoming', category: 'Township / Plots', location: 'Omega II, Greater Noida', year: '2027', builtUpArea: '6 acres', units: '84 plots', progress: 0, cover: IMG.land, gallery: [], summary: 'Gated plotted development with 12 m roads, underground cabling and a community park.', highlights: 'Freehold plots, Underground cabling, Gated community' },
];

const services = [
  { title: 'House Construction', icon: 'crane', order: 1, ctaType: 'construction', cover: IMG.workers, summary: 'Turnkey construction of independent houses, villas and builder floors at a fixed per-sq-ft rate.', points: 'Architectural & structural drawings, Sanction from authority, Itemised BOQ, Branded materials, Weekly photo updates, 1-year structural warranty', description: '<p>We take your plot from bare land to a finished home. One contract covers design, approvals, structure, finishing and handover, with payments linked to construction stages.</p>' },
  { title: 'Buy a Flat or Plot', icon: 'key', order: 2, ctaType: 'enquiry', cover: IMG.tower, summary: 'Title-checked flats, plots, villas and builder floors across Delhi NCR.', points: 'Document verification, Site visits, Price negotiation, Home loan assistance, Registry support', description: '<p>Every listing on Avyaadwik is reviewed by our documentation team before it goes live. We arrange site visits, negotiate on your behalf and help you through the loan and registry.</p>' },
  { title: 'Sell Your Property', icon: 'handshake', order: 3, ctaType: 'sell', cover: IMG.house2, summary: 'Sell to us directly, or let us market your property to verified buyers.', points: 'Free valuation, Written offer in 72 hours, Professional photos, Buyer screening, Paperwork handled', description: '<p>Two ways to sell: we can buy your flat, house or plot ourselves with a written offer within 72 hours of a site visit, or we list and market it to our buyer network.</p>' },
  { title: 'Plot Development', icon: 'plot', order: 4, ctaType: 'enquiry', cover: IMG.land, summary: 'Land aggregation, layout planning and development of gated plotted colonies.', points: 'Land due diligence, Layout approval, Roads & drainage, Boundary & gate, Plot registry', description: '<p>For landowners and investors, we plan and develop plotted colonies — from layout approval to roads, drainage, electrification and registry of individual plots.</p>' },
  { title: 'Renovation & Interiors', icon: 'paint', order: 5, ctaType: 'construction', cover: IMG.living2, summary: 'Kitchen, bathroom and full-home renovation with modular interiors.', points: 'Modular kitchen, Bathroom remodelling, False ceiling, Flooring, Painting & waterproofing', description: '<p>Upgrade the home you already own. Our interior team handles design, 3D views and execution with a fixed timeline.</p>' },
  { title: 'Legal & Loan Assistance', icon: 'scale', order: 6, ctaType: 'enquiry', cover: IMG.office, summary: 'Title search, agreements, home loans, stamp duty and registry support.', points: 'Title search report, Sale agreement drafting, Home loan tie-ups, Stamp duty calculation, Mutation', description: '<p>Property paperwork is where most deals go wrong. Our legal desk checks the chain of title and handles agreements, loans and registry for you.</p>' },
];

const posts = [
  { title: 'Construction cost per sq ft in Delhi NCR: what goes into the number', category: 'Construction', date: '2026-09-18', author: 'Avyaadwik team', cover: IMG.blueprint, excerpt: 'A plain breakdown of structure, finishing and approval costs so you can compare contractor quotes line by line.', body: '<p>When two contractors quote ₹1,900 and ₹2,400 per sq ft, they are rarely quoting the same house. The difference usually sits in three places: the grade of steel and cement, the finishing specification, and what is left out of the quote.</p><h3>Structure</h3><p>Foundation, columns, beams and slabs typically account for 40–45% of the total cost. Ask for the steel brand and grade (Fe 500D or Fe 550D) in writing.</p><h3>Finishing</h3><p>Flooring, sanitary ware, electrical and woodwork make up most of the remaining cost and vary the most. Insist on a brand-wise BOQ.</p><h3>Approvals</h3><p>Sanction fees, architect fees and utility connections are often missing from cheaper quotes.</p>' },
  { title: '7 documents to check before you buy a plot', category: 'Buying', date: '2026-08-30', author: 'Avyaadwik legal desk', cover: IMG.land, excerpt: 'Title deed, mutation, encumbrance certificate and four more papers that protect you from a bad plot purchase.', body: '<p>A plot is only as good as its papers. Before paying a token amount, ask for these documents:</p><ol><li>Sale deed / title deed with the full chain</li><li>Mutation (dakhil kharij) in the seller\'s name</li><li>Encumbrance certificate for at least 13 years</li><li>Approved layout plan</li><li>Land use / conversion certificate</li><li>Latest property tax receipts</li><li>No-objection certificate from the society or authority, if applicable</li></ol>' },
  { title: 'Selling your flat directly to a company vs listing it', category: 'Selling', date: '2026-07-12', author: 'Avyaadwik team', cover: IMG.house2, excerpt: 'When a quick direct sale makes sense, and when you are better off waiting for the open market.', body: '<p>A direct sale gets you certainty and speed — usually a closing within 30 days. Listing on the open market can get a higher price but takes longer and involves more visits. If you have a deadline, such as a new purchase or a relocation, a direct offer is often the better choice.</p>' },
];

const testimonials = [
  { name: 'Rajesh Malhotra', role: 'Built a 3-storey house in Saket', rating: 5, quote: 'They shared photos every Saturday and the final bill matched the quote to the rupee. That has never happened to me with a contractor before.' },
  { name: 'Priya & Ankit Sharma', role: 'Bought a 3 BHK in Noida', rating: 5, quote: 'The team pointed out a pending NOC on another flat we liked. We bought this one instead and the registry was done in two weeks.' },
  { name: 'Col. S. K. Verma (Retd.)', role: 'Sold a plot in Greater Noida', rating: 5, quote: 'I needed to sell quickly. Avyaadwik made a written offer after one visit and the payment came through on the agreed date.' },
];

const faqs = [
  { question: 'Do you only work in Delhi NCR?', answer: 'Our construction and sales teams currently cover New Delhi, Noida, Greater Noida, Gurugram, Ghaziabad and Faridabad. For other cities, contact us and we will tell you honestly whether we can help.', category: 'General', order: 1 },
  { question: 'How is your construction rate calculated?', answer: 'We quote a per-sq-ft rate based on the specification you choose, backed by an itemised bill of quantities. Approvals, architect fees and utility connections are listed separately so nothing is hidden.', category: 'Construction', order: 2 },
  { question: 'How are construction payments made?', answer: 'Payments are linked to stages — foundation, each slab, brickwork, plaster, finishing and handover. You pay for a stage only after it is photo-verified.', category: 'Construction', order: 3 },
  { question: 'Can you buy my property directly?', answer: 'Yes. After a site visit and document check we make a written offer within 72 hours. If you accept, we can usually close within 30 days.', category: 'Selling', order: 4 },
  { question: 'Do you charge buyers brokerage?', answer: 'Brokerage depends on the listing and is always disclosed before a site visit. Properties we build ourselves are sold without brokerage.', category: 'Buying', order: 5 },
  { question: 'Do you help with home loans?', answer: 'We work with major banks and housing finance companies and can help you compare offers and complete the paperwork.', category: 'Loans & legal', order: 6 },
];

const slides = [
  { heading: 'From the first brick to the final registry.', subheading: 'Construction, verified flats and plots, and direct property purchase across Delhi NCR.', image: IMG.villa, buttonText: 'Explore properties', buttonLink: '/properties', order: 1 },
  { heading: 'Build your home at a fixed price.', subheading: 'Itemised BOQ, stage-wise payments and weekly photo updates from your site.', image: IMG.crane, buttonText: 'Get a construction quote', buttonLink: '/construction', order: 2 },
  { heading: 'Selling? Get a written offer in 72 hours.', subheading: 'We buy flats, houses and plots directly from owners.', image: IMG.house2, buttonText: 'Sell your property', buttonLink: '/sell-property', order: 3 },
];

const team = [
  { name: 'Founder Name', designation: 'Founder & Managing Director', bio: 'Civil engineer with nearly two decades of residential construction experience.', order: 1 },
  { name: 'Sales Head', designation: 'Head of Sales', bio: 'Leads the buying and selling desk across Delhi NCR.', order: 2 },
  { name: 'Project Manager', designation: 'Head of Construction', bio: 'Oversees site engineers, quality checks and handovers.', order: 3 },
];

const partners = ['SBI Home Loans', 'HDFC Bank', 'ICICI Bank', 'LIC Housing Finance', 'Axis Bank', 'Bank of Baroda'].map((name, i) => ({ name, order: i + 1 }));

const pages = [
  { title: 'Privacy Policy', showInFooter: true, body: '<p>This policy explains how Avyaadwik collects and uses information you share through this website.</p><h3>What we collect</h3><p>Name, phone number, email and the details you enter in enquiry forms. We also use cookies and analytics tools (such as Google Analytics and Meta Pixel) to understand how the site is used.</p><h3>How we use it</h3><p>To respond to your enquiry, share property or construction information you asked for, and improve our services. We do not sell your data.</p><h3>Contact</h3><p>Write to us at the email address listed on the Contact page to access or delete your information.</p>' },
  { title: 'Terms of Use', showInFooter: true, body: '<p>Information on this website is provided for general guidance. Property details, prices and availability may change without notice. Please verify all details and documents independently before entering into any transaction.</p>' },
];

async function seed() {
  const state = db.raw();
  if (state.seeded) return false;
  await db.batch(() => fill(state));
  return true;
}

function fill(state) {
  db.setSettings(settings);
  const add = (name, rows, slugKey = 'title') => rows.forEach(r => db.insert(name, { published: true, ...r, ...(slugKey ? { slug: slugify(r[slugKey]) } : {}) }));
  add('properties', properties);
  add('projects', projects);
  add('services', services);
  add('posts', posts);
  add('pages', pages);
  add('slides', slides, null);
  add('testimonials', testimonials, null);
  add('faqs', faqs, null);
  add('team', team, null);
  add('partners', partners, null);
  const email = process.env.ADMIN_EMAIL || 'admin@avyaadwik.com';
  const password = process.env.ADMIN_PASSWORD || 'Avyaadwik@2026';
  db.insert('users', { name: 'Administrator', email, role: 'admin', passwordHash: bcrypt.hashSync(password, 10) });
  state.seeded = true;
  console.log(`\n  Seeded demo content. Admin login: ${email}\n  Change the password right after your first login.\n`);
}

module.exports = { seed };
