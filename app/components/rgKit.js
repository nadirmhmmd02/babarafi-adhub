'use client';

/* ─────────────────────────────────────────────────────────────
   RG KIT — potongan bersama halaman Ads Hub redesain "Ridgeline"
   (Dashboard, Campaigns, Analytics & Insights). Styling di app/ridgeline.css.
   Satu sumber untuk: preset → rentang tanggal nyata, format rentang pendek,
   delta ber-ikon bulat, ikon (i) definisi, pil filter tanggal, periode pembanding
   (previousRange), sparkline kartu KPI (KpiSpark — Dashboard Ads Hub & Leads Hub),
   menu pilihan (RgMenu) & dialog (RgDialog) — dipakai halaman Notes.
   ───────────────────────────────────────────────────────────── */

import { useState, useRef, useEffect, useId } from 'react';
import { ArrowUp, ArrowDown, Info, Calendar, ChevronDown, Check, X } from 'lucide-react';
import { monotonePath } from './AreaChart';

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

/* Menu pilihan: tombol (default pil) + daftar .rg-menu. Lapisan POSISI (.rg-menu-pos)
   dipisah dari lapisan ANIMASI (.rg-menu wdScaleIn) — kalau digabung popup "loncat".
   Klik di luar (guard contains) / Esc menutup. Opsi: { value, label, Icon?, dot?, hint?, tone? }.
   `footer` boleh fungsi (close) => node, untuk tombol aksi di kaki menu. Dipakai Notes (To Do). */
export function RgMenu({
  options, value, onSelect, label, icon: Icon, dot, title, disabled,
  className = 'rg-pill', align = 'left', direction = 'down', minWidth = 180,
  footer, block = false, caret = true, showCheck = true,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div ref={ref} className={`rg-menu-wrap${block ? ' is-block' : ''}`}>
      <button type="button" className={className} aria-expanded={open} aria-haspopup="menu"
        title={title} disabled={disabled} onClick={() => setOpen(o => !o)}>
        {Icon && <Icon size={15} />}
        {dot && <span className="rg-menu-dot" style={{ background: dot }} />}
        {label != null && <span className="rg-menu-label">{label}</span>}
        {caret && <ChevronDown size={14} className="rg-caret" />}
      </button>
      {open && (
        <div className={`rg-menu-pos is-${direction} is-${align}`}>
          <div className="rg-menu" role="menu" style={{ minWidth }}>
            {options.map(o => {
              const on = value !== undefined && o.value === value;
              const OIcon = o.Icon;
              return (
                <button key={String(o.value)} type="button" role="menuitemradio" aria-checked={on}
                  className={`rg-menu-item${on ? ' is-on' : ''}${o.tone ? ` is-${o.tone}` : ''}`}
                  onClick={() => { onSelect(o.value); close(); }}>
                  {OIcon && <OIcon size={15} className="rg-menu-ico" />}
                  {o.dot && <span className="rg-menu-dot" style={{ background: o.dot }} />}
                  <span className="rg-menu-label">{o.label}</span>
                  {o.hint && <span className="rg-menu-hint">{o.hint}</span>}
                  {showCheck && on && <Check size={14} className="rg-menu-check" />}
                </button>
              );
            })}
            {footer && <div className="rg-menu-foot">{typeof footer === 'function' ? footer(close) : footer}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* Dialog skin (.rg-dialog) — Esc & klik latar menutup (kecuali sedang `busy`). */
export function RgDialog({ icon: Icon, tone, title, sub, onClose, busy, children, foot, width }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);
  return (
    <div className="rg-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="rg-dialog" role="dialog" aria-modal="true" aria-label={title} style={width ? { maxWidth: width } : undefined}>
        <div className="rg-dialog-head">
          {Icon && <span className={`rg-dialog-ico${tone ? ` is-${tone}` : ''}`}><Icon size={17} /></span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="rg-dialog-title">{title}</div>
            {sub && <div className="rg-dialog-sub rg-clip">{sub}</div>}
          </div>
          <button type="button" className="rg-iconbtn" onClick={onClose} disabled={busy} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="rg-dialog-body">{children}</div>
        {foot && <div className="rg-dialog-foot">{foot}</div>}
      </div>
    </div>
  );
}

/* Periode pembanding — SALINAN previousRange() di app/api/meta/route.js (aturan Nadir
   2 Sep 2026): N bulan kalender penuh → N bulan tepat sebelumnya; bulan berjalan →
   tanggal yang sama bulan lalu; selain itu → periode sama panjang tepat sebelumnya.
   Dipakai Dashboard Leads Hub (delta vs periode sebelumnya) — jaga sinkron. */
export function previousRange(since, until) {
  const P = s => new Date(s + 'T00:00:00Z');
  const Y = d => d.toISOString().slice(0, 10);
  const s = P(since), u = P(until);
  if (s.getUTCDate() === 1 && u >= s) {
    const months      = (u.getUTCFullYear() - s.getUTCFullYear()) * 12 + (u.getUTCMonth() - s.getUTCMonth()) + 1;
    const lastOfUntil = new Date(Date.UTC(u.getUTCFullYear(), u.getUTCMonth() + 1, 0)).getUTCDate();
    const prevUntilD  = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 0));
    if (u.getUTCDate() === lastOfUntil) {
      return { since: Y(new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() - months, 1))), until: Y(prevUntilD) };
    }
    if (months === 1) {
      const prevSinceD = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() - 1, 1));
      const day        = Math.min(u.getUTCDate(), prevUntilD.getUTCDate());
      return { since: Y(prevSinceD), until: Y(new Date(Date.UTC(prevSinceD.getUTCFullYear(), prevSinceD.getUTCMonth(), day))) };
    }
  }
  const len = Math.round((u - s) / 86400000) + 1;
  const pu = new Date(s); pu.setUTCDate(pu.getUTCDate() - 1);
  const ps = new Date(pu); ps.setUTCDate(ps.getUTCDate() - (len - 1));
  return { since: Y(ps), until: Y(pu) };
}

/* ─── Sparkline kartu KPI: kurva + titik akhir bercincin + garis jatuh putus-putus ───
   Revisi 28 Sep 2026: dulu digambar dalam persen (viewBox 0–100) di pita ±29px, titik
   akhir yang rendah terpotong tepi bawah panel. Sekarang diukur dalam piksel asli
   (ResizeObserver): garis berada di pita SPARK_T dari atas s.d. SPARK_B dari bawah,
   titik terakhir berhenti SPARK_R dari tepi kanan → cincin titik selalu utuh. */
const SPARK_T = 10, SPARK_B = 16, SPARK_R = 18;
export function KpiSpark({ data }) {
  const gid = useId().replace(/:/g, '');
  const ref = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setBox({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vals = (data || []).filter(v => v != null && v >= 0);
  const { w, h } = box;
  let body = null;
  if (vals.length >= 2 && w > SPARK_R && h > SPARK_T + SPARK_B) {
    const max = Math.max(...vals), min = Math.min(...vals);
    const band = h - SPARK_T - SPARK_B;
    const pts = vals.map((v, i) => ({
      x: (i / (vals.length - 1)) * (w - SPARK_R),
      // Nilai datar (semua sama) → garis di tengah pita, bukan menempel di dasar
      y: SPARK_T + (max > min ? (1 - (v - min) / (max - min)) * band : band / 2),
    }));
    const d = monotonePath(pts);
    const last = pts[pts.length - 1];
    body = (<>
      <svg width={w} height={h}>
        <defs>
          <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--rg-tone)', stopOpacity: 0.26 }} />
            <stop offset="100%" style={{ stopColor: 'var(--rg-tone)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={`${d}L${last.x.toFixed(1)},${h}L0,${h}Z`} fill={`url(#${gid}-g)`} className="rg-area" />
        <path d={d} fill="none" pathLength="1" strokeDasharray="1"
          className="rg-spark-line"
          style={{ stroke: 'var(--rg-tone)', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
      </svg>
      <span className="rg-spark-drop" style={{ left: last.x, top: last.y }} />
      <span className="rg-spark-dot" style={{ left: last.x, top: last.y }} />
    </>);
  }
  return <div ref={ref} className="rg-spark" aria-hidden="true">{body}</div>;
}
