(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Rich text editors (Quill)
  $$('[data-rte]').forEach(function (el) {
    var target = document.getElementById(el.dataset.rte);
    if (!window.Quill) { el.remove(); target.hidden = false; target.rows = 10; return; }
    var q = new Quill(el, {
      theme: 'snow',
      modules: { toolbar: [[{ header: [2, 3, false] }], ['bold', 'italic', 'underline', 'link'], [{ list: 'ordered' }, { list: 'bullet' }], ['blockquote', 'image', 'video'], ['clean']] },
    });
    q.on('text-change', function () { target.value = q.root.innerHTML === '<p><br></p>' ? '' : q.root.innerHTML; markDirty(); });
  });

  // Character counters for SEO fields
  $$('[data-count]').forEach(function (el) {
    var max = +el.dataset.count, hint = document.createElement('p');
    hint.className = 'hint';
    el.insertAdjacentElement('afterend', hint);
    var upd = function () { var n = el.value.length; hint.textContent = n + ' / ' + max + ' characters'; hint.classList.toggle('over', n > max); };
    el.addEventListener('input', upd); upd();
  });

  // Auto slug from title (only for new items / empty slug)
  $$('[data-slug-from]').forEach(function (slug) {
    var src = document.getElementById(slug.dataset.slugFrom); if (!src) return;
    var touched = !!slug.value;
    slug.addEventListener('input', function () { touched = true; });
    src.addEventListener('input', function () {
      if (touched) return;
      slug.value = src.value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      slug.dispatchEvent(new Event('change'));
    });
  });

  // Google result preview
  var serp = $('[data-serp]');
  if (serp) {
    var title = $('#f_seoTitle'), desc = $('#f_seoDescription'), main = $('#f_title') || $('#f_name'), slug = $('#f_slug');
    var sum = $('#f_summary') || $('#f_excerpt');
    var upd = function () {
      $('[data-serp-title]', serp).textContent = (title && title.value) || (main && main.value) || '';
      $('[data-serp-desc]', serp).textContent = (desc && desc.value) || (sum && sum.value) || '';
      $('[data-serp-slug]', serp).textContent = (slug && slug.value) || '';
    };
    [title, desc, main, slug, sum].forEach(function (e) { if (e) { e.addEventListener('input', upd); e.addEventListener('change', upd); } });
  }

  // Image field: preview + clear
  $$('[data-preview]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      var f = inp.files[0]; if (!f) return;
      var prev = inp.closest('.imgfield').querySelector('.imgprev');
      if (prev) prev.innerHTML = '<img src="' + URL.createObjectURL(f) + '" alt="">';
      inp.closest('label').lastChild.textContent = f.name.length > 22 ? f.name.slice(0, 20) + '…' : f.name;
    });
  });
  $$('[data-clear]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.getElementById(b.dataset.clear).value = '';
      var prev = b.closest('.imgfield').querySelector('.imgprev'); if (prev) prev.innerHTML = '';
      markDirty();
    });
  });

  // Media picker
  var picker = $('#picker');
  $$('[data-pick]').forEach(function (b) {
    b.addEventListener('click', function () {
      $('[data-picker-frame]', picker).src = '/admin/media?pick=' + encodeURIComponent(b.dataset.pick);
      picker.showModal();
    });
  });
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || !e.data.pick) return;
    var inp = document.getElementById(e.data.pick);
    if (inp) {
      inp.value = e.data.url;
      var prev = inp.closest('.imgfield') && inp.closest('.imgfield').querySelector('.imgprev');
      if (prev) prev.innerHTML = '<img src="' + e.data.url + '" alt="">';
      markDirty();
    }
    if (picker) picker.close();
  });

  // Gallery: remove, add URL, drag to reorder, show pending uploads
  $$('[data-gal]').forEach(function (g) {
    var grid = $('.gal-grid', g), val = $('[data-gal-value]', g);
    var sync = function () { val.value = $$('figure', grid).map(function (f) { return f.dataset.url; }).join('\n'); markDirty(); };
    var add = function (url) {
      var fig = document.createElement('figure'); fig.dataset.url = url; fig.draggable = true;
      fig.innerHTML = '<img src="' + url + '" alt=""><button type="button" aria-label="Remove" data-gal-rm>×</button>';
      grid.appendChild(fig); sync();
    };
    grid.addEventListener('click', function (e) { if (e.target.matches('[data-gal-rm]')) { e.target.closest('figure').remove(); sync(); } });
    $('[data-gal-url]', g).addEventListener('click', function () { var u = prompt('Image URL'); if (u) add(u.trim()); });
    $('[data-gal-files]', g).addEventListener('change', function (e) {
      $('[data-gal-pending]', g).textContent = e.target.files.length ? e.target.files.length + ' photo(s) will be added when you save' : '';
    });
    var drag;
    $$('figure', grid).forEach(function (f) { f.draggable = true; });
    grid.addEventListener('dragstart', function (e) { drag = e.target.closest('figure'); if (drag) drag.classList.add('dragging'); });
    grid.addEventListener('dragend', function () { if (drag) drag.classList.remove('dragging'); drag = null; sync(); });
    grid.addEventListener('dragover', function (e) {
      e.preventDefault(); var over = e.target.closest('figure');
      if (drag && over && over !== drag) { var r = over.getBoundingClientRect(); grid.insertBefore(drag, e.clientX > r.left + r.width / 2 ? over.nextSibling : over); }
    });
  });

  // Copy URL
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = location.origin + b.dataset.copy;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () {
        var t = b.innerHTML; b.textContent = 'Copied'; setTimeout(function () { b.innerHTML = t; }, 1400);
      }).catch(function () { prompt('Copy this URL', url); });
    });
  });

  // Unsaved changes warning
  var dirty = false;
  function markDirty() { dirty = true; }
  $$('form[data-dirty]').forEach(function (f) {
    f.addEventListener('input', markDirty);
    f.addEventListener('change', markDirty);
    f.addEventListener('submit', function () { dirty = false; });
  });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
