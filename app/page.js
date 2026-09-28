'use client';

/* ══ DASHBOARD ADS HUB — redesain "Ridgeline" (PREVIEW LOKAL, Sep 2026) ═══════
   THESIS: laporan iklan dibaca seperti instrumen — kartu cangkang + panel dalam,
     angka monospace, warna hanya untuk data & arah perubahan (bukan dekorasi).
   OWN-WORLD: kanvas charcoal #222 (terang: abu hangat #F2F2EF), cangkang #1D1D1D,
     panel #2A2A2A, kontrol pil netral; ungu/oranye/teal = Awareness/Traffic/Conversion.
   STORY: 5 detik pertama = 5 KPI + arah perubahannya vs periode pembanding yang
     tertulis jelas → ke mana uang pergi & seberapa efisien → tren harian + campaign terbaik.
   FIRST VIEWPORT: top bar (judul + konteks | filter & aksi) → 5 kartu KPI →
     Spend Breakdown + Cost Efficiency → grafik harian + Top Campaigns. Fit 1 layar.
   Logika fetch & rumus metrik TIDAK diubah — hanya penyajian. Style: dashboard-ridgeline.css
   ══════════════════════════════════════════════════════════════════════════ */

import './dashboard-ridgeline.css';
import { useState, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  RefreshCw,
  Wallet, Users, Eye, MousePointerClick, UserPlus,
  MessageSquare, Trash2, GitCompareArrows,
  ArrowRight, ArrowUpRight,
  ChartPie, Gauge, Trophy, TriangleAlert,
} from 'lucide-react';
import { ID, presetToRange, fmtRangeShort, fmtClock, toneOf, Delta, InfoTip, DatePill } from './components/rgKit';
import CountUp from './components/CountUp';
import AreaChart, { monotonePath } from './components/AreaChart';
import CompareModal from './components/CompareModal';
import LeadsBreakdownModal from './components/LeadsBreakdownModal';
import ExportMenu from './components/ExportMenu';
import { useAuth } from './components/AuthContext';
import { useDashboardFilter, DATE_PRESETS_DASHBOARD } from './components/DateFilterContext';
import ThemeToggle from './components/ThemeToggle';
import PlatformSelector, { DEFAULT_PLATFORM } from './components/PlatformSelector';
import PlatformPlaceholder from './components/PlatformPlaceholder';
import useIsMobile from './components/useIsMobile';
import DateFilterPopup from './components/DateFilterPopup';
import { TYPE } from './components/typography';
import { dashboardFontVars } from './components/dashboardFonts';
import { supabase, authFetch } from './supabase';
/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ */
import { Download } from 'lucide-react';
import PreviewPanel from './components/PreviewPanel';
import { buildDemoDashboard } from './components/demoDashboard';
const DEMO_ALLOWED = process.env.NODE_ENV !== 'production';
/* ═══ END PREVIEW-ONLY ═══ */

/* ─── Token lama (masih dipakai tombol top bar mobile & popup Suggestions) ─── */
const BG      = 'var(--pg)';
const CARD    = 'var(--cd)';
const BORDER  = 'var(--br)';
const TXT     = 'var(--t1)';
const SUB     = 'var(--t2)';
const MUTE    = 'var(--t3)';
// Warna literal di bawah = field `color` lama di data donut/Top Campaigns. Sejak redesain
// laporan (28 Sep 2026) Export memilih warna per LABEL dari palet laporannya sendiri, dan
// layar memakai token skin (--rg-*) lewat OBJ_VAR/TYPE_VAR — literal ini tidak tampil lagi.
const GREEN   = '#2FB673';
const BLUE    = '#3B82F6';
const PURPLE  = '#8B5CF6';
const ORANGE  = '#F59E0B';

// Warna objektif di layar (theme-aware, divalidasi skill dataviz)
const OBJ_VAR  = { Awareness: 'var(--rg-aware)', Traffic: 'var(--rg-traffic)', Conversion: 'var(--rg-conv)', Other: 'var(--rg-other)' };
const TYPE_VAR = { AWARENESS: 'var(--rg-aware)', TRAFFIC: 'var(--rg-traffic)', CONVERSION: 'var(--rg-conv)' };


/* ─── Helpers ─── */
function getActionValue(actions, types) {
  if (!actions) return 0;
  for (const t of types) {
    const a = actions.find(x => x.action_type === t);
    if (a) return parseInt(a.value) || 0;
  }
  return 0;
}

/* ─── Leads = SEMUA mekanisme penangkapan lead (aturan Nadir 3 Sep 2026) ───
   Dulu hanya form, sehingga iklan klik-ke-WhatsApp (dipakai sepanjang Q1 2026)
   tidak ikut terhitung dan lead Q1 tampil 1 padahal aslinya 389.
     LEAD_FORM = payung form (instant form Meta + form website via pixel)
     LEAD_WA   = CTA klik-ke-WhatsApp
   Rumus ini terduplikasi di page.js, campaigns, reportData, CompareModal,
   CombineModal, CampaignModal & insightEngine — JAGA TETAP SINKRON. */
const LEAD_FORM = ["lead", "onsite_conversion.lead_grouped"];
const LEAD_WA   = ["onsite_conversion.messaging_conversation_started_7d"];
function getLeads(actions) {
  return (getActionValue(actions, LEAD_FORM) || 0) + (getActionValue(actions, LEAD_WA) || 0);
}
/* Rincian per sumber untuk popup di kartu KPI Leads. "lead" adalah payung form;
   instant form dipisah lewat lead_grouped, sisanya dianggap form website (pixel). */
function getLeadBreakdown(actions) {
  const form    = getActionValue(actions, LEAD_FORM) || 0;
  const instant = getActionValue(actions, ["onsite_conversion.lead_grouped"]) || 0;
  const wa      = getActionValue(actions, LEAD_WA) || 0;
  return { instant, web: Math.max(0, form - instant), wa, total: form + wa };
}

/* Preset → rentang tanggal nyata (presetToRange), format rentang & delta: rgKit.js
   (dipakai bersama Campaigns & Analytics). */

function getCampaignType(name) {
  const n = name?.toUpperCase() || '';
  if (n.includes('TRAFFIC'))                            return 'TRAFFIC';
  if (n.includes('PROSPEK') || n.includes('KONVERSI')) return 'CONVERSION';
  return 'AWARENESS';
}

// Spend full format — tanpa abbreviation, dengan pemisah ribuan
function fmtSpendFull(n) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

// Angka penuh (Reach/Impressions/Traffic/Leads) — pemisah ribuan, tanpa singkatan
function fmtNumFull(n) {
  return Math.round(n).toLocaleString('id-ID');
}

// Buang prefix tipe iklan ("KTBR AWR - ", dst) → tampilkan nama setelah "-"
function stripCampPrefix(name) {
  const i = (name || '').indexOf('-');
  return i >= 0 ? name.slice(i + 1).trim() : (name || '—');
}

// Result per campaign sesuai tipe (logika bisnis CLAUDE.md)
function getCampaignResult(name, ins) {
  const type = getCampaignType(name);
  if (type === 'TRAFFIC')    return getActionValue(ins.actions, ['link_click']);
  if (type === 'CONVERSION') return getLeads(ins.actions);
  const n = (name || '').toUpperCase();
  if (n.includes('AWR REACH')) return parseFloat(ins.reach || 0);
  return parseFloat(ins.impressions || 0); // AWARENESS default → impressions
}
// Label satuan result + nama biaya per result (penyajian saja, ikut getCampaignResult)
function resultMeta(name) {
  const type = getCampaignType(name);
  if (type === 'TRAFFIC')    return { resultLabel: 'clicks', costLabel: 'CPC' };
  if (type === 'CONVERSION') return { resultLabel: 'leads',  costLabel: 'CPL' };
  const n = (name || '').toUpperCase();
  return { resultLabel: n.includes('AWR REACH') ? 'reach' : 'impr.', costLabel: 'CPM' };
}

function pctChange(cur, prev) {
  if (!prev || prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

/* ─── Format angka gaya Indonesia (titik = ribuan, koma = desimal; ID dari rgKit) ─── */
function fmtCtr(v)  { return v.toLocaleString(ID, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'; }
// Ruang sempit (baris Top Campaigns): Rp 1,24 jt · Rp 350 rb — satuan Indonesia, bukan K/M
function fmtRpShort(n) {
  if (n >= 1e9) return 'Rp ' + (n / 1e9).toLocaleString(ID, { maximumFractionDigits: 2 }) + ' M';
  if (n >= 1e6) return 'Rp ' + (n / 1e6).toLocaleString(ID, { maximumFractionDigits: 2 }) + ' jt';
  if (n >= 1e3) return 'Rp ' + Math.round(n / 1e3).toLocaleString(ID) + ' rb';
  return 'Rp ' + Math.round(n).toLocaleString(ID);
}
function fmtNumShort(n) {
  if (n >= 1e9) return (n / 1e9).toLocaleString(ID, { maximumFractionDigits: 1 }) + ' M';
  if (n >= 1e6) return (n / 1e6).toLocaleString(ID, { maximumFractionDigits: 1 }) + ' jt';
  if (n >= 1e4) return (n / 1e3).toLocaleString(ID, { maximumFractionDigits: 1 }) + ' rb';
  return Math.round(n).toLocaleString(ID);
}

/* ─── Date helpers (untuk sumbu chart sebulan penuh) ─── */
function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetweenStr(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000) + 1;
}

// Bangun array chart selebar rentang (range); slot tanpa data = null,
// jadi garis hanya muncul di hari yang punya data. Label = tanggal (day-of-month).
function buildChartData(daily, range) {
  // Fallback: tanpa range, susun kontigu seperti semula
  if (!range || !range.since || !range.until) {
    const r = { spend: [], awareness: [], traffic: [], leads: [] };
    const dates = [];
    daily.forEach((d, i) => {
      r.spend    .push(Math.round(parseFloat(d.spend || 0)));
      r.awareness.push(Math.round(parseFloat(d.impressions || 0)));
      r.traffic  .push(getActionValue(d.actions, ['link_click']));
      r.leads    .push(getLeads(d.actions));
      dates.push(d.date_start ? parseInt(d.date_start.slice(8, 10), 10) : i + 1);
    });
    return { data: r, dates, todayIdx: -1 };
  }

  const { since, until } = range;
  const n = Math.max(1, daysBetweenStr(since, until));
  const data = {
    spend:     Array(n).fill(null),
    awareness: Array(n).fill(null),
    traffic:   Array(n).fill(null),
    leads:     Array(n).fill(null),
  };
  const dates = [];
  for (let i = 0; i < n; i++) {
    const ds = addDaysStr(since, i);
    dates.push(parseInt(ds.slice(8, 10), 10)); // tanggal (1..31)
  }

  daily.forEach(d => {
    if (!d.date_start) return;
    const idx = daysBetweenStr(since, d.date_start) - 1;
    if (idx < 0 || idx >= n) return;
    data.spend[idx]     = Math.round(parseFloat(d.spend || 0));
    data.awareness[idx] = Math.round(parseFloat(d.impressions || 0));
    data.traffic[idx]   = getActionValue(d.actions, ['link_click']);
    data.leads[idx]     = getLeads(d.actions);
  });

  const todayStr  = new Date().toISOString().slice(0, 10);
  const todayIdx  = daysBetweenStr(since, todayStr) - 1;
  return { data, dates, todayIdx: (todayIdx >= 0 && todayIdx < n) ? todayIdx : -1 };
}

/* ─── Arah perubahan → nada (toneOf), Delta & InfoTip: rgKit.js ─── */

/* ─── Sparkline kartu KPI: kurva + titik akhir bercincin + garis jatuh putus-putus ───
   Revisi 28 Sep 2026: dulu digambar dalam persen (viewBox 0–100) di pita ±29px, titik
   akhir yang rendah terpotong tepi bawah panel. Sekarang diukur dalam piksel asli
   (ResizeObserver): garis berada di pita SPARK_T dari atas s.d. SPARK_B dari bawah,
   titik terakhir berhenti SPARK_R dari tepi kanan → cincin titik selalu utuh. */
const SPARK_T = 10, SPARK_B = 16, SPARK_R = 18;
function KpiSpark({ data }) {
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

/* ─── Kartu KPI (anatomi kartu proyek referensi: header · panel bergradasi · footer) ─── */
function KpiCard({ label, icon: Icon, info, tipAlign, unit, value, display, pct, good, spark, prevLabel, prevDisplay, onOpen, openLabel, delay = 0 }) {
  const tone = toneOf(pct, good);
  return (
    <div className="rg-card rg-rise" style={{ height: '100%', animationDelay: `${delay}ms` }}>
      <div className="rg-head">
        <span className="rg-head-ico"><Icon size={15} /></span>
        <span className="rg-title">{label}</span>
        <InfoTip text={info} align={tipAlign} />
      </div>
      <div className={`rg-well rg-kpi-well rg-tone-${tone === 'na' ? 'neu' : tone}`}>
        <div className="rg-kpi-value">
          {unit && <span className="rg-unit">{unit}</span>}
          <CountUp value={value} display={display} delay={delay + 120} />
        </div>
        <div className="rg-kpi-sub">
          <Delta pct={pct} good={good} />
          {prevLabel && <span>vs {prevLabel}</span>}
        </div>
        <KpiSpark data={spark} />
      </div>
      {onOpen ? (
        <button type="button" className="rg-foot" onClick={onOpen}>
          <span>{openLabel}</span>
          <ArrowRight size={15} className="rg-foot-arrow" />
        </button>
      ) : (
        <div className="rg-foot">
          <span>Previous</span>
          <span className="rg-mono rg-foot-val">{prevDisplay ?? '—'}</span>
        </div>
      )}
    </div>
  );
}

/* ─── Meter batang mini (tren harian 4C) — ala meter "SEO Overview" referensi ─── */
function MiniBars({ data, color, count = 9 }) {
  const vals = (data || []).filter(v => v != null && isFinite(v)).slice(-count);
  if (vals.length < 2) return null;
  const max = Math.max(...vals) || 1;
  return (
    <div className="rg-bars" aria-hidden="true">
      {vals.map((v, i) => (
        <span key={i} className="rg-bar">
          <i style={{ height: `${Math.max(8, (v / max) * 100)}%`, background: color, animationDelay: `${300 + i * 35}ms` }} />
        </span>
      ))}
    </div>
  );
}

function EfficiencyCard({ items, prevLabel, delay = 0, fill = true }) {
  return (
    <div className="rg-card rg-rise" style={{ ...(fill ? { height: '100%' } : null), animationDelay: `${delay}ms` }}>
      <div className="rg-head">
        <span className="rg-head-ico"><Gauge size={15} /></span>
        <span className="rg-title">Cost Efficiency</span>
        {prevLabel && <span className="rg-meta">Change vs {prevLabel}</span>}
      </div>
      <div className="rg-well rg-eff">
        {items.map((m, i) => (
          <div key={m.label} className="rg-eff-cell">
            <div className="rg-eff-label">
              <span>{m.label}</span>
              <InfoTip text={m.info} align={i % 2 ? 'end' : undefined} />
            </div>
            <div className="rg-eff-value">
              <span className="rg-mono rg-eff-num">{m.value}</span>
            </div>
            <div className="rg-eff-scope">
              <Delta pct={m.pct} good={m.good} />
              <span>
                <span className="rg-scope-long">{m.scope}</span>
                <span className="rg-scope-short">{m.scopeShort || m.scope}</span>
              </span>
            </div>
            <MiniBars data={m.spark} color={m.color} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Donut Spend Breakdown — cincin tebal, celah permukaan antar segmen ─── */
function Donut({ segs, total, hover, setHover }) {
  const R = 40, C = 2 * Math.PI * R;
  const GAP = segs.length > 1 ? 1.6 : 0;
  let acc = 0;
  const h = hover != null ? segs[hover] : null;
  return (
    <div className="rg-donut">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {segs.map((s, i) => {
          const len  = s.frac * C;
          const dash = Math.max(0.01, len - GAP);
          const el = (
            <circle key={s.label} cx="50" cy="50" r={R} fill="none" strokeWidth="13"
              strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-(acc + GAP / 2)}
              style={{ stroke: OBJ_VAR[s.label] || 'var(--rg-other)', opacity: hover != null && hover !== i ? 0.28 : 1, cursor: 'pointer' }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="rg-donut-center">
        <span className="rg-donut-label">{h ? h.label : 'Total Spend'}</span>
        <span className="rg-donut-value rg-mono">{h ? h.value : total}</span>
        {h && <span className="rg-donut-chip rg-mono">{h.pct}% of spend</span>}
      </div>
    </div>
  );
}

function SpendCard({ segs, total, hover, setHover, delay = 0, fill = true }) {
  return (
    <div className="rg-card rg-rise" style={{ ...(fill ? { height: '100%' } : null), animationDelay: `${delay}ms` }}>
      <div className="rg-head">
        <span className="rg-head-ico"><ChartPie size={15} /></span>
        <span className="rg-title">Spend Breakdown</span>
        <span className="rg-meta">By campaign objective</span>
        <Link href="/campaigns" className="rg-iconbtn" title="Open Campaigns" aria-label="Open Campaigns">
          <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="rg-well rg-split">
        {segs.length === 0 ? (
          <div className="rg-empty" style={{ gridColumn: '1 / -1' }}>
            <strong>No spend in this period</strong>
            <span>Pick a wider date range to see how the budget was split.</span>
          </div>
        ) : (<>
          <Donut segs={segs} total={total} hover={hover} setHover={setHover} />
          <div className="rg-legend">
            {segs.map((s, i) => (
              <div key={s.label} className={`rg-lg${hover != null && hover !== i ? ' is-dim' : ''}`}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <div className="rg-lg-name">
                  <span className="rg-lg-sw" style={{ background: OBJ_VAR[s.label] || 'var(--rg-other)' }} />
                  <span>{s.label}</span>
                  {s.count != null && <span className="rg-lg-count">· {s.count} campaign{s.count === 1 ? '' : 's'}</span>}
                </div>
                <div className="rg-lg-vals rg-mono">
                  <span>{s.value}</span>
                  <span className="rg-lg-pct">{s.pct}%</span>
                </div>
                <div className="rg-meter" aria-hidden="true">
                  {s.frac >= 0.995 ? (
                    <span style={{ width: '100%', background: OBJ_VAR[s.label] || 'var(--rg-other)', animationDelay: `${250 + i * 80}ms` }} />
                  ) : (<>
                    <span style={{ width: `calc(${(s.frac * 100).toFixed(2)}% - 2px)`, minWidth: '4px', background: OBJ_VAR[s.label] || 'var(--rg-other)', animationDelay: `${250 + i * 80}ms` }} />
                    <span />
                  </>)}
                </div>
              </div>
            ))}
          </div>
        </>)}
      </div>
    </div>
  );
}

/* ─── Top Campaigns — urut CTR tertinggi (permintaan Nadir 3 Agu 2026) ─── */
function TopCampaignsCard({ rows, delay = 0, mobile = false }) {
  return (
    <div className="rg-card rg-rise" style={{ ...(mobile ? { maxHeight: '440px' } : { height: '100%' }), animationDelay: `${delay}ms` }}>
      <div className="rg-head">
        <span className="rg-head-ico"><Trophy size={15} /></span>
        <span className="rg-title">Top Campaigns</span>
        <span className="rg-meta">Sorted by CTR</span>
        <Link href="/campaigns" className="rg-iconbtn" title="Open Campaigns" aria-label="Open Campaigns">
          <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="rg-well rg-list-well">
        {rows.length === 0 ? (
          <div className="rg-empty">
            <strong>No campaigns delivered</strong>
            <span>Campaigns that spend in this period are ranked here.</span>
          </div>
        ) : (<>
          <div className="rg-list-head"><span>Campaign</span><span>CTR · Spend</span></div>
          <div className="rg-list">
            {rows.map((c, i) => (
              <div key={i} className="rg-camp">
                <span className="rg-rank rg-mono">{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="rg-camp-name">
                    <span className="rg-camp-dot" style={{ background: TYPE_VAR[c.type] }} />
                    <span title={c.name}>{c.name}</span>
                  </div>
                  <div className="rg-camp-meta rg-mono">
                    {fmtNumShort(c.result)} {c.resultLabel} · {c.costLabel} {c.cpr != null ? fmtSpendFull(c.cpr) : '—'}
                  </div>
                </div>
                <div className="rg-camp-right">
                  <div className="rg-camp-ctr rg-mono">{fmtCtr(c.ctr)}</div>
                  <div className="rg-camp-spend rg-mono">{fmtRpShort(c.spend)}</div>
                </div>
              </div>
            ))}
          </div>
        </>)}
      </div>
    </div>
  );
}

/* ─── Skeleton muat pertama (refetch berikutnya: tampilan lama diredupkan, tanpa lompat) ─── */
function SkelCard({ lines = 2, style }) {
  return (
    <div className="rg-card" style={style}>
      <div className="rg-head"><span className="rg-skel" style={{ width: '38%', height: 11 }} /></div>
      <div className="rg-well" style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span className="rg-skel" style={{ width: '62%', height: 22 }} />
        {Array.from({ length: lines }).map((_, i) => (
          <span key={i} className="rg-skel" style={{ width: `${48 - i * 10}%`, height: 10 }} />
        ))}
      </div>
      <div className="rg-foot"><span className="rg-skel" style={{ width: '46%', height: 9 }} /></div>
    </div>
  );
}
function DashboardSkeleton({ isMobile }) {
  if (isMobile) return (
    <>
      <SkelCard style={{ height: 216, flexShrink: 0 }} />
      <SkelCard lines={3} style={{ height: 230, flexShrink: 0 }} />
      <SkelCard lines={4} style={{ height: 300, flexShrink: 0 }} />
    </>
  );
  return (
    <>
      <div className="rg-row-kpi">{[0, 1, 2, 3, 4].map(i => <SkelCard key={i} />)}</div>
      <div className="rg-row-mid"><SkelCard lines={3} /><SkelCard lines={3} /></div>
      <div className="rg-row-bot"><SkelCard lines={5} /><SkelCard lines={5} /></div>
    </>
  );
}

/* ─── Main ─── */
export default function DashboardPage() {
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const { dateOpt, customSince, setCustomSince, customUntil, setCustomUntil, isCustom, selectPreset, applyCustom } = useDashboardFilter();
  const [hoverSeg, setHoverSeg]         = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCompare, setShowCompare]   = useState(false);
  const [showLeadsInfo, setShowLeadsInfo] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [summary, setSummary]           = useState(null);
  const [chartData, setChartData]       = useState({ spend:[], awareness:[], traffic:[], leads:[] });
  const [chartDates, setChartDates]     = useState([]);
  const [chartSince, setChartSince]     = useState('');
  const [prevRange, setPrevRange]       = useState(null);
  const [updatedAt, setUpdatedAt]       = useState(null);
  const [donutSegs, setDonutSegs]       = useState([]);
  const [donutTotal, setDonutTotal]     = useState({ value:'—', label:'Total Spend' });
  const [todayIdx, setTodayIdx]         = useState(0);
  const [topCampaigns, setTopCampaigns] = useState([]);
  const [activeCampaignCount, setActiveCampaignCount] = useState(0);
  const [showSuggest, setShowSuggest]   = useState(false);
  const [suggestions, setSuggestions]   = useState([]);
  const [hasUnread, setHasUnread]       = useState(false);
  const [platform, setPlatform]         = useState(DEFAULT_PLATFORM);
  const suggestRef = useRef(null);
  // Penanda permintaan terakhir: respons lama yang datang belakangan tidak boleh
  // menimpa hasil yang lebih baru (mis. ganti filter cepat / saklar data preview)
  const fetchToken = useRef(0);

  /* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ */
  const [demo, setDemo] = useState(false);
  const demoReady = useRef(false);
  useEffect(() => {
    if (!DEMO_ALLOWED) return;
    try { if (localStorage.getItem('wd-preview-demo') !== '0') setDemo(true); } catch {}
  }, []);
  useEffect(() => {
    if (!demoReady.current) { demoReady.current = true; return; }
    refresh();
  }, [demo]);
  function toggleDemo(v) {
    setDemo(v);
    try { localStorage.setItem('wd-preview-demo', v ? '1' : '0'); } catch {}
  }
  /* ═══ END PREVIEW-ONLY ═══ */

  // Slot aksi di top bar mobile (MobileNav) — diisi via portal.
  // Kiri theme toggle: export + refresh · kanan theme toggle: suggestions (admin)
  const [topbarSlot, setTopbarSlot]           = useState(null);
  const [topbarSlotRight, setTopbarSlotRight] = useState(null);
  useEffect(() => {
    setTopbarSlot(isMobile ? document.getElementById('wd-topbar-actions') : null);
    setTopbarSlotRight(isMobile ? document.getElementById('wd-topbar-actions-right') : null);
  }, [isMobile]);

  // Bulan kiri kalender (UI only). Default: bulan lalu, jadi tampil "bulan lalu + bulan ini".
  const _initCal = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const [calY, setCalY] = useState(_initCal.getFullYear());
  const [calM, setCalM] = useState(_initCal.getMonth());

  useEffect(() => { if (!isCustom) fetchData(); }, [dateOpt, isCustom]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from('suggestions').select('created_at').order('created_at', { ascending: false }).limit(1);
      if (data && data.length > 0) {
        const lastSeen = localStorage.getItem('wd-suggest-seen');
        if (!lastSeen || new Date(data[0].created_at) > new Date(lastSeen)) setHasUnread(true);
      }
    })();
  }, [isAdmin]);

  useEffect(() => {
    if (!showSuggest) return;
    (async () => {
      const { data, error } = await supabase.from('suggestions').select('*').order('created_at', { ascending: false });
      if (!error && data) setSuggestions(data);
    })();
    localStorage.setItem('wd-suggest-seen', new Date().toISOString());
    setHasUnread(false);
  }, [showSuggest]);

  useEffect(() => {
    if (!showSuggest) return;
    const handler = (e) => { if (suggestRef.current && !suggestRef.current.contains(e.target)) setShowSuggest(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSuggest]);

  useEffect(() => {
    if (!showDropdown) return;
    const h = e => { if (!e.target.closest('[data-filter]')) setShowDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showDropdown]);

  async function fetchData(since = '', until = '') {
    const token = ++fetchToken.current;
    setLoading(true); setError(null);
    try {
      const url = since && until
        ? `/api/meta?mode=dashboard&since=${since}&until=${until}`
        : `/api/meta?mode=dashboard&date_preset=${dateOpt.value}`;
      let json;
      /* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ */
      if (demo) {
        const r = since && until ? { since, until } : presetToRange(dateOpt.value);
        await new Promise(res => setTimeout(res, 350));
        json = buildDemoDashboard({ ...r, isThisMonth: !(since && until) && dateOpt.value === 'this_month' });
      } else
      /* ═══ END PREVIEW-ONLY ═══ */
      {
        const res = await authFetch(url);
        json = await res.json();
      }
      if (token !== fetchToken.current) return;
      if (json.error) throw new Error(json.error);

      const sum        = json.summary     || {};
      const prev       = json.prevSummary || {};
      const daily      = json.daily       || [];
      const campaigns  = json.campaigns   || [];
      const chartRange = json.chartRange  || null;

      const totalSpend       = parseFloat(sum.spend || 0);
      const totalReach       = parseFloat(sum.reach || 0);
      const totalImpressions = parseFloat(sum.impressions || 0);
      const curLeadsAcc      = getLeads(sum.actions);

      // Periode sebelumnya (untuk growth badge) — pakai level akun biar ringan & konsisten
      const prevSpend       = parseFloat(prev.spend || 0);
      const prevReach       = parseFloat(prev.reach || 0);
      const prevImpressions = parseFloat(prev.impressions || 0);

      const prevCampaigns  = json.prevCampaigns || [];

      const campsWithData  = campaigns.filter(c => parseFloat(c.insights?.data?.[0]?.spend || 0) > 0);
      // "Active campaigns" = campaign yang PUNYA delivery (spend > 0) di periode filter,
      // bukan status ACTIVE saat ini — biar angkanya ikut rentang tanggal yang dipilih.
      setActiveCampaignCount(campsWithData.length);
      const trafficCamps   = campsWithData.filter(c => getCampaignType(c.name) === 'TRAFFIC');
      const convCamps      = campsWithData.filter(c => getCampaignType(c.name) === 'CONVERSION');
      const awareCamps     = campsWithData.filter(c => getCampaignType(c.name) === 'AWARENESS');

      const trafficSpend    = trafficCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.spend||0), 0);
      const trafficClicks   = trafficCamps.reduce((s,c) => s + getActionValue(c.insights?.data?.[0]?.actions, ['link_click']), 0);
      const convSpend       = convCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.spend||0), 0);
      const convLeads       = convCamps.reduce((s,c) => s + getLeads(c.insights?.data?.[0]?.actions), 0);
      // Rincian lead per sumber — dijumlah dari campaign CONVERSION yang SAMA dengan
      // angka kartu KPI, supaya isi popup selalu pas dengan angka yang diklik.
      const leadBreakdown   = convCamps.reduce((a,c) => {
        const b = getLeadBreakdown(c.insights?.data?.[0]?.actions);
        return { instant:a.instant+b.instant, web:a.web+b.web, wa:a.wa+b.wa, total:a.total+b.total };
      }, { instant:0, web:0, wa:0, total:0 });
      const convImpressions = convCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.impressions||0), 0);
      const convClicks      = convCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.clicks||0), 0);
      const awareSpend      = awareCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.spend||0), 0);

      // 4C periode ini (rumus final per tipe — JANGAN diubah)
      const calcCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null;
      const calcCPC = trafficClicks > 0    ? trafficSpend / trafficClicks            : null;
      const calcCPL = convLeads > 0        ? convSpend / convLeads                   : null;
      const calcCTR = convImpressions > 0  ? (convClicks / convImpressions) * 100    : null;

      // 4C periode pembanding — dihitung dari prevCampaigns dgn rumus per-tipe yang SAMA,
      // supaya badge % apple-to-apple (dipakai laporan export + kartu Cost Efficiency).
      const prevCampsWithData = prevCampaigns.filter(c => parseFloat(c.insights?.data?.[0]?.spend || 0) > 0);
      const prevTrafficCamps  = prevCampsWithData.filter(c => getCampaignType(c.name) === 'TRAFFIC');
      const prevConvCamps     = prevCampsWithData.filter(c => getCampaignType(c.name) === 'CONVERSION');
      const prevTrafficSpend  = prevTrafficCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.spend||0), 0);
      const prevTrafficClicks = prevTrafficCamps.reduce((s,c) => s + getActionValue(c.insights?.data?.[0]?.actions, ['link_click']), 0);
      const prevConvSpend     = prevConvCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.spend||0), 0);
      const prevConvLeads     = prevConvCamps.reduce((s,c) => s + getLeads(c.insights?.data?.[0]?.actions), 0);
      const prevConvImpr      = prevConvCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.impressions||0), 0);
      const prevConvClicks    = prevConvCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.clicks||0), 0);
      const prevCPM = prevImpressions > 0   ? (prevSpend / prevImpressions) * 1000  : null;
      const prevCPC = prevTrafficClicks > 0 ? prevTrafficSpend / prevTrafficClicks  : null;
      const prevCPL = prevConvLeads > 0     ? prevConvSpend / prevConvLeads         : null;
      const prevCTR = prevConvImpr > 0      ? (prevConvClicks / prevConvImpr) * 100 : null;

      setSummary({
        totalSpend, totalReach, totalImpressions,
        totalTraffic: trafficClicks,
        totalLeads:   convLeads || curLeadsAcc,
        leadBreakdown,
        calcCPM, calcCPC, calcCPL, calcCTR,
        pctSpend:       pctChange(totalSpend, prevSpend),
        pctReach:       pctChange(totalReach, prevReach),
        pctImpressions: pctChange(totalImpressions, prevImpressions),
        pctTraffic:     pctChange(trafficClicks, prevTrafficClicks), // apple-to-apple: link click campaign TRAFFIC saja di dua periode
        pctLeads:       pctChange(convLeads, prevConvLeads),         // apple-to-apple: lead campaign CONVERSION saja di dua periode
        // % 4C vs periode sebelumnya (null kalau salah satu sisi tak ada data)
        pctCPM: calcCPM != null ? pctChange(calcCPM, prevCPM) : null,
        pctCPC: calcCPC != null ? pctChange(calcCPC, prevCPC) : null,
        pctCPL: calcCPL != null ? pctChange(calcCPL, prevCPL) : null,
        pctCTR: calcCTR != null ? pctChange(calcCTR, prevCTR) : null,
        // Nilai mentah periode pembanding — ditampilkan di footer kartu KPI ("Previous")
        prevSpend, prevReach, prevImpressions,
        prevTraffic: prevTrafficClicks,
        prevLeads:   prevConvLeads,
      });

      const built = buildChartData(daily, chartRange);
      setChartData(built.data);
      setChartDates(built.dates);
      setTodayIdx(built.todayIdx);
      setChartSince(chartRange?.since || '');
      setPrevRange(json.prevRange || null);

      // Top campaigns — Campaign · Spend · Result · Cost/Result · CTR
      // Urutan: CTR tertinggi di atas (permintaan Nadir 3 Agu 2026). Warna per tipe.
      const TYPE_COLOR = { AWARENESS: PURPLE, TRAFFIC: ORANGE, CONVERSION: GREEN };
      const tops = campsWithData
        .map(c => {
          const ins    = c.insights?.data?.[0] || {};
          const sp     = parseFloat(ins.spend || 0);
          const impr   = parseFloat(ins.impressions || 0);
          const clk    = parseFloat(ins.clicks || 0);
          const type   = getCampaignType(c.name);
          const result = getCampaignResult(c.name, ins);
          return {
            name:  stripCampPrefix(c.name),
            type,
            spend: sp,
            result,
            ...resultMeta(c.name),
            // Awareness → CPM (per 1.000 impressions); Traffic/Conversion → per result
            cpr:   result > 0 ? (type === 'AWARENESS' ? (sp / result) * 1000 : sp / result) : null,
            ctr:   impr > 0 ? (clk / impr) * 100 : 0,
            color: TYPE_COLOR[type],
          };
        })
        .sort((a, b) => (b.ctr - a.ctr) || (b.spend - a.spend));
      setTopCampaigns(tops);

      // Donut spend breakdown (field dash/offset/color tetap untuk laporan Export)
      const total = totalSpend || 1;
      const segs  = [];
      if (awareSpend > 0)   segs.push({ color: PURPLE, label:'Awareness',  pct: Math.round(awareSpend/total*100),   value: fmtSpendFull(awareSpend),   frac: awareSpend/total,   count: awareCamps.length   });
      if (trafficSpend > 0) segs.push({ color: ORANGE, label:'Traffic',    pct: Math.round(trafficSpend/total*100), value: fmtSpendFull(trafficSpend), frac: trafficSpend/total, count: trafficCamps.length });
      if (convSpend > 0)    segs.push({ color: GREEN,  label:'Conversion', pct: Math.round(convSpend/total*100),    value: fmtSpendFull(convSpend),    frac: convSpend/total,    count: convCamps.length    });
      const other = Math.max(0, totalSpend - awareSpend - trafficSpend - convSpend);
      if (other > 0)        segs.push({ color: BLUE,   label:'Other',      pct: Math.round(other/total*100),        value: fmtSpendFull(other),        frac: other/total,        count: null                });

      const CIRC = 238.76;
      let offset = 0;
      setDonutSegs(segs.map(seg => {
        const dash = (seg.pct / 100) * CIRC;
        const s = { ...seg, dash: parseFloat(dash.toFixed(1)), offset: parseFloat((-offset).toFixed(1)) };
        offset += dash;
        return s;
      }));
      setDonutTotal({ value: fmtSpendFull(totalSpend), label: 'Total Spend' });
      setUpdatedAt(new Date());
    } catch (err) {
      if (token !== fetchToken.current) return;
      setError(err.message);
    }
    if (token === fetchToken.current) setLoading(false);
  }

  async function handleDeleteSuggestion(id) {
    const { error } = await supabase.from('suggestions').delete().eq('id', id);
    if (!error) setSuggestions(prev => prev.filter(s => s.id !== id));
  }

  async function handleClearAllSuggestions() {
    // id bertipe UUID — filter harus valid untuk uuid, bukan angka
    const { error } = await supabase.from('suggestions').delete().not('id', 'is', null);
    if (!error) setSuggestions([]);
  }

  function applyCustomRange() {
    if (!customSince || !customUntil) return;
    applyCustom(customSince, customUntil);
    setShowDropdown(false);
    fetchData(customSince, customUntil);
  }

  function handleSelectPreset(opt) {
    selectPreset(opt);
    setShowDropdown(false);
  }

  // ── Kalender (UI only) ──
  function openFilter() {
    const next = !showDropdown;
    if (next && customSince) { // buka: lompat ke bulan tanggal mulai
      const p = customSince.split('-');
      setCalY(+p[0]); setCalM(+p[1] - 1);
    }
    setShowDropdown(next);
  }
  function shiftCal(delta) {
    const dt = new Date(calY, calM + delta, 1);
    setCalY(dt.getFullYear()); setCalM(dt.getMonth());
  }
  // Bangun range di customSince/customUntil (dipakai applyCustomRange yang sudah ada)
  function pickDay(ds) {
    if (!customSince || (customSince && customUntil)) { setCustomSince(ds); setCustomUntil(''); }
    else if (ds < customSince) { setCustomUntil(customSince); setCustomSince(ds); }
    else setCustomUntil(ds);
  }
  // Pilih range sekaligus (tombol kuartal) + lompatkan kalender ke bulan awal range
  function pickRange(s, u) {
    setCustomSince(s); setCustomUntil(u);
    const p = s.split('-'); setCalY(+p[0]); setCalM(+p[1] - 1);
  }

  function refresh() {
    if (isCustom && customSince && customUntil) fetchData(customSince, customUntil);
    else fetchData();
  }

  function filterLabel() {
    if (isCustom && customSince && customUntil) {
      const fmt = d => new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' });
      return `${fmt(customSince)} – ${fmt(customUntil)}`;
    }
    return dateOpt.label;
  }

  // Rentang aktif (tanggal nyata) untuk pil filter: "This month │ 1–27 Sep 2026"
  const curRange  = isCustom && customSince && customUntil
    ? { since: customSince, until: customUntil }
    : presetToRange(dateOpt.value);
  const rangeText = fmtRangeShort(curRange.since, curRange.until, true);
  const prevLabel = prevRange ? fmtRangeShort(prevRange.since, prevRange.until) : '';

  const initialLoading = loading && !summary;
  const busy = loading && summary ? ' rg-busy' : '';

  // ── Tombol top bar MOBILE (dirender via portal ke MobileNav — di luar skin,
  //    jadi tetap gaya lama 36px agar serasi dengan theme toggle top bar) ──
  const refreshButtonMobile = (
    <button onClick={refresh} title="Refresh" style={{
      width:'36px', height:'36px', display:'flex', alignItems:'center', justifyContent:'center',
      background: CARD, border:`1px solid ${BORDER}`, borderRadius:'9px', cursor:'pointer',
      flexShrink:0, transition:'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor='var(--br-strong)'}
    onMouseLeave={e => e.currentTarget.style.borderColor=BORDER}
    >
      <RefreshCw size={15} color={SUB} style={loading ? { animation:'wdSpin 0.8s linear infinite' } : undefined}/>
    </button>
  );

  const suggestTrigger = isMobile ? (
    <button
      onClick={() => setShowSuggest(prev => !prev)}
      title="Suggestions"
      style={{
        width:'36px', height:'36px', display:'flex', alignItems:'center', justifyContent:'center',
        background: CARD, border:`1px solid ${showSuggest ? 'var(--cal-accent-line)' : BORDER}`,
        borderRadius:'9px', cursor:'pointer', position:'relative',
        flexShrink:0, transition:'border-color 0.15s',
      }}
    >
      <MessageSquare size={15} color="var(--cal-accent-line)"/>
      {hasUnread && (
        <span style={{
          position:'absolute', top:'6px', right:'6px',
          width:'8px', height:'8px', borderRadius:'50%',
          background:'#EF4444', border:`2px solid ${CARD}`,
          animation:'wdPulseDot 1.5s ease-in-out infinite',
        }}/>
      )}
    </button>
  ) : (
    <button type="button" className="rg-pill rg-round" aria-expanded={showSuggest}
      title="User suggestions" aria-label={hasUnread ? 'User suggestions (new)' : 'User suggestions'}
      onClick={() => setShowSuggest(prev => !prev)}>
      <MessageSquare size={15} />
      {hasUnread && <span className="rg-alert-dot" aria-hidden="true" />}
    </button>
  );

  const suggestionsBlock = isAdmin ? (
    <div ref={suggestRef} style={{ position:'relative' }}>
      {suggestTrigger}

      {showSuggest && (
        <div style={ isMobile ? {
          position:'fixed', top:'64px', left:'16px', right:'16px', zIndex:60,
          maxHeight:'60vh',
          background:'var(--cd)', border:`1px solid ${BORDER}`, borderRadius:'14px',
          boxShadow:'var(--pop-shadow)', overflow:'hidden',
          animation:'wdScaleIn 0.15s cubic-bezier(0.4,0,0.2,1)',
          display:'flex', flexDirection:'column',
        } : {
          position:'absolute', top:'48px', right:0, zIndex:50,
          width:'380px', maxHeight:'440px',
          background:'var(--cd)', border:`1px solid ${BORDER}`, borderRadius:'16px',
          boxShadow:'var(--pop-shadow)', overflow:'hidden',
          animation:'wdScaleIn 0.15s cubic-bezier(0.4,0,0.2,1)',
          display:'flex', flexDirection:'column',
        }}>
          <div style={{
            padding:'14px 16px', borderBottom:`1px solid ${BORDER}`, background:'var(--sf)',
            display:'flex', alignItems:'center', gap:'8px',
          }}>
            <MessageSquare size={16} color={SUB}/>
            <span style={{ ...TYPE.sectionTitle }}>User Suggestions</span>
            <span style={{ ...TYPE.caption, marginLeft:'auto' }}>{suggestions.length} total</span>
            {suggestions.length > 0 && (
              <button onClick={handleClearAllSuggestions} title="Clear all" style={{
                background:'none', border:'none', cursor:'pointer', color:'#EF4444',
                fontSize:'11px', fontWeight:500, padding:'2px 6px', borderRadius:'6px',
                transition:'background 0.15s', marginLeft:'8px',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background='none'}
              >Clear all</button>
            )}
          </div>
          <div style={{ overflowY:'auto', flex:1, padding:'12px' }}>
            {suggestions.length === 0 ? (
              <div style={{ ...TYPE.body, textAlign:'center', color:MUTE, padding:'24px 0' }}>No suggestions yet.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {suggestions.map(s => (
                  <div key={s.id} style={{
                    padding:'12px', borderRadius:'10px',
                    border:`1px solid ${BORDER}`, background:'var(--data-bg)',
                    animation:'wdFadeUp 0.2s cubic-bezier(0.4,0,0.2,1)',
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                      <span style={{ fontSize:'11px', fontWeight:600, color:SUB, textTransform:'capitalize' }}>{s.author}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <span style={{ fontSize:'10px', color:MUTE }}>
                          {new Date(s.created_at).toLocaleDateString('en-GB',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                        </span>
                        <button onClick={() => handleDeleteSuggestion(s.id)} title="Delete" style={{
                          background:'none', border:'none', cursor:'pointer', color:'#EF4444',
                          display:'flex', alignItems:'center', opacity:0.6, transition:'opacity 0.15s', padding:0,
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity=1}
                        onMouseLeave={e => e.currentTarget.style.opacity=0.6}
                        ><Trash2 size={13}/></button>
                      </div>
                    </div>
                    <div style={{ ...TYPE.small, color:TXT, whiteSpace:'pre-wrap' }}>{s.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  ) : null;

  const exportProps = {
    summary, chartData, chartDates,
    donut: { segs: donutSegs, total: donutTotal },
    rangeLabel: filterLabel(),
    // Header laporan = pil yang sama dengan layar: "This month │ 1–28 Sep 2026"
    rangePreset: isCustom ? 'Custom range' : dateOpt.label,
    rangeDetail: rangeText,
    prevLabel,              // "vs 1–28 Aug" di kartu KPI & Cost Efficiency laporan
    todayIdx,               // grafik harian laporan di-nol-kan s.d. hari ini, sama dengan layar
    activeCount: activeCampaignCount,
    since: isCustom ? customSince : '',
    until: isCustom ? customUntil : '',
  };

  // ── Isi kartu (dipakai layout desktop & mobile) ──
  let kpis = [], eff = [];
  if (summary) {
    kpis = [
      { label:'Total Spend', icon:Wallet, unit:'Rp',
        value:Math.round(summary.totalSpend), display:fmtNumFull(summary.totalSpend),
        pct:summary.pctSpend, good:'none', spark:chartData.spend,
        prevDisplay: fmtSpendFull(summary.prevSpend || 0),
        info:'Total amount spent across all campaigns in the selected period. More or less spend is a budget decision, so its change is shown in grey.' },
      { label:'Reach', icon:Users,
        value:Math.round(summary.totalReach), display:fmtNumFull(summary.totalReach),
        pct:summary.pctReach, good:'up', spark:chartData.awareness,
        prevDisplay: fmtNumFull(summary.prevReach || 0),
        info:'Unique people who saw at least one ad, across all campaigns.' },
      { label:'Impressions', icon:Eye,
        value:Math.round(summary.totalImpressions), display:fmtNumFull(summary.totalImpressions),
        pct:summary.pctImpressions, good:'up', spark:chartData.awareness,
        prevDisplay: fmtNumFull(summary.prevImpressions || 0),
        info:'Total times ads were shown, across all campaigns.' },
      { label:'Traffic', icon:MousePointerClick, tipAlign:'end',
        value:summary.totalTraffic, display:fmtNumFull(summary.totalTraffic),
        pct:summary.pctTraffic, good:'up', spark:chartData.traffic,
        prevDisplay: fmtNumFull(summary.prevTraffic || 0),
        info:'Link clicks from Traffic campaigns only — the objective built to drive visits.' },
      { label:'Leads', icon:UserPlus, tipAlign:'end',
        value:summary.totalLeads, display:fmtNumFull(summary.totalLeads),
        pct:summary.pctLeads, good:'up', spark:chartData.leads,
        onOpen:() => setShowLeadsInfo(true), openLabel:'View lead sources',
        info:'Leads from Conversion campaigns: instant forms, website forms and WhatsApp chats.' },
    ];
    // Tren harian 4C untuk meter batang — basis blended level akun (sama seperti
    // sparkline lama); angka utama kartu tetap kalkulasi final per tipe. Kalau angka
    // utamanya "—" (tak ada campaign tipe itu), meter disembunyikan supaya tidak
    // tampak ada tren untuk metrik yang kosong.
    const _s = chartData.spend || [], _i = chartData.awareness || [], _t = chartData.traffic || [], _l = chartData.leads || [];
    const _div = (a, b, mul = 1) => a.map((v, idx) => (v != null && b[idx] > 0) ? (v / b[idx]) * mul : null);
    const _if  = (val, series) => (val ? series : null);
    eff = [
      { label:'CPM', scope:'All campaigns', value: summary.calcCPM ? fmtSpendFull(summary.calcCPM) : '—',
        pct: summary.pctCPM, good:'down', spark:_if(summary.calcCPM, _div(_s, _i, 1000)), color:'var(--rg-spend)',
        info:'Cost per 1,000 impressions = total spend ÷ total impressions × 1,000, all campaigns. Lower is better.' },
      { label:'CPC', scope:'Traffic campaigns', scopeShort:'Traffic only', value: summary.calcCPC ? fmtSpendFull(summary.calcCPC) : '—',
        pct: summary.pctCPC, good:'down', spark:_if(summary.calcCPC, _div(_s, _t)), color:'var(--rg-traffic)',
        info:'Cost per link click = spend ÷ link clicks, Traffic campaigns only. Lower is better.' },
      { label:'CPL', scope:'Conversion campaigns', scopeShort:'Conversion only', value: summary.calcCPL ? fmtSpendFull(summary.calcCPL) : '—',
        pct: summary.pctCPL, good:'down', spark:_if(summary.calcCPL, _div(_s, _l)), color:'var(--rg-conv)',
        info:'Cost per lead = spend ÷ leads, Conversion campaigns only. Lower is better.' },
      { label:'CTR', scope:'Conversion campaigns', scopeShort:'Conversion only', value: summary.calcCTR ? fmtCtr(summary.calcCTR) : '—',
        pct: summary.pctCTR, good:'up', spark:_if(summary.calcCTR, _div(_t, _i, 100)), color:'var(--rg-conv)',
        info:'Click-through rate = clicks ÷ impressions × 100, Conversion campaigns only. Higher is better.' },
    ];
  }

  const ctxLine = !platform.available
    ? <span>{platform.label} · under development</span>
    : initialLoading
      ? <span>Loading Meta Ads data…</span>
      : error
        ? <span>Could not load data</span>
        : (<>
            <span className="rg-live" aria-hidden="true" />
            <span>{platform.label}</span>
            <span className="rg-ctx-sep" aria-hidden="true" />
            <span>{activeCampaignCount} campaign{activeCampaignCount === 1 ? '' : 's'} with spend</span>
            <span className="rg-ctx-sep" aria-hidden="true" />
            <span>{loading ? 'Refreshing…' : updatedAt ? `Updated ${fmtClock(updatedAt)}` : ''}</span>
          </>);

  const dateButton = (
    <DatePill open={showDropdown} onToggle={openFilter} isMobile={isMobile} isCustom={isCustom}
      presetLabel={dateOpt.label} mobileLabel={filterLabel()} rangeText={rangeText}>
      <DateFilterPopup
        presets={DATE_PRESETS_DASHBOARD}
        dateOpt={dateOpt}
        isCustom={isCustom}
        customSince={customSince}
        customUntil={customUntil}
        calY={calY} calM={calM}
        isMobile={isMobile}
        onSelectPreset={handleSelectPreset}
        onPickDay={pickDay}
        onPickRange={pickRange}
        onShiftCal={shiftCal}
        onApply={applyCustomRange}
        onClose={() => setShowDropdown(false)}
      />
    </DatePill>
  );

  return (
    <div className={`rg ${dashboardFontVars}${isMobile ? ' is-mobile' : ''}`}
      style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', background: BG }}>

      {/* ══ TOP BAR — judul + konteks (kiri) · filter & aksi (kanan) ══ */}
      <header className="rg-top">
        <div className="rg-top-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="rg-h1">Dashboard</h1>
            {/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ */}
            {demo && (
              <span style={{
                padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 500, whiteSpace: 'nowrap',
                background: 'rgba(233,160,52,0.16)', color: '#D98F1F',
              }}>Demo data</span>
            )}
            {/* ═══ END PREVIEW-ONLY ═══ */}
          </div>
          <div className="rg-ctx">{ctxLine}</div>
        </div>

        <div className="rg-tools">
          <PlatformSelector selected={platform} onSelect={setPlatform} />
          {dateButton}

          {!isMobile && (<>
            <span className="rg-vsep" aria-hidden="true" />
            {/* Compare & Export = tombol ikon bulat 40px (keputusan Nadir 28 Sep 2026, sama
                dengan preferensi icon-only 7 Agu 2026) — nama aksi di tooltip */}
            <button type="button" className="rg-pill rg-round" title="Compare two periods"
              aria-label="Compare two periods" onClick={() => setShowCompare(true)}>
              <GitCompareArrows size={15} />
            </button>
            {/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ (saat data dummy: Export dimatikan
                supaya laporan berisi angka rekaan tidak sampai tersebar) */}
            {isAdmin && demo && (
              <button type="button" className="rg-pill rg-round" disabled
                title="Export is disabled while demo data is on" aria-label="Export report (disabled while demo data is on)">
                <Download size={15} />
              </button>
            )}
            {isAdmin && !demo && <ExportMenu {...exportProps} pill iconOnly />}
            {/* ═══ END PREVIEW-ONLY ═══ */}
            <span className="rg-vsep" aria-hidden="true" />
            <button type="button" className="rg-pill rg-round" title="Refresh data" aria-label="Refresh data"
              onClick={refresh} disabled={loading}>
              <RefreshCw size={15} style={loading ? { animation:'wdSpin 0.8s linear infinite' } : undefined} />
            </button>
            <ThemeToggle className="rg-pill rg-round" />
            {suggestionsBlock}
          </>)}

          {/* Mobile: aksi pindah ke top bar. Urutan dari kanan:
              Suggestions → Theme toggle → Refresh → Export */}
          {isMobile && topbarSlot && createPortal(
            <>
              {/* ═══ PREVIEW-ONLY: `!demo` — JANGAN DI-PUSH ═══ */}
              {isAdmin && !demo && <ExportMenu {...exportProps} compact />}
              {refreshButtonMobile}
            </>,
            topbarSlot
          )}
          {isMobile && topbarSlotRight && suggestionsBlock && createPortal(suggestionsBlock, topbarSlotRight)}
        </div>
      </header>

      {/* ══ ISI ══ */}
      <div className="rg-body">
        {!platform.available && <PlatformPlaceholder platform={platform} />}

        {platform.available && initialLoading && <DashboardSkeleton isMobile={isMobile} />}

        {platform.available && !loading && error && (
          <div className="rg-error" role="alert">
            <span className="rg-error-ico"><TriangleAlert size={20} /></span>
            <div style={{ flex:1, minWidth:0 }}>
              <div className="rg-error-title">Meta Ads data couldn’t be loaded</div>
              <div className="rg-error-msg">{error}</div>
            </div>
            <button type="button" className="rg-pill" onClick={refresh}>
              <RefreshCw size={15} />Try again
            </button>
          </div>
        )}

        {platform.available && summary && !error && (isMobile ? (<>
          {/* Mobile: KPI carousel swipe (scroll-snap native), lalu kartu bertumpuk */}
          <div className="wd-hscroll" style={{
            display:'flex', gap:'12px', overflowX:'auto', flexShrink:0,
            scrollSnapType:'x mandatory', margin:'0 -16px', padding:'2px 16px',
          }}>
            {kpis.map((k, i) => (
              // 216px (dulu 196): sparkline butuh ≥52px supaya titik akhirnya tidak terpotong
              <div key={k.label} className={busy} style={{ minWidth:'76%', flexShrink:0, scrollSnapAlign:'center', height:'216px' }}>
                <KpiCard {...k} prevLabel={prevLabel} delay={i * 55} />
              </div>
            ))}
          </div>
          <div className={busy} style={{ flexShrink:0 }}>
            <EfficiencyCard items={eff} prevLabel={prevLabel} delay={220} fill={false} />
          </div>
          <div className={busy} style={{ flexShrink:0 }}>
            <SpendCard segs={donutSegs} total={donutTotal.value} hover={hoverSeg} setHover={setHoverSeg} delay={260} fill={false} />
          </div>
          {/* 380px (dulu 340): baris tombol metrik + statistik 2 baris + plot tanpa memotong sumbu tanggal */}
          <div className={busy} style={{ height:'380px', flexShrink:0 }}>
            <AreaChart data={chartData} dates={chartDates} today={todayIdx} since={chartSince} delay={300} />
          </div>
          <div className={busy} style={{ flexShrink:0, display:'flex', flexDirection:'column' }}>
            <TopCampaignsCard rows={topCampaigns} delay={340} mobile />
          </div>
        </>) : (<>
          {/* ══ BARIS 1: 5 KPI ══ */}
          <div className={`rg-row-kpi${busy}`}>
            {kpis.map((k, i) => <KpiCard key={k.label} {...k} prevLabel={prevLabel} delay={i * 55} />)}
          </div>

          {/* ══ BARIS 2: ke mana uang pergi · seberapa efisien ══ */}
          <div className={`rg-row-mid${busy}`}>
            <SpendCard segs={donutSegs} total={donutTotal.value} hover={hoverSeg} setHover={setHoverSeg} delay={240} />
            <EfficiencyCard items={eff} prevLabel={prevLabel} delay={290} />
          </div>

          {/* ══ BARIS 3: tren harian · campaign terbaik ══ */}
          <div className={`rg-row-bot${busy}`}>
            <AreaChart data={chartData} dates={chartDates} today={todayIdx} since={chartSince} delay={340} />
            <TopCampaignsCard rows={topCampaigns} delay={390} />
          </div>
        </>))}
      </div>

      {/* ══ COMPARE PERIODS ══ */}
      {showCompare && (() => {
        const r = isCustom && customSince && customUntil
          ? { since: customSince, until: customUntil }
          : presetToRange(dateOpt.value);
        return (
          <CompareModal
            initialSince={r.since}
            initialUntil={r.until}
            onClose={() => setShowCompare(false)}
          />
        );
      })()}

      {/* Popup rincian Leads — dibuka dari kartu KPI "Leads" */}
      {showLeadsInfo && (
        <LeadsBreakdownModal
          breakdown={summary?.leadBreakdown}
          periodLabel={filterLabel()}
          onClose={() => setShowLeadsInfo(false)}
        />
      )}

      {/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ */}
      {DEMO_ALLOWED && isAdmin && !isMobile && <PreviewPanel demo={demo} onDemo={toggleDemo} />}
      {/* ═══ END PREVIEW-ONLY ═══ */}
    </div>
  );
}
