'use client';

/* ══ LEADS HUB — DASHBOARD, redesain "Ridgeline" (LIVE 28 Sep 2026) ══════
   Nuansa sama dengan Dashboard Ads Hub: top bar judul + konteks | pil filter & aksi,
   kartu cangkang + panel dalam, angka Geist Mono penuh, delta ber-ikon bulat, warna
   hanya untuk data (status, sales) — pilihan/aktif netral. Skin: app/ridgeline.css +
   anatomi KPI dari app/dashboard-ridgeline.css + khusus Leads: app/leads-ridgeline.css.
   SUSUNAN INFORMASI = keputusan Nadir (G1, Jul 2026), tidak diubah:
     KPI pair (Total Leads + Follow-up) → Leads by Status (5 sel, tanpa donut) →
     Leads by Sales + By Category → baris uang DORMANT (Total Closing + Cost & ROI,
     abu-abu garis putus-putus s.d. ada Deal; saat ada Deal naik tepat di bawah status).
   LOGIKA DATA SAMA dgn v3.1: leads approved cohort by created_at, filter kategori,
   spend konversi via /api/leads?mode=spend, ROAS = closing ÷ spend,
   ROI = (closing − spend) ÷ spend, Black Box = lead unverified (admin).
   KPI ke-3 "Lead Quality" (pilihan Nadir 28 Sep 2026): % lead yang sudah Warm/Hot/Deal —
   deretan KPI bercerita jumlah → kecepatan (follow-up) → kualitas.
   BARU (boleh dibuang kalau Nadir tidak suka): delta vs periode sebelumnya di KPI
   (query leads periode pembanding, aturan periode sama dgn Ads Hub — previousRange),
   penanda "prev" di meter follow-up, rata-rata nilai per deal.
   Dedup metrik: Total Closing & ROAS cukup di kartu Total Closing (dulu dobel di Cost & ROI).
   ══════════════════════════════════════════════════════════════════════════ */

import '../dashboard-ridgeline.css';
import '../leads-ridgeline.css';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  RefreshCw, Users, PhoneCall, Gem, ListChecks, Tags, Wallet, Calculator,
  Inbox, ArrowUpRight, ArrowRight, ArrowUp, ArrowDown, Check, ChevronDown, TriangleAlert,
} from 'lucide-react';
import { useAuth } from '../components/AuthContext';
import { supabase, authFetch } from '../supabase';
import useIsMobile from '../components/useIsMobile';
import ThemeToggle from '../components/ThemeToggle';
import DateFilterPopup from '../components/DateFilterPopup';
import CountUp from '../components/CountUp';
import { STATUSES, SALES, CATEGORIES, kategoriLabel } from '../components/leadsConfig';
import { useLeadsFilter, DATE_PRESETS_DASHBOARD } from '../components/DateFilterContext';
import { dashboardFontVars } from '../components/dashboardFonts';
import {
  fmtRangeShort, fmtClock, fmtPct1, toneOf, Delta, InfoTip, DatePill, KpiSpark, previousRange,
} from '../components/rgKit';

/* ─── Format angka — PENUH gaya Indonesia (sama dengan Dashboard Ads Hub) ─── */
const fmtInt = v => Math.round(v || 0).toLocaleString('id-ID');
const fmtRp  = v => 'Rp ' + fmtInt(v);
const fmtPct0 = v => fmtInt(v) + '%';
const fmtX = v => v.toLocaleString('id-ID', { minimumFractionDigits: v < 10 ? 2 : 1, maximumFractionDigits: v < 10 ? 2 : 1 }) + 'x';
const plural = (n, w) => `${fmtInt(n)} ${w}${n === 1 ? '' : 's'}`;

/* Warna status & sales = token skin (app/leads-ridgeline.css) */
const STATUS_VAR = {
  'No Status': 'var(--lh-none)', Cold: 'var(--lh-cold)', Warm: 'var(--lh-warm)', Hot: 'var(--lh-hot)', Deal: 'var(--lh-deal)',
};
const SALES_VAR = { Akmel: 'var(--lh-akmel)', Hendra: 'var(--lh-hendra)', Dedik: 'var(--lh-dedik)' };

/* Lead "qualified" = sudah diproses sales ke Warm, Hot atau Deal */
const QUALIFIED = ['Warm', 'Hot', 'Deal'];
const qualCount = counts => QUALIFIED.reduce((n, s) => n + (counts[s] || 0), 0);
const ptsTone = pts => (pts == null ? 'na' : Math.abs(pts) < 0.05 ? 'neu' : pts > 0 ? 'pos' : 'neg');

/* preset → {since, until} (versi client; SAMA dengan v3.1 — logika query tidak diubah) */
function ymd(d) { return d.toISOString().slice(0, 10); }
function presetToRange(preset) {
  const now = new Date();
  const today = ymd(now);
  const add = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return ymd(d); };
  switch (preset) {
    case 'today':     return { since: today, until: today };
    case 'yesterday': return { since: add(-1), until: add(-1) };
    case 'last_7d':   return { since: add(-7),  until: add(-1) };
    case 'last_14d':  return { since: add(-14), until: add(-1) };
    case 'last_30d':  return { since: add(-30), until: add(-1) };
    case 'this_month': return { since: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, until: today };
    case 'last_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last  = new Date(now.getFullYear(), now.getMonth(), 0);
      return { since: ymd(first), until: ymd(last) };
    }
    default: return { since: add(-30), until: add(-1) };
  }
}

/* Ringkas satu kumpulan lead (rumus v3.1, tidak diubah) */
function summarize(leads, range) {
  const total = leads.length;
  const fu = leads.filter(l => l.followed_up).length;
  const statusCounts = Object.fromEntries(STATUSES.map(s => [s, 0]));
  const byKategori = Object.fromEntries([...CATEGORIES.map(c => c.value), '—'].map(k => [k, 0]));
  const bySales = Object.fromEntries([...SALES, '—'].map(s => [s, { leads: 0, deals: 0 }]));
  let closing = 0;
  for (const l of leads) {
    statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
    byKategori[l.kategori_promo || '—'] = (byKategori[l.kategori_promo || '—'] || 0) + 1;
    const sk = l.sales && bySales[l.sales] ? l.sales : '—';
    bySales[sk].leads += 1;
    if (l.status === 'Deal') bySales[sk].deals += 1;
    if (l.status === 'Deal' && l.closing_amount) closing += parseFloat(l.closing_amount);
  }
  // Lead per hari dalam rentang (sparkline Total Leads)
  const daily = [];
  if (range) {
    const dayCounts = {};
    for (const l of leads) {
      const day = (l.created_at || '').slice(0, 10);
      if (day) dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
    const end = new Date(range.until + 'T00:00:00');
    for (let dt = new Date(range.since + 'T00:00:00'); dt <= end; dt.setDate(dt.getDate() + 1)) {
      daily.push(dayCounts[ymd(dt)] || 0);
    }
  }
  return {
    total, fuCount: fu, fuRate: total ? (fu / total) * 100 : 0,
    statusCounts, byKategori, bySales, deals: statusCounts.Deal || 0, closing, daily,
  };
}

/* ─── Delta dalam poin persen (follow-up rate: 58% → 72% = naik 14 pts) ─── */
function DeltaPts({ pts }) {
  if (pts == null || !isFinite(pts)) return <span className="rg-delta is-na" title="No leads in the comparison period">—</span>;
  const tone = Math.abs(pts) < 0.05 ? 'neu' : pts > 0 ? 'pos' : 'neg';
  const Arrow = pts >= 0 ? ArrowUp : ArrowDown;
  return (
    <span className={`rg-delta is-${tone}`}>
      <span className="rg-delta-ico" aria-hidden="true"><Arrow size={10} strokeWidth={3} /></span>
      <span className="rg-sr">{pts >= 0 ? 'Up' : 'Down'} </span>
      {Math.abs(pts).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts
    </span>
  );
}

/* ─── Kartu KPI (anatomi sama dengan Dashboard Ads Hub: kepala · panel bergradasi · kaki) ─── */
function LeadsKpi({ label, icon: Icon, info, tipAlign, tone, footLabel, footVal, delay = 0, headExtra, children }) {
  return (
    <div className="rg-card rg-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="rg-head">
        <span className="rg-head-ico"><Icon size={15} /></span>
        <span className="rg-title">{label}</span>
        <InfoTip text={info} align={tipAlign} />
        {headExtra}
      </div>
      <div className={`rg-well rg-kpi-well rg-tone-${tone === 'na' ? 'neu' : tone}`}>{children}</div>
      <div className="rg-foot">
        <span>{footLabel}</span>
        <span className="rg-mono rg-foot-val">{footVal}</span>
      </div>
    </div>
  );
}

/* ─── Meter "barcode" follow-up + penanda rate periode lalu ─── */
const TICKS = 60;
function FollowTicks({ rate, prevRate }) {
  const on = Math.round((Math.max(0, Math.min(rate, 100)) / 100) * TICKS);
  const p = prevRate != null ? Math.max(0, Math.min(prevRate, 100)) : null;
  // Label "prev" jangan keluar panel di ujung kiri/kanan
  const shift = p == null ? 0 : p < 12 ? 0 : p > 88 ? -100 : -50;
  return (
    <div className="rgl-ticks" role="img" aria-label={`${Math.round(rate)}% of leads followed up`}>
      {Array.from({ length: TICKS }).map((_, i) => (
        <i key={i} className={i < on ? 'is-on' : undefined} style={{ animationDelay: `${200 + i * 10}ms` }} />
      ))}
      {p != null && (
        <span className="rgl-ticks-prev" style={{ left: `${p}%` }}>
          <span style={{ transform: `translateX(${shift}%)` }}>prev {fmtPct0(p)}</span>
        </span>
      )}
    </div>
  );
}

/* ─── Meter kualitas: batang bertumpuk Warm · Hot · Deal (warna sama dgn Leads by Status)
   + sisa lead (belum/tidak qualified) sebagai track, penanda rate periode lalu ─── */
function QualityMeter({ counts, total, prevRate, delay = 0 }) {
  const segs = QUALIFIED.map(s => ({ s, n: counts[s] || 0 })).filter(x => x.n > 0);
  const p = prevRate != null ? Math.max(0, Math.min(prevRate, 100)) : null;
  const shift = p == null ? 0 : p < 12 ? 0 : p > 88 ? -100 : -50;
  return (
    <div className="rgl-qual">
      <div className="rgl-qual-bar" aria-hidden="true">
        {total > 0 && segs.map((x, i) => (
          <i key={x.s} title={`${x.s}: ${fmtInt(x.n)} lead${x.n === 1 ? '' : 's'}`}
            style={{ width: `calc(${(x.n / total) * 100}% - 3px)`, minWidth: 4, background: STATUS_VAR[x.s], animationDelay: `${delay + 200 + i * 90}ms` }} />
        ))}
        <i className="is-rest" />
      </div>
      {p != null && (
        <span className="rgl-ticks-prev" style={{ left: `${p}%` }}>
          <span style={{ transform: `translateX(${shift}%)` }}>prev {fmtPct0(p)}</span>
        </span>
      )}
    </div>
  );
}

/* ─── Leads by Status: 5 sel sejajar (tanpa donut — keputusan Nadir Jul 2026) ─── */
function StatusCard({ d, delay = 0 }) {
  return (
    <div className="rg-card rg-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="rg-head">
        <span className="rg-head-ico"><ListChecks size={15} /></span>
        <span className="rg-title">Leads by Status</span>
        <span className="rg-meta rgl-meta-long">Where this period’s leads stand now</span>
        <Link href="/leads/list" className="rg-iconbtn" title="Open Leads List" aria-label="Open Leads List">
          <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="rg-well rgl-status">
        {STATUSES.map((s, i) => {
          const n = d.statusCounts[s] || 0;
          const pct = d.total ? (n / d.total) * 100 : 0;
          return (
            <div key={s} className="rgl-st">
              <div className="rgl-st-name"><span className="rgl-dot" style={{ background: STATUS_VAR[s] }} />{s}</div>
              <div className="rgl-st-num rg-mono"><CountUp value={n} display={fmtInt(n)} delay={delay + 120} /></div>
              <div className="rgl-st-pct">{fmtPct0(pct)} of leads</div>
              <div className="rgl-bar" aria-hidden="true">
                <i style={{ width: `${pct}%`, minWidth: n ? 4 : 0, background: STATUS_VAR[s], animationDelay: `${delay + 200 + i * 60}ms` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Leads by Sales — pembagian lead, BUKAN performa (keputusan Nadir) ─── */
function SalesCard({ d, delay = 0 }) {
  const entries = [...SALES, '—'].filter(s => s !== '—' || (d.bySales['—']?.leads || 0) > 0);
  const max = Math.max(...entries.map(s => d.bySales[s]?.leads || 0), 1);
  return (
    <div className="rg-card rg-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="rg-head">
        <span className="rg-head-ico"><Users size={15} /></span>
        <span className="rg-title">Leads by Sales</span>
        <span className="rg-meta rgl-meta-long">How leads are shared across the team</span>
      </div>
      <div className="rg-well rgl-list">
        {d.total === 0 ? (
          <div className="rg-empty">
            <strong>No leads in this period</strong>
            <span>Pick a wider date range to see how leads were assigned.</span>
          </div>
        ) : entries.map((s, i) => {
          const row = d.bySales[s] || { leads: 0, deals: 0 };
          const c = s === '—' ? 'var(--rg-other)' : SALES_VAR[s];
          const pct = d.total ? (row.leads / d.total) * 100 : 0;
          return (
            <div key={s} className="rgl-sales">
              <span className="rgl-avatar" style={{ '--c': c }} aria-hidden="true">{s === '—' ? '?' : s.charAt(0)}</span>
              <div className="rgl-who">
                <b>{s === '—' ? 'Unassigned' : s}</b>
                <span>{fmtPct1(pct)} of leads{row.deals ? ` · ${plural(row.deals, 'deal')}` : ''}</span>
              </div>
              <div className="rgl-bar" aria-hidden="true">
                <i style={{ width: `${(row.leads / max) * 100}%`, minWidth: row.leads ? 4 : 0, background: c, animationDelay: `${delay + 200 + i * 60}ms` }} />
              </div>
              <span className="rgl-count rg-mono">{fmtInt(row.leads)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── By Category (terdeteksi dari nama campaign) ─── */
function CategoryCard({ d, delay = 0 }) {
  const keys = [...CATEGORIES.map(c => c.value), '—'].filter(k => k !== '—' || (d.byKategori['—'] || 0) > 0);
  return (
    <div className="rg-card rg-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="rg-head">
        <span className="rg-head-ico"><Tags size={15} /></span>
        <span className="rg-title">By Category</span>
        <span className="rg-meta rgl-meta-long">Detected from campaign name</span>
      </div>
      <div className="rg-well rgl-list">
        {d.total === 0 ? (
          <div className="rg-empty">
            <strong>No leads in this period</strong>
            <span>Categories appear once leads come in.</span>
          </div>
        ) : keys.map((k, i) => {
          const n = d.byKategori[k] || 0;
          const pct = d.total ? (n / d.total) * 100 : 0;
          const c = k === '—' ? 'var(--rg-other)' : 'var(--rg-conv)';
          return (
            <div key={k} className="rgl-cat">
              <span className="rgl-cat-name">{k === '—' ? 'Uncategorized' : kategoriLabel(k)}</span>
              <span className="rgl-cat-vals rg-mono"><span>{fmtInt(n)}</span><span>{fmtPct0(pct)}</span></span>
              <div className="rgl-bar" aria-hidden="true">
                <i style={{ width: `${pct}%`, minWidth: n ? 4 : 0, background: c, animationDelay: `${delay + 200 + i * 60}ms` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Total Closing — cincin ROAS saat menyala; DORMANT saat belum ada Deal ─── */
function ClosingCard({ d, dormant, delay = 0 }) {
  const ringP = d.spend ? Math.min(d.roas / 4, 1) * 100 : 0;
  return (
    <div className={`rg-card rg-rise${dormant ? ' rgl-dormant' : ''}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="rg-head">
        <span className="rg-head-ico"><Wallet size={15} /></span>
        <span className="rg-title">Total Closing</span>
        <span className={`rg-chip ${dormant ? 'is-muted' : 'is-pos'}`} style={{ marginLeft: 'auto', marginRight: 4 }}>
          {plural(d.deals, 'deal')}
        </span>
      </div>
      <div className="rg-well rgl-close">
        {!dormant && (
          <div className="rgl-ring" style={{ '--p': ringP }} title="ROAS = total closing ÷ conversion spend">
            <div className="rgl-ring-in">
              <span className="rgl-ring-val rg-mono">{d.spend ? fmtX(d.roas) : '—'}</span>
              <span className="rgl-ring-lbl">ROAS</span>
            </div>
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div className="rgl-close-val rg-mono">
            <span className="rg-unit">Rp</span>
            <CountUp value={Math.round(d.closing)} display={fmtInt(d.closing)} delay={delay + 120} />
          </div>
          <div className="rgl-close-sub">
            {dormant
              ? 'No closing in this period yet — this card lights up when the first deal lands'
              : `Avg. ${fmtRp(d.closing / d.deals)} per deal · counted by lead created date`}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Cost & ROI (atribusi cohort) ─── */
function CostRoiCard({ d, dormant, delay = 0 }) {
  const live = !!(d.spend && d.deals);
  const cells = [
    { label: 'Conversion spend', value: fmtRp(d.spend), note: 'Conversion campaigns',
      info: 'Meta spend of Conversion campaigns (name contains PROSPEK or KONVERSI) in this period.' },
    { label: 'Cost per deal', value: d.deals ? fmtRp(d.cpd) : '—', note: 'Spend ÷ deals',
      info: 'Conversion spend divided by the number of deals from this period’s leads.' },
    { label: 'ROI', value: live ? `${d.roi >= 0 ? '+' : '−'}${fmtInt(Math.abs(d.roi))}%` : '—',
      tone: live ? (d.roi >= 0 ? 'is-pos' : 'is-neg') : '', note: '(Closing − spend) ÷ spend',
      info: 'Return on conversion spend: (total closing − spend) ÷ spend.', align: 'end' },
  ];
  return (
    <div className={`rg-card rg-rise${dormant ? ' rgl-dormant' : ''}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="rg-head">
        <span className="rg-head-ico"><Calculator size={15} /></span>
        <span className="rg-title">Cost &amp; ROI</span>
        <span className="rg-meta">Cohort attribution</span>
        <InfoTip align="end" text="Closings are counted in the period the lead came in (by created date), so they line up with that period’s spend." />
      </div>
      <div className="rg-well rgl-roi">
        {cells.map(c => (
          <div key={c.label} className="rgl-roi-cell">
            <div className="rgl-roi-label"><span>{c.label}</span><InfoTip text={c.info} align={c.align} /></div>
            <div className={`rgl-roi-val rg-mono ${c.tone || ''}`}>{c.value}</div>
            <div className="rgl-roi-note">{c.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Pil kategori promo (menu rata tengah thd tombol — lapisan posisi dipisah dari animasi) ─── */
function CategoryPill({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);
  const opts = [{ value: 'Semua', label: 'All categories' }, ...CATEGORIES.map(c => ({ value: c.value, label: c.label }))];
  const cur = opts.find(o => o.value === value) || opts[0];
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="rg-pill" aria-expanded={open} aria-haspopup="menu" title="Lead category"
        onClick={() => setOpen(o => !o)}>
        <Tags size={15} />
        <span>{cur.label}</span>
        <ChevronDown size={14} className="rg-caret" />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 46, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
          <div className="rg-menu" role="menu" style={{ minWidth: 240 }}>
            {opts.map(o => (
              <button key={o.value} type="button" role="menuitemradio" aria-checked={o.value === value}
                className={`rg-menu-item${o.value === value ? ' is-on' : ''}`}
                onClick={() => { onChange(o.value); setOpen(false); }}>
                {o.label}
                {o.value === value && <Check size={14} className="rg-menu-check" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Skeleton muat pertama (refetch berikutnya: tampilan lama diredupkan) ─── */
function SkelCard({ lines = 2 }) {
  return (
    <div className="rg-card">
      <div className="rg-head"><span className="rg-skel" style={{ width: '32%', height: 11 }} /></div>
      <div className="rg-well" style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span className="rg-skel" style={{ width: '40%', height: 22 }} />
        {Array.from({ length: lines }).map((_, i) => (
          <span key={i} className="rg-skel" style={{ width: `${56 - i * 12}%`, height: 10 }} />
        ))}
      </div>
    </div>
  );
}

/* ═══ MAIN ═══ */
export default function LeadsDashboardPage() {
  const { role } = useAuth();
  const isMobile = useIsMobile();
  const { dateOpt, customSince, customUntil, isCustom, selectPreset, applyCustom } = useLeadsFilter();

  const [showDropdown, setShowDropdown] = useState(false);
  const [kategori, setKategori] = useState('Semua');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [data, setData]         = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  // Penanda permintaan terakhir: respons lama (ganti filter cepat) tidak menimpa yang baru
  const fetchToken = useRef(0);

  // Kalender popup (UI only)
  const _initCal = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const [calY, setCalY] = useState(_initCal.getFullYear());
  const [calM, setCalM] = useState(_initCal.getMonth());
  const [localSince, setLocalSince] = useState('');
  const [localUntil, setLocalUntil] = useState('');

  // Slot top bar mobile (refresh via portal, pola halaman lain)
  const [topbarSlot, setTopbarSlot] = useState(null);
  useEffect(() => {
    setTopbarSlot(isMobile ? document.getElementById('wd-topbar-actions') : null);
  }, [isMobile]);

  useEffect(() => { if (!role) return; fetchData(); }, [role, dateOpt, isCustom, customSince, customUntil, kategori]);

  useEffect(() => {
    if (!showDropdown) return;
    const h = e => { if (!e.target.closest('[data-filter]')) setShowDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showDropdown]);

  const range = isCustom && customSince && customUntil
    ? { since: customSince, until: customUntil }
    : presetToRange(dateOpt.value);
  const prevR = previousRange(range.since, range.until);

  async function fetchData() {
    const token = ++fetchToken.current;
    setLoading(true); setError(null);
    try {
      let leads, prevLeads = null, spend = 0, inboxCount = 0;

      // 1. Leads approved dalam periode (cohort by created_at) + periode pembanding
      const q = (r, cols) => {
        let query = supabase
          .from('leads')
          .select(cols)
          .eq('verification', 'approved')
          .gte('created_at', r.since + 'T00:00:00')
          .lte('created_at', r.until + 'T23:59:59.999');
        if (kategori !== 'Semua') query = query.eq('kategori_promo', kategori);
        return query.limit(10000);
      };
      const [curRes, prevRes] = await Promise.all([
        q(range, 'status, followed_up, closing_amount, kategori_promo, sales, created_at'),
        q(prevR, 'status, followed_up'),
      ]);
      if (curRes.error) throw new Error(curRes.error.message);
      leads = curRes.data;
      prevLeads = prevRes.error ? null : prevRes.data;   // gagal → delta "—", halaman tetap jalan

      // 2. Spend campaign konversi (agregat) — periode sama
      try {
        const url = isCustom && customSince && customUntil
          ? `/api/leads?mode=spend&since=${customSince}&until=${customUntil}`
          : `/api/leads?mode=spend&date_preset=${dateOpt.value}`;
        const res  = await authFetch(url);
        const json = await res.json();
        if (!json.error) spend = json.spend || 0;
      } catch (e) {}

      // 3. Black Box count (admin only)
      if (role === 'admin') {
        const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('verification', 'unverified');
        inboxCount = count || 0;
      }
      if (token !== fetchToken.current) return;

      const cur  = summarize(leads, range);
      const prev = prevLeads ? summarize(prevLeads, null) : null;
      setData({
        ...cur,
        spend,
        cpd:  cur.deals ? spend / cur.deals : 0,
        roas: spend ? cur.closing / spend : 0,                  // ROAS = omzet ÷ spend
        roi:  spend ? (cur.closing - spend) / spend * 100 : 0,  // ROI  = (omzet − spend) ÷ spend
        inboxCount,
        prev,
        pctLeads: prev && prev.total ? ((cur.total - prev.total) / prev.total) * 100 : null,
        fuPts:    prev && prev.total ? cur.fuRate - prev.fuRate : null,
        qualCount: qualCount(cur.statusCounts),
        qualRate:  cur.total ? (qualCount(cur.statusCounts) / cur.total) * 100 : 0,
        prevQualRate: prev && prev.total ? (qualCount(prev.statusCounts) / prev.total) * 100 : null,
        qualPts: prev && prev.total && cur.total
          ? (qualCount(cur.statusCounts) / cur.total - qualCount(prev.statusCounts) / prev.total) * 100 : null,
      });
      setUpdatedAt(new Date());
    } catch (err) {
      if (token !== fetchToken.current) return;
      setError(err.message);
    }
    if (token === fetchToken.current) setLoading(false);
  }

  /* ── Handler filter (pola sama Reports) ── */
  function openFilter() {
    const next = !showDropdown;
    if (next) {
      setLocalSince(customSince || ''); setLocalUntil(customUntil || '');
      if (customSince) { const p = customSince.split('-'); setCalY(+p[0]); setCalM(+p[1] - 1); }
    }
    setShowDropdown(next);
  }
  function shiftCal(delta) {
    const dt = new Date(calY, calM + delta, 1);
    setCalY(dt.getFullYear()); setCalM(dt.getMonth());
  }
  function pickDay(ds) {
    if (!localSince || (localSince && localUntil)) { setLocalSince(ds); setLocalUntil(''); }
    else if (ds < localSince) { setLocalUntil(localSince); setLocalSince(ds); }
    else setLocalUntil(ds);
  }
  function pickRange(s, u) {
    setLocalSince(s); setLocalUntil(u);
    const p = s.split('-'); setCalY(+p[0]); setCalM(+p[1] - 1);
  }
  function applyCustomRange() {
    if (!localSince || !localUntil) return;
    applyCustom(localSince, localUntil);
    setShowDropdown(false);
  }
  function handleSelectPreset(opt) {
    selectPreset(opt);
    setShowDropdown(false);
  }
  function filterLabel() {
    if (isCustom && customSince && customUntil) {
      const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
      return `${fmt(customSince)} – ${fmt(customUntil)}`;
    }
    return dateOpt.label;
  }

  if (!role) return null;

  const d = data;
  const initialLoading = loading && !d;
  const busy = loading && d ? ' rg-busy' : '';
  const hasDeal = !!d && d.deals > 0;
  const dormant = !!d && d.deals === 0;
  const prevLabel = fmtRangeShort(prevR.since, prevR.until);
  const rangeText = fmtRangeShort(range.since, range.until, true);
  const showInbox = role === 'admin' && !!d && d.inboxCount > 0;

  const ctxLine = initialLoading
    ? <span>Loading leads…</span>
    : error && !d
      ? <span>Could not load data</span>
      : (<>
          <span className="rg-live" aria-hidden="true" />
          <span>Leads Hub</span>
          <span className="rg-ctx-sep" aria-hidden="true" />
          <span>{plural(d?.total || 0, 'lead')}{kategori !== 'Semua' ? ` · ${kategoriLabel(kategori)}` : ''}</span>
          <span className="rg-ctx-sep" aria-hidden="true" />
          <span>{loading ? 'Refreshing…' : updatedAt ? `Updated ${fmtClock(updatedAt)}` : ''}</span>
        </>);

  // Tombol refresh HP — dirender via portal ke top bar MobileNav (di luar skin),
  // jadi tetap gaya lama 36px agar serasi dengan theme toggle top bar
  const refreshBtnMobile = (
    <button onClick={fetchData} title="Refresh" style={{
      width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '9px', cursor: 'pointer',
      flexShrink: 0, transition: 'border-color 0.15s',
    }}>
      <RefreshCw size={14} color="var(--t2)" style={loading ? { animation: 'wdSpin 0.8s linear infinite' } : undefined} />
    </button>
  );

  return (
    <div className={`rg rg-page ${dashboardFontVars}${isMobile ? ' is-mobile' : ''}`}>

      {/* ══ TOP BAR — judul + konteks (kiri) · filter & aksi (kanan) ══ */}
      <header className="rg-top">
        <div className="rg-top-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="rg-h1">Dashboard</h1>
          </div>
          <div className="rg-ctx">{ctxLine}</div>
        </div>

        <div className="rg-tools">
          {/* Black Box (admin, desktop) — lead menunggu verifikasi */}
          {!isMobile && showInbox && (
            <Link href="/leads/list" className="rg-pill" title="Leads waiting for verification — open Black Box">
              <span className="rgl-inbox-dot" aria-hidden="true" />
              <span><span className="rgl-inbox-n rg-mono">{fmtInt(d.inboxCount)}</span> in Black Box</span>
            </Link>
          )}

          {/* Filter kategori promo (scope Dashboard saja — MASTER PLAN 3.3) */}
          <CategoryPill value={kategori} onChange={setKategori} />

          <DatePill open={showDropdown} onToggle={openFilter} isMobile={isMobile} isCustom={isCustom}
            presetLabel={dateOpt.label} mobileLabel={filterLabel()} rangeText={rangeText}>
            <DateFilterPopup
              presets={DATE_PRESETS_DASHBOARD}
              dateOpt={dateOpt}
              isCustom={isCustom}
              customSince={localSince}
              customUntil={localUntil}
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

          {!isMobile && (<>
            <span className="rg-vsep" aria-hidden="true" />
            <button type="button" className="rg-pill rg-round" title="Refresh data" aria-label="Refresh data"
              onClick={fetchData} disabled={loading}>
              <RefreshCw size={15} style={loading ? { animation: 'wdSpin 0.8s linear infinite' } : undefined} />
            </button>
            <ThemeToggle className="rg-pill rg-round" />
          </>)}
          {isMobile && topbarSlot && createPortal(refreshBtnMobile, topbarSlot)}
        </div>
      </header>

      {/* ══ ISI ══ */}
      <div className="rg-body">
        {error && (
          <div className="rg-error" role="alert">
            <span className="rg-error-ico"><TriangleAlert size={20} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="rg-error-title">Leads data couldn’t be loaded</div>
              <div className="rg-error-msg">{error}</div>
            </div>
            <button type="button" className="rg-pill" onClick={fetchData}>
              <RefreshCw size={15} />Try again
            </button>
          </div>
        )}

        {/* Black Box (admin, HP — desktop pakai pil di top bar) */}
        {isMobile && showInbox && (
          <Link href="/leads/list" className="rgl-inbox-banner">
            <Inbox size={16} />
            <span><b className="rg-mono">{fmtInt(d.inboxCount)}</b> lead{d.inboxCount === 1 ? '' : 's'} waiting in Black Box</span>
            <span>Open <ArrowRight size={13} style={{ verticalAlign: '-2px' }} /></span>
          </Link>
        )}

        {initialLoading && (<>
          <div className="rgl-row rgl-row-kpi"><SkelCard /><SkelCard /><SkelCard /></div>
          <div className="rgl-row-status"><SkelCard lines={1} /></div>
          <div className="rgl-row rgl-row-split"><SkelCard lines={3} /><SkelCard lines={3} /></div>
          <div className="rgl-row rgl-row-money"><SkelCard lines={1} /><SkelCard lines={1} /></div>
        </>)}

        {d && (<>
          {/* ── 1 · KPI: jumlah (Total Leads) → kecepatan (Follow-up) → kualitas (Lead Quality) ── */}
          <div className={`rgl-row rgl-row-kpi${busy}`} style={{ order: 1 }}>
            <LeadsKpi label="Total Leads" icon={Users} tone={toneOf(d.pctLeads, 'up')} delay={0}
              info="Approved leads that came in during this period, by the date the lead was created. Leads still waiting in Black Box are not counted."
              footLabel="Previous" footVal={d.prev ? fmtInt(d.prev.total) : '—'}>
              <div className="rg-kpi-value rg-mono">
                <CountUp value={d.total} display={fmtInt(d.total)} delay={120} />
                <span className="rg-unit">lead{d.total === 1 ? '' : 's'}</span>
              </div>
              <div className="rg-kpi-sub">
                <Delta pct={d.pctLeads} good="up" />
                <span>vs {prevLabel}</span>
              </div>
              <KpiSpark data={d.daily} />
            </LeadsKpi>

            <LeadsKpi label="Follow-up" icon={PhoneCall} delay={55} tone={ptsTone(d.fuPts)}
              info="Share of this period’s leads that sales have marked as followed up. The change is in percentage points."
              footLabel="Followed up" footVal={`${fmtInt(d.fuCount)} of ${fmtInt(d.total)}`}>
              <div className="rg-kpi-value rg-mono">
                <span>
                  <CountUp value={Math.round(d.fuRate)} display={fmtInt(d.fuRate)} delay={175} />
                  <span className="rg-unit" style={{ marginLeft: 2 }}>%</span>
                </span>
              </div>
              <div className="rg-kpi-sub">
                <DeltaPts pts={d.fuPts} />
                <span>vs {prevLabel}</span>
              </div>
              <FollowTicks rate={d.fuRate} prevRate={d.prev && d.prev.total ? d.prev.fuRate : null} />
            </LeadsKpi>

            <LeadsKpi label="Lead Quality" icon={Gem} tipAlign="end" delay={110} tone={ptsTone(d.qualPts)}
              info="Share of this period’s leads that sales have moved to Warm, Hot or Deal. The change is in percentage points. Newer leads may not be qualified yet."
              headExtra={(
                <span className="rgl-legend-mini" aria-hidden="true">
                  {QUALIFIED.map(s => <span key={s}><span className="rgl-dot" style={{ background: STATUS_VAR[s] }} />{s}</span>)}
                </span>
              )}
              footLabel="Qualified" footVal={`${fmtInt(d.qualCount)} of ${fmtInt(d.total)}`}>
              <div className="rg-kpi-value rg-mono">
                <span>
                  <CountUp value={Math.round(d.qualRate)} display={fmtInt(d.qualRate)} delay={230} />
                  <span className="rg-unit" style={{ marginLeft: 2 }}>%</span>
                </span>
              </div>
              <div className="rg-kpi-sub">
                <DeltaPts pts={d.qualPts} />
                <span>vs {prevLabel}</span>
              </div>
              <QualityMeter counts={d.statusCounts} total={d.total} prevRate={d.prevQualRate} delay={110} />
            </LeadsKpi>
          </div>

          {/* ── 2 · Leads by Status ── */}
          <div className={`rgl-row-status${busy}`} style={{ order: 2 }}>
            <StatusCard d={d} delay={140} />
          </div>

          {/* ── 3 · Leads by Sales + By Category (turun ke bawah baris uang saat ada Deal) ── */}
          <div className={`rgl-row rgl-row-split${busy}`} style={{ order: hasDeal ? 4 : 3 }}>
            <SalesCard d={d} delay={hasDeal ? 320 : 220} />
            <CategoryCard d={d} delay={hasDeal ? 370 : 270} />
          </div>

          {/* ── 4 · Baris uang — DORMANT s.d. ada Deal; saat ada Deal naik tepat di bawah status ── */}
          <div className={`rgl-row rgl-row-money rgl-money${busy}`} style={{ order: hasDeal ? 3 : 4 }}>
            <ClosingCard d={d} dormant={dormant} delay={hasDeal ? 220 : 320} />
            <CostRoiCard d={d} dormant={dormant} delay={hasDeal ? 270 : 370} />
          </div>
        </>)}
      </div>
    </div>
  );
}
