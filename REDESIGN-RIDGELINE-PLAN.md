# REDESAIN 2 — GAYA "RIDGELINE" (Dashboard Ads Hub + Sidebar)

Status: **⏸ DISIMPAN 27 Sep 2026 — preview LOKAL, BELUM LIVE.** Semua kode ada di branch lokal `redesign/dashboard-ridgeline` (tidak di-push; web live & branch `main` tidak tersentuh). Dilanjutkan kapan pun Nadir siap.
Sumber: sesi Claude Code 27 Sep 2026 — critique UI (skill impeccable) → referensi baru dari Nadir → preview lokal ronde 1 (Dashboard) & ronde 2 (data dummy + Sidebar + eksplorasi warna).

---

## 0. CARA MELANJUTKAN

1. `git checkout redesign/dashboard-ridgeline` (folder project otomatis berisi versi redesain).
2. Jalankan server lokal (Claude: `preview_start` nama `adhub`) → buka **http://localhost:3000** → login admin sekali (localhost dianggap alamat baru oleh browser).
3. Di Dashboard, panel **Preview controls** (pojok kanan-bawah): saklar *Demo data* + pilihan aksen.
4. Selesaikan keputusan di Bagian 6 → bersihkan item PREVIEW-ONLY (Bagian 7) → checklist live (Bagian 8).
5. Kembali ke versi live kapan saja: `git checkout main`.

---

## 1. LATAR BELAKANG

- Nadir berencana redesain Ad Hub. Critique UI (27 Sep 2026, dual-agent impeccable) memberi skor **20/40** ("Cukup"). Temuan utama: kata metrik sama tapi angka beda antar halaman (P0), layout patah di layar laptop, kontras teks sekunder di bawah standar, format angka & arti warna tidak seragam, desain terasa generik (template HR Pinterest).
- Nadir membawa **referensi utama baru: dashboard SEO "Ridgeline"** (2 potong gambar, sudah dijahit → `docs/redesign-ridgeline/referensi-ridgeline.jpg`).
- Permintaan Nadir: tes dulu di **Dashboard Ads Hub**, semua komponen laporan dipertahankan, font seperti referensi, preview lokal dulu, pakai skill UI + marketing. Ronde 2: data dummy supaya semua panel aktif + **redesain sidebar** dengan "warna & gaya baru, lupakan warna lama".

## 2. YANG DIAMBIL DARI REFERENSI

- Kanvas charcoal; **kartu = cangkang gelap (shell) + panel dalam lebih terang (well)**, sudut membulat besar.
- Kartu KPI ala "kartu proyek": header (ikon + nama) · panel bergradasi warna naik/turun + tekstur titik + sparkline dengan titik akhir bercincin + garis jatuh putus-putus · footer.
- **Angka monospace**, delta = lingkaran berpanah + persen berwarna.
- Kontrol berbentuk **pil** (tinggi 40px) + tombol bulat; pilihan/aktif **netral** (bukan warna aksen).
- Donut tebal + batang meter (ala "AI Search Visibility"); grid 2×2 + meter batang mini (ala "SEO Overview"); grafik garis + tooltip ber-header tanggal (ala "Traffic Analytics").
- Sidebar: rel ikon ramping + panel menu teks; item aktif = pil + garis aksen di kiri; logout lingkaran merah.

## 3. CAKUPAN

| Bagian | Status |
|---|---|
| Dashboard Ads Hub (`/`) — desktop, HP, tema gelap & terang | ✅ Preview selesai |
| Sidebar desktop (semua halaman) | ✅ Preview selesai |
| Halaman lain (Campaigns, Calendar, Analytics, Leads Hub, Maps, Notes, Login) | ⏳ Belum — isi tetap versi lama |
| Menu HP (drawer `MobileNav`) | ⏳ Belum |
| Laporan Export PDF/JPG | Sengaja TIDAK diubah (font dikunci Plus Jakarta Sans) |
| Rumus metrik & logika fetch | TIDAK disentuh sama sekali |

## 4. DESIGN SYSTEM (semua nilai sudah dipakai di kode)

### 4.1 Font
- **Geist** (teks UI + angka besar KPI, tabular) & **Geist Mono** (semua angka data: delta, nilai, sumbu, tabel). Referensi tidak mencantumkan nama font; Geist paling mendekati. Dipasang lewat `app/components/dashboardFonts.js`, hanya di Dashboard & Sidebar.
- Skala: judul halaman 20/600 · judul kartu 14/500 · teks 13 · keterangan 12 · nilai KPI 27/500 (23 di kartu sempit) · nilai efisiensi 21 (19 sempit) · statistik grafik 18 · sumbu grafik 10,5 mono.

### 4.2 Netral Dashboard (`app/dashboard-ridgeline.css`, prefix `--rg-`)
| Token | Gelap (disampel dari referensi) | Terang (turunan) |
|---|---|---|
| Kanvas `bg` | `#222222` | `#F2F2EF` |
| Cangkang kartu `shell` | `#1D1D1D` | `#EAEAE6` |
| Panel dalam `well` | `#2A2A2A` | `#FFFFFF` |
| Garis cangkang `line` | `#2E2E2E` | `#DFDFDA` |
| Garis dalam `line-soft` | `#363636` | `#ECECE7` |
| Grid grafik | `#3A3A3A` (putus-putus) | `#E1E1DC` |
| Track meter | `#3B3B3B` | `#E8E8E3` |
| Pil kontrol / garis pil | `#262626` / `#353535` | `#FFFFFF` / `#DCDCD6` |
| Teks utama / sekunder / redup | `#F5F5F5` / `#A8A8A8` / `#939393` | `#161616` / `#57574F` / `#686862` |
| Naik (bagus) / turun (buruk) | `#2BBE8A` / `#F26A6E` | `#0B8157` / `#CF363C` |
| Tooltip | `#1B1B1B` (header `#2C2C2C`) | sama (tooltip gelap di dua tema) |

Kontras teks sudah dihitung: semua ≥ 4,5:1 (teks redup gelap 4,6:1 di panel).

### 4.3 Warna data (divalidasi skill dataviz: aman buta warna, semua pasangan)
| Arti | Gelap | Terang |
|---|---|---|
| Awareness | `#8B5CF6` | `#7C4DEB` |
| Traffic | `#D9782A` | `#C9661A` |
| Conversion (juga Leads) | `#10A393` | `#0E9486` |
| Other | `#6E6E6E` | `#A3A39D` |
| Spend (seri uang, bukan objektif) | `#4A90E2` | `#2E78C7` |

Warna mengikuti ENTITAS di semua panel (donut, meter efisiensi, grafik harian, titik Top Campaigns). Nada panel KPI mengikuti ARAH perubahan: naik bagus = teal, turun buruk = merah, Spend = abu netral.

### 4.4 Netral Sidebar (`app/sidebar-ridgeline.css`, prefix `--sb-`)
| Token | Gelap | Terang |
|---|---|---|
| Latar sidebar (= cangkang) | `#1D1D1D` | `#EAEAE6` |
| Garis tepi / garis rel | `#2A2A2A` / `#262626` | `#DCDCD6` / `#E0E0DA` |
| Tombol menu (bulat) | `#262626` + garis `#343434` | `#FFFFFF` + garis `#DCDCD6` |
| Ikon rel | `#A3A3A3` | `#5E5E58` |
| Item menu / hover-aktif | `#A8A8A8` / `#F5F5F5` | `#57574F` / `#161616` |
| Label section (HURUF BESAR) | `#858585` | `#65655F` |
| Pil item aktif / garis pil | `#2E2E2E` / `#383838` | `#FFFFFF` / `#DCDCD6` |
| Logout | `#F26A6E` di latar merah 13% | `#CF363C` di latar merah 10% |
| Flyout (saat diciutkan) | `#232323` | `#FFFFFF` |

### 4.5 🌶️ AKSEN BARU — EKSPLORASI "REMPAH KEBAB" (belum diputuskan)
Warna lama (forest/lime) ditinggalkan atas permintaan Nadir. 4 kandidat, bisa dijajal di panel Preview (`html[data-accent]`):

| Nama | Warna | Teks/ikon di atasnya | Catatan |
|---|---|---|---|
| **Ember** (default preview) | `#E8731B` | `#FFFFFF` | oranye bara — paling mirip referensi Ridgeline |
| **Saffron** | `#E9A034` | `#1D1405` | kuning kunyit/safron |
| **Chili** | `#E0484D` | `#FFFFFF` | merah cabai |
| **Sumac** | `#B8336A` | `#FFFFFF` | merah keunguan buah sumac |

Dipakai HANYA di sidebar: logo, lingkaran hub aktif (+ bayangan lembut), garis penanda item aktif, avatar user, ring fokus keyboard. Isi dashboard sengaja tetap netral seperti referensi.

Referensi asli (untuk arsip): kanvas `#222222`, cangkang `#1D1D1D`, panel `#2A2A2A`, oranye brand `#DE7407`, teal data `#009E8E`, hijau naik `#03996B`, merah turun `#FC6063`, biru `#018ADA`, ungu `#8A4BFA`.

### 4.6 Tata letak Dashboard (desktop, fit 1 layar)
Top bar 70px (judul + konteks "Meta Ads · N campaigns with spend · Updated jj:mm" | platform · tanggal "This month │ 1–27 Sep 2026" · Compare · Export · refresh · tema · suggestions) → baris KPI (172–214px, 5 kartu) → baris tengah (226–330px: Spend Breakdown 1,2fr + Cost Efficiency 1fr) → baris bawah (290–580px: grafik harian 2,15fr + Top Campaigns 1fr). Jarak 12px, tepi 16px. Elemen sempit menyesuaikan lebar KARTU (container query), jadi tetap rapi saat sidebar dibuka.

### 4.7 Sidebar
Rel 64px (menu · ikon Ads Hub/Leads Hub/Maps Hub/Notes · logout) + panel 212px (bisa digeser 184–300). Default diciutkan; hover ikon hub → flyout daftar halaman. `aside` WAJIB `z-index: 30` (sticky = stacking context; tanpa itu flyout tertimpa kartu). Export `NAV_SECTIONS` / `navSectionsFor` / `USER_ALLOWED` tidak berubah (dipakai MobileNav & AppShell).

## 5. ELEMEN BARU DI DASHBOARD (boleh dibuang kalau Nadir tidak suka)
1. Ikon ⓘ definisi + cakupan tiap metrik (mis. "CPC = campaign Traffic saja").
2. KPI menulis periode pembanding ("vs 1–27 Aug") + nilai periode lalu di footer; Leads → "View lead sources".
3. Delta % untuk CPM/CPC/CPL/CTR (dulu hanya di Export); biaya turun = hijau.
4. Grafik harian: rata-rata harian, hari puncak, hari berisi data; hari tanpa spend digambar 0; sumbu dibulatkan (0 / 50 rb / 100 rb); penanda hari ini.
5. Top Campaigns: label CPM/CPC/CPL per tipe, spend "Rp 1,04 jt" (bukan "Rp 1M" yang terbaca miliar).
6. Skeleton saat memuat, data lama diredupkan saat refresh, error + tombol "Try again", tag "Soon" untuk Google/TikTok.

## 6. KEPUTUSAN YANG MENUNGGU NADIR
1. **Aksen final**: Ember / Saffron / Chili / Sumac (atau lainnya).
2. **Delta Total Spend abu-abu netral** (dulu merah/hijau) — alasan: naik/turun budget bukan baik/buruk.
3. **Tombol Compare & Export berlabel** seperti referensi (7 Agu 2026 Nadir minta icon-only).
4. Format: desimal koma (4,52%); label "N campaigns with spend" (dulu "N active"); tab grafik "Awareness" → "Impressions".
5. Gaya ini diteruskan ke halaman lain + menu HP? Urutan?
6. (Ide dari critique, opsional) Mode Presentasi untuk atasan: angka utama besar + kalimat kesimpulan, tanpa tombol/suara.

## 7. ITEM PREVIEW-ONLY — WAJIB DIBUANG SEBELUM PUSH
- Hapus file `app/components/demoDashboard.js` (data dummy) dan `app/components/PreviewPanel.js` (panel preview).
- `app/page.js`: semua blok bertanda `PREVIEW-ONLY — JANGAN DI-PUSH` (import, state `demo`, cabang data dummy di `fetchData`, chip "Demo data", Export dimatikan saat demo, render `PreviewPanel`).
- `app/components/Sidebar.js`: blok PREVIEW-ONLY pembaca `wd-preview-accent`.
- `app/sidebar-ridgeline.css`: hapus override `html[data-accent=…]`, tanam aksen terpilih di `:root`.
- Pengaman: data dummy hanya hidup saat `NODE_ENV !== 'production'`; Export mati saat demo aktif.
- Yang DIPERTAHANKAN: penjaga `fetchToken` di `fetchData` (respons lama tidak menimpa hasil baru).

## 8. CHECKLIST SEBELUM LIVE
- [ ] Keputusan Bagian 6 dijawab & diterapkan
- [ ] Item Bagian 7 dibuang, `npm run build` lolos
- [ ] Finish review impeccable + tulis `DESIGN.md` (sengaja ditunda sampai arah disetujui)
- [ ] Cek live dengan data asli: gelap/terang, HP, sidebar buka/tutup, halaman lain
- [ ] Merge ke `main` → push → cek deploy Vercel
- [ ] Update CLAUDE.md (struktur file, aturan warna/font baru)

## 9. CATATAN LAIN DARI SESI INI
- 🐞 **Bug production terpisah**: peta dasar Outlet Maps rusak — tile CARTO sekarang mengirim gambar "API KEY REQUIRED" (terverifikasi 27 Sep 2026). Belum diperbaiki.
- Temuan critique lain (masih berlaku untuk halaman di luar Dashboard): label metrik beda arti antar halaman ("Blended CPC" di Analytics), Esc tidak menutup popup tanggal/Compare/Stop-Run, kontras teks sekunder lama, kolom Nama Leads List tidak menempel, Calendar tanpa judul.
- Server lokal: `npm run dev` (port 3000). Dev Next.js 16 memakai folder `.next/dev`, jadi `npm run build` aman dijalankan bersamaan.

## 10. FILE YANG BERUBAH (branch `redesign/dashboard-ridgeline`)
Baru: `app/dashboard-ridgeline.css`, `app/sidebar-ridgeline.css`, `app/components/dashboardFonts.js`, `docs/redesign-ridgeline/referensi-ridgeline.jpg`, `REDESIGN-RIDGELINE-PLAN.md`, + preview-only `app/components/demoDashboard.js`, `app/components/PreviewPanel.js`.
Diubah: `app/page.js` (tampilan Dashboard; logika data disalin utuh), `app/components/AreaChart.js` (grafik harian, dashboard-only), `app/components/Sidebar.js`, `app/components/PlatformSelector.js` (pil + tag Soon), `app/components/ExportMenu.js` (varian `pill` + atribut `data-export-report`), `app/components/ThemeToggle.js` (prop opsional `className`).
