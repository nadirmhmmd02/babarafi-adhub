/* ─────────────────────────────────────────────────────────────
   FONT DASHBOARD ADS HUB — redesain "Ridgeline" (preview lokal Sep 2026)
   Referensi Nadir memakai sans grotesk + angka monospace → Geist + Geist Mono.
   Hanya dipasang di akar halaman Dashboard (lewat CSS variable), jadi halaman
   lain tetap Plus Jakarta Sans. `jakarta` di sini khusus mengunci font laporan
   Export (PDF/JPG) supaya hasil export tidak ikut berubah.
   ───────────────────────────────────────────────────────────── */
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const dashboardFontVars = `${geist.variable} ${geistMono.variable} ${jakarta.variable}`;
