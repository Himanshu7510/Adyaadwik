(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // mobile menu
  var toggle = $('.nav-toggle'), nav = $('#mainNav');
  function setNav(open) {
    if (!toggle || !nav) return;
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () { setNav(!nav.classList.contains('is-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setNav(false); });
    window.addEventListener('resize', function () { if (window.innerWidth > 1020) setNav(false); });
  }

  // bottom bar "Enquire": jump to the form on this page, or go to the contact page
  $$('[data-enquire]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var t = $(a.dataset.enquire) || $('.lead-form');
      if (!t) return;
      e.preventDefault();
      var y = t.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
      var f = t.querySelector('input[name=name]') || (t.matches('.lead-form') && t.querySelector('input[name=name]'));
      if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 600);
    });
  });

  // swipeable gallery counter (phones)
  var gg = $('.gallery-grid'), gc = $('[data-gallery-count]');
  if (gg && gc) gg.addEventListener('scroll', function () {
    var n = gg.children.length, i = Math.round(gg.scrollLeft / gg.clientWidth) + 1;
    gc.textContent = Math.min(i, n) + ' / ' + n;
  }, { passive: true });

  // hero slider
  var slides = $$('.hero-slide'), copies = $$('[data-slide-copy]'), dots = $$('[data-dot]'), cur = 0, timer;
  function show(i) {
    cur = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) { s.classList.toggle('is-active', k === cur); });
    copies.forEach(function (s, k) { s.classList.toggle('is-active', k === cur); });
    dots.forEach(function (d, k) { d.setAttribute('aria-selected', k === cur); });
  }
  if (slides.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var start = function () { clearInterval(timer); timer = setInterval(function () { show(cur + 1); }, 6500); };
    dots.forEach(function (d) { d.addEventListener('click', function () { show(+d.dataset.dot); start(); }); });
    start();
  } else dots.forEach(function (d) { d.addEventListener('click', function () { show(+d.dataset.dot); }); });

  // finder tabs
  $$('[data-tabs]').forEach(function (box) {
    var tabs = $$('[data-tab]', box);
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.setAttribute('aria-selected', x === t); });
        $$('[data-panel]', box).forEach(function (p) { p.hidden = p.dataset.panel !== t.dataset.tab; });
      });
    });
  });

  // generic toggle (mobile filters)
  $$('[data-toggle]').forEach(function (b) {
    b.addEventListener('click', function () { var t = $(b.dataset.toggle); if (t) t.classList.toggle('is-open'); });
  });
  $$('[data-scroll]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); var t = $(a.dataset.scroll); if (t) t.scrollIntoView({ behavior: 'smooth' }); var f = t && t.querySelector('input[name=name]'); if (f) setTimeout(function () { f.focus(); }, 500); });
  });

  // gallery lightbox
  $$('[data-gallery]').forEach(function (g) {
    var dlg = $('[data-lightbox]', g); if (!dlg) return;
    var imgs = JSON.parse($('[data-images]', g).textContent), img = $('[data-lb-img]', dlg), i = 0;
    function go(n) { i = (n + imgs.length) % imgs.length; img.src = imgs[i]; }
    $$('[data-open]', g).forEach(function (b) { b.addEventListener('click', function () { go(+b.dataset.open); dlg.showModal(); }); });
    $('[data-close]', dlg).addEventListener('click', function () { dlg.close(); });
    $('[data-prev]', dlg).addEventListener('click', function () { go(i - 1); });
    $('[data-next]', dlg).addEventListener('click', function () { go(i + 1); });
    dlg.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') go(i - 1); if (e.key === 'ArrowRight') go(i + 1); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  });

  // construction cost calculator
  var calc = $('[data-calc]');
  if (calc) {
    var fmt = function (v) {
      if (v >= 1e7) return '₹' + (v / 1e7).toFixed(2) + ' Cr';
      if (v >= 1e5) return '₹' + (v / 1e5).toFixed(1) + ' L';
      return '₹' + Math.round(v).toLocaleString('en-IN');
    };
    var run = function () {
      var plot = +$('[data-plot]', calc).value || 0, unit = +$('[data-unit]', calc).value || 1;
      var floors = +$('[data-floors]', calc).value || 1, cover = +$('[data-cover]', calc).value || .75;
      var rate = +(($('input[name=pkg]:checked', calc) || {}).value || 0);
      var area = plot * unit * cover * floors;
      $('[data-out-area]').textContent = Math.round(area).toLocaleString('en-IN') + ' sq ft';
      $('[data-out-total]').textContent = area && rate ? fmt(area * rate) : '—';
    };
    calc.addEventListener('input', run); calc.addEventListener('change', run); run();
  }

  // copy link button
  $$('[data-copy-link]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = b.dataset.copyLink;
      var done = function () { b.classList.add('is-copied'); setTimeout(function () { b.classList.remove('is-copied'); }, 1500); };
      if (navigator.share && matchMedia('(pointer: coarse)').matches) { navigator.share({ url: url, title: document.title }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { prompt('Copy this link', url); });
      else prompt('Copy this link', url);
    });
  });

  // analytics helper
  function track(name, params) {
    params = params || {};
    window.dataLayer.push(Object.assign({ event: name }, params));
    if (window.gtag) gtag('event', name, params);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-track]'); if (!a) return;
    var kind = a.dataset.track;
    track(kind === 'call' ? 'click_call' : kind === 'whatsapp' ? 'click_whatsapp' : 'click_' + kind, { link_url: a.href });
    if (window.fbq && (kind === 'call' || kind === 'whatsapp')) fbq('track', 'Contact', { method: kind });
  });

  // lead forms: submit via fetch, then go to /thank-you (which fires conversion events)
  $$('[data-lead-form]').forEach(function (f) {
    var started = false;
    f.addEventListener('input', function () { if (!started) { started = true; track('form_start', { form_type: f.elements.type.value }); } });
    f.addEventListener('submit', function (e) {
      if (!window.fetch || !window.FormData) return;
      e.preventDefault();
      var err = $('.form-error', f);
      err.hidden = true;
      f.classList.add('is-sending');
      fetch(f.action, { method: 'POST', body: f.enctype === 'multipart/form-data' ? new FormData(f) : new URLSearchParams(new FormData(f)), headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.ok) { location.href = j.redirect || '/thank-you'; return; }
          err.textContent = j.error || 'Something went wrong. Please call us.'; err.hidden = false;
          if (window.grecaptcha) try { grecaptcha.reset(); } catch (x) {}
        })
        .catch(function () { err.textContent = 'Could not send. Check your connection and try again.'; err.hidden = false; })
        .finally(function () { f.classList.remove('is-sending'); });
    });
  });
})();
