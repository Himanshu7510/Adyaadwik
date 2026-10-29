const nodemailer = require('nodemailer');
const db = require('./db');

const LEAD_TYPES = {
  enquiry: 'Property enquiry',
  contact: 'Contact form',
  construction: 'Construction quote',
  sell: 'Sell property',
  callback: 'Callback request',
  requirement: 'Buying requirement',
};

async function verifyRecaptcha(token, ip) {
  const s = db.settings();
  if (!s.recaptchaSiteKey || !s.recaptchaSecret) return true;
  if (!token) return false;
  try {
    const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: s.recaptchaSecret, response: token, remoteip: ip || '' }),
    });
    const j = await r.json();
    return !!j.success;
  } catch (e) {
    console.error('reCAPTCHA check failed:', e.message);
    return true; // don't lose leads if Google is unreachable
  }
}

function transporter() {
  const s = db.settings();
  if (!s.smtpHost || !s.smtpUser) return null;
  const port = Number(s.smtpPort) || 465;
  return nodemailer.createTransport({ host: s.smtpHost, port, secure: port === 465, auth: { user: s.smtpUser, pass: s.smtpPass } });
}

async function sendMail(opts) {
  const t = transporter();
  if (!t) return { ok: false, error: 'SMTP is not configured' };
  const s = db.settings();
  try {
    await t.sendMail({ from: s.smtpFrom || s.smtpUser, ...opts });
    return { ok: true };
  } catch (e) {
    console.error('Email failed:', e.message);
    return { ok: false, error: e.message };
  }
}

const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function notify(lead) {
  const s = db.settings();
  const rows = Object.entries(lead)
    .filter(([k, v]) => v && !['id', 'updatedAt', 'status', 'notes'].includes(k))
    .map(([k, v]) => `<tr><td style="padding:6px 12px;color:#7a6650">${esc(k)}</td><td style="padding:6px 12px">${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</td></tr>`).join('');
  if (s.notifyEmails) {
    sendMail({
      to: s.notifyEmails,
      replyTo: lead.email || undefined,
      subject: `New lead: ${LEAD_TYPES[lead.type] || lead.type} — ${lead.name || lead.phone}`,
      html: `<h2 style="font-family:Georgia,serif;color:#2E1C10">New ${esc(LEAD_TYPES[lead.type] || 'lead')}</h2><table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">${rows}</table>`,
    });
  }
  if (s.autoReply && lead.email) {
    sendMail({
      to: lead.email,
      subject: `Thank you for contacting ${s.siteName || 'Avyaadwik'}`,
      html: `<p>Dear ${esc(lead.name || 'there')},</p><p>Thank you for reaching out. A member of our team will call you within one working day.</p><p>Regards,<br>${esc(s.siteName || 'Avyaadwik')}<br>${esc(s.phone || '')}</p>`,
    });
  }
  if (s.leadWebhook) {
    fetch(s.leadWebhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) })
      .catch(e => console.error('Lead webhook failed:', e.message));
  }
}

async function createLead(data) {
  const lead = db.insert('leads', { status: 'New', notes: '', ...data });
  notify(lead).catch(() => {});
  return lead;
}

module.exports = { createLead, verifyRecaptcha, sendMail, LEAD_TYPES };
