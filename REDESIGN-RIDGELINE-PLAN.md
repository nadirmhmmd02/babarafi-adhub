# REDESAIN 2 — GAYA "RIDGELINE" (Dashboard Ads Hub + Sidebar)

Status: **🔄 DILANJUTKAN 28 Sep 2026 — preview LOKAL, BELUM LIVE.** Semua kode ada di branch lokal `redesign/dashboard-ridgeline` (tidak di-push; web live & branch `main` tidak tersentuh).
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
| Leads Hub, Maps, Notes, Login | ⏳ Belum — di luar kategori Ads Hub, tetap versi lama |
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
- Hapus file `app/components/demoDashboard.js` (data dummy semua halaman), `app/components/demoMode.js` (saklar bersama) dan `app/components/PreviewPanel.js` (panel preview).
- Buang semua blok bertanda `PREVIEW-ONLY — JANGAN DI-PUSH` di: `app/page.js` (import, `useDemoMode`, cabang dummy di `fetchData`, chip, Export dimatikan saat demo, render `PreviewPanel`), `app/campaigns/page.js` (+ cabang Stop/Run & Edit Budget lokal), `app/calendar/page.js` (+ CRUD di memori), `app/reports/page.js` (+ `useAuth` khusus panel, teks chip "demo data"), `app/components/CompareModal.js`, `app/components/CampaignModal.js`. Cek: `grep -rn "PREVIEW-ONLY" app` harus kosong.
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

