/* SkyLens Việt Nam — lapisan bahasa (VI default, EN, ID asli).
   Teks sumber SkyLens 2.0 berbahasa Indonesia tetap di kode; lapisan ini menerjemahkan teks yang TAMPIL di layar
   (node teks, placeholder/title/aria-label, alert/confirm, judul halaman, teks di kanvas laporan) memakai kamus
   I18N_DICT {vi:{asli:terjemahan}, en:{...}}. Nilai data & logika (kode status, kunci) tidak disentuh.
   Ganti bahasa: I18N.set('en') -> disimpan, halaman dimuat ulang. */
(function(){
  'use strict';
  var KEY = 'slvn_lang', lang = 'vi', sudahPilih = false;
  try{ var q = new URLSearchParams(location.search).get('lang'); if(q) localStorage.setItem(KEY, q); var sv = localStorage.getItem(KEY); sudahPilih = !!sv; lang = sv || 'vi'; }catch(e){ sudahPilih = true; }
  if(['vi','en','id'].indexOf(lang) < 0) lang = 'vi';
  window.VN_LANG = lang;
  var DICT = (window.I18N_DICT && window.I18N_DICT[lang]) || {};
  var BUL = {vi: ['Th1','Th2','Th3','Th4','Th5','Th6','Th7','Th8','Th9','Th10','Th11','Th12'], en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']};
  var HAR = {vi: ['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'], en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']};
  var TPL = [];   // kunci berisi {X} (mis. sambutan Pinpin "Haloo {N}! {SALAM}…") -> pola regex dengan isian
  Object.keys(DICT).forEach(function(k){
    if(!/\{[A-Z]+\}/.test(k)) return;
    var nama = [], pola = k.split(/(\{[A-Z]+\})/).map(function(p){ var m = /^\{([A-Z]+)\}$/.exec(p); if(m){ nama.push(m[1]); return '([\\s\\S]+?)'; } return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('');
    try{ TPL.push({re: new RegExp('^(\\s*)' + pola + '(\\s*)$'), nama: nama, ke: DICT[k]}); }catch(e){}
  });
  var keys = Object.keys(DICT).filter(function(k){ return k && DICT[k] != null && DICT[k] !== k && !/\{[A-Z]+\}/.test(k); }).sort(function(a, b){ return b.length - a.length; });
  function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  var huruf = /[A-Za-zÀ-ỹ0-9]/;
  var RE = null;
  if(keys.length){
    try{
      RE = new RegExp(keys.map(function(k){
        return (huruf.test(k[0]) ? '(?<![A-Za-zÀ-ỹ0-9])' : '') + escRe(k) + (huruf.test(k[k.length - 1]) ? '(?![A-Za-zÀ-ỹ0-9])' : '');
      }).join('|'), 'g');
    }catch(e){ RE = null; }
  }
  var cache = new Map();
  function tr(s){
    if(lang === 'id' || s == null) return s;
    s = String(s); if(!/[A-Za-z]/.test(s)) return s;
    if(cache.has(s)) return cache.get(s);
    var t = s.trim(), out, i, m;
    for(i = 0; i < TPL.length && out == null; i++){
      m = TPL[i].re.exec(s);
      if(m){ var isi = {}; TPL[i].nama.forEach(function(n, j){ isi[n] = tr(m[j + 2]); }); out = m[1] + TPL[i].ke.replace(/\{([A-Z]+)\}/g, function(a, n){ return isi[n] != null ? isi[n] : a; }) + m[m.length - 1]; }
    }
    if(out != null){}
    else if(DICT.hasOwnProperty(t)) out = s.replace(t, DICT[t]);
    else if(RE){ RE.lastIndex = 0; out = s.replace(RE, function(m){ return DICT[m]; }); }
    else out = s;
    if(cache.size > 20000) cache.clear();
    cache.set(s, out); return out;
  }
  var ATTR = ['placeholder', 'title', 'aria-label', 'alt', 'data-tip'];
  var asli = new WeakMap();   // node -> [teks asli, teks terjemahan terakhir]
  function lewati(el){
    for(var e = el; e && e.nodeType === 1; e = e.parentNode){
      var tg = e.tagName; if(tg === 'SCRIPT' || tg === 'STYLE' || tg === 'TEXTAREA' || tg === 'CODE') return true;
      if(e.getAttribute && (e.getAttribute('translate') === 'no' || e.classList.contains('notranslate'))) return true;
    }
    return false;
  }
  function teks(n){
    var v = n.nodeValue; if(!v || !/[A-Za-z]/.test(v)) return;
    var m = asli.get(n); if(m && m[1] === v) return;
    if(lewati(n.parentNode)) return;
    var t = tr(v); asli.set(n, [v, t]); if(t !== v) n.nodeValue = t;
  }
  function elemen(el){
    if(el.hasAttribute && el.hasAttribute('data-i18n-sw') && !el.firstChild && window.I18N){ el.appendChild(window.I18N.tombol(el.getAttribute('data-i18n-sw') || '')); return; }
    if(lewati(el)) return;
    for(var i = 0; i < ATTR.length; i++){
      var a = ATTR[i], v = el.getAttribute(a); if(!v) continue;
      var t = tr(v); if(t !== v) el.setAttribute(a, t);
    }
    if(el.tagName === 'INPUT' && /^(button|submit)$/i.test(el.type) && el.value){ var tv = tr(el.value); if(tv !== el.value) el.value = tv; }
  }
  function sapu(root){
    if(!root) return;
    if(root.nodeType === 3){ teks(root); return; }
    if(root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if(root.nodeType === 1){ if(lewati(root)) return; elemen(root); }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n;
    while((n = w.nextNode())){ if(n.nodeType === 3) teks(n); else elemen(n); }
  }
  var antre = new Set(), dijadwal = false;
  function jalankan(){ dijadwal = false; var a = Array.from(antre); antre.clear(); a.forEach(sapu); }
  function jadwal(n){ antre.add(n); if(!dijadwal){ dijadwal = true; (window.queueMicrotask || setTimeout)(jalankan); } }
  function mulai(){
    sapu(document.body);
    new MutationObserver(function(ms){
      ms.forEach(function(m){
        if(m.type === 'characterData') jadwal(m.target);
        else if(m.type === 'attributes') jadwal(m.target);
        else m.addedNodes.forEach(jadwal);
      });
    }).observe(document.documentElement, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR});
    if(document.title) document.title = tr(document.title);
  }
  if(lang !== 'id'){
    var _a = window.alert, _c = window.confirm, _p = window.prompt;
    window.alert = function(m){ return _a.call(window, tr(m)); };
    window.confirm = function(m){ return _c.call(window, tr(m)); };
    window.prompt = function(m, d){ return _p.call(window, tr(m), d); };
    try{
      var C = CanvasRenderingContext2D.prototype, f1 = C.fillText, f2 = C.strokeText, f3 = C.measureText;
      C.fillText = function(t){ arguments[0] = tr(t); return f1.apply(this, arguments); };
      C.strokeText = function(t){ arguments[0] = tr(t); return f2.apply(this, arguments); };
      C.measureText = function(t){ return f3.call(this, tr(t)); };
    }catch(e){}
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai); else mulai();
  /* Pertama kali dibuka: layar pilih bahasa (Tiếng Việt / Bahasa Indonesia / English) */
  function layarPilih(){
    if(sudahPilih || document.getElementById('i18nPilih')) return;
    var o = document.createElement('div'); o.id = 'i18nPilih'; o.className = 'notranslate'; o.setAttribute('translate', 'no');
    o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Chọn ngôn ngữ / Pilih bahasa / Choose language');
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#1C212D;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font-family:"Plus Jakarta Sans","Inter",system-ui,-apple-system,"Segoe UI",sans-serif';
    var pil = [['vi','Tiếng Việt','Chọn ngôn ngữ'],['id','Bahasa Indonesia','Pilih bahasa'],['en','English','Choose language']];
    o.innerHTML = '<div style="width:100%;max-width:380px;display:flex;flex-direction:column;gap:12px">' +
      '<div style="font-size:30px;font-weight:800;letter-spacing:-.01em;margin-bottom:2px">Sky<span style="color:#FE7A1B">Lens</span></div>' +
      '<div style="font-size:14px;opacity:.75;margin-bottom:14px;line-height:1.5">' + pil.map(function(x){ return x[2]; }).join(' · ') + '</div>' +
      pil.map(function(x, i){ return '<button type="button" data-l="' + x[0] + '" style="display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:58px;padding:14px 18px;border-radius:16px;border:1.5px solid ' + (i === 0 ? '#FE7A1B' : 'rgba(255,255,255,.22)') + ';background:' + (i === 0 ? '#FE7A1B' : 'rgba(255,255,255,.06)') + ';color:' + (i === 0 ? '#1C212D' : '#fff') + ';font-family:inherit;font-weight:800;font-size:17px;line-height:1.2;cursor:pointer;text-align:left"><span>' + x[1] + '</span><span style="font-family:inherit;font-weight:700;font-size:12px;opacity:.8;letter-spacing:.08em">' + x[0].toUpperCase() + '</span></button>'; }).join('') +
      '<div style="font-size:12px;opacity:.55;margin-top:10px;line-height:1.5">Có thể đổi lại bất cứ lúc nào · Bisa diganti kapan saja · You can change it any time</div></div>';
    o.addEventListener('click', function(e){
      var b = e.target.closest('button[data-l]'); if(!b) return;
      var l = b.getAttribute('data-l');
      try{ localStorage.setItem(KEY, l); }catch(err){}
      if(l === lang){ o.remove(); sudahPilih = true; } else location.reload();
    });
    document.body.appendChild(o);
    setTimeout(function(){ var f = o.querySelector('button'); if(f) f.focus(); }, 50);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', layarPilih); else layarPilih();
  document.documentElement.lang = lang === 'id' ? 'id' : lang;
  window.I18N = {
    lang: lang, t: tr,
    bulan: null, hari: null,   // nama bulan/hari tetap dari kode (Indonesia) lalu diterjemahkan kamus
    set: function(l){ try{ localStorage.setItem(KEY, l); }catch(e){} location.reload(); },
    /* tombol pilih bahasa kecil: I18N.tombol() -> elemen */
    tombol: function(gaya){
      var w = document.createElement('div'); w.className = 'notranslate i18nSw'; w.setAttribute('translate', 'no');
      w.style.cssText = 'display:inline-flex;gap:4px;' + (gaya || '');
      [['vi','VI'],['en','EN'],['id','ID']].forEach(function(x){
        var b = document.createElement('button'); b.type = 'button'; b.textContent = x[1];
        b.setAttribute('aria-pressed', x[0] === lang ? 'true' : 'false');
        b.style.cssText = 'border:1px solid ' + (x[0] === lang ? '#FE7A1B' : 'rgba(127,127,127,.35)') + ';background:' + (x[0] === lang ? '#FE7A1B' : 'transparent') + ';color:' + (x[0] === lang ? '#1C212D' : 'inherit') + ';border-radius:8px;padding:4px 9px;font-family:inherit;font-weight:700;font-size:12px;cursor:pointer;min-width:34px;min-height:28px';
        b.onclick = function(){ if(x[0] !== lang) window.I18N.set(x[0]); };
        w.appendChild(b);
      });
      return w;
    }
  };
})();
