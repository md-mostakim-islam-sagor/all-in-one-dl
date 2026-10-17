(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var form = $('form'), input = $('url'), btnClear = $('clear'), btnPaste = $('paste'), btnSubmit = $('submit');
  var statusEl = $('status'), loader = $('loader'), empty = $('empty'), result = $('result'), toastEl = $('toast');
  var busy = false, toastTimer;

  $('year').textContent = new Date().getFullYear();

  function toast(msg) {
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.hidden = true; }, 4000);
  }
  function setStatus(msg, type) {
    if (!msg) { statusEl.hidden = true; return; }
    statusEl.textContent = msg; statusEl.className = 'status ' + type; statusEl.hidden = false;
  }
  function validUrl(v) {
    try { var u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch (e) { return false; }
  }
  function setBusy(b) {
    busy = b; btnSubmit.disabled = b; btnPaste.disabled = b; loader.hidden = !b;
    btnSubmit.querySelector('span').textContent = b ? 'Fetching…' : 'Download';
  }
  function reset() {
    input.value = ''; btnClear.hidden = true; result.hidden = true; empty.hidden = false; setStatus('');
    input.focus();
  }

  input.addEventListener('input', function () { btnClear.hidden = !input.value; });
  btnClear.addEventListener('click', reset);

  btnPaste.addEventListener('click', function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) { toast('Paste is not supported here. Please paste manually.'); input.focus(); return; }
    navigator.clipboard.readText().then(function (t) {
      input.value = (t || '').trim(); btnClear.hidden = !input.value; input.focus();
    }).catch(function () { toast('Clipboard access denied. Please paste manually.'); input.focus(); });
  });

  form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });

  function submit() {
    if (busy) return;
    var url = input.value.trim();
    if (!url) { setStatus('Please paste a video link first.', 'error'); return; }
    if (!validUrl(url)) { setStatus('Enter a valid link starting with http:// or https://', 'error'); return; }
    setStatus(''); result.hidden = true; empty.hidden = true; setBusy(true);

    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, 30000);
    fetch('/api/download', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url }), signal: ctrl.signal
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data; try { data = JSON.parse(txt); } catch (e) { throw new Error('Unexpected server response.'); }
        if (!r.ok) throw new Error(data && data.error ? String(data.error) : 'Request failed.');
        return data;
      });
    }).then(render).catch(function (err) {
      empty.hidden = false;
      setStatus(err.name === 'AbortError' ? 'The request timed out. Please try again.' : (err.message || 'Something went wrong.'), 'error');
    }).then(function () { clearTimeout(t); setBusy(false); });
  }

  function chip(text) { var li = document.createElement('li'); li.textContent = text; return li; }
  function fmtDuration(d) {
    var n = Number(d); if (!isFinite(n) || n <= 0) return '';
    if (n > 100000) n = n / 1000;
    n = Math.round(n); var h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = n % 60;
    var p = function (x) { return x < 10 ? '0' + x : '' + x; };
    return (h ? h + ':' + p(m) : m) + ':' + p(s);
  }
  function fmtSize(b) {
    var n = Number(b); if (!isFinite(n) || n <= 0) return (typeof b === 'string' && b) ? b : '';
    var u = ['B', 'KB', 'MB', 'GB'], i = 0; while (n >= 1024 && i < 3) { n /= 1024; i++; }
    return n.toFixed(i ? 1 : 0) + ' ' + u[i];
  }
  function kind(m) { return m.type === 'audio' ? 'audio' : m.type === 'video' ? 'video' : 'other'; }
  function extOf(m) {
    if (m.extension) return m.extension.replace(/[^a-z0-9]/gi, '').toLowerCase();
    try { var e = new URL(m.url).pathname.split('.').pop(); if (/^[a-z0-9]{2,5}$/i.test(e)) return e.toLowerCase(); } catch (x) {}
    return kind(m) === 'audio' ? 'mp3' : kind(m) === 'video' ? 'mp4' : '';
  }
  function fileName(title, m, idx) {
    var base = (title || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'mostakim-' + (kind(m) === 'other' ? 'file' : kind(m));
    if (m.quality && idx > 0) base += ' ' + m.quality.replace(/[\\/:*?"<>|]/g, '');
    var ext = extOf(m);
    return ext ? base + '.' + ext : base;
  }

  function render(d) {
    $('title').textContent = d.title || 'Untitled media';
    var img = $('thumb'), fb = $('thumbFallback');
    if (d.thumbnail) {
      img.referrerPolicy = 'no-referrer'; img.src = d.thumbnail; img.hidden = false; fb.hidden = true;
      img.onerror = function () { img.hidden = true; fb.hidden = false; };
    } else { img.hidden = true; fb.hidden = false; }

    var info = $('info'); info.textContent = '';
    if (d.author) info.appendChild(chip('By ' + d.author));
    if (d.source) info.appendChild(chip(d.source));
    var dur = fmtDuration(d.duration); if (dur) info.appendChild(chip(dur));

    var groups = { video: $('videos'), audio: $('audios'), other: $('others') };
    Object.keys(groups).forEach(function (k) { groups[k].hidden = true; groups[k].querySelector('ul').textContent = ''; });
    var counts = { video: 0, audio: 0, other: 0 };

    (d.medias || []).forEach(function (m) {
      var k = kind(m), ul = groups[k].querySelector('ul'), idx = counts[k]++;
      var li = document.createElement('li'), opt = document.createElement('div'); opt.className = 'opt';
      var s = document.createElement('strong'); s.textContent = m.quality || (k === 'audio' ? 'Audio' : k === 'video' ? 'Video' : 'File');
      var sm = document.createElement('small');
      sm.textContent = [extOf(m).toUpperCase(), fmtSize(m.size)].filter(Boolean).join(' · ');
      opt.appendChild(s); opt.appendChild(sm);
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn';
      var ic = document.createElement('i'); ic.className = 'fa-solid fa-download';
      b.appendChild(ic); b.appendChild(document.createTextNode(' Download'));
      b.setAttribute('aria-label', 'Download ' + s.textContent + ' ' + k);
      b.addEventListener('click', function () { download(m, fileName(d.title, m, idx), b); });
      li.appendChild(opt); li.appendChild(b); ul.appendChild(li); groups[k].hidden = false;
    });
    result.hidden = false; setStatus('');
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function saveBlob(blob, name) {
    var a = document.createElement('a'), u = URL.createObjectURL(blob);
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }
  function fallback(m, name) {
    var a = document.createElement('a'); a.href = m.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    toast('The source blocks direct downloads, so it opened in a new tab. Use your browser\u2019s Save option if it does not start.');
  }
  function btnState(btn, state) {
    var ic = btn.querySelector('i'), tx = btn.lastChild;
    btn.classList.remove('loading', 'done');
    if (state === 'loading') { btn.classList.add('loading'); ic.className = 'fa-solid fa-circle-notch'; tx.textContent = ' Preparing…'; }
    else if (state === 'done') { btn.classList.add('done'); ic.className = 'fa-solid fa-check'; tx.textContent = ' Started'; }
    else { ic.className = 'fa-solid fa-download'; tx.textContent = ' Download'; }
  }
  function download(m, name, btn) {
    if (btn.disabled) return;
    btn.disabled = true; btnState(btn, 'loading');
    fetch(m.url, { mode: 'cors' }).then(function (r) {
      if (!r.ok) throw new Error('bad status'); return r.blob();
    }).then(function (blob) { saveBlob(blob, name); toast('Download started: ' + name); btnState(btn, 'done'); })
      .catch(function () { fallback(m, name); btnState(btn, 'done'); })
      .then(function () { setTimeout(function () { btnState(btn, 'idle'); btn.disabled = false; }, 2000); });
  }
})();
