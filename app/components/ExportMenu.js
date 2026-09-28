'use client';

import { useState, useRef, useEffect, useId, forwardRef } from 'react';
import {
  Download, ChevronDown, FileText, Image as ImageIcon, Loader2, Calendar,
  Wallet, Users, Eye, MousePointerClick, UserPlus, ChartPie, Gauge, ChartLine,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { authFetch } from '../supabase';
import { dashboardFontVars } from './dashboardFonts';
import { monotonePath } from './AreaChart';
import { fmtRangeShort, toneOf, fmtPct1 } from './rgKit';
import { buildReportData, monthChunks, isWholeMonths, monthToken } from './reportData';
/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ (Export pakai data dummy saat saklar Demo data nyala;
   nama file diberi "DEMO" supaya laporan berisi angka rekaan tidak tertukar dengan laporan asli) */
import { isDemoOn } from './demoMode';
import { buildDemoDashboard } from './demoDashboard';
const demoTag = () => (isDemoOn() ? 'DEMO-' : '');
/* ═══ END PREVIEW-ONLY ═══ */

/* ─────────────────────────────────────────────────────────────
   EXPORT LAPORAN (PDF/JPG 16:9, 1280×720) — redesain "Ridgeline" 28 Sep 2026
   Permintaan Nadir: hasil tombol download laporan disesuaikan dengan desain
   dashboard baru. Isi TETAP sama (5 KPI + % vs periode pembanding, Spend
   Breakdown, CPM/CPC/CPL/CTR, grafik harian semua metrik; Top Campaigns tidak
   ikut) — yang berubah tampilannya: kanvas charcoal/abu hangat, kartu cangkang
   + panel dalam, font Geist + angka Geist Mono, warna data sama dengan layar.

   ATURAN TEKNIS (laporan difoto html2canvas dari elemen tersembunyi):
   - Semua warna literal hex/rgba (BUKAN var CSS / color-mix / oklch — html2canvas
     gagal membaca fungsi warna modern), dijaga sama dengan app/ridgeline.css.
   - Gradasi & grafik lewat SVG ber-atribut (bukan gradient CSS / mask).
   - Ikon lucide WAJIB diberi prop color eksplisit (currentColor hilang saat SVG
     diserialisasi html2canvas).
   - Font lewat variabel next/font yang dipasang di akar laporan sendiri, supaya
     tetap Geist walau ExportMenu dirender di luar .rg (top bar HP).
   ───────────────────────────────────────────────────────────── */

const REPORT_THEME = {
  dark: {
    BG: '#222222', SHELL: '#1D1D1D', WELL: '#2A2A2A', WELL_LINE: 'rgba(255,255,255,0.035)',
    LINE: '#2E2E2E', LINE_SOFT: '#363636', GRID: '#3A3A3A', TRACK: '#3B3B3B',
    PILL: '#262626', PILL_LINE: '#353535',
    T1: '#F5F5F5', T2: '#A8A8A8', T3: '#939393',
    POS: '#2BBE8A', NEG: '#F26A6E',
    TINT: { pos: ['#10A393', 0.32], neg: ['#F26A6E', 0.26], neu: ['#FFFFFF', 0.07] },
    AWARE: '#8B5CF6', TRAFFIC: '#D9782A', CONV: '#10A393', OTHER: '#6E6E6E', SPEND: '#2F97EF',
  },
  light: {
    BG: '#F2F2EF', SHELL: '#EAEAE6', WELL: '#FFFFFF', WELL_LINE: '#E3E3DE',
    LINE: '#DFDFDA', LINE_SOFT: '#ECECE7', GRID: '#E1E1DC', TRACK: '#E8E8E3',
    PILL: '#FFFFFF', PILL_LINE: '#DCDCD6',
    T1: '#161616', T2: '#57574F', T3: '#686862',
    POS: '#0B8157', NEG: '#CF363C',
    TINT: { pos: ['#0E9486', 0.17], neg: ['#CF363C', 0.14], neu: ['#161616', 0.05] },
    AWARE: '#7C4DEB', TRAFFIC: '#C9661A', CONV: '#0E9486', OTHER: '#A3A39D', SPEND: '#096CB5',
  },
};
const paletteFor = (theme) => REPORT_THEME[theme === 'light' ? 'light' : 'dark'];
const objColor = (P, label) => ({ Awareness: P.AWARE, Traffic: P.TRAFFIC, Conversion: P.CONV }[label] || P.OTHER);
const toneColor = (P, tone) => (tone === 'pos' ? P.POS : tone === 'neg' ? P.NEG : P.T2);

const F_SANS = 'var(--font-geist), -apple-system, "Segoe UI", Roboto, sans-serif';
const F_MONO = 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace';
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* ─── UI palette (tombol + dropdown di header) — token lama, dipetakan .rg di dashboard ─── */
const UI_CARD   = 'var(--cd)';
const UI_BORDER = 'var(--br)';
const UI_BRS    = 'var(--br-strong)';
const UI_TXT    = 'var(--t1)';
const UI_SUB    = 'var(--t2)';
const UI_MUTE   = 'var(--t3)';
const UI_HOVER  = 'var(--hover)';

/* ─── Format — ANGKA PENUH biar sama dgn dashboard (Rp 1.440.076) ─── */
function fmtSpendFull(n) { return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID'); }
function fmtNumFull(n)   { return Math.round(n || 0).toLocaleString('id-ID'); }
function fmtAvg(money, v) {
  if (money) return 'Rp ' + Math.round(v).toLocaleString('id-ID');
  return v < 10 ? v.toLocaleString('id-ID', { maximumFractionDigits: 1 }) : Math.round(v).toLocaleString('id-ID');
}

/* ─── Geometri tetap laporan (px) ─── */
const RW = 1280, RH = 720, RPX = 32, RPY = 26, RGAP = 12;
const KPI_WELL_W = Math.floor((RW - RPX * 2 - RGAP * 4) / 5 - 10);   // ≈223
const CHART_W = RW - RPX * 2 - 10 - 36;                               // lebar area plot grafik harian
// Tinggi plot grafik harian (muat di panel bawah dengan sisa ±4px)
const CHART_H = 122;

/* ─── Delta: lingkaran berpanah + persen (sama dgn layar) ─── */
function RDelta({ pct, good = 'up', P, size = 12 }) {
  const tone = toneOf(pct, good);
  if (tone === 'na') return <span style={{ fontFamily: F_MONO, fontSize: size, color: P.T3 }}>—</span>;
  const c = toneColor(P, tone);
  const Arrow = pct >= 0 ? ArrowUp : ArrowDown;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
      <span style={{ width: 14, height: 14, borderRadius: 7, background: c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Arrow size={9} strokeWidth={3} color={P.WELL} />
      </span>
      <span style={{ fontFamily: F_MONO, fontSize: size, fontWeight: 500, color: c, letterSpacing: '-0.02em' }}>{fmtPct1(pct)}</span>
    </span>
  );
}

/* ─── Sparkline KPI: kurva + gradasi + titik akhir bercincin + garis jatuh ─── */
function RSpark({ data, color, P, w = KPI_WELL_W, h = 46 }) {
  const gid = useId().replace(/:/g, '');
  const vals = (data || []).filter(v => v != null && v >= 0);
  if (vals.length < 2) return null;
  const T = 8, B = 12, R = 16;
  const max = Math.max(...vals), min = Math.min(...vals), band = h - T - B;
  const pts = vals.map((v, i) => ({
    x: (i / (vals.length - 1)) * (w - R),
    y: T + (max > min ? (1 - (v - min) / (max - min)) * band : band / 2),
  }));
  const d = monotonePath(pts);
  const last = pts[pts.length - 1];
  // html2canvas TIDAK menggambar <svg> yang position:absolute (terbukti 28 Sep 2026) —
  // SVG harus di alur normal; pembungkus div relative (bukan SVG-nya) menjaga urutan
  // gambar di atas gradasi RTint, margin negatif = selebar panel.
  return (
    <div style={{ position: 'relative', margin: `auto -13px 0`, height: h, flexShrink: 0 }}>
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${gid}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d}L${last.x.toFixed(1)},${h}L0,${h}Z`} fill={`url(#${gid}g)`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <line x1={last.x} y1={last.y} x2={last.x} y2={h} stroke={color} strokeOpacity="0.55" strokeWidth="1" strokeDasharray="2 3" />
      <circle cx={last.x} cy={last.y} r="7.5" fill={color} fillOpacity="0.18" />
      <circle cx={last.x} cy={last.y} r="3.8" fill={P.WELL} stroke={color} strokeWidth="2" />
    </svg>
    </div>
  );
}

/* ─── Gradasi warna arah perubahan di pojok kanan-bawah panel KPI ─── */
function RTint({ tone, P }) {
  const gid = useId().replace(/:/g, '');
  const [c, o] = P.TINT[tone] || P.TINT.neu;
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, display: 'block' }}>
      <defs>
        <radialGradient id={`${gid}t`} cx="100%" cy="100%" r="100%">
          <stop offset="0%" stopColor={c} stopOpacity={o} />
          <stop offset="72%" stopColor={c} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill={`url(#${gid}t)`} />
    </svg>
  );
}

/* ─── Kartu cangkang + panel dalam (anatomi sama dengan layar) ─── */
function RCard({ P, icon: Icon, title, meta, style, wellStyle, children }) {
  return (
    <div style={{ background: P.SHELL, border: `1px solid ${P.LINE}`, borderRadius: 18, padding: 4, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, ...style }}>
      <div style={{ height: 32, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 0 11px', flexShrink: 0 }}>
        {Icon && <Icon size={14} color={P.T2} />}
        <span style={{ fontSize: 13, fontWeight: 500, color: P.T1, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{title}</span>
        {meta && <span style={{ marginLeft: 'auto', fontSize: 11.5, color: P.T2, whiteSpace: 'nowrap' }}>{meta}</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', background: P.WELL, border: `1px solid ${P.WELL_LINE}`, borderRadius: 14, overflow: 'hidden', ...wellStyle }}>
        {children}
      </div>
    </div>
  );
}

/* ─── Donut Spend Breakdown — cincin tebal, celah antar segmen ─── */
function RDonut({ segs, total, P, size = 124 }) {
  const R = 40, C = 2 * Math.PI * R;
  const GAP = segs.length > 1 ? 1.6 : 0;
  let acc = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
        <g transform="rotate(-90 50 50)">
          {segs.map(s => {
            const len = s.frac * C;
            const dash = Math.max(0.01, len - GAP);
            const el = (
              <circle key={s.label} cx="50" cy="50" r={R} fill="none" stroke={objColor(P, s.label)} strokeWidth="13"
                strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-(acc + GAP / 2)} />
            );
            acc += len;
            return el;
          })}
        </g>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <span style={{ fontSize: 10, color: P.T2 }}>Total Spend</span>
        <span style={{ marginTop: 3, fontFamily: F_MONO, fontSize: 10, fontWeight: 500, color: P.T1, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{total}</span>
      </div>
    </div>
  );
}

/* ─── Grafik harian: keempat metrik, satu sumbu diindeks ke puncak masing-masing ─── */
function RDaily({ chartData = {}, dates = [], todayIdx, P }) {
  const series = [
    { key: 'spend',     name: 'Spend',       color: P.SPEND,   money: true },
    { key: 'awareness', name: 'Impressions', color: P.AWARE },
    { key: 'traffic',   name: 'Traffic',     color: P.TRAFFIC },
    { key: 'leads',     name: 'Leads',       color: P.CONV },
  ];
  const n = Math.max(1, ...series.map(s => (chartData[s.key] || []).length));
  // Sama dengan grafik di layar: hari yang SUDAH lewat tanpa baris Meta = 0 (garis turun ke
  // dasar), hari setelah hari ini kosong. todayIdx dari Dashboard (bulan berjalan); laporan
  // per bulan (bulan lampau) → seluruh bulan sudah lewat.
  const lastIdx = todayIdx != null && todayIdx >= 0 ? todayIdx : n - 1;

  const PL = 38, PR = 84, PT = 8, PB = 20;
  const pw = CHART_W - PL - PR, ph = CHART_H - PT - PB;
  const X = i => PL + (n > 1 ? (i / (n - 1)) * pw : pw / 2);
  const Y = f => PT + ph - f * ph;

  const lines = series.map(s => {
    const raw = chartData[s.key] || [];
    const vals = raw.map((v, i) => (v != null ? v : i <= lastIdx ? 0 : null));
    const elapsed = vals.filter(v => v != null);
    const max = elapsed.length ? Math.max(...elapsed) : 0;
    const avg = elapsed.length ? elapsed.reduce((a, b) => a + b, 0) / elapsed.length : 0;
    const pts = [];
    vals.forEach((v, i) => { if (v != null) pts.push({ x: X(i), y: Y(max > 0 ? v / max : 0) }); });
    return { ...s, pts, d: monotonePath(pts), avg };
  });

  // Label ujung garis: renggangkan min 13px + garis pemandu berwarna seri
  const ends = lines.filter(l => l.pts.length).map(l => {
    const p = l.pts[l.pts.length - 1];
    return { key: l.key, name: l.name, color: l.color, x: p.x, y: p.y, ly: p.y };
  }).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].ly - ends[k - 1].ly < 13) ends[k].ly = ends[k - 1].ly + 13;
  const over = ends.length ? ends[ends.length - 1].ly - (PT + ph) : 0;
  if (over > 0) ends.forEach(e => { e.ly -= over; });

  const step = dates.length <= 33 ? 1 : Math.ceil(dates.length / 15);
  const ticks = [];
  for (let i = 0; i < dates.length; i += step) ticks.push(i);
  const drawOrder = ['awareness', 'traffic', 'leads', 'spend'];

  return (
    <div style={{ padding: '12px 18px 8px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      {/* legenda = kunci garis + nama + rata-rata harian (angka asli) */}
      <div style={{ display: 'flex', gap: 30, flexShrink: 0 }}>
        {lines.map(l => (
          <div key={l.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: P.T2 }}>
              <span style={{ width: 12, height: 2, borderRadius: 2, background: l.color }} />{l.name}
            </div>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
              <span style={{ fontFamily: F_MONO, fontSize: 15, fontWeight: 500, color: P.T1, letterSpacing: '-0.02em' }}>{fmtAvg(l.money, l.avg)}</span>
              <span style={{ fontSize: 11, color: P.T3 }}>avg/day</span>
            </div>
          </div>
        ))}
      </div>
      {/* Jarak atas di PEMBUNGKUS, bukan di <svg>: html2canvas menghitung margin SVG dua kali
          (gambar turun 8px lalu terpotong batas SVG → label tanggal sempat hilang separuh) */}
      <div style={{ marginTop: 8, flexShrink: 0 }}>
      <svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ display: 'block', overflow: 'visible' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <g key={f}>
            <line x1={PL} x2={PL + pw} y1={Y(f)} y2={Y(f)} stroke={P.GRID} strokeWidth="1" strokeDasharray="3 5" />
            {(f === 0 || f === 0.5 || f === 1) && (
              <text x={PL - 8} y={Y(f)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill={P.T3} style={{ fontFamily: F_MONO }}>{Math.round(f * 100)}%</text>
            )}
          </g>
        ))}
        {drawOrder.map(k => {
          const l = lines.find(x => x.key === k);
          return l.d ? <path key={k} d={l.d} fill="none" stroke={l.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /> : null;
        })}
        {drawOrder.map(k => {
          const l = lines.find(x => x.key === k);
          const p = l.pts[l.pts.length - 1];
          return p ? <circle key={k} cx={p.x} cy={p.y} r="3.6" fill={l.color} stroke={P.WELL} strokeWidth="2" /> : null;
        })}
        {ends.map(e => (
          <g key={e.key}>
            <path d={`M${(e.x + 7).toFixed(1)},${e.y.toFixed(1)}L${(e.x + 9).toFixed(1)},${e.y.toFixed(1)}L${(e.x + 16).toFixed(1)},${e.ly.toFixed(1)}L${(e.x + 20).toFixed(1)},${e.ly.toFixed(1)}`}
              fill="none" stroke={e.color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <text x={e.x + 24} y={e.ly} dominantBaseline="middle" fontSize="10.5" fontWeight="500" fill={P.T2} style={{ fontFamily: F_SANS }}>{e.name}</text>
          </g>
        ))}
        {ticks.map(i => (
          <text key={i} x={X(i)} y={PT + ph + 15} textAnchor="middle" fontSize={dates.length > 20 ? 9.5 : 10} fill={P.T3} style={{ fontFamily: F_MONO }}>{dates[i]}</text>
        ))}
      </svg>
      </div>
    </div>
  );
}

/* ─── ReportBody — kartu laporan 1280×720 (dipakai untuk 1 gambar & pisah per bulan) ─── */
const ReportBody = forwardRef(function ReportBody({ summary, chartData = {}, chartDates = [], donut = {}, rangeLabel = '', rangePreset, rangeDetail, prevLabel, todayIdx, activeCount = 0, P }, ref) {
  const vsText = prevLabel ? `vs ${prevLabel}` : 'vs previous period';
  const kpis = summary ? [
    { label: 'Total Spend', icon: Wallet,            unit: 'Rp', value: fmtNumFull(summary.totalSpend), pct: summary.pctSpend, good: 'none', spark: chartData.spend },
    { label: 'Reach',       icon: Users,             value: fmtNumFull(summary.totalReach),       pct: summary.pctReach,       good: 'up', spark: chartData.awareness },
    { label: 'Impressions', icon: Eye,               value: fmtNumFull(summary.totalImpressions), pct: summary.pctImpressions, good: 'up', spark: chartData.awareness },
    { label: 'Traffic',     icon: MousePointerClick, value: fmtNumFull(summary.totalTraffic),     pct: summary.pctTraffic,     good: 'up', spark: chartData.traffic },
    { label: 'Leads',       icon: UserPlus,          value: fmtNumFull(summary.totalLeads),       pct: summary.pctLeads,       good: 'up', spark: chartData.leads },
  ] : [];

  // Tren harian 4C (meter batang) — basis blended harian, sama dengan kartu di layar
  const _s = chartData.spend || [], _i = chartData.awareness || [], _t = chartData.traffic || [], _l = chartData.leads || [];
  const _div = (a, b, mul = 1) => a.map((v, idx) => (v != null && b[idx] > 0) ? (v / b[idx]) * mul : null);
  const eff = summary ? [
    { label: 'CPM', scope: 'All campaigns',        value: summary.calcCPM ? fmtSpendFull(summary.calcCPM) : '—', pct: summary.pctCPM, good: 'down', color: P.SPEND,   spark: summary.calcCPM ? _div(_s, _i, 1000) : null },
    { label: 'CPC', scope: 'Traffic campaigns',    value: summary.calcCPC ? fmtSpendFull(summary.calcCPC) : '—', pct: summary.pctCPC, good: 'down', color: P.TRAFFIC, spark: summary.calcCPC ? _div(_s, _t) : null },
    { label: 'CPL', scope: 'Conversion campaigns', value: summary.calcCPL ? fmtSpendFull(summary.calcCPL) : '—', pct: summary.pctCPL, good: 'down', color: P.CONV,    spark: summary.calcCPL ? _div(_s, _l) : null },
    { label: 'CTR', scope: 'Conversion campaigns', value: summary.calcCTR ? summary.calcCTR.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '—', pct: summary.pctCTR, good: 'up', color: P.CONV, spark: summary.calcCTR ? _div(_t, _i, 100) : null },
  ] : [];

  const segs = (donut?.segs || []).map(s => ({ ...s, frac: s.frac != null ? s.frac : (s.pct || 0) / 100 }));
  const presetText = rangePreset || rangeLabel || '—';

  return (
    <div ref={ref} data-export-report className={dashboardFontVars} style={{
      position: 'fixed', left: '-10000px', top: 0, width: RW, height: RH, boxSizing: 'border-box',
      background: P.BG, color: P.T1, padding: `${RPY}px ${RPX}px`, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontFamily: F_SANS,
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* ── Header: brand + judul (kiri) · pil periode + konteks (kanan) ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 54, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: P.T2, letterSpacing: '-0.01em' }}>Baba Rafi Ad Hub</div>
          <div style={{ marginTop: 4, fontSize: 26, fontWeight: 600, color: P.T1, letterSpacing: '-0.03em', lineHeight: 1.1 }}>Performance Marketing Report</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 34, padding: '0 15px', borderRadius: 999, background: P.PILL, border: `1px solid ${P.PILL_LINE}`, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
            <Calendar size={14} color={P.T2} />
            <span style={{ color: P.T2 }}>{presetText}</span>
            {rangeDetail && <span style={{ width: 1, height: 16, background: P.PILL_LINE }} />}
            {rangeDetail && <span style={{ color: P.T1 }}>{rangeDetail}</span>}
          </div>
          <div style={{ marginTop: 7, fontSize: 12, color: P.T2 }}>Meta Ads · {activeCount} campaign{activeCount === 1 ? '' : 's'} with spend</div>
        </div>
      </div>

      {/* ── Baris 1: 5 KPI ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: RGAP, height: 146, marginTop: 16, flexShrink: 0 }}>
        {kpis.map(k => {
          const tone = toneOf(k.pct, k.good);
          const t = tone === 'na' ? 'neu' : tone;
          const Ic = k.icon;
          return (
            <RCard key={k.label} P={P} icon={Ic} title={k.label} wellStyle={{ padding: '11px 13px 0', display: 'flex', flexDirection: 'column' }}>
              <RTint tone={t} P={P} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 5, whiteSpace: 'nowrap' }}>
                {k.unit && <span style={{ fontSize: 13, fontWeight: 500, color: P.T2 }}>{k.unit}</span>}
                <span style={{ fontSize: 24, fontWeight: 500, color: P.T1, letterSpacing: '-0.035em', lineHeight: 1.05 }}>{k.value}</span>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, whiteSpace: 'nowrap' }}>
                <RDelta pct={k.pct} good={k.good} P={P} size={11.5} />
                <span style={{ fontSize: 11.5, color: P.T2 }}>{vsText}</span>
              </div>
              <RSpark data={k.spark} color={toneColor(P, t)} P={P} />
            </RCard>
          );
        })}
      </div>

      {/* ── Baris 2: Spend Breakdown · Cost Efficiency (sama lebar, seperti layar) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: RGAP, height: 190, marginTop: RGAP, flexShrink: 0 }}>
        <RCard P={P} icon={ChartPie} title="Spend Breakdown" meta="By campaign objective"
          wellStyle={{ display: 'flex', alignItems: 'center', gap: 24, padding: '0 22px 0 18px' }}>
          {segs.length === 0 ? (
            <div style={{ flex: 1, textAlign: 'center', fontSize: 12.5, color: P.T2 }}>No spend in this period</div>
          ) : (<>
            <RDonut segs={segs} total={donut?.total?.value || '—'} P={P} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: segs.length > 3 ? 8 : 13 }}>
              {segs.map(s => (
                <div key={s.label}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: objColor(P, s.label), flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: P.T1 }}>{s.label}</span>
                    {s.count != null && <span style={{ fontSize: 11.5, color: P.T2 }}>· {s.count} campaign{s.count === 1 ? '' : 's'}</span>}
                    <span style={{ marginLeft: 'auto', fontFamily: F_MONO, fontSize: 12.5, color: P.T1, letterSpacing: '-0.02em' }}>{s.value}</span>
                    <span style={{ width: 34, textAlign: 'right', fontFamily: F_MONO, fontSize: 12, color: P.T2 }}>{s.pct}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: 3, height: 6, marginTop: 6 }}>
                    <span style={{ width: `${Math.max(1.5, s.frac * 100)}%`, borderRadius: 3, background: objColor(P, s.label) }} />
                    {s.frac < 0.995 && <span style={{ flex: 1, borderRadius: 3, background: P.TRACK }} />}
                  </div>
                </div>
              ))}
            </div>
          </>)}
        </RCard>

        <RCard P={P} icon={Gauge} title="Cost Efficiency" meta={prevLabel ? `Change vs ${prevLabel}` : 'Change vs previous period'}
          wellStyle={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: 'repeat(2, minmax(0, 1fr))', padding: '0 18px' }}>
          {eff.map((m, i) => {
            const bars = (m.spark || []).filter(v => v != null && isFinite(v)).slice(-9);
            const bmax = Math.max(...bars, 0) || 1;
            return (
              <div key={m.label} style={{
                display: 'flex', alignItems: 'center', gap: 12, minWidth: 0,
                padding: i % 2 ? '0 0 0 16px' : '0 16px 0 0',
                borderBottom: i < 2 ? `1px solid ${P.LINE_SOFT}` : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: P.T1 }}>{m.label}</div>
                  <div style={{ marginTop: 4, fontFamily: F_MONO, fontSize: 18, fontWeight: 500, color: P.T1, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{m.value}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5, whiteSpace: 'nowrap' }}>
                    <RDelta pct={m.pct} good={m.good} P={P} size={11} />
                    <span style={{ fontSize: 11, color: P.T2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.scope}</span>
                  </div>
                </div>
                {bars.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 34, flexShrink: 0 }}>
                    {bars.map((v, bi) => (
                      <span key={bi} style={{ position: 'relative', width: 5, height: '100%', borderRadius: 3, background: P.TRACK, overflow: 'hidden' }}>
                        <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.max(8, (v / bmax) * 100)}%`, borderRadius: 3, background: m.color }} />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </RCard>
      </div>

      {/* ── Baris 3: tren harian keempat metrik ── */}
      <RCard P={P} icon={ChartLine} title="Daily Trends" meta="Each line is scaled to its own peak day (= 100%)"
        style={{ flex: 1, marginTop: RGAP }}>
        <RDaily chartData={chartData} dates={chartDates} todayIdx={todayIdx} P={P} />
      </RCard>
    </div>
  );
});

// compact: tombol icon-only lama (top bar HP 36px)
// pill: tombol gaya Dashboard redesain (.rg-pill); iconOnly → bulat 40px tanpa label
// (keputusan Nadir 28 Sep 2026: Compare & Export icon saja)
export default function ExportMenu({
  summary, chartData = {}, chartDates = [], donut = {}, rangeLabel = '', rangePreset, rangeDetail, prevLabel, todayIdx,
  activeCount = 0, since = '', until = '', compact = false, size = 36, radius = 9, pill = false, iconOnly = false, labelClassName,
}) {
  // Laporan hasil export ikut tema dashboard yang sedang aktif (terang/gelap)
  const { theme } = useAuth();
  const P = paletteFor(theme);

  const [open, setOpen]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const [splitMode, setSplitMode] = useState('combined');   // 'combined' | 'perMonth'
  const [split, setSplit] = useState(null);                 // { format, reports:[...] } saat menangkap gambar per bulan
  const reportRef = useRef(null);
  const splitRefs = useRef([]);

  // Opsi "pisah per bulan" hanya kalau filter = beberapa bulan penuh (≥2)
  const months   = isWholeMonths(since, until) ? monthChunks(since, until) : [];
  const canSplit = months.length >= 2;

  useEffect(() => {
    if (!open) return;
    const h = e => { if (!e.target.closest('[data-export]')) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const stamp = () => new Date().toISOString().slice(0, 10);

  // Export 1 gambar (rentang aktif apa adanya) — snapshot report tunggal
  async function runSingle(type) {
    if (!reportRef.current || busy) return;
    setBusy(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: P.BG, useCORS: true, logging: false });
      const wCss = canvas.width / 2, hCss = canvas.height / 2;
      if (type === 'jpg') {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/jpeg', 0.95); a.download = `BabaRafiAdHub-report-${demoTag()}${stamp()}.jpg`;
        document.body.appendChild(a); a.click(); a.remove();
      } else {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [wCss, hCss] });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, wCss, hCss);
        pdf.save(`BabaRafiAdHub-report-${demoTag()}${stamp()}.pdf`);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export gagal: ' + err.message);
    }
    setBusy(false);
  }

  // Export pisah per bulan: fetch tiap bulan → build → render N ReportBody → capture (di useEffect)
  async function runSplit(type) {
    if (busy) return;
    setBusy(true);
    try {
      const reports = await Promise.all(months.map(async (mo) => {
        let json;
        /* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ */
        if (isDemoOn()) json = buildDemoDashboard({ since: mo.since, until: mo.until });
        else
        /* ═══ END PREVIEW-ONLY ═══ */
        {
          const res = await authFetch(`/api/meta?mode=dashboard&since=${mo.since}&until=${mo.until}`);
          json = await res.json();
        }
        if (json.error) throw new Error(json.error);
        const r = buildReportData(json);
        return {
          ...r,
          rangePreset: `${MONTH_FULL[mo.m]} ${mo.y}`,
          rangeDetail: fmtRangeShort(mo.since, mo.until, true),
          prevLabel:   r.prevRange ? fmtRangeShort(r.prevRange.since, r.prevRange.until) : '',
          token: monthToken(mo),
        };
      }));
      splitRefs.current = [];
      setSplit({ format: type, reports });   // trigger render + capture di useEffect
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export gagal: ' + err.message);
      setBusy(false);
    }
  }

  // Tangkap gambar per bulan setelah N ReportBody ter-render
  useEffect(() => {
    if (!split) return;
    let cancelled = false;
    (async () => {
      // tunggu 2 frame + sedikit jeda supaya layout & font matang
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise(r => setTimeout(r, 80));
      if (cancelled) return;
      try {
        const html2canvas = (await import('html2canvas')).default;
        const canvases = [];
        for (let i = 0; i < split.reports.length; i++) {
          const el = splitRefs.current[i];
          if (el) canvases.push(await html2canvas(el, { scale: 2, backgroundColor: P.BG, useCORS: true, logging: false }));
        }
        if (split.format === 'jpg') {
          // JPG: tiap bulan jadi file terpisah, kedownload otomatis satu per satu (bukan zip)
          for (let i = 0; i < canvases.length; i++) {
            const a = document.createElement('a');
            a.href = canvases[i].toDataURL('image/jpeg', 0.95);
            a.download = `BabaRafiAdHub-report-${demoTag()}${split.reports[i].token}-${stamp()}.jpg`;
            document.body.appendChild(a); a.click(); a.remove();
            await new Promise(r => setTimeout(r, 400));   // jeda antar unduhan biar tidak diblok browser
          }
        } else {
          // PDF: satu file, N lembar berurutan
          const { jsPDF } = await import('jspdf');
          let pdf;
          canvases.forEach((c, i) => {
            const w = c.width / 2, h = c.height / 2;
            if (i === 0) pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [w, h] });
            else pdf.addPage([w, h], 'landscape');
            pdf.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, w, h);
          });
          if (pdf) pdf.save(`BabaRafiAdHub-report-${demoTag()}${split.reports.length}bulan-${stamp()}.pdf`);
        }
      } catch (err) {
        console.error('Export failed:', err);
        alert('Export gagal: ' + err.message);
      }
      if (!cancelled) { setSplit(null); setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [split]);

  function handleFormat(type) {
    setOpen(false);
    if (canSplit && splitMode === 'perMonth') runSplit(type);
    else runSingle(type);
  }

  return (
    <div style={{ position: 'relative' }} data-export>
      {/* ── Tombol Export ── */}
      {pill ? (
        <button type="button" className={`rg-pill${iconOnly ? ' rg-round' : ''}`} aria-expanded={open} aria-haspopup="menu"
          disabled={busy} title={busy ? 'Exporting…' : 'Export report'} aria-label="Export report"
          onClick={() => !busy && setOpen(o => !o)}>
          {busy
            ? <Loader2 size={15} style={{ animation: 'wdSpin 0.8s linear infinite' }} />
            : <Download size={15} />}
          {!iconOnly && <span className={labelClassName}>{busy ? 'Exporting…' : 'Export'}</span>}
          {!iconOnly && !busy && <ChevronDown size={14} className="rg-caret" />}
        </button>
      ) : (
      <button
        onClick={() => !busy && setOpen(o => !o)}
        title="Export"
        style={ compact ? {
          width: size + 'px', height: size + 'px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: UI_CARD, border: `1px solid ${UI_BORDER}`, borderRadius: radius + 'px',
          cursor: busy ? 'default' : 'pointer', flexShrink: 0, transition: 'border-color 0.15s',
        } : {
          display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 14px',
          background: UI_CARD, border: `1px solid ${UI_BORDER}`, borderRadius: '10px',
          fontSize: '13px', color: busy ? UI_SUB : UI_TXT, cursor: busy ? 'default' : 'pointer', transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => { if (!busy) e.currentTarget.style.borderColor = UI_BRS; }}
        onMouseLeave={e => e.currentTarget.style.borderColor = UI_BORDER}
      >
        {busy
          ? <Loader2 size={14} color={UI_SUB} style={{ animation: 'wdSpin 0.8s linear infinite' }} />
          : <Download size={14} color={UI_SUB} />}
        {!compact && (busy ? 'Exporting…' : 'Export')}
        {!compact && !busy && <ChevronDown size={13} color={UI_SUB} />}
      </button>
      )}

      {/* ── Dropdown format (+ pilihan pisah per bulan kalau filter beberapa bulan) ── */}
      {open && !busy && (
        <div style={{ position: 'absolute', top: '46px', left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
        <div style={{
          background: UI_CARD, border: `1px solid ${UI_BORDER}`, borderRadius: '14px', minWidth: canSplit ? '244px' : '190px',
          boxShadow: 'var(--pop-shadow)', animation: 'wdScaleIn 0.15s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden', padding: '6px',
        }}>
          {canSplit && (
            <>
              <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.8px', color: UI_MUTE, textTransform: 'uppercase', padding: '6px 10px 6px' }}>
                {months.length} bulan — jadikan
              </div>
              <div style={{ display: 'flex', gap: '6px', padding: '0 8px 8px' }}>
                {[
                  { v: 'combined', label: '1 gambar' },
                  { v: 'perMonth', label: `Per bulan (${months.length})` },
                ].map(opt => {
                  const on = splitMode === opt.v;
                  return (
                    <button key={opt.v} onClick={() => setSplitMode(opt.v)} style={{
                      flex: 1, padding: '8px 6px', borderRadius: '999px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
                      border: `1px solid ${on ? 'var(--cal-accent)' : UI_BORDER}`,
                      background: on ? 'var(--cal-accent-soft, var(--hover))' : 'transparent',
                      color: on ? 'var(--ac)' : UI_SUB, transition: 'all 0.12s',
                    }}>{opt.label}</button>
                  );
                })}
              </div>
              <div style={{ height: '1px', background: UI_BORDER, margin: '0 8px 6px' }} />
            </>
          )}
          <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '1.4px', color: UI_MUTE, textTransform: 'uppercase', padding: '2px 10px 8px' }}>Export as</div>
          {[
            { type: 'pdf', label: 'PDF Document', icon: FileText, hint: canSplit && splitMode === 'perMonth' ? `${months.length} lembar` : '.pdf' },
            { type: 'jpg', label: 'JPG Image',    icon: ImageIcon, hint: canSplit && splitMode === 'perMonth' ? `${months.length} file` : '.jpg' },
          ].map(o => {
            const Ic = o.icon;
            return (
              <div key={o.type} onClick={() => handleFormat(o.type)} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '9px', cursor: 'pointer', fontSize: '13px', color: UI_SUB,
              }}
                onMouseEnter={e => { e.currentTarget.style.background = UI_HOVER; e.currentTarget.style.color = UI_TXT; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = UI_SUB; }}
              >
                <Ic size={16} />
                <span style={{ flex: 1 }}>{o.label}</span>
                <span style={{ fontSize: '11px', color: UI_MUTE }}>{o.hint}</span>
              </div>
            );
          })}
        </div>
        </div>
      )}

      {/* Report tunggal (tersembunyi) — sumber export 1 gambar */}
      <ReportBody ref={reportRef} summary={summary} chartData={chartData} chartDates={chartDates} donut={donut}
        rangeLabel={rangeLabel} rangePreset={rangePreset} rangeDetail={rangeDetail} prevLabel={prevLabel}
        todayIdx={todayIdx} activeCount={activeCount} P={P} />

      {/* Report per bulan (tersembunyi, hanya saat proses pisah) — sumber capture */}
      {split && split.reports.map((r, i) => (
        <ReportBody key={i} ref={el => { splitRefs.current[i] = el; }}
          summary={r.summary} chartData={r.chartData} chartDates={r.chartDates} donut={r.donut}
          rangePreset={r.rangePreset} rangeDetail={r.rangeDetail} prevLabel={r.prevLabel}
          activeCount={r.activeCount} P={P} />
      ))}
    </div>
  );
}
