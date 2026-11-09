/* SkyLens Việt Nam — BACKEND TIRUAN (mock Supabase) untuk tahap uji sebelum proyek Supabase VN dibuat.
   - Menangkap fetch() ke URL yang host-nya diawali "mock." dan meniru PostgREST + RPC + Storage SkyLens 2.0.
   - Data disimpan di IndexedDB browser (asal/origin yang sama). App dan dashboard yang dibuka dari origin yang sama
     (mis. satu artifact berisi /app dan /dashboard) berbagi data yang sama, jadi temuan dari app muncul di dashboard.
   - Begitu Supabase VN siap: ganti VN_SB_URL / VN_SB_KEY di config dan berkas ini otomatis tidak aktif.
   Tabel: sales_roster, assign_pilot, temuan_pilot, jejak_lokasi, grid_progress, manual_areas, persetujuan_lokasi, app_config. */
(function(){
  'use strict';
  var URL0 = (window.VN_SB_URL || '');
  if(!/^https?:\/\/mock\./i.test(URL0)) return;
  var TABLES = ['sales_roster','assign_pilot','temuan_pilot','jejak_lokasi','grid_progress','manual_areas','persetujuan_lokasi','app_config','foto'];
  var DB = {}; TABLES.forEach(function(t){ DB[t] = []; });
  var SEQ = {};
  var idb = null;
  function open(){
    return new Promise(function(res){
      try{
        var rq = indexedDB.open('slvn_mockbe', 1);
        rq.onupgradeneeded = function(){ var d = rq.result; TABLES.forEach(function(t){ if(!d.objectStoreNames.contains(t)) d.createObjectStore(t, {keyPath: '_k'}); }); };
        rq.onsuccess = function(){ idb = rq.result; res(); };
        rq.onerror = function(){ res(); };
      }catch(e){ res(); }
    });
  }
  function loadAll(){
    if(!idb) return Promise.resolve();
    return Promise.all(TABLES.map(function(t){
      return new Promise(function(res){
        try{ var rq = idb.transaction(t).objectStore(t).getAll(); rq.onsuccess = function(){ DB[t] = rq.result || []; SEQ[t] = DB[t].reduce(function(a, r){ return Math.max(a, +r.id || 0); }, 0); res(); }; rq.onerror = function(){ res(); }; }catch(e){ res(); }
      });
    }));
  }
  function put(t, rows){ if(!idb || !rows.length) return; try{ var s = idb.transaction(t, 'readwrite').objectStore(t); rows.forEach(function(r){ s.put(r); }); }catch(e){} }
  function del(t, rows){ if(!idb || !rows.length) return; try{ var s = idb.transaction(t, 'readwrite').objectStore(t); rows.forEach(function(r){ s.delete(r._k); }); }catch(e){} }
  var siap = open().then(loadAll), diSeed = false;
  window.VN_MOCK = {siap: siap, db: DB, reset: function(){ TABLES.forEach(function(t){ del(t, DB[t]); DB[t] = []; }); return seed(); }};

  function uuid(){ return (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){ var r = Math.random()*16|0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); })); }
  var UNIK = {sales_roster: ['kode'], grid_progress: ['key_petak','kode_salesman','cell_r','cell_c'], app_config: ['kunci'], temuan_pilot: ['id']};
  function kunci(t, r){ var u = UNIK[t]; return u ? t + ':' + u.map(function(c){ return r[c]; }).join('|') : t + ':' + r.id; }
  function insertRows(t, rows, upsert){
    var out = [];
    rows.forEach(function(r0){
      var r = Object.assign({}, r0);
      if(t !== 'sales_roster' && t !== 'app_config' && t !== 'grid_progress' && t !== 'temuan_pilot' && r.id == null){ SEQ[t] = (SEQ[t] || 0) + 1; r.id = SEQ[t]; }
      if(t === 'temuan_pilot' && !r.id) r.id = uuid();
      if(t === 'grid_progress' && r.id == null){ SEQ[t] = (SEQ[t] || 0) + 1; r.id = SEQ[t]; }
      if(t === 'assign_pilot'){ if(!r.status) r.status = 'aktif'; if(!r.tanggal_assign) r.tanggal_assign = new Date().toISOString(); }
      if(t === 'sales_roster' && r.aktif == null) r.aktif = true;
      if(t === 'manual_areas' && !r.created_at) r.created_at = new Date().toISOString();
      r._k = kunci(t, r);
      var i = DB[t].findIndex(function(x){ return x._k === r._k; });
      if(i >= 0){ if(!upsert) return; r = Object.assign(DB[t][i], r); DB[t][i] = r; }
      else DB[t].push(r);
      out.push(r);
    });
    put(t, out); return out;
  }
  function seed(){
    var R = (typeof ROSTER !== 'undefined' ? ROSTER : (typeof TX2_ROSTER !== 'undefined' ? TX2_ROSTER : {})) || {};
    if(!DB.app_config.length) insertRows('app_config', [{kunci: 'skenario_jks', nilai: 'A'}, {kunci: 'fokus_penyisir', nilai: 'HUNTER'}, {kunci: 'siklus_mulai', nilai: '2026-11-09'}, {kunci: 'katalog_vn', nilai: []}]);
    if(!DB.sales_roster.length){
      var rows = [];
      Object.keys(R).forEach(function(dep){ (R[dep] || []).forEach(function(s){ rows.push({kode: String(s[0]), nama: s[1], depot: dep, aktif: true}); }); });
      insertRows('sales_roster', rows, true);
    }
  }
  /* ---------- PostgREST mini ---------- */
  function parseVal(v){ if(v === 'null') return null; if(v === 'true') return true; if(v === 'false') return false; return v; }
  function cmp(a, b){ if(a == null && b == null) return 0; if(a == null) return -1; if(b == null) return 1; var na = +a, nb = +b; if(!isNaN(na) && !isNaN(nb) && a !== '' && b !== '') return na - nb; return String(a) < String(b) ? -1 : (String(a) > String(b) ? 1 : 0); }
  function cocok(row, col, expr){
    var neg = false; if(expr.indexOf('not.') === 0){ neg = true; expr = expr.slice(4); }
    var i = expr.indexOf('.'), op = expr.slice(0, i), v = decodeURIComponent(expr.slice(i + 1)), x = row[col], r;
    switch(op){
      case 'eq': r = String(x) === String(parseVal(v)) || (x === parseVal(v)); break;
      case 'neq': r = String(x) !== String(parseVal(v)); break;
      case 'gt': r = cmp(x, v) > 0; break; case 'gte': r = cmp(x, v) >= 0; break;
      case 'lt': r = cmp(x, v) < 0; break; case 'lte': r = cmp(x, v) <= 0; break;
      case 'is': r = parseVal(v) === null ? x == null : x === parseVal(v); break;
      case 'in': var arr = v.replace(/^\(|\)$/g, '').split(',').map(function(s){ return s.replace(/^"|"$/g, ''); }); r = arr.indexOf(String(x)) >= 0; break;
      case 'like': case 'ilike': var re = new RegExp('^' + v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*') + '$', op === 'ilike' ? 'i' : ''); r = re.test(String(x == null ? '' : x)); break;
      default: r = true;
    }
    return neg ? !r : r;
  }
  var RESV = {select:1, order:1, limit:1, offset:1, on_conflict:1, columns:1};
  function saring(t, params){
    var rows = DB[t].slice();
    params.forEach(function(p){ if(RESV[p[0]]) return; rows = rows.filter(function(r){ return cocok(r, p[0], p[1]); }); });
    return rows;
  }
  function pilihKolom(rows, sel){
    if(!sel || sel === '*') return rows.map(function(r){ var o = Object.assign({}, r); delete o._k; return o; });
    var cols = sel.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    return rows.map(function(r){ var o = {}; cols.forEach(function(c){ var a = c.split(':'); var src = a.length > 1 ? a[1] : a[0], dst = a[0]; o[dst] = r[src] === undefined ? null : r[src]; }); return o; });
  }
  function jsonRes(body, status, extra){ var st = status || 200; return new Response((body == null || st === 204 || st === 205) ? null : JSON.stringify(body), {status: st, headers: Object.assign({'Content-Type': 'application/json'}, extra || {})}); }
  async function rest(method, path, qs, headers, body){
    var t = path; if(DB[t] === undefined) return jsonRes({message: 'relation "' + t + '" does not exist', code: '42P01'}, 404);
    var params = []; qs.forEach(function(v, k){ params.push([k, v]); });
    var get = function(k){ var p = params.find(function(x){ return x[0] === k; }); return p ? p[1] : null; };
    var prefer = (headers.get && headers.get('Prefer')) || '';
    if(method === 'GET' || method === 'HEAD'){
      var rows = saring(t, params);
      var ord = get('order');
      if(ord) ord.split(',').reverse().forEach(function(o){ var a = o.split('.'), c = a[0], desc = a[1] === 'desc'; rows.sort(function(x, y){ var d = cmp(x[c], y[c]); return desc ? -d : d; }); });
      var total = rows.length, off = +(get('offset') || 0), lim = get('limit') != null ? +get('limit') : null;
      var rg = headers.get && headers.get('Range');
      if(rg){ var m = /(\d+)-(\d+)?/.exec(rg); if(m){ off = +m[1]; if(m[2] != null) lim = +m[2] - off + 1; } }
      if(lim == null || lim > 1000) lim = Math.min(1000, lim == null ? 1000 : lim);   // batas 1000 baris seperti Supabase
      rows = rows.slice(off, off + lim);
      var cr = (rows.length ? off + '-' + (off + rows.length - 1) : '*') + '/' + (/count=exact/.test(prefer) ? total : '*');
      if(method === 'HEAD') return new Response(null, {status: 200, headers: {'Content-Range': cr}});
      var out = pilihKolom(rows, get('select'));
      if((headers.get && /vnd\.pgrst\.object/.test(headers.get('Accept') || ''))){ if(out.length !== 1) return jsonRes({message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116'}, 406); return jsonRes(out[0], 200, {'Content-Range': cr}); }
      return jsonRes(out, 200, {'Content-Range': cr});
    }
    if(method === 'POST'){
      var arr = Array.isArray(body) ? body : [body];
      var ins = insertRows(t, arr, /merge-duplicates/.test(prefer));
      return /return=representation/.test(prefer) ? jsonRes(pilihKolom(ins, get('select')), 201) : jsonRes(null, 201);
    }
    if(method === 'PATCH'){
      var up = saring(t, params); up.forEach(function(r){ Object.assign(r, body); }); put(t, up);
      return /return=representation/.test(prefer) ? jsonRes(pilihKolom(up, get('select'))) : jsonRes(null, 204);
    }
    if(method === 'DELETE'){
      var dl = saring(t, params); DB[t] = DB[t].filter(function(r){ return dl.indexOf(r) < 0; }); del(t, dl);
      return /return=representation/.test(prefer) ? jsonRes(pilihKolom(dl, get('select'))) : jsonRes(null, 204);
    }
    return jsonRes({message: 'method'}, 405);
  }
  /* ---------- RPC (meniru fungsi SQL SkyLens 2.0) ---------- */
  function cekSales(kode){ if(TOK[kode]) kode = TOK[kode]; var s = DB.sales_roster.find(function(r){ return String(r.kode) === String(kode); }); return (s && s.aktif !== false) ? s : null; }
  var TZ = 7 * 3600e3;
  function tglLokal(iso){ return new Date(Date.parse(iso) + TZ).toISOString().slice(0, 10); }
  function sah(t){ return t.status_tindak_lanjut === 'lanjut_noo' && t.foto_url && t.lat != null && t.lon != null; }
  var RPC = {
    sales_login: function(a){ var s = cekSales(a.p_kode); return s ? {ok: true, kode: a.p_kode, nama: s.nama, depot: s.depot} : {ok: false, error: 'kode sales tidak dikenal atau nonaktif'}; },
    sales_tugas: function(a){
      var s = cekSales(a.p_kode); if(!s) return {ok: false, error: 'kode sales tidak dikenal atau nonaktif'};
      var akt = DB.assign_pilot.filter(function(r){ return r.status === 'aktif'; });
      return {ok: true,
        petak: akt.filter(function(r){ return String(r.kode_salesman) === String(a.p_kode); }).sort(function(x, y){ return cmp(x.tanggal_assign, y.tanggal_assign); }).map(function(r){ return r.key_petak; }),
        dialihkan: akt.filter(function(r){ return String(r.kode_salesman) !== String(a.p_kode) && r.depot === s.depot; }).map(function(r){ return r.key_petak; }),
        area_manual: DB.manual_areas.filter(function(m){ return String(m.kode_salesman) === String(a.p_kode); }).map(function(m){ return {id: m.id, name: m.name, reason: m.reason, geojson: m.geojson}; }),
        grid: DB.grid_progress.filter(function(g){ return String(g.kode_salesman) === String(a.p_kode); }).map(function(g){ return [g.key_petak, g.cell_r, g.cell_c]; })};
    },
    kirim_jejak: function(a){
      var s = cekSales(a.p_kode); if(!s) return {ok: false, error: 'kode sales tidak dikenal atau nonaktif'};
      var rows = (a.p_titik || []).map(function(t){ return {key_petak: t.key_petak, kode_salesman: a.p_kode, lat: t.lat, lon: t.lon, waktu: t.waktu || new Date().toISOString(), akurasi: t.akurasi, depot: s.depot, kecepatan: t.kecepatan, baterai: t.baterai}; });
      insertRows('jejak_lokasi', rows); return {ok: true, n: rows.length};
    },
    kirim_grid: function(a){
      var s = cekSales(a.p_kode); if(!s) return {ok: false, error: 'kode sales tidak dikenal atau nonaktif'};
      var n0 = DB.grid_progress.length;
      insertRows('grid_progress', (a.p_sel || []).map(function(t){ return {key_petak: t.key_petak, kode_salesman: a.p_kode, cell_r: t.cell_r, cell_c: t.cell_c, lat: t.lat, lon: t.lon, waktu: t.waktu || new Date().toISOString(), depot: s.depot}; }));
      return {ok: true, n: DB.grid_progress.length - n0};
    },
    kirim_temuan: function(a){
      var s = cekSales(a.p_kode); if(!s) return {ok: false, error: 'kode sales tidak dikenal atau nonaktif'};
      var d = a.p_data || {}, r = Object.assign({}, d, {kode_salesman: a.p_kode, depot: s.depot, tanggal: d.tanggal || new Date().toISOString()});
      if(r.key_petak === '') r.key_petak = null; if(!r.id) r.id = uuid();
      insertRows('temuan_pilot', [r]); return {ok: true, id: r.id};
    },
    catat_persetujuan: function(a){ if(!cekSales(a.p_kode)) return {ok: false, error: 'kode sales tidak dikenal atau nonaktif'}; insertRows('persetujuan_lokasi', [{kode_salesman: a.p_kode, setuju: a.p_setuju, waktu: new Date().toISOString(), versi_app: a.p_versi, perangkat: a.p_perangkat}]); return {ok: true}; },
    sales_ringkasan: function(a){
      var s = cekSales(a.p_kode); if(!s) return {ok: false, error: 'kode sales tidak dikenal atau nonaktif'};
      var hari = tglLokal(new Date().toISOString()), bln = hari.slice(0, 7);
      var T = DB.temuan_pilot.filter(function(t){ return String(t.kode_salesman) === String(a.p_kode); });
      var hi = T.filter(function(t){ return tglLokal(t.tanggal) === hari; }), bi = T.filter(function(t){ return tglLokal(t.tanggal).slice(0, 7) === bln; });
      var tgl = {}; T.filter(sah).forEach(function(t){ tgl[tglLokal(t.tanggal)] = 1; });
      var nyala = !!tgl[hari], d = new Date(Date.parse(hari + 'T00:00:00Z')); if(!nyala) d.setUTCDate(d.getUTCDate() - 1);
      var streak = 0;
      for(var i = 0; i < 800; i++){ if(d.getUTCDay() === 0){ d.setUTCDate(d.getUTCDate() - 1); continue; } if(!tgl[d.toISOString().slice(0, 10)]) break; streak++; d.setUTCDate(d.getUTCDate() - 1); }
      return {ok: true, nama: s.nama, depot: s.depot,
        hari_ini: {temuan: hi.length, noo: hi.filter(sah).length, kotak: DB.grid_progress.filter(function(g){ return String(g.kode_salesman) === String(a.p_kode) && tglLokal(g.waktu) === hari; }).length},
        bulan_ini: {temuan: bi.length, noo: bi.filter(sah).length}, total_noo: T.filter(sah).length, streak: streak, streak_nyala: nyala,
        riwayat: T.slice().sort(function(x, y){ return cmp(y.tanggal, x.tanggal); }).slice(0, 40).map(function(t){ return {id: t.id, nama_toko: t.nama_toko, status: t.status_tindak_lanjut, tanggal: t.tanggal, luar_petak: t.key_petak == null, ada_foto: !!t.foto_url, ukuran_toko: t.ukuran_toko, key_petak: t.key_petak, nominal_order: t.nominal_order}; })};
    },
    /* ---- keamanan (tiruan): PIN tiruan 123456, password akun tiruan tes123; data depo dari /_qa_data (khusus uji lokal) ---- */
    sales_login_pin: function(a){ var s = cekSales(a.p_kode); if(!s) return {ok: false, error: 'kode sales tidak dikenal atau nonaktif'}; if(a.p_pin !== (PINBARU[a.p_kode] || '123456')) return {ok: false, error: 'PIN salah.'}; var t = uuid(); TOK[t] = String(a.p_kode); return {ok: true, kode: a.p_kode, nama: s.nama, depot: s.depot, token: t, ganti_pin: !PINBARU[a.p_kode]}; },
    sales_ganti_pin: function(a){ var k = TOK[a.p_token]; if(!k) return {ok: false, error: 'sesi berakhir'}; if(!/^\d{6}$/.test(a.p_pin_baru || '')) return {ok: false, error: 'PIN harus 6 angka.'}; PINBARU[k] = a.p_pin_baru; return {ok: true}; },
    roster_depo: function(a){ return DB.sales_roster.filter(function(r){ return r.depot === a.p_depot && r.aktif !== false; }).sort(function(x, y){ return cmp(x.nama, y.nama); }).map(function(r){ return [String(r.kode), r.nama]; }); },
    sales_data: async function(a){ var s = cekSales(a.p_token); if(!s) return {ok: false, error: 'sesi berakhir, silakan masuk lagi dengan PIN'}; var d = await dataQa(s.depot, a.p_sken); return d ? {ok: true, zona: d.zona, outlet: d.outlet, kpi: d.kpi} : {ok: false, error: 'data depo belum ada'}; },
    saya: function(){ var m = AKUN(); return m ? Object.assign({ok: true}, m) : {ok: false, error: 'akun belum terdaftar'}; },
    dash_data: async function(a){ var m = AKUN(); if(!m || (m.peran !== 'SA' && m.depot.indexOf(a.p_depot) < 0)) return {ok: false, error: 'tidak berhak'}; var d = await dataQa(a.p_depot, a.p_sken); return d ? {ok: true, data: d} : {ok: false, error: 'data depo belum ada'}; },
    atur_pin_massal: function(a){ (a.p || []).forEach(function(x){ PINBARU[x[0]] = x[1]; }); return {ok: true, n: (a.p || []).length}; },
    hapus_jejak: function(a){
      var dl = DB.jejak_lokasi.filter(function(r){ return (!a.p_kode || String(r.kode_salesman) === String(a.p_kode)) && (a.p_key == null || +r.key_petak === +a.p_key) && (!a.p_dari || r.waktu >= a.p_dari) && (!a.p_sampai || r.waktu < a.p_sampai); });
      DB.jejak_lokasi = DB.jejak_lokasi.filter(function(r){ return dl.indexOf(r) < 0; }); del('jejak_lokasi', dl);
      return {ok: true, n: dl.length};
    }
  };
  var TOK = {}, PINBARU = {}, USER = null;
  async function dataQa(dep, sk){
    try{ var nm = location.origin + '/_qa_data/' + String(dep).replace(/\s+/g, '_'); var d = await (await _fetch(nm + '.json')).json();
      if(sk && sk !== 'A'){ try{ d.outlet = (await (await _fetch(nm + '__' + sk + '.json')).json()).outlet; }catch(e){} } return d; }catch(e){ return null; }
  }
  function AKUN(){
    if(!USER) return null; var e = USER, C = (typeof CABANG !== 'undefined' ? CABANG : []), M = (typeof DEPOT_MANIFEST !== 'undefined' ? DEPOT_MANIFEST : {});
    if(/^sa@/.test(e)) return {peran: 'SA', depot: Object.keys(M), email: e, nama: 'SUPER ADMIN (TIRUAN)'};
    var m = /^(bm|rbm)\.([a-z0-9]+)@/.exec(e); if(!m) return null; var kode = m[2].toUpperCase();
    if(m[1] === 'rbm') return {peran: 'RBM', region: kode, cabang: kode, email: e, nama: 'RBM ' + kode, depot: C.filter(function(c){ return c.reg === kode; }).reduce(function(a, c){ return a.concat(c.dep); }, [])};
    var c = C.filter(function(x){ return x.k.replace('.', '') === kode; })[0]; return c ? {peran: 'BM', region: c.reg, cabang: c.k, email: e, nama: 'BM ' + c.n, depot: c.dep.slice()} : null;
  }
  function jwt(email){ var b = function(o){ return btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }; return b({alg: 'HS256', typ: 'JWT'}) + '.' + b({sub: 'u-' + email, email: email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600}) + '.sig'; }
  var _fetch = window.fetch.bind(window);
  window.fetch = async function(input, init){
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if(url.indexOf(URL0) !== 0) return _fetch(input, init);
    await siap; if(!diSeed){ diSeed = true; seed(); }
    init = init || {};
    var method = (init.method || (input && input.method) || 'GET').toUpperCase();
    var headers = new Headers(init.headers || (input && input.headers) || {});
    var u = new URL(url), path = u.pathname;
    var body = init.body;
    if(typeof body === 'string'){ try{ body = JSON.parse(body); }catch(e){} }
    try{
      if(path.indexOf('/rest/v1/rpc/') === 0){
        var fn = path.slice(13), f = RPC[fn];
        if(!f) return jsonRes({message: 'Could not find the function public.' + fn, code: 'PGRST202'}, 404);
        body = body || {}; if(body.p_kode && TOK[body.p_kode]) body.p_kode = TOK[body.p_kode]; if(body.p_token && TOK[body.p_token]) body.p_token = TOK[body.p_token];
        return jsonRes(await f(body));
      }
      if(path.indexOf('/auth/v1/') === 0){
        if(/\/token$/.test(path)){
          if(!body || body.password !== 'tes123' || !/@skylens-vn\.local$/.test(body.email || '')) return jsonRes({error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials', code: 400}, 400);
          USER = body.email; var at = jwt(USER);
          return jsonRes({access_token: at, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'mock-r', user: {id: 'u-' + USER, aud: 'authenticated', role: 'authenticated', email: USER, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString()}});
        }
        if(/\/logout$/.test(path)){ USER = null; return jsonRes(null, 204); }
        if(/\/user$/.test(path)) return USER ? jsonRes({id: 'u-' + USER, email: USER, aud: 'authenticated', role: 'authenticated'}) : jsonRes({message: 'no user'}, 401);
        return jsonRes({}, 200);
      }
      if(path.indexOf('/rest/v1/') === 0) return await rest(method, decodeURIComponent(path.slice(9)), u.searchParams, headers, body);
      if(path.indexOf('/storage/v1/object/') === 0){
        var p = path.replace(/^\/storage\/v1\/object\/(public\/)?/, '');
        if(method === 'POST' || method === 'PUT'){
          var blob = init.body instanceof Blob ? init.body : new Blob([init.body]);
          var dataUrl = await new Promise(function(res){ var fr = new FileReader(); fr.onload = function(){ res(fr.result); }; fr.readAsDataURL(blob); });
          insertRows('foto', [{id: p, url: dataUrl}], true);
          return jsonRes({Key: p});
        }
        var f2 = DB.foto.find(function(x){ return x.id === p; });
        if(!f2) return new Response('', {status: 404});
        return _fetch(f2.url);
      }
      return jsonRes({message: 'mock: tidak dikenal'}, 404);
    }catch(e){ return jsonRes({message: String(e && e.message || e)}, 500); }
  };
  /* foto dari storage tiruan: dipakai di <img> lewat data URL */
  window.VN_MOCK.fotoUrl = function(path){ var f = DB.foto.find(function(x){ return x.id === path; }); return f ? f.url : ''; };
})();
