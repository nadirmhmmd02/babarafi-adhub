# REDESAIN 2 — GAYA "RIDGELINE" (Dashboard Ads Hub + Sidebar)

Status: **🔄 DILANJUTKAN 28 Sep 2026 (ronde 7 = Notes, ronde 8 = Outlet Maps + Leads Analytics, ronde 9 = Login) — preview LOKAL, BELUM LIVE.** Semua kode ada di branch lokal `redesign/dashboard-ridgeline` (tidak di-push; web live & branch `main` tidak tersentuh).
Sumber: sesi Claude Code 27 Sep 2026 — critique UI (skill impeccable) → referensi baru dari Nadir → preview lokal ronde 1 (Dashboard) & ronde 2 (data dummy + Sidebar + eksplorasi warna). **Ronde 3 (28 Sep 2026)** — 5 permintaan Nadir dari screenshot, lihat Bagian 11. **Ronde 4 (28 Sep 2026)** — semua keputusan dijawab + seluruh halaman Ads Hub & laporan Export diredesain, lihat Bagian 12.

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
| Campaigns, Calendar, Analytics & Insights (`/reports`) — desktop, HP, dua tema | ✅ Preview selesai (ronde 4) |
| Laporan Export PDF/JPG | ✅ Diredesain (ronde 4) — font Geist, palet Ridgeline, ikut tema |
| Dashboard Leads Hub (`/leads`) — desktop, HP, dua tema | ✅ Preview selesai (ronde 5, Bagian 14) |
| Leads List (`/leads/list`) — desktop, HP, dua tema | ✅ Preview selesai (ronde 6, Bagian 15) |
| Notes (`/notes`, termasuk To Do) — desktop, HP, dua tema | ✅ Preview selesai (ronde 7, Bagian 16) |
| Outlet Maps (`/maps`) — desktop, HP, dua tema + peta dasar OpenStreetMap abu-abu | ✅ Preview selesai (ronde 8, Bagian 17) |
| Leads Hub → Analytics & Insights (`/leads/insights`) — DIBANGUN (dulu placeholder) | ✅ Preview selesai (ronde 8, Bagian 18) |
| Login (`/login`) — desktop, HP, dua tema | ✅ Preview selesai (ronde 9, Bagian 19) — lihat via panel Preview → "View login page" |
| Menu HP (drawer + top bar `MobileNav`) | ⏳ Belum — masih desain lama (termasuk logo) |
| Rumus metrik & logika fetch | TIDAK disentuh sama sekali |

## 4. DESIGN SYSTEM (semua nilai sudah dipakai di kode)

### 4.1 Font
- **Geist** (teks UI + angka besar KPI, tabular) & **Geist Mono** (semua angka data: delta, nilai, sumbu, tabel). Referensi tidak mencantumkan nama font; Geist paling mendekati. Dipasang lewat `app/components/dashboardFonts.js` di akar semua halaman Ads Hub (`.rg`), Sidebar, dan laporan Export (sejak ronde 4 — dulu laporan dikunci Plus Jakarta Sans).
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
| Spend (seri uang, bukan objektif) | `#2F97EF` (dulu `#4A90E2`) | `#096CB5` (dulu `#2E78C7`) |

Spend digeser 28 Sep 2026: di mode grafik "All" keempat garis tampil bersamaan, dan biru lama terlalu mirip ungu Awareness (validator dataviz, semua pasangan: ΔE normal 14,6 gelap / 14,3 terang, di bawah batas 15). Warna baru lolos semua cek di dua tema. Di tema gelap, CVD biru↔ungu 7,1 ada di pita "boleh dengan pembeda kedua", dan pembedanya adalah label nama di ujung garis.

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

### 4.5 🌶️ AKSEN BARU — ✅ FINAL: SAFFRON (dipilih Nadir 28 Sep 2026)
Aksen ditanam di `:root` pada `sidebar-ridgeline.css`: `--sb-acc #E9A034`, `--sb-acc-fg #1D1405` (teks/ikon di atas isian saffron, 8,3:1), `--sb-acc-soft rgba(233,160,52,.18)`. Token tambahan **`--sb-acc-ink`** untuk saffron sebagai TEKS/GARIS (huruf avatar, ring fokus keyboard): terang `#935F0A` (4,5:1 di #EAEAE6; saffron asli cuma 1,8:1), gelap `#EDA844` (4,7:1 di latar avatar). Override `html[data-accent]` + pemilih aksen di panel Preview SUDAH DIHAPUS.

Arsip eksplorasi. Warna lama (forest/lime) ditinggalkan atas permintaan Nadir. Ada 4 kandidat:

| Nama | Warna | Teks/ikon di atasnya | Catatan |
|---|---|---|---|
| **Ember** (default preview) | `#E8731B` | `#FFFFFF` | oranye bara — paling mirip referensi Ridgeline |
| **Saffron** | `#E9A034` | `#1D1405` | kuning kunyit/safron |
| **Chili** | `#E0484D` | `#FFFFFF` | merah cabai |
| **Sumac** | `#B8336A` | `#FFFFFF` | merah keunguan buah sumac |

Dipakai HANYA di sidebar: lingkaran hub aktif (+ bayangan lembut), garis penanda item aktif, avatar user, ring fokus keyboard (+ saklar panel Preview). Logo sudah dihapus dari sidebar (28 Sep 2026). Isi dashboard sengaja tetap netral seperti referensi.

Referensi asli (untuk arsip): kanvas `#222222`, cangkang `#1D1D1D`, panel `#2A2A2A`, oranye brand `#DE7407`, teal data `#009E8E`, hijau naik `#03996B`, merah turun `#FC6063`, biru `#018ADA`, ungu `#8A4BFA`.

### 4.6 Tata letak Dashboard (desktop, fit 1 layar)
Top bar 70px (judul + konteks "Meta Ads · N campaigns with spend · Updated jj:mm" | platform · tanggal "This month │ 1–27 Sep 2026" · Compare · Export · refresh · tema · suggestions) → baris KPI (**216–248px, basis 232**, 5 kartu) → baris tengah (**210–330px: Spend Breakdown 1fr + Cost Efficiency 1fr, SAMA LEBAR**) → baris bawah (**270–580px**: grafik harian 2,15fr + Top Campaigns 1fr). Jarak 12px, tepi 16px. Elemen sempit menyesuaikan lebar KARTU (container query), jadi tetap rapi saat sidebar dibuka. Revisi 28 Sep: donut ikut TINGGI panel (maks 172px, `100cqh`), angka tengah donut ikut skala lebar donut (dulu menabrak cincin), sel Cost Efficiency merapat kalau panel < 190px. HP: kartu KPI 216px (dulu 196), grafik harian 380px (dulu 340; sumbu tanggal sempat terpotong 36px), statistik grafik lebih rapat (2 baris).

### 4.7 Sidebar
Rel 64px (menu · ikon Ads Hub/Leads Hub/Maps Hub/Notes · logout) + panel 212px (bisa digeser 184–300). Kepala panel = teks "Baba Rafi Ad Hub" saja, TANPA logo, tebal semua (700; "Ad Hub" tetap abu), padding kiri 26px sejajar teks menu (permintaan Nadir 28 Sep 2026). Default diciutkan; hover ikon hub → flyout daftar halaman. `aside` WAJIB `z-index: 30` (sticky = stacking context; tanpa itu flyout tertimpa kartu). Export `NAV_SECTIONS` / `navSectionsFor` / `USER_ALLOWED` tidak berubah (dipakai MobileNav & AppShell).

## 5. ELEMEN BARU DI DASHBOARD (boleh dibuang kalau Nadir tidak suka)
1. Ikon ⓘ definisi + cakupan tiap metrik (mis. "CPC = campaign Traffic saja").
2. KPI menulis periode pembanding ("vs 1–27 Aug") + nilai periode lalu di footer; Leads → "View lead sources".
3. Delta % untuk CPM/CPC/CPL/CTR (dulu hanya di Export); biaya turun = hijau.
4. Grafik harian: rata-rata harian, hari puncak, hari berisi data; hari tanpa spend digambar 0; sumbu dibulatkan (0 / 50 rb / 100 rb); penanda hari ini.
5. Top Campaigns: label CPM/CPC/CPL per tipe, spend "Rp 1,04 jt" (bukan "Rp 1M" yang terbaca miliar).
6. Skeleton saat memuat, data lama diredupkan saat refresh, error + tombol "Try again", tag "Soon" untuk Google/TikTok.
7. **Tombol "All" di grafik harian (28 Sep 2026)** menampilkan keempat garis sekaligus. Satuannya beda, jadi satu sumbu diindeks: tiap garis diskalakan ke hari puncaknya sendiri (= 100%, sumbu 0–100%), BUKAN dua sumbu-Y. Legenda = rata-rata harian asli per metrik (hover → garis lain meredup), label nama di ujung garis (didorong renggang + garis pemandu kalau bertabrakan; disembunyikan kalau plot < 420px), tooltip berisi angka ASLI keempat metrik, catatan "Each line is scaled to its own peak day" (disembunyikan kalau sempit). HP: tombol tanpa kunci warna, "Impressions" → "Impr.".
8. **Sparkline KPI digambar dalam piksel asli** (ResizeObserver): pita garis 10px dari atas s.d. 16px dari bawah, titik akhir 18px dari kanan → cincin titik tidak pernah terpotong (dulu pita ±20px di kotak 29px, titik rendah terpotong).

## 6. KEPUTUSAN YANG MENUNGGU NADIR
SEMUA SUDAH DIJAWAB NADIR (28 Sep 2026):
1. ~~**Aksen final**~~ → ✅ **SAFFRON**.
2. ~~Delta Total Spend abu-abu netral~~ → ✅ YA, "sementara" (berlaku juga di Analytics & laporan Export).
3. ~~Tombol Compare & Export berlabel~~ → ❌ TIDAK — **icon saja** (bulat 40px, nama aksi di tooltip).
4. ~~Desimal koma, "campaigns with spend", tab "Impressions"~~ → ✅ YA (Campaigns/Calendar juga pakai angka penuh gaya Indonesia).
5. ~~Diteruskan ke halaman lain?~~ → ✅ SEMUA halaman kategori **Ads Hub** (Campaigns, Calendar, Analytics & Insights), nuansa font & warna dua tema sama dengan Dashboard. Tes lokal dulu.
6. ~~Mode Presentasi~~ → Nadir mengartikannya sebagai **hasil tombol download laporan (Export)** → ✅ laporan diredesain (Bagian 12).

## 7. ITEM PREVIEW-ONLY — WAJIB DIBUANG SEBELUM PUSH
- Hapus file `app/components/demoDashboard.js` (data dummy semua halaman), `app/components/demoNotes.js` (data dummy Notes + To Do, klien Supabase tiruan), `app/components/demoMaps.js` (dummy Outlet Maps), `app/components/demoMode.js` (saklar bersama) dan `app/components/PreviewPanel.js` (panel preview).
- Buang semua blok bertanda `PREVIEW-ONLY — JANGAN DI-PUSH` di: `app/page.js` (import, `useDemoMode`, cabang dummy di `fetchData`, chip, Export dimatikan saat demo, render `PreviewPanel`), `app/campaigns/page.js` (+ cabang Stop/Run & Edit Budget lokal), `app/calendar/page.js` (+ CRUD di memori), `app/reports/page.js` (+ `useAuth` khusus panel, teks chip "demo data"), `app/components/CompareModal.js`, `app/components/CampaignModal.js`, `app/components/ExportMenu.js` (Export dari data dummy + nama file "DEMO-"), `app/leads/page.js`, `app/leads/list/page.js` (termasuk `isDemoId` & cabang demo di `dbUpdate`/`handleSync`), `app/notes/page.js` (import, `demo`/`db` → ganti semua `db.` jadi `supabase.`, `useTodos(role === 'admin')`, guard `isDemoNotesId` di penyimpan catatan aktif, chip, `PreviewPanel`), `app/components/useTodos.js` (param `client` + alias `realSupabase` → kembali `import { supabase }`), `app/maps/page.js` (import, `demo`, baris `if (demo) return demoMapsCall(body)` di `callApi`, chip, `PreviewPanel`), `app/leads/insights/page.js` (import, `demo` + cabang dummy di `fetchData`, chip, `PreviewPanel`), **hapus folder `app/preview-login/`**, `app/components/LoginScreen.js` (blok `if (preview)` di `submit`; prop `preview`/`previewBar` boleh dibuang), `app/login-ridgeline.css` (aturan `.rgin-preview`). Cek: `grep -rn "PREVIEW-ONLY" app` harus kosong.
- ~~`app/components/Sidebar.js`: blok PREVIEW-ONLY pembaca `wd-preview-accent`~~ → ✅ sudah dihapus 28 Sep 2026.
- ~~`app/sidebar-ridgeline.css`: hapus override `html[data-accent=…]`, tanam aksen terpilih di `:root`~~ → ✅ selesai 28 Sep 2026 (Saffron).
- Pengaman: data dummy hanya hidup saat `NODE_ENV !== 'production'`; Export mati saat demo aktif.
- Yang DIPERTAHANKAN: penjaga `fetchToken` di `fetchData` Dashboard, Campaigns & Analytics (respons lama tidak menimpa hasil baru; di Analytics baru ditambahkan 28 Sep 2026).

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
Baru: `app/ridgeline.css` (skin bersama, ronde 4), `app/dashboard-ridgeline.css`, `app/campaigns-ridgeline.css`, `app/calendar-ridgeline.css`, `app/reports-ridgeline.css`, `app/sidebar-ridgeline.css`, `app/components/dashboardFonts.js`, `app/components/rgKit.js`, `docs/redesign-ridgeline/referensi-ridgeline.jpg`, `REDESIGN-RIDGELINE-PLAN.md`, + preview-only `app/components/demoDashboard.js`, `app/components/PreviewPanel.js`.
Diubah ronde 4: `app/layout.js` (import ridgeline.css), `app/campaigns/page.js`, `app/calendar/page.js`, `app/reports/page.js`, `app/components/ExportMenu.js` (laporan baru + `iconOnly`), `app/components/reportData.js` (+prevRange/frac/count), `app/components/CampaignModal.js`, `CombineModal.js`, `CompareModal.js`, `LeadsBreakdownModal.js` (warna → token skin), `app/components/AppShell.js` (tombol Suggestions melayang ikut skin di rute Ads Hub).
Diubah: `app/page.js` (tampilan Dashboard; logika data disalin utuh), `app/components/AreaChart.js` (grafik harian, dashboard-only), `app/components/Sidebar.js`, `app/components/PlatformSelector.js` (pil + tag Soon), `app/components/ExportMenu.js` (varian `pill` + atribut `data-export-report`), `app/components/ThemeToggle.js` (prop opsional `className`).

## 11. RONDE 3 — REVISI 28 SEP 2026 (5 permintaan Nadir dari screenshot)
| # | Permintaan | Yang dikerjakan |
|---|---|---|
| 1 | Aksen fix Saffron "turmeric gold" | Ditanam di `:root` + token `--sb-acc-ink` (teks/garis), pemilih aksen & override `data-accent` dibuang |
| 2 | Logo di samping "Baba Rafi Ad Hub" dihapus, teks tebal semua | Logo dibuang dari kepala panel sidebar; teks 700 semua, sejajar teks menu. `MobileNav` (menu HP) BELUM diubah, masih desain lama dengan logo |
| 3 | Grafik di kartu KPI terpotong → maksimalkan, kartu boleh lebih tinggi | Sparkline piksel asli (68px di layar 1920×953, dulu ±29px), baris KPI 216–248 (basis 232); baris tengah/bawah dipangkas min-nya; HP kartu 216px |
| 4 | Spend Breakdown & Cost Efficiency sama lebar, batas tepat di tengah kanvas | `repeat(2, minmax(0,1fr))`, terverifikasi selisih pusat 0px di 5 ukuran layar + sidebar terbuka |
| 5 | Tombol tambahan untuk menampilkan semua garis grafik sekaligus | Tombol "All" (lihat Bagian 5 no. 7) + biru Spend digeser (Bagian 4.3) |

Ikut diperbaiki karena bersinggungan: angka tengah donut menabrak cincin, donut terpotong di layar pendek, grafik harian HP terpotong 36px di bagian sumbu tanggal.

## 12. RONDE 4 — HALAMAN ADS HUB + LAPORAN EXPORT (28 Sep 2026)
Jawaban Nadir atas 6 keputusan ada di Bagian 6. Yang dikerjakan:

**Struktur baru (skin bersama):**
- `app/ridgeline.css` (BARU, di-import sekali di `app/layout.js`) = token dua tema, pemetaan token lama → skin, top bar, pil, kartu cangkang+panel, delta, segmen, chip, menu, form, dialog, bar melayang/toast, state, tabel dasar, kerangka HP. Semua di-scope `.rg`.
- `dashboard-ridgeline.css` dirampingkan jadi bagian khusus Dashboard; baru: `campaigns-ridgeline.css`, `calendar-ridgeline.css`, `reports-ridgeline.css`.
- `app/components/rgKit.js` (BARU) = satu sumber `presetToRange`, `fmtRangeShort`, `fmtClock`, `fmtPct1`, `toneOf`, `Delta`, `InfoTip`, `DatePill` — dipakai Dashboard, Campaigns, Analytics.
- Token lama yang dipetakan di `.rg` bertambah: `--ac`, `--accent-*`, `--pos/--neg(+soft)`, `--data-br` → popup bawaan (Compare, rincian Leads, detail campaign, hitung gabungan, filter tanggal) otomatis netral. Token baru: `--rg-warn`, `--rg-pos-fill/-tx`, `--rg-neg-fill/-tx`, `--rg-scrim`.

**Dashboard:** Compare & Export = tombol ikon bulat 40px (ExportMenu prop `pill iconOnly`).

**Campaigns:** top bar judul + konteks (Meta Ads · N campaigns · A active · N non-active · Updated) | pil tanggal · refresh · tema. Tabel di kartu "All campaigns": header kalimat biasa + tombol urut (aria-sort), baris grup = titik warna objektif (entitas dashboard, dulu biru/kuning/hijau lama), status = chip (Active hijau · Stop netral · Ended redup), aksi admin = tombol ikon bulat, angka Geist Mono PENUH (Rp 1.440.076 — dulu "Rp 1.2 jt"), subtotal + tombol pil. Bar melayang "Calculate Total", dialog Stop/Run & Edit Budget gaya baru + **Esc menutup**, toast, skeleton, error + "Try again", tabel lama diredupkan saat memuat ulang + penjaga respons usang (`fetchToken`). Chip objektif/status di popup detail & hitung gabungan disamakan.

**Calendar:** top bar judul + konteks | pil bulan ‹ › · Add campaign. Gantt di kartu "Schedule" (legenda objektif di kepala), kolom info lebar px pas isi + kolom hari berbagi sisa (min tabel 1180px → digeser di layar sempit/HP, kolom Campaign menempel berlatar pekat), hari ini = pita netral, batang = warna entitas. Status chip + dropdown menu, aksi = ikon bulat (hapus merah). Kartu "Monthly budget" (total + per objektif + batang proporsi) & "Not scheduled yet". Form: Objective/Status = segmen (bukan `<select>`), budget ber-affix Rp, konfirmasi hapus = dialog bergaya (bukan `confirm()` browser), Esc menutup. Tanpa tombol tema (tidak pernah ada).

**Analytics & Insights:** top bar judul + konteks | pil tanggal · refresh (tanpa tombol tema — sengaja, commit 821d8da). Hero "Performance score" = cincin tebal + "59/100" + chip status (ala panel "AI Search Visibility" referensi), kesimpulan, 6 angka ringkas + delta (Total Spend netral). Kartu insight: ikon tingkat berlatar + judul + chip tingkat (Critical merah · Warning kuning tua `--rg-warn` · Positive hijau · Info biru), isi, angka pendukung, tren.

**Laporan Export (1280×720):** header = "Baba Rafi Ad Hub" + judul + pil periode ("This month │ 1–28 Sep 2026") + konteks; 5 KPI ala layar (gradasi arah perubahan, sparkline bertitik akhir, "vs 1–28 Aug"); Spend Breakdown (donut + meter) & Cost Efficiency 2×2 (delta + meter batang) sama lebar; "Daily Trends" 4 garis diindeks ke puncak masing-masing + legenda rata-rata/hari + label ujung. Ikut tema (palet literal di `REPORT_THEME`). Laporan per bulan ikut (`reportData` kini juga mengirim `prevRange`, `frac`, `count` — rumus tidak berubah).
**⚠️ Jebakan html2canvas (terbukti saat verifikasi):** (1) `<svg>` ber-`position:absolute` TIDAK digambar → sparkline wajib di alur normal (pembungkus div relative); (2) `margin` pada `<svg>` dihitung dua kali → gambar turun & terpotong → margin di pembungkus; (3) fungsi warna modern (`color-mix`, `color()`, oklch) gagal di-parse → laporan pakai hex/rgba literal saja.

**Verifikasi ronde 4:** build lolos; Campaigns (sort 3 tahap, subtotal, pilih→bar melayang, dialog Edit Budget + Esc), Calendar (menu status, form + segmen, konfirmasi hapus — semua dibuka/ditutup tanpa mengubah data), Analytics (cincin, chip muat, 3 kartu), HP 375px, tema terang (kontras teks ≥4,5:1), laporan Export dirender dengan html2canvas asli project & dilihat gambarnya.
**Catatan:** saat pengujian beruntun, API sempat membalas 401 (verifikasi token Supabase gagal saat lonjakan) dan Meta membatasi daftar campaign (daftar kosong diam-diam) — bukan akibat redesain; dicatat sebagai tugas terpisah.
Verifikasi (pane browser tersembunyi, jadi ResizeObserver disimulasikan untuk pengecekan): 1920×953, 1920×1080, 1536×730, 1440×789, 1366×650 (+ sidebar terbuka), HP 375×812, tema gelap & terang. Scroll di layar pendek: 1366×650 = 156px, 1536×730 = 76px, 1440×789 = 17px, 1920 = 0.

## 13. RONDE 4b — DATA DUMMY DI SEMUA HALAMAN ADS HUB (28 Sep 2026)
Permintaan Nadir: fokus lokal, halaman Ads Hub pakai data dummy supaya bisa dilihat penuh tanpa menarik Meta (tarikan beruntun sempat membuat akun iklan dibatasi).
- **Satu saklar untuk semua halaman** (`app/components/demoMode.js`): panel Preview controls kini muncul di Dashboard, Campaigns, Calendar & Analytics (admin, desktop); nilai di localStorage `wd-preview-demo` (default NYALA), dibaca saat state dibuat → permintaan PERTAMA halaman sudah dummy, nol tarikan Meta. Chip "Demo data" di samping judul tiap halaman.
- **Data dihitung per hari** (`demoDashboard.js`): 12 campaign rekaan × tarif harian × pola mingguan × promo tgl 12–15 × faktor bulan × acak deterministik → rentang apa pun konsisten (Dashboard = Campaigns = Analytics = Compare; Compare "Sep vs Aug" sama persis dengan badge dashboard). Bulan ini vs bulan lalu = delta campur (6 kartu insight: Warning/Positive/Info, skor 84 "Good"); **"Last month" = bulan berat** (Leads −40%, CPL +62% → kartu Critical, skor 39).
- Isi khusus: campaign Stop (berhenti N hari lalu → hilang di "Last 7 days"), campaign Ended, kasus nyata nama "TRAFFIC" ber-objective Awareness (hasil = Impressions), campaign Conversion boros (kartu "Needs attention").
- **Campaigns:** Stop/Run & Edit Budget berjalan tapi hanya di memori (tidak ke Meta; bertahan saat pindah halaman, hilang saat refresh). Popup detail = poster iklan SVG rekaan bertanda DEMO (4:5 & 9:16, carousel 3 slide di campaign Conversion) + rincian Facebook/Instagram/Messenger/Audience Network.
- **Calendar:** 14 jadwal relatif bulan berjalan (menyeberang ke bulan lalu/depan, 2 tanpa tanggal), status otomatis dari tanggal; tambah/edit/hapus/ganti status hanya di memori — Supabase tidak disentuh (tanpa demo, Calendar asli September memang kosong).
- **Compare** ikut saklar (dua periode dari data dummy).
- Diverifikasi di localhost (sesi login Nadir): 4 halaman terisi, popup detail + Stop + Compare + tambah/ganti status Calendar jalan, **0 request ke /api/ maupun Supabase REST**, console bersih, saklar on/off berpindah data asli↔dummy, `npm run build` lolos.

## 14. RONDE 5 — EXPORT DEMO + DASHBOARD LEADS HUB GAYA RIDGELINE (28 Sep 2026)
Permintaan Nadir: (1) Export jalan dengan data dummy, (2) redesain Dashboard Leads Hub dengan nuansa Dashboard Ads Hub.
- **Export + Demo data:** tombol Export tidak lagi dimatikan saat demo; laporan (satu periode & pisah per bulan) dibangun dari data dummy, nama file diawali `DEMO-` supaya tidak tertukar dengan laporan asli (PREVIEW-ONLY di ExportMenu.js).
- **Dashboard Leads Hub (`app/leads/page.js` + `app/leads-ridgeline.css`, prefix `.rgl-`):** skin `.rg` penuh (Geist, kartu cangkang+panel, pil, delta, chip). SUSUNAN INFORMASI TETAP keputusan Nadir Jul 2026: KPI pair → Leads by Status (5 sel, tanpa donut) → Leads by Sales + By Category → baris uang DORMANT (naik ke bawah status saat ada Deal). Rumus & query TIDAK diubah.
  - **KPI ke-3 "Lead Quality" (pilihan Nadir 28 Sep 2026, dari 3 usulan):** % lead yang sudah Warm/Hot/Deal, delta dalam pts vs periode lalu, batang bertumpuk Warm·Hot·Deal (warna sama dgn panel status) + penanda prev, legenda mini di kepala kartu (disembunyikan ≤1180px), kaki "77 of 210 qualified". Deretan KPI = jumlah → kecepatan → kualitas. Usulan lain yang TIDAK dipilih (bisa menyusul): Response Time (median lead masuk → follow-up dari lead_history — RLS admin-only, bias bulk follow-up), Top City. CPL versi Leads Hub sengaja TIDAK disarankan (beda definisi dgn CPL Ads Hub).
  - Total Leads & Follow-up = anatomi KPI Ads Hub (kepala · panel bergradasi arah perubahan + tekstur titik · kaki). Total Leads: sparkline harian. Follow-up: meter "barcode" 60 batang (penerus meter barcode lama) + penanda "prev".
  - Status: 5 sel sejajar dipisah garis, warna status dari palet skin (No Status abu · Cold biru · Warm amber · Hot merah · Deal hijau). Sales: avatar berwarna (Akmel biru · Hendra ungu · Dedik teal, hue sama dengan Leads List). Kategori: batang teal (entitas Conversion).
  - Dormant = kartu garis putus-putus tanpa bayangan, teks redup, angka tetap tampil; menyala otomatis (cincin ROAS hijau) saat ada Deal.
  - Top bar: pil "N in Black Box" (admin) · pil kategori (menu rata tengah) · pil tanggal | refresh · tema. HP: banner Black Box, sel status 2 kolom, keterangan kepala kartu panjang disembunyikan.
  - **BARU (boleh dibuang):** delta vs periode sebelumnya di 2 KPI (query leads periode pembanding, aturan periode sama dgn Ads Hub → `previousRange` di rgKit), follow-up dalam poin persen ("pts"), rata-rata nilai per deal. **Dedup:** Total Closing & ROAS hanya di kartu Total Closing (dulu dobel di Cost & ROI → kini Conversion spend · Cost per deal · ROI).
- Kode bersama: `KpiSpark` & `previousRange` pindah ke `app/components/rgKit.js` (dipakai Dashboard Ads Hub & Leads Hub).
- Data dummy Leads (`buildDemoLeads` di demoDashboard.js): pola harian & faktor bulan sama dgn Ads Hub, status bergantung umur lead (Deal hanya lead ≥10 hari → "Last 7 days" = baris uang dormant), spend konversi = spend campaign PROSPEK/KONVERSI dummy (angkanya sama persis dengan Dashboard Ads Hub), 7 lead di Black Box.
- Diverifikasi (localhost, sesi Nadir): 1920×1080 fit tanpa scroll; 1366×768 scroll ±120px (sama pola Ads Hub di layar pendek), tanpa daftar terpotong; dormant ("Last 7 days") & menyala ("This month"); tema terang & gelap; HP 375px tanpa scroll samping; console bersih; `npm run build` lolos. Export: tombol aktif saat demo (unduhan file tidak dicoba dari pane).

## 15. RONDE 6 — LEADS LIST GAYA RIDGELINE (28 Sep 2026)
File: `app/leads/list/page.js` (ditulis ulang tampilannya) + `app/leads-list-ridgeline.css` (prefix `.rgll-`), warna status/sales dari `app/leads-ridgeline.css`.
- **Logika v3.0 dipertahankan utuh:** Black Box (approve/reject satuan & massal, NEW tidak hilang saat approve), sensor kontak role user (nomor/email disensor, copy & cari by nomor/email mati), label NEW hilang setelah aksi apa pun, Columns persist `wd-leads-cols-hidden`, filter kategori (split button) / status / sales / tanggal, bulk copy · follow-up context-aware · set status non-Deal · assign sales, Deal WAJIB nominal, paginasi 100, terbaru di atas. Query Supabase sama (tulis: satu id → `eq`, banyak → `in`, lewat helper `dbUpdate`).
- **Tampilan:** top bar (Add leads = pil utama gelap → Sync Meta / Import · pil tanggal · refresh · tema) → toolbar (tab segmen Black Box·All leads dengan panah kategori menempel = split button, cari pil, All status, All sales, Columns kanan; status & sales abu-abu not-allowed di Black Box) → kartu tabel (header rata kiri, aksi center, Closing kanan; chip warna per status & per sales; follow-up & notes = tombol bulat; kaki "Showing 1–100 of N" + paginasi). Menu Sales/Status per baris = menu fixed (tidak terpotong scroll, buka ke atas kalau dekat dasar layar). Dialog Deal/Notes/Import = skin dialog + Esc. Bar aksi massal & toast = bar melayang skin.
- **Perubahan kecil dari v3.0 (bisa dikembalikan):** urutan toolbar kini tab (Black Box · All leads) dulu baru cari — dulu cari di antara Black Box & All leads; kolom **centang + Name MENEMPEL** saat tabel digeser ke samping (temuan critique; scroll di lapisan dalam `.rgll-scroll` tanpa border supaya tidak ada 1px tembus); Email/Campaign/Category dipangkas (teks lengkap di tooltip).
- **Bug yang ditemukan & dicegah saat tes:** kalau baris tab lama tetap tampil (diredupkan) sambil tab baru dimuat, baris lead approved sempat mendapat tombol Approve/Reject Black Box → Reject bisa mengenai lead approved. Sekarang pindah tab = tabel dikosongkan (skeleton) + saat refresh baris tidak bisa diklik (`.rgll-well.rg-busy { pointer-events:none }`). Versi live tidak kena (dulu selalu skeleton).
- **Data dummy Leads kini satu gudang di memori** (`demoDashboard.js`: `demoLeadsList/Patch/Sync/InboxCount`, `buildDemoLeads` membaca gudang yang sama): 400 hari lead (±3.700 approved) + 7 di Black Box, nama/nomor (pola 081200xxxxxx)/email rekaan. Ubah di Leads List → Dashboard Leads Hub ikut berubah (terbukti: Deal baru → 6 deals, Total Closing +Rp 50 jt). Sync demo menambah 2–4 lead ke Black Box.
- Diverifikasi (localhost, sesi Nadir): status via menu, Deal (tombol terkunci s.d. nominal, ribuan otomatis), Notes + Esc, pilih baris (header "mixed"), bulk set status (menu ke atas), follow-up context-aware, Columns hide/show + persist (dikembalikan), Black Box approve & bulk bar, Sync; 1920×1080, 1366×768 (tabel digeser, Name menempel, header menempel), tema terang, HP 375px tanpa scroll samping; 0 request ke Supabase/API saat demo; `npm run build` lolos.

## 16. RONDE 7 — NOTES GAYA RIDGELINE (28 Sep 2026)
Permintaan Nadir: "cek project redesain lalu kerjakan redesain halaman Notes". File: `app/notes/page.js` (tampilan ditulis ulang), `app/components/TodoPanel.js`, `app/components/TodoDetail.js`, BARU `app/notes-ridgeline.css` (prefix `.rgn-`). Komponen bersama baru di `rgKit.js`: **`RgMenu`** (menu pil/baris, lapisan posisi `.rg-menu-pos` terpisah dari animasi, klik-luar + Esc) & **`RgDialog`** (dialog skin + Esc). `.rg-pill.is-primary` dipindah dari leads-list css ke `ridgeline.css` (dipakai Leads List & Notes).
- **Susunan & fitur TIDAK berubah:** daftar catatan + To Do di kolom kiri (lebar 240–520 & tinggi To Do 150–640 tetap bisa digeser + diingat), editor / detail tugas di kanan, minimize To Do, lipat grup Pinned/All notes, geser urutan catatan & tugas, auto-save 700 ms, checklist, auto-link + Ctrl+klik, paste teks polos, Tab, klik gutter = block baris, catatan terakhir diingat, suara selesai. Logika editor disalin utuh.
- **Tampilan:** top bar (judul + konteks "Workspace · N notes · N open tasks · Synced across your devices" | pil utama gelap **New note** · tema) → kolom kiri = kartu **Notes** (cangkang + panel: cari pil, grup Pinned/All notes berikon panah + jumlah mono, baris = judul + cuplikan & waktu rata kanan; pin/hapus/pegangan geser muncul saat disentuh, pin aktif selalu tampil) + celah 12px (pegangan pil saat disentuh = pembatas geser) + kartu **To Do** (kepala: ikon · To Do · "3 open" · tombol minimize bulat · pil view yang membuka ke ATAS). Kartu kanan: kepala = toolbar format ikon (Heading & Clear formatting kini ikon) + tombol copy; panel = judul besar 22px + meta (chip Pinned · Saving…/✓ Saved/Edited …) + garis + isi catatan.
- **Detail tugas:** kepala "Task · daftar" + tombol tutup (BARU — kembali ke catatan), judul 20px + lingkaran selesai + bintang, Steps, grup aksi (My Day · Due date · List) memakai `RgMenu`, Note (textarea skin), kaki "Created …" + Delete.
- **Dialog:** hapus catatan/tugas/daftar = `RgDialog` merah (Esc/klik latar menutup, tombol terkunci selama proses, TANPA autofocus di Delete supaya Enter tidak langsung menghapus); **daftar baru / ganti nama = dialog** (dulu editor sebaris di kepala panel yang sempit).
- **Warna:** isi netral. Link di catatan = biru `--rg-spend` (satu-satunya teks berwarna, dulu warna aksen); centang ☑ & lingkaran selesai = hijau `--rg-pos`; bintang Important & ikon My Day aktif = kuning tua `--rg-warn`; terlambat = merah. **Stabilo di tema gelap** kini teks gelap di atas warna pastel (dulu teks putih di atas kuning muda — tidak terbaca).
- **Perbaikan ikut:** cuplikan & "Copy as plain text" dulu menempelkan Heading ke baris berikutnya ("Fokus bulan iniPromo…") → h3 kini dihitung satu baris. Baris catatan dirender lewat fungsi (dulu komponen di dalam komponen → remount tiap ketikan). Lebar kolom tersimpan di luar rentang baru dijepit (min naik 210→240), tinggi To Do dijepit supaya kartu Notes ≥150px di layar pendek.
- **HP:** satu kolom seperti dulu (daftar ↔ editor via tombol kembali di top bar), New note sebaris dengan judul, konteks diringkas "6 notes · 7 open tasks", aksi baris selalu tampil.
- **Data dummy (PREVIEW-ONLY):** `demoNotes.js` = klien Supabase tiruan (`from().select/insert/update/delete/eq/single`) berisi 6 catatan (heading, bullet, numbered, checklist, stabilo, link), 2 daftar, 10 tugas (My Day, Important, jatuh tempo kemarin/hari ini/besok/minggu depan, steps, selesai). Semua aksi hanya di memori; **catatan asli Nadir tidak disentuh** (terverifikasi 0 request ke Supabase REST). Id `demo-…` tidak menimpa "catatan terakhir dibuka" milik data asli.
- Diverifikasi (localhost, sesi Nadir, data dummy): 1440×900 & 1280×720 tanpa scroll halaman, tema gelap & terang, HP 375px tanpa scroll samping (daftar + editor), pilih tugas → detail → tutup, menu view (ke atas) + pil mengalah dengan elipsis di daftar bernama panjang, Rename list via dialog + Enter, hapus catatan + Esc, ketik → Saving…/Saved, auto-link saat spasi, stabilo buka/tutup klik-luar, centang, lipat grup, minimize To Do (50px, kepala utuh), geser lebar & tinggi (tersimpan; nilai tes sudah dikembalikan ke default), console bersih, `npm run build` lolos.

## 17. RONDE 8a — OUTLET MAPS GAYA RIDGELINE + PETA DASAR BARU (28 Sep 2026)
Permintaan Nadir: redesain Outlet Maps (Maps Hub). Keputusan Nadir: peta dasar = **OpenStreetMap abu-abu** (gratis, tanpa akun/API key); perbaikan peta **ikut redesain** (TIDAK di-hotfix ke web live dulu — web live tetap tanpa peta dasar sampai redesain di-merge).
- File: `app/maps/page.js` (tampilan ditulis ulang), BARU `app/maps-ridgeline.css` (prefix `.rgm-`), `MapView.js`, `mapsConfig.js`. Logika data (sync, geocode berulang, mark done, mapping Depo→Provinsi, filter, batas 100 baris) TIDAK berubah; semua panggilan lewat satu pintu `callApi()`.
- **Peta dasar:** CARTO membalas gambar "API KEY REQUIRED" (dicek lagi 28 Sep 2026) → `tile.openstreetmap.org` (atribusi "© OpenStreetMap contributors"). Warna OSM dibuat netral via CSS filter di pane tile: terang `grayscale + contrast .88 + brightness 1.06`, gelap `grayscale + invert + contrast .82 + brightness .82`. Tile gagal (≥6 gagal, 0 berhasil) → pesan kecil di peta, outlet tetap tampil. Terverifikasi dengan data asli (486 outlet) di localhost.
- **Susunan baru:** top bar (judul + konteks "Maps Hub · N outlets · Google Sheets (read-only) · Last sync …" | tombol Wilayah bulat + badge depo belum dipetakan · **Sync sheet** pil utama · refresh · tema) → banner geocode (biru info, progress bar, Stop) → kartu **Outlets by status** (5 sel = tombol filter, gaya "Leads by Status"; Total punya batang bertumpuk 3 status) → **toolbar filter DIPINDAH ke atas peta** (cari · Depo · Province · City · Reset · "N of M outlets" — berlaku untuk peta & tabel; dulu di dalam kartu tabel) → peta (kepala: "N on map" + legenda) + panel Alerts | Data quality (segmen + jumlah; chip "N to register / N to claim"; alert = ikon bulat berwarna + tombol ✓ hijau) → tabel Outlets (chip status, tombol ikon Maps, kaki "Showing 100 of N" + Show all). Klik baris → **kartu peta digulir ke layar** lalu terbang ke outlet (BARU; dulu peta bisa di luar layar). Dialog Depo → Province = `RgDialog` + chip provinsi (Esc menutup). Toast hasil sync = kartu skin kanan-bawah.
- Warna status = token `--mp-*` (Registered hijau `--rg-pos` · Not Registered kuning tua · Needs Claim biru · Needs review merah); teks kuning memakai tinta gelap (kontras). Cluster = lingkaran netral kontras tinggi + halo. Popup Leaflet ikut skin.
- Data dummy (PREVIEW-ONLY) `demoMaps.js`: 446 outlet di 25 depo, 9 alert (relokasi/info berubah/hilang), data quality (2 duplikat, 3 koordinat rusak, 1 depo kosong, 1 baris dilewati), 2 depo belum dipetakan, 16 outlet tanpa kota (banner geocode). Semua aksi hanya di memori.
- Jebakan: isi `.rg-body` halaman yang boleh scroll WAJIB `flex-shrink: 0` — tanpa itu kartu status tergencet & tertimpa toolbar. `.rg-pill.is-set` dipindah ke `ridgeline.css` (dipakai Leads List & Maps).
- Diverifikasi: 1440×900 & 1280×720, tema gelap/terang, HP 375px tanpa scroll samping (refresh di top bar HP), filter status/Depo, mark done, tab Data quality, dialog provinsi + Esc, Sync + toast, Geocode sampai selesai, klik baris → popup, data asli (read-only) tampil, `npm run build` lolos. Commit `aa83b18`.

## 18. RONDE 8b — LEADS HUB → ANALYTICS & INSIGHTS DIBANGUN (28 Sep 2026)
Permintaan Nadir: "bangun halaman beneran tapi pakai data dummy dulu", keempat panel dipilih. Dulu `LeadsPlaceholder` ("under development") — komponen itu kini TIDAK dipakai lagi (boleh dihapus saat bersih-bersih).
- File: `app/leads/insights/page.js`, BARU `app/components/leadsInsightEngine.js` (mesin murni: `buildLeadsAnalysis(rows, prevRows, range, prevRange)` → metrik + insight), BARU `app/leads-insights-ridgeline.css` (prefix `.rgi-`; kartu insight meminjam `reports-ridgeline.css`, warna status `leads-ridgeline.css`). `DateFilterContext` + `useLeadsInsightsFilter` (filter tanggal sendiri, default This month). Filter kategori promo = `RgMenu`.
- **Definisi = Dashboard Leads Hub** (lead approved, cohort by created_at, preset tanggal sama persis, periode pembanding `previousRange`): Qualified = Warm/Hot/Deal (= Lead Quality) · Contacted = follow-up ATAU sudah diberi status · Time to deal = deal_date − tanggal lead masuk · jam & hari masuk = waktu lokal (WIB). Nama kota dirapikan (spasi & kapital).
- **Isi (atas → bawah):** (1) **What stands out** — ≤6 kartu insight rule-based, urut Critical→Warning→Positive→Info: volume vs periode lalu, antrean lead >2 hari belum dihubungi, Lead Quality naik/turun (+ catatan lead masih baru), sumber terbaik / sumber berkualitas rendah (min. 15/20 lead), kecepatan closing, jam & hari tersibuk, lead tanpa sales, beban sales timpang, kota teratas; <5 lead → satu kartu "Not enough leads". (2) **Leads over time** — batang bertumpuk per kategori promo (per hari; >62 hari → per minggu mulai Senin), tooltip angka asli, kaki rata-rata & hari tersibuk + **Lead funnel** (Leads → Contacted → Qualified → Hot or Deal → Deal, % dari semua & dari langkah sebelumnya). (3) **Lead sources** — tabel per campaign (Leads, Contacted %, Qualified % + batang, Deals, Closing; baris total) + **Time to deal** (rata-rata hari, delta vs periode lalu — lebih cepat = hijau, histogram 0–7/8–14/15–30/31–60/60+, median; tanpa deal = kartu redup garis putus). (4) **Top cities** (8 teratas + % tanpa kota) + **When leads arrive** (peta panas 7 hari × 24 jam, sel tersibuk bergaris).
- Data dummy: gudang lead yang SAMA dengan Dashboard Leads & Leads List (`demoDashboard.js`); sumber lead kini 4 campaign (2 Autopilot + 2 form umum "Uncategorized"), form website umum sengaja berkualitas rendah → insight "sumber lemah" bisa muncul. "Last 7 days" = kondisi belum ada deal.
- Diverifikasi: 1440×900 & 1280×720 (tidak ada kartu yang isinya meluap; daftar kota menggulir di dalam kartu), tema gelap/terang, HP 375px, tooltip grafik, preset Last 7 days & kuartal Q2 (per minggu), **query data asli terbukti jalan** (read-only; Q2 = 157 lead asli, join campaign OK), console bersih, `npm run build` lolos.

## 19. RONDE 9 — LOGIN GAYA RIDGELINE (28 Sep 2026)
Keputusan Nadir (dari 3 pilihan): **kartu di tengah** (susunan lama, bukan layar terbelah) · **tema ikut tema terakhir di perangkat** (data-theme dari skrip no-flash — TIDAK lagi dikunci terang seperti keputusan Jul 2026) · **logo mark di lingkaran Saffron + "Baba Rafi Ad Hub"** (logo mark tidak diubah; Saffron = aksen brand sidebar).
- File: BARU `app/components/LoginScreen.js` (tampilan + logika, dipisah supaya bisa dipratinjau), `app/login/page.js` jadi pembungkus tipis, BARU `app/login-ridgeline.css` (prefix `.rgin-`), `AuthContext.js` pesan error kini Inggris ("Wrong email or password." / "Sign-in failed — please try again.").
- Logika masuk SAMA: `login(email, password, remember)` → `homeFor(role)`; Remember me = sesi localStorage vs sessionStorage.
- Tampilan: kanvas skin + tekstur titik halus memudar ke tepi; kartu cangkang (kepala logo + nama) → panel (judul "Sign in", kolom email & password ber-ikon 46px, mata tampil/sembunyi, Remember me = kotak centang netral, "Forgot password?" = catatan info biru "Passwords are reset by the Ad Hub admin…" — dulu tampil sebagai ERROR merah berbahasa Indonesia) → tombol utama gelap penuh + spinner saat masuk → kaki "Internal team access · © 2026 Baba Rafi".
- BARU (kecil): validasi kosong di klien ("Enter your email and password."), peringatan **Caps Lock is on** di kolom password, kolom email fokus otomatis, warna autofill browser ikut panel, placeholder email netral (TIDAK menampilkan pola nama akun internal), isian 16px di HP (iPhone tidak nge-zoom).
- PREVIEW-ONLY: `/preview-login` merender `<LoginScreen preview />` di atas app (tombol Sign in dimatikan) + bar "Back to app · Login preview · tema"; tautan "View login page" di panel Preview. Alasan: /login asli me-redirect pengguna yang sudah login.
- Diverifikasi (via /preview-login): 1440×900 gelap & terang, HP 375px tanpa scroll samping, error kosong + garis merah, catatan Forgot password, tampil/sembunyi password, Remember me, `npm run build` lolos. /login asli memakai komponen yang sama (tidak bisa dibuka saat login).

