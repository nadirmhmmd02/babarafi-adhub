'use client';

/* ─────────────────────────────────────────────────────────────
   RG KIT — potongan bersama halaman Ads Hub redesain "Ridgeline"
   (Dashboard, Campaigns, Analytics & Insights). Styling di app/ridgeline.css.
   Satu sumber untuk: preset → rentang tanggal nyata, format rentang pendek,
   delta ber-ikon bulat, ikon (i) definisi, dan pil filter tanggal.
   ───────────────────────────────────────────────────────────── */

import { ArrowUp, ArrowDown, Info, Calendar, ChevronDown } from 'lucide-react';

export const ID  = 'id-ID';
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function ymdLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* Preset → rentang tanggal nyata (pil filter, Periode A di Compare, header laporan).
   Sama persis dengan perhitungan preset di server (app/api/meta/route.js). */
export function presetToRange(preset) {
  const now = new Date();
  const today = ymdLocal(now);
  const add = n => { const d = new Date(now); d.setDate(d.getDate() + n); return ymdLocal(d); };
  switch (preset) {
    case 'today':      return { since: today,   until: today };
    case 'yesterday':  return { since: add(-1), until: add(-1) };
    case 'last_3d':    return { since: add(-3),  until: add(-1) };
    case 'last_7d':    return { since: add(-7),  until: add(-1) };
    case 'last_14d':   return { since: add(-14), until: add(-1) };
    case 'last_30d':   return { since: add(-30), until: add(-1) };
    case 'this_month': return { since: ymdLocal(new Date(now.getFullYear(), now.getMonth(), 1)), until: today };
    case 'last_month': return {
      since: ymdLocal(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      until: ymdLocal(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
    default:           return { since: add(-30), until: add(-1) };
  }
}

// "1–27 Sep", "28 Aug – 3 Sep", "1 Jan – 30 Apr 2026"
export function fmtRangeShort(since, until, withYear = false) {
  if (!since || !until) return '';
  const [y1, m1, d1] = since.split('-').map(Number);
  const [y2, m2, d2] = until.split('-').map(Number);
  const yr = withYear ? ` ${y2}` : '';
  if (since === until)             return `${d1} ${MON[m1 - 1]}${yr}`;
  if (y1 === y2 && m1 === m2)      return `${d1}–${d2} ${MON[m1 - 1]}${yr}`;
  if (y1 === y2)                   return `${d1} ${MON[m1 - 1]} – ${d2} ${MON[m2 - 1]}${yr}`;
  return `${d1} ${MON[m1 - 1]} ${y1} – ${d2} ${MON[m2 - 1]} ${y2}`;
}

export function fmtClock(d) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Persen 1 desimal gaya Indonesia (koma desimal), tanpa tanda — arah dibawa ikon
export function fmtPct1(v) {
  return Math.abs(v).toLocaleString(ID, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

/* ─── Arah perubahan → nada warna ───
   good: 'up' (naik = bagus), 'down' (biaya: turun = bagus), 'none' (Spend: naik/turun
   adalah keputusan budget, bukan baik/buruk → abu-abu netral). */
export function toneOf(pct, good) {
  if (pct == null || !isFinite(pct)) return 'na';
  if (good === 'none') return 'neu';
  return (pct >= 0) === (good === 'up') ? 'pos' : 'neg';
}

export function Delta({ pct, good = 'up' }) {
  const tone = toneOf(pct, good);
  if (tone === 'na') return <span className="rg-delta is-na" title="No data in the comparison period">—</span>;
  const Arrow = pct >= 0 ? ArrowUp : ArrowDown;
  return (
    <span className={`rg-delta is-${tone}`}>
      <span className="rg-delta-ico" aria-hidden="true"><Arrow size={10} strokeWidth={3} /></span>
      <span className="rg-sr">{pct >= 0 ? 'Up' : 'Down'} </span>
      {fmtPct1(pct)}
    </span>
  );
}

// Ikon (i) — definisi metrik muncul saat hover/fokus (CSS murni, lihat .rg-info)
export function InfoTip({ text, align }) {
  if (!text) return null;
  return (
    <button type="button" className="rg-info" data-tip={text} data-align={align} aria-label={text}>
      <Info size={13} />
    </button>
  );
}

/* Pil filter tanggal: "This month │ 1–28 Sep 2026" (label preset disembunyikan saat header
   sempit). `children` = popup DateFilterPopup, dirender hanya saat `open`. Atribut
   data-filter dipakai listener klik-di-luar di tiap halaman. */
export function DatePill({ open, onToggle, isMobile, isCustom, presetLabel, mobileLabel, rangeText, children }) {
  return (
    <div style={{ position: 'relative' }} data-filter>
      <button type="button" className="rg-pill" aria-expanded={open} aria-haspopup="dialog"
        title="Date range" onClick={onToggle}>
        <Calendar size={15} />
        {isMobile ? (
          <span>{mobileLabel}</span>
        ) : (<>
          <span className="rg-date-preset rg-hide-narrow">{isCustom ? 'Custom range' : presetLabel}</span>
          <span className="rg-date-sep rg-hide-narrow" aria-hidden="true" />
          <span>{rangeText}</span>
        </>)}
        <ChevronDown size={14} className="rg-caret" />
      </button>
      {open && children}
    </div>
  );
}
