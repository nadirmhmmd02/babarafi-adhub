'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

/* ─────────────────────────────────────────────────────────────
   SPRING CHECK — lingkaran "selesai" To Do yang memantul (adaptasi "Spring Check"
   React Bits, kategori Micro, Sep 2026). Tanpa library motion: pegas kecil
   ditulis sendiri di sini.

   useSpringCheck(on) → ref untuk elemen BARIS. Tiap frame menulis variabel CSS
   --sc-fill / --sc-box / --sc-tick / --sc-word / --sc-rule ke elemen itu, lalu
   dibaca turunannya:
   - <CheckCircle/> : isi hijau membesar dari tengah (sedikit kebablasan lalu
                      mantul balik), lingkaran menggembung, centang tergambar
   - <StrikeText/>  : garis coret memanjang kiri→kanan + teks meredup
   Styling di notes-ridgeline.css (.sc-*). Hormati prefers-reduced-motion.
   ───────────────────────────────────────────────────────────── */

// Pegas ≈ React Bits: visual duration 0,2 detik, pantulan ±20% (bounce 0.2)
const VISUAL = 0.2;
const OMEGA = (2 * Math.PI) / (VISUAL * 1.2);
const ZETA = 0.456;
const SWELL = 0.35;                         // lingkaran menggembung saat isi kebablasan
const RULE_LAG = 0.12, RULE_END = 0.84;     // garis coret mulai sedikit telat, penuh sebelum isi
const DONE_OPACITY = 0.55;                  // teks tugas selesai meredup ke sini

const clamp01 = v => Math.min(1, Math.max(0, v));

function paint(el, x) {
  if (!el) return;
  const held = clamp01(x);
  el.style.setProperty('--sc-fill', Math.max(x, 0).toFixed(4));
  el.style.setProperty('--sc-box', (1 + SWELL * Math.max(0, x - 1)).toFixed(4));
  el.style.setProperty('--sc-tick', (1 - held).toFixed(4));
  el.style.setProperty('--sc-word', (1 - (1 - DONE_OPACITY) * held).toFixed(4));
  el.style.setProperty('--sc-rule', clamp01((held - RULE_LAG) / (RULE_END - RULE_LAG)).toFixed(4));
}

export function useSpringCheck(on) {
  const ref = useRef(null);
  const st = useRef({ x: on ? 1 : 0, v: 0, raf: 0 });

  // Nilai awal ditulis sebelum layar digambar → tugas selesai langsung tampil tercentang
  useLayoutEffect(() => { paint(ref.current, st.current.x); }, []);

  useEffect(() => {
    const s = st.current;
    const target = on ? 1 : 0;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { s.x = target; s.v = 0; paint(ref.current, target); return undefined; }
    if (s.x === target && s.v === 0) return undefined;
    let last = performance.now();
    const step = now => {
      const dt = Math.min(0.064, (now - last) / 1000);
      last = now;
      // integrasi semi-implisit dalam langkah 4 ms — stabil walau frame tersendat;
      // posisi & kecepatan dibawa terus, jadi klik ulang di tengah animasi berbalik mulus
      const n = Math.max(1, Math.ceil(dt / 0.004));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        const a = -OMEGA * OMEGA * (s.x - target) - 2 * ZETA * OMEGA * s.v;
        s.v += a * h;
        s.x += s.v * h;
      }
      if (Math.abs(s.x - target) < 0.0015 && Math.abs(s.v) < 0.02) {
        s.x = target; s.v = 0; s.raf = 0;
        paint(ref.current, target);
        return;
      }
      paint(ref.current, s.x);
      s.raf = requestAnimationFrame(step);
    };
    s.raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(s.raf);
  }, [on]);

  return ref;
}

/* Lingkaran selesai — ukuran sama dengan ikon lucide Circle lama (lingkaran 20/24 kotak) */
export function CheckCircle({ size = 17 }) {
  return (
    <span className="sc-circle" aria-hidden="true"
      style={{ width: size, height: size, '--sc-ring': `${size >= 22 ? 2 : 1.5}px` }}>
      <span className="sc-box">
        <span className="sc-fill" />
        <svg className="sc-tick" viewBox="0 0 24 24">
          <path d="M20 6 9 17l-5-5" pathLength="1" strokeDasharray="1" />
        </svg>
      </span>
    </span>
  );
}

/* Teks + garis coret animasi (lebar garis = lebar teks, terpotong elipsis kalau panjang) */
export function StrikeText({ children }) {
  return (
    <span className="sc-strike">
      <span className="sc-word">{children}</span>
      <span className="sc-rule" aria-hidden="true" />
    </span>
  );
}
