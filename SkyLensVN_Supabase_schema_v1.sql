-- SkyLens Việt Nam — skema Supabase v1 (9 Nov 2026), proyek "SkyLens Vietnam" (ref gccbuwjyddvhadhoarqc, akun digitalizationpma2).
-- Disusun dari skema SkyLens 2.0 yang sedang dipakai (v1 + v2_nopin + v3 ringkasan + v4 ukuran SG/GR + nominal order + "dialihkan").
-- Perbedaan Vietnam: zona waktu Asia/Ho_Chi_Minh, tanpa toko sedotan, roster dummy (Hunter/Farmer/Mixed) bisa diunggah ulang dari dashboard.
-- KEAMANAN (sama dengan jalur 2.0 saat ini, belum Fase 1): app sales memakai RPC security definer dengan kode sales saja;
-- dashboard memakai kunci anon. Pengetatan (login per orang, foto privat, cabut akses anon) dijadwalkan terpisah.
create extension if not exists pgcrypto with schema extensions;

-- ===================== TABEL =====================
create table if not exists public.sales_roster (
  id bigint generated always as identity primary key,
  depot text not null,
  kode text not null unique,
  nama text not null,
  pin_hash text,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.assign_pilot (
  id uuid primary key default gen_random_uuid(),
  kode_salesman text not null,
  key_petak bigint not null,
  status text not null default 'aktif' check (status in ('aktif','dibatalkan','selesai')),
  tanggal_assign timestamptz not null default now(),
  ditugaskan_oleh text,
  depot text,
  petak_versi text not null default 'vn_prio_v1',
  grup_uji text check (grup_uji in ('lama','baru','lain'))
);
create index if not exists assign_kode_idx on public.assign_pilot (kode_salesman, status);
create index if not exists assign_petak_idx on public.assign_pilot (key_petak);
create table if not exists public.temuan_pilot (
  id uuid primary key default gen_random_uuid(),
  key_petak bigint,
  kode_salesman text,
  lat double precision, lon double precision, akurasi integer,
  nama_toko text, belanja_kemana text, nama_grosir_pasar text,
  rata_belanja_nabati numeric, nominal_order numeric, no_hp text,
  status_tindak_lanjut text, jadwal_kunjung_lagi text, alasan_tidak_tertarik text,
  foto_url text, catatan text, ditemukan_grosir text, jumlah_toko_baru integer,
  ukuran_toko text check (ukuran_toko is null or ukuran_toko in ('RT-L','RT-M','RT-S','SG','GR')),
  tanggal timestamptz not null default now(),
  depot text,
  verifikasi_status text not null default 'pending' check (verifikasi_status in ('pending','valid','ditolak')),
  verifikasi_oleh text, verifikasi_at timestamptz, alasan_tolak text
);
create index if not exists temuan_kode_idx on public.temuan_pilot (kode_salesman, tanggal);
create index if not exists temuan_petak_idx on public.temuan_pilot (key_petak);
create table if not exists public.jejak_lokasi (
  id bigint generated always as identity primary key,
  key_petak bigint, kode_salesman text,
  lat double precision, lon double precision,
  waktu timestamptz not null default now(),
  akurasi integer, depot text, kecepatan real, baterai smallint,
  diterima timestamptz not null default now()
);
create index if not exists jejak_kode_idx on public.jejak_lokasi (kode_salesman, waktu);
create index if not exists jejak_petak_idx on public.jejak_lokasi (key_petak, kode_salesman);
create index if not exists jejak_waktu_idx on public.jejak_lokasi (waktu);
create index if not exists jejak_depot_idx on public.jejak_lokasi (depot, waktu);
create table if not exists public.grid_progress (
  id uuid primary key default gen_random_uuid(),
  key_petak bigint, kode_salesman text, cell_r integer, cell_c integer,
  lat double precision, lon double precision,
  waktu timestamptz not null default now(), depot text,
  unique (key_petak, kode_salesman, cell_r, cell_c)
);
create table if not exists public.manual_areas (
  id uuid primary key default gen_random_uuid(),
  depot_id text not null, kode_salesman text, drawn_by text, name text, reason text,
  geojson jsonb not null, status text not null default 'aktif',
  created_at timestamptz not null default now()
);
create index if not exists manual_depot_idx on public.manual_areas (depot_id);
create table if not exists public.persetujuan_lokasi (
  id bigint generated always as identity primary key,
  kode_salesman text not null, setuju boolean not null,
  waktu timestamptz not null default now(), versi_app text, perangkat text
);
create index if not exists persetujuan_kode_idx on public.persetujuan_lokasi (kode_salesman, waktu desc);
-- pengaturan bersama app & dashboard (skenario JKS, fokus Hunter, tanggal mulai siklus, katalog). Bukan tempat rahasia.
create table if not exists public.app_config (
  kunci text primary key,
  nilai jsonb,
  diubah timestamptz not null default now()
);
-- rahasia admin (hash password hapus jejak). Tanpa policy = tidak terbaca lewat API.
create table if not exists public.admin_rahasia (
  kunci text primary key,
  hash text not null
);

-- ===================== RLS + AKSES ANON (jalur 2.0 saat ini) =====================
alter table public.sales_roster enable row level security;
alter table public.assign_pilot enable row level security;
alter table public.temuan_pilot enable row level security;
alter table public.jejak_lokasi enable row level security;
alter table public.grid_progress enable row level security;
alter table public.manual_areas enable row level security;
alter table public.persetujuan_lokasi enable row level security;
alter table public.app_config enable row level security;
alter table public.admin_rahasia enable row level security;

revoke all on public.sales_roster, public.assign_pilot, public.temuan_pilot, public.jejak_lokasi, public.grid_progress,
  public.manual_areas, public.persetujuan_lokasi, public.app_config, public.admin_rahasia from anon, authenticated;

create policy anon_baca on public.sales_roster for select to anon, authenticated using (true);
create policy anon_tambah on public.sales_roster for insert to anon, authenticated with check (true);
create policy anon_ubah on public.sales_roster for update to anon, authenticated using (true) with check (true);
create policy anon_hapus on public.sales_roster for delete to anon, authenticated using (true);
grant select (id, depot, kode, nama, aktif, created_at), insert (depot, kode, nama, aktif), update (depot, nama, aktif), delete on public.sales_roster to anon, authenticated;

create policy anon_baca on public.assign_pilot for select to anon, authenticated using (true);
create policy anon_tambah on public.assign_pilot for insert to anon, authenticated with check (true);
create policy anon_ubah on public.assign_pilot for update to anon, authenticated using (true) with check (true);
grant select, insert, update on public.assign_pilot to anon, authenticated;

create policy anon_baca on public.temuan_pilot for select to anon, authenticated using (true);
create policy anon_verifikasi on public.temuan_pilot for update to anon, authenticated using (true) with check (true);
grant select on public.temuan_pilot to anon, authenticated;
grant update (verifikasi_status, verifikasi_oleh, verifikasi_at, alasan_tolak) on public.temuan_pilot to anon, authenticated;

create policy anon_baca on public.jejak_lokasi for select to anon, authenticated using (true);
grant select on public.jejak_lokasi to anon, authenticated;
create policy anon_baca on public.grid_progress for select to anon, authenticated using (true);
grant select on public.grid_progress to anon, authenticated;
create policy anon_baca on public.persetujuan_lokasi for select to anon, authenticated using (true);
grant select on public.persetujuan_lokasi to anon, authenticated;

create policy anon_semua on public.manual_areas for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.manual_areas to anon, authenticated;

create policy anon_baca on public.app_config for select to anon, authenticated using (true);
create policy anon_tulis on public.app_config for insert to anon, authenticated with check (true);
create policy anon_ubah on public.app_config for update to anon, authenticated using (true) with check (true);
grant select, insert, update on public.app_config to anon, authenticated;

-- ===================== RPC APP SALES (kode sales saja, sama dengan 2.0) =====================
create or replace function public._cek_sales(p_kode text)
returns table (depot text, nama text, err text)
language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  select s.depot as d, s.nama as nm, s.aktif as ak into r from sales_roster s where s.kode = p_kode;
  if not found or not r.ak then depot := null; nama := null; err := 'kode sales tidak dikenal atau nonaktif'; return next; return; end if;
  depot := r.d; nama := r.nm; err := null; return next;
end $$;

create or replace function public.sales_login(p_kode text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  select * into r from _cek_sales(p_kode);
  if r.err is not null then return jsonb_build_object('ok', false, 'error', r.err); end if;
  return jsonb_build_object('ok', true, 'kode', p_kode, 'nama', r.nama, 'depot', r.depot);
end $$;

create or replace function public.sales_tugas(p_kode text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  select * into r from _cek_sales(p_kode);
  if r.err is not null then return jsonb_build_object('ok', false, 'error', r.err); end if;
  return jsonb_build_object('ok', true,
    'petak', coalesce((select jsonb_agg(a.key_petak order by a.tanggal_assign) from assign_pilot a where a.kode_salesman = p_kode and a.status = 'aktif'), '[]'::jsonb),
    'dialihkan', coalesce((select jsonb_agg(distinct a.key_petak) from assign_pilot a where a.kode_salesman <> p_kode and a.status = 'aktif' and a.depot = r.depot), '[]'::jsonb),
    'area_manual', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'reason', m.reason, 'geojson', m.geojson)) from manual_areas m where m.kode_salesman = p_kode), '[]'::jsonb),
    'grid', coalesce((select jsonb_agg(jsonb_build_array(g.key_petak, g.cell_r, g.cell_c)) from grid_progress g where g.kode_salesman = p_kode), '[]'::jsonb));
end $$;

create or replace function public.kirim_jejak(p_kode text, p_titik jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r record; n integer;
begin
  select * into r from _cek_sales(p_kode);
  if r.err is not null then return jsonb_build_object('ok', false, 'error', r.err); end if;
  insert into jejak_lokasi (key_petak, kode_salesman, lat, lon, waktu, akurasi, depot, kecepatan, baterai)
  select t.key_petak, p_kode, t.lat, t.lon, coalesce(t.waktu, now()), t.akurasi, r.depot, t.kecepatan, t.baterai
  from jsonb_to_recordset(p_titik) as t(key_petak bigint, lat double precision, lon double precision, waktu timestamptz, akurasi integer, kecepatan real, baterai smallint);
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'n', n);
end $$;

create or replace function public.kirim_grid(p_kode text, p_sel jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r record; n integer;
begin
  select * into r from _cek_sales(p_kode);
  if r.err is not null then return jsonb_build_object('ok', false, 'error', r.err); end if;
  insert into grid_progress (key_petak, kode_salesman, cell_r, cell_c, lat, lon, waktu, depot)
  select t.key_petak, p_kode, t.cell_r, t.cell_c, t.lat, t.lon, coalesce(t.waktu, now()), r.depot
  from jsonb_to_recordset(p_sel) as t(key_petak bigint, cell_r integer, cell_c integer, lat double precision, lon double precision, waktu timestamptz)
  on conflict (key_petak, kode_salesman, cell_r, cell_c) do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'n', n);
end $$;

create or replace function public.kirim_temuan(p_kode text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_id uuid;
begin
  select * into r from _cek_sales(p_kode);
  if r.err is not null then return jsonb_build_object('ok', false, 'error', r.err); end if;
  v_id := coalesce((p_data->>'id')::uuid, gen_random_uuid());
  insert into temuan_pilot (id, key_petak, kode_salesman, lat, lon, akurasi, nama_toko, belanja_kemana, nama_grosir_pasar,
      rata_belanja_nabati, nominal_order, no_hp, status_tindak_lanjut, jadwal_kunjung_lagi, alasan_tidak_tertarik, foto_url, catatan,
      ditemukan_grosir, jumlah_toko_baru, tanggal, depot, ukuran_toko)
  values (v_id, nullif(p_data->>'key_petak','')::bigint, p_kode, (p_data->>'lat')::double precision, (p_data->>'lon')::double precision,
      (p_data->>'akurasi')::integer, p_data->>'nama_toko', p_data->>'belanja_kemana', p_data->>'nama_grosir_pasar',
      (p_data->>'rata_belanja_nabati')::numeric, (p_data->>'nominal_order')::numeric, p_data->>'no_hp', p_data->>'status_tindak_lanjut',
      p_data->>'jadwal_kunjung_lagi', p_data->>'alasan_tidak_tertarik', p_data->>'foto_url', p_data->>'catatan', p_data->>'ditemukan_grosir',
      (p_data->>'jumlah_toko_baru')::integer, coalesce((p_data->>'tanggal')::timestamptz, now()), r.depot, nullif(p_data->>'ukuran_toko',''))
  on conflict (id) do nothing;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.catat_persetujuan(p_kode text, p_setuju boolean, p_versi text, p_perangkat text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  select * into r from _cek_sales(p_kode);
  if r.err is not null then return jsonb_build_object('ok', false, 'error', r.err); end if;
  insert into persetujuan_lokasi (kode_salesman, setuju, versi_app, perangkat) values (p_kode, p_setuju, left(p_versi, 20), left(p_perangkat, 80));
  return jsonb_build_object('ok', true);
end $$;

-- NOO sah = lanjut_noo + foto + GPS. Streak = hari kerja Senin–Sabtu berturut-turut (zona Asia/Ho_Chi_Minh), Minggu dilewati.
create or replace function public.sales_ringkasan(p_kode text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r record; tz text := 'Asia/Ho_Chi_Minh';
  v_hari date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_awal date := date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh'))::date;
  a int; b int; c int; d int; e int; k int; v_tgl date[]; v_d date; v_streak int := 0; v_nyala boolean; v_n int := 0; v_riw jsonb;
begin
  select * into r from _cek_sales(p_kode);
  if r.err is not null then return jsonb_build_object('ok', false, 'error', r.err); end if;
  select count(*) filter (where (tanggal at time zone tz)::date = v_hari),
         count(*) filter (where (tanggal at time zone tz)::date = v_hari and status_tindak_lanjut = 'lanjut_noo' and foto_url is not null and lat is not null and lon is not null),
         count(*) filter (where (tanggal at time zone tz)::date >= v_awal),
         count(*) filter (where (tanggal at time zone tz)::date >= v_awal and status_tindak_lanjut = 'lanjut_noo' and foto_url is not null and lat is not null and lon is not null),
         count(*) filter (where status_tindak_lanjut = 'lanjut_noo' and foto_url is not null and lat is not null and lon is not null)
    into a, b, c, d, e from temuan_pilot where kode_salesman = p_kode;
  select count(*) into k from grid_progress where kode_salesman = p_kode and (waktu at time zone tz)::date = v_hari;
  select coalesce(array_agg(distinct (tanggal at time zone tz)::date), '{}') into v_tgl from temuan_pilot
   where kode_salesman = p_kode and status_tindak_lanjut = 'lanjut_noo' and foto_url is not null and lat is not null and lon is not null;
  v_nyala := v_hari = any(v_tgl);
  v_d := case when v_nyala then v_hari else v_hari - 1 end;
  while v_n < 800 loop
    v_n := v_n + 1;
    if extract(dow from v_d) = 0 then v_d := v_d - 1; continue; end if;
    exit when not (v_d = any(v_tgl));
    v_streak := v_streak + 1; v_d := v_d - 1;
  end loop;
  select coalesce(jsonb_agg(x order by x->>'tanggal' desc), '[]'::jsonb) into v_riw from (
    select jsonb_build_object('id', t.id, 'nama_toko', t.nama_toko, 'status', t.status_tindak_lanjut, 'tanggal', t.tanggal,
      'luar_petak', t.key_petak is null, 'ada_foto', t.foto_url is not null, 'ukuran_toko', t.ukuran_toko, 'key_petak', t.key_petak, 'nominal_order', t.nominal_order) as x
    from temuan_pilot t where t.kode_salesman = p_kode order by t.tanggal desc limit 40) q;
  return jsonb_build_object('ok', true, 'nama', r.nama, 'depot', r.depot,
    'hari_ini', jsonb_build_object('temuan', a, 'noo', b, 'kotak', k), 'bulan_ini', jsonb_build_object('temuan', c, 'noo', d),
    'total_noo', e, 'streak', v_streak, 'streak_nyala', v_nyala, 'riwayat', v_riw);
end $$;

-- hapus jejak (dashboard admin): dicek terhadap hash di admin_rahasia('hapus_jejak'). Selama hash belum diisi, selalu ditolak.
create or replace function public.hapus_jejak(p_kode text, p_key bigint, p_admin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare h text; n integer;
begin
  select hash into h from admin_rahasia where kunci = 'hapus_jejak';
  if h is null or p_admin is null or h <> crypt(p_admin, h) then return jsonb_build_object('ok', false, 'error', 'password admin salah atau belum diatur'); end if;
  delete from jejak_lokasi where kode_salesman = p_kode and key_petak = p_key;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'n', n);
end $$;

revoke all on function public._cek_sales(text) from public, anon, authenticated;
revoke all on function public.sales_login(text), public.sales_tugas(text), public.kirim_jejak(text, jsonb), public.kirim_grid(text, jsonb),
  public.kirim_temuan(text, jsonb), public.catat_persetujuan(text, boolean, text, text), public.sales_ringkasan(text), public.hapus_jejak(text, bigint, text) from public;
grant execute on function public.sales_login(text), public.sales_tugas(text), public.kirim_jejak(text, jsonb), public.kirim_grid(text, jsonb),
  public.kirim_temuan(text, jsonb), public.catat_persetujuan(text, boolean, text, text), public.sales_ringkasan(text), public.hapus_jejak(text, bigint, text) to anon, authenticated;

-- ===================== STORAGE: foto temuan (publik dengan path acak, sama dengan 2.0 saat ini) =====================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('temuan-foto', 'temuan-foto', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "vn anon upload temuan foto" on storage.objects;
create policy "vn anon upload temuan foto" on storage.objects for insert to anon, authenticated with check (bucket_id = 'temuan-foto');

-- ===================== DATA AWAL: pengaturan + roster dummy Big Son (skenario A) + TESTING =====================
insert into public.app_config (kunci, nilai) values
  ('skenario_jks', '"A"'), ('fokus_penyisir', '"HUNTER"'), ('siklus_mulai', '"2026-11-09"'), ('katalog_vn', '[]')
on conflict (kunci) do nothing;
insert into public.sales_roster (depot, kode, nama) values
  ('BIG SON','F01','FARMER-NV F01'),('BIG SON','F02','FARMER-NV F02'),
  ('BIG SON','H01','HUNTER-NV H01'),('BIG SON','H02','HUNTER-NV H02'),('BIG SON','H03','HUNTER-NV H03'),
  ('BIG SON','H04','HUNTER-NV H04'),('BIG SON','H05','HUNTER-NV H05'),('BIG SON','H06','HUNTER-NV H06'),
  ('BIG SON','BM-NOR02-BIG_SON','BM-QUẢN LÝ KHU VỰC (DEMO)'),('BIG SON','RBM-NORTH-BIG_SON','RBM-QUẢN LÝ VÙNG (DEMO)'),
  ('TESTING','TEST-KEVIN','HUNTER-TESTER KEVIN'),('TESTING','TEST-01','HUNTER-TESTER 01')
on conflict (kode) do nothing;
