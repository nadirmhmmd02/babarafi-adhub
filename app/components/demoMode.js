'use client';

/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ (hapus seluruh file ini + pemakaiannya sebelum push produksi)
   ─────────────────────────────────────────────────────────────
   SAKLAR "DEMO DATA" BERSAMA untuk semua halaman Ads Hub redesain (Dashboard,
   Campaigns, Calendar, Analytics & Insights). Satu tombol di panel Preview
   controls → semua halaman ikut, tersimpan di localStorage `wd-preview-demo`
   (default NYALA; '0' = mati). Hanya hidup di `npm run dev` — di build produksi
   DEMO_ALLOWED = false sehingga saklar selalu mati.
   Nilai dibaca LANGSUNG saat state dibuat (bukan lewat efek) supaya permintaan
   pertama halaman sudah dummy — tidak ada tarikan Meta sia-sia yang bisa memicu
   pembatasan akun iklan saat review. Aman dari hydration mismatch karena AppShell
   baru merender halaman di klien setelah sesi login terbaca.
   ───────────────────────────────────────────────────────────── */

import { useState, useEffect } from 'react';

export const DEMO_ALLOWED = process.env.NODE_ENV !== 'production';
const KEY = 'wd-preview-demo';
const EVT = 'wd-demo-change';

export function isDemoOn() {
  if (!DEMO_ALLOWED || typeof window === 'undefined') return false;
  try { return localStorage.getItem(KEY) !== '0'; } catch { return false; }
}

export function setDemoMode(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {}
  window.dispatchEvent(new Event(EVT));
}

/* State demo yang ikut berubah kalau saklar di-klik (di halaman ini atau tab lain). */
export function useDemoMode() {
  const [demo, setDemo] = useState(isDemoOn);
  useEffect(() => {
    if (!DEMO_ALLOWED) return;
    const sync = () => setDemo(isDemoOn());
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return demo;
}

/* Penanda kecil di sebelah judul halaman saat data dummy aktif. */
export function DemoChip() {
  return (
    <span style={{
      padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 500, whiteSpace: 'nowrap',
      background: 'rgba(233,160,52,0.16)', color: '#D98F1F',
    }}>Demo data</span>
  );
}

/* Jeda kecil supaya skeleton/animasi muat tetap terlihat seperti data asli. */
export const demoDelay = (ms = 350) => new Promise(res => setTimeout(res, ms));
/* ═══ END PREVIEW-ONLY ═══ */
