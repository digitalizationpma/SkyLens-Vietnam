# SkyLens Việt Nam

Nasional: 137 NPP (Miền Bắc 57 · Miền Trung 33 · Miền Nam 47), 90.688 petak, 145.603 outlet. App sales + dashboard, fork SkyLens 2.0 (app 1.2.10, dashboard v30.1). Versi app VN-0.3.0.

- `index.html` — halaman awal
- `app/` — app sales (VI default, EN, ID)
- `dash/` — dashboard (login per akun: BM per cabang, RBM per region, Super Admin; password dicek server). Super Admin › Pengaturan Vietnam: skenario JKS A/B/M, penyisir, siklus, katalog, unggah struktur area (`dash/template_struktur_vn.xlsx`).
- Data toko per NPP (zona, outlet, skenario JKS) **tidak ada di repo ini**: tersimpan privat di Supabase (tabel `data_depo`) dan hanya bisa diambil lewat RPC setelah login (dashboard: akun per orang; app: kode sales + PIN).
- `app/data/jalan/<NPP>.json` — jalan OSM + jumlah atap Microsoft per petak (data terbuka), diambil saat dipakai.
- Backend: Supabase "SkyLens Vietnam" (ref gccbuwjyddvhadhoarqc). `?backend=mock` = backend tiruan di browser.
- `SkyLensVN_Supabase_schema_v1.sql` — skema database.
