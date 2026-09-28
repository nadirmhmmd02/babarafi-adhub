/* ─────────────────────────────────────────────────────────────
   FONT ADS HUB — redesain "Ridgeline" (preview lokal Sep 2026)
   Referensi Nadir memakai sans grotesk + angka monospace → Geist + Geist Mono.
   Dipasang (lewat CSS variable) di akar halaman Ads Hub (.rg: Dashboard,
   Campaigns, Calendar, Analytics & Insights) + Sidebar; halaman lain tetap
   Plus Jakarta Sans. Laporan Export (PDF/JPG) ikut Geist sejak 28 Sep 2026
   (permintaan Nadir: hasil download laporan disesuaikan dengan desain baru).
   ───────────────────────────────────────────────────────────── */
import { Geist, Geist_Mono } from 'next/font/google';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

export const dashboardFontVars = `${geist.variable} ${geistMono.variable}`;
