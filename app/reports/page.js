'use client';

/* ══ ANALYTICS & INSIGHTS — redesain "Ridgeline" (PREVIEW LOKAL, 28 Sep 2026) ════
   Insight otomatis dari data Meta Ads yang sedang berjalan (insightEngine.js,
   rule-based dari data real; siap di-upgrade ke narasi LLM). Route tetap /reports.
   Nuansa sama dengan Dashboard: top bar judul + konteks | pil tanggal & refresh,
   kartu cangkang + panel dalam, angka Geist Mono, delta ber-ikon bulat.
   Skor = cincin tebal + "72/100" + chip status (ala panel "AI Search Visibility"
   referensi). Tanpa tombol tema — tema ikut setting global (keputusan lama, commit
   821d8da). Logika fetch = mode=dashboard (sama dengan Dashboard) — JANGAN diubah.
   Skin: app/ridgeline.css + app/reports-ridgeline.css.
   ══════════════════════════════════════════════════════════════════════════ */

import '../reports-ridgeline.css';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles, RefreshCw,
  TrendingUp, TrendingDown, TriangleAlert, Award, Activity,
  Zap, Target, Wallet, BadgeCheck, CircleAlert, Crosshair, Lightbulb,
} from 'lucide-react';
import CountUp from '../components/CountUp';
import useIsMobile from '../components/useIsMobile';
import DateFilterPopup from '../components/DateFilterPopup';
import { useReportsFilter, DATE_PRESETS_DASHBOARD } from '../components/DateFilterContext';
import { buildAnalysis, fmtRp, fmtNum } from '../components/insightEngine';
import { monotonePath } from '../components/AreaChart';
import { dashboardFontVars } from '../components/dashboardFonts';
import { presetToRange, fmtRangeShort, fmtClock, Delta, DatePill } from '../components/rgKit';
import { authFetch } from '../supabase';
/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ */
import PreviewPanel from '../components/PreviewPanel';
import { useAuth } from '../components/AuthContext';
import { buildDemoDashboard } from '../components/demoDashboard';
import { DEMO_ALLOWED, useDemoMode, DemoChip, demoDelay } from '../components/demoMode';
/* ═══ END PREVIEW-ONLY ═══ */

/* Tingkat insight → nada warna skin (critical merah · warning kuning tua · positive hijau ·
   info biru). Status color hanya untuk arti status, bukan dekorasi. */
const SEV = {
  critical: { tone: 'neg',  label: 'Critical' },
  warning:  { tone: 'warn', label: 'Warning'  },
  positive: { tone: 'pos',  label: 'Positive' },
  info:     { tone: 'info', label: 'Info'     },
};
const TONE_VAR = { neg: 'var(--rg-neg)', warn: 'var(--rg-warn)', pos: 'var(--rg-pos)', info: 'var(--rg-spend)' };

const ICONS = {
  TrendingUp, TrendingDown, TriangleAlert, Award, Activity,
  Zap, Target, Wallet, BadgeCheck, CircleAlert, Crosshair,
};

const scoreTone = (v) => (v >= 68 ? 'pos' : v >= 50 ? 'warn' : 'neg');

/* ─── Mini sparkline kartu insight (kurva monoton, warna = nada insight) ─── */
function Spark({ data, tone }) {
  const vals = (data || []).filter(v => v != null && v >= 0);
  if (vals.length < 2) return null;
  const W = 240, H = 34;
  const max = Math.max(...vals), min = Math.min(...vals), rng = max - min || 1;
  const pts = vals.map((v, i) => ({ x: (i / (vals.length - 1)) * W, y: H - 4 - ((v - min) / rng) * (H - 8) }));
  return (
    <svg className="rgr-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={monotonePath(pts)} fill="none" vectorEffect="non-scaling-stroke"
        style={{ stroke: TONE_VAR[tone], strokeWidth: 1.8, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
    </svg>
  );
}

/* ─── Skor: cincin tebal + angka monospace + chip status (ala referensi) ─── */
function ScoreRing({ score, label, size = 170 }) {
  const [prog, setProg] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setProg(score), 150);
    return () => clearTimeout(t);
  }, [score]);
  const R = 40, C = 2 * Math.PI * R;
  const tone = scoreTone(score);
  return (
    <div className="rgr-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="13" style={{ stroke: 'var(--rg-track)' }} />
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="13" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C - (prog / 100) * C}
          style={{ stroke: TONE_VAR[tone], transition: 'stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <div className="rgr-ring-center">
        <span className="rgr-ring-label">Score</span>
        <span className="rg-mono rgr-ring-value">
          <CountUp value={score} display={String(score)} delay={150} /><span className="rgr-ring-max">/100</span>
        </span>
        <span className={`rg-chip is-${tone} rgr-ring-chip`}>{label}</span>
      </div>
    </div>
  );
}

/* ─── Kartu insight: kepala (ikon + judul + tingkat) · panel (isi, angka, tren) ─── */
function InsightCard({ insight, index }) {
  const sev = SEV[insight.severity] || SEV.info;
  const Icon = ICONS[insight.icon] || Lightbulb;
  return (
    <div className="rg-card rg-rise rgr-card" style={{ animationDelay: `${120 + Math.min(index, 8) * 55}ms` }}>
      <div className="rg-head rgr-card-head">
        <span className={`rgr-sev-ico is-${sev.tone}`}><Icon size={15} /></span>
        <span className="rgr-card-title">{insight.title}</span>
        <span className={`rg-chip is-${sev.tone} rgr-sev-chip`}>{sev.label}</span>
      </div>
      <div className="rg-well rgr-card-well">
        <p className="rgr-card-body">{insight.body}</p>
        {insight.chips?.length > 0 && (
          <div className="rgr-chips">
            {insight.chips.map((c, i) => (
              <div key={i} className="rgr-datum">
                <span className="rgr-datum-label">{c.label}</span>
                <span className={`rg-mono rgr-datum-value${c.tone === 'pos' ? ' is-pos' : c.tone === 'neg' ? ' is-neg' : ''}`}>{c.value}</span>
              </div>
            ))}
          </div>
        )}
        {insight.spark && <Spark data={insight.spark} tone={sev.tone} />}
      </div>
    </div>
  );
}

function ReportsSkeleton({ isMobile }) {
  return (
    <>
      <div className="rg-card rgr-hero">
        <div className="rg-head"><span className="rg-skel" style={{ width: 150, height: 11 }} /></div>
        <div className="rg-well rgr-hero-well">
          <span className="rg-skel" style={{ width: isMobile ? 136 : 170, height: isMobile ? 136 : 170, borderRadius: '50%' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="rg-skel" style={{ width: '70%', height: 14 }} />
            <span className="rg-skel" style={{ width: '45%', height: 10 }} />
          </div>
        </div>
      </div>
      <div className="rgr-grid">
        {[0, 1, 2].map(i => (
          <div key={i} className="rg-card rgr-card">
            <div className="rg-head"><span className="rg-skel" style={{ width: '55%', height: 11 }} /></div>
            <div className="rg-well rgr-card-well" style={{ gap: 10 }}>
              <span className="rg-skel" style={{ width: '92%', height: 10 }} />
              <span className="rg-skel" style={{ width: '78%', height: 10 }} />
              <span className="rg-skel" style={{ width: '40%', height: 26, borderRadius: 10 }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══ MAIN ═══ */
export default function ReportsPage() {
  const isMobile = useIsMobile();
  const { dateOpt, customSince, setCustomSince, customUntil, setCustomUntil, isCustom, selectPreset, applyCustom } = useReportsFilter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [analysis, setAnalysis]   = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  // Bulan kiri kalender (UI only) — default: bulan lalu + bulan ini
  const _initCal = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const [calY, setCalY] = useState(_initCal.getFullYear());
  const [calM, setCalM] = useState(_initCal.getMonth());

  // Slot top bar mobile — refresh pindah ke atas via portal
  const [topbarSlot, setTopbarSlot] = useState(null);
  useEffect(() => {
    setTopbarSlot(isMobile ? document.getElementById('wd-topbar-actions') : null);
  }, [isMobile]);

  /* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ (saklar Demo data bersama — app/components/demoMode.js) */
  const { isAdmin } = useAuth();
  const demo = useDemoMode();
  const prevDemo = useRef(demo);
  useEffect(() => {
    if (prevDemo.current === demo) return;
    prevDemo.current = demo;
    refresh();
  }, [demo]);
  /* ═══ END PREVIEW-ONLY ═══ */
  // Penanda permintaan terakhir: respons lama yang datang belakangan (mis. ganti filter
  // cepat / saklar Demo data) tidak boleh menimpa hasil yang lebih baru
  const fetchToken = useRef(0);

  useEffect(() => { if (!isCustom) fetchData(); }, [dateOpt, isCustom]);
  // Restore custom range yang persist di context saat balik ke tab ini
  useEffect(() => { if (isCustom && customSince && customUntil) fetchData(customSince, customUntil); }, []);

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
        await demoDelay();
        json = buildDemoDashboard(since && until ? { since, until } : presetToRange(dateOpt.value));
      } else
      /* ═══ END PREVIEW-ONLY ═══ */
      {
        const res = await authFetch(url);
        json = await res.json();
      }
      if (token !== fetchToken.current) return;
      if (json.error) throw new Error(json.error);
      setAnalysis(buildAnalysis(json));
      setUpdatedAt(new Date());
    } catch (err) {
      if (token !== fetchToken.current) return;
      setError(err.message);
    }
    if (token === fetchToken.current) setLoading(false);
  }

  function refresh() {
    if (isCustom && customSince && customUntil) fetchData(customSince, customUntil);
    else fetchData();
  }

  // ── Handler filter (pola sama dengan Dashboard) ──
  function openFilter() {
    const next = !showDropdown;
    if (next && customSince) {
      const p = customSince.split('-');
      setCalY(+p[0]); setCalM(+p[1] - 1);
    }
    setShowDropdown(next);
  }
  function shiftCal(delta) {
    const dt = new Date(calY, calM + delta, 1);
    setCalY(dt.getFullYear()); setCalM(dt.getMonth());
  }
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
  function filterLabel() {
    if (isCustom && customSince && customUntil) {
      const fmt = d => new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' });
      return `${fmt(customSince)} – ${fmt(customUntil)}`;
    }
    return dateOpt.label;
  }
  const curRange  = isCustom && customSince && customUntil
    ? { since: customSince, until: customUntil }
    : presetToRange(dateOpt.value);
  const rangeText = fmtRangeShort(curRange.since, curRange.until, true);

  // Tombol refresh HP — dirender via portal ke top bar MobileNav (di luar skin),
  // jadi tetap gaya lama 36px agar serasi dengan tombol top bar lain
  const refreshButtonMobile = (
    <button onClick={refresh} title="Refresh" style={{
      width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '9px',
      cursor: 'pointer', flexShrink: 0, transition: 'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--br-strong)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--br)'}
    >
      <RefreshCw size={15} color="var(--t2)" style={loading ? { animation: 'wdSpin 0.8s linear infinite' } : undefined} />
    </button>
  );

  const m = analysis?.metrics;
  const initialLoading = loading && !analysis;
  const busy = loading && analysis ? ' rg-busy' : '';

  const ctxLine = initialLoading
    ? <span>Analyzing Meta Ads data…</span>
    : error && !analysis
      ? <span>Could not load data</span>
      : analysis ? (<>
          <span className="rg-live" aria-hidden="true" />
          <span>{analysis.insights.length} insight{analysis.insights.length === 1 ? '' : 's'}</span>
          <span className="rg-ctx-sep" aria-hidden="true" />
          <span>{analysis.campaignCount} campaign{analysis.campaignCount === 1 ? '' : 's'} analyzed</span>
          <span className="rg-ctx-sep" aria-hidden="true" />
          <span>{loading ? 'Refreshing…' : updatedAt ? `Updated ${fmtClock(updatedAt)}` : ''}</span>
        </>) : <span>Auto-generated from Meta Ads data</span>;

  const stats = m ? [
    { label: 'Leads',       value: fmtNum(m.leads),       pct: m.dLeads,       good: 'up' },
    { label: 'Traffic',     value: fmtNum(m.traffic),     pct: m.dTraffic,     good: 'up' },
    // Total Spend: naik/turun = keputusan budget → abu-abu netral (aturan sama dengan Dashboard)
    { label: 'Total Spend', value: fmtRp(m.spend),        pct: m.dSpend,       good: 'none' },
    { label: 'Reach',       value: fmtNum(m.reach),       pct: m.dReach,       good: 'up' },
    { label: 'Impressions', value: fmtNum(m.impressions), pct: m.dImpressions, good: 'up' },
    { label: 'CPM',         value: m.cpm != null ? fmtRp(m.cpm) : '—', pct: m.dCPM, good: 'down' },
  ] : [];

  return (
    <div className={`rg rg-page ${dashboardFontVars}${isMobile ? ' is-mobile' : ''}`}>

      {/* ══ TOP BAR ══ */}
      <header className="rg-top">
        <div className="rg-top-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="rg-h1">Analytics &amp; Insights</h1>
            {/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ */}
            {demo && <DemoChip />}
            {/* ═══ END PREVIEW-ONLY ═══ */}
          </div>
          <div className="rg-ctx">{ctxLine}</div>
        </div>

        <div className="rg-tools">
          {/* Filter tanggal (sama dengan Dashboard & Campaigns) */}
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

          {!isMobile && (<>
            <span className="rg-vsep" aria-hidden="true" />
            <button type="button" className="rg-pill rg-round" title="Refresh data" aria-label="Refresh data"
              onClick={refresh} disabled={loading}>
              <RefreshCw size={15} style={loading ? { animation: 'wdSpin 0.8s linear infinite' } : undefined} />
            </button>
          </>)}
          {isMobile && topbarSlot && createPortal(refreshButtonMobile, topbarSlot)}
        </div>
      </header>

      {/* ══ ISI ══ */}
      <div className="rg-body rgr-body">

        {initialLoading && <ReportsSkeleton isMobile={isMobile} />}

        {!loading && error && (
          <div className="rg-error" role="alert">
            <span className="rg-error-ico"><TriangleAlert size={20} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="rg-error-title">The analysis couldn’t be loaded</div>
              <div className="rg-error-msg">{error}</div>
            </div>
            <button type="button" className="rg-pill" onClick={refresh}>
              <RefreshCw size={15} />Try again
            </button>
          </div>
        )}

        {analysis && !error && (<>
          {/* ══ HERO: PERFORMANCE SCORE ══ */}
          <div className={`rg-card rg-rise rgr-hero${busy}`}>
            <div className="rg-head">
              <span className="rg-head-ico"><Sparkles size={15} /></span>
              <span className="rg-title">Performance score</span>
              <span className="rg-meta">{filterLabel()} vs previous period</span>
            </div>
            <div className="rg-well rgr-hero-well">
              <ScoreRing score={analysis.score.value} label={analysis.score.label} size={isMobile ? 136 : 170} />

              <div className="rgr-verdict">
                <div className="rgr-verdict-text">{analysis.score.verdict}</div>
                <div className="rgr-verdict-note">
                  Scored from your live Meta Ads data — trends in leads, traffic, costs and reach compared with the previous period.
                </div>
              </div>

              <div className="rgr-stats">
                {stats.map(s => (
                  <div key={s.label} className="rgr-stat">
                    <div className="rgr-stat-label">{s.label}</div>
                    <div className="rg-mono rgr-stat-value">{s.value}</div>
                    <Delta pct={s.pct} good={s.good} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ══ INSIGHT CARDS ══ */}
          <div className="rgr-section">
            <span className="rgr-section-title">Generated insights</span>
            <span className="rg-chip">{analysis.insights.length} from {/* PREVIEW-ONLY: cabang demo */ demo ? 'demo data' : 'live Meta Ads data'}</span>
          </div>

          {analysis.insights.length === 0 ? (
            <div className="rg-card rg-rise rgr-card" style={{ animationDelay: '120ms' }}>
              <div className="rg-well rgr-quiet">
                <div className="rg-empty">
                  <strong>All quiet — no notable signals this period</strong>
                  <span>Metrics are stable compared to the previous period. Check back after a few days of new data.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className={`rgr-grid${busy}`}>
              {analysis.insights.map((ins, i) => (
                <InsightCard key={ins.id} insight={ins} index={i} />
              ))}
            </div>
          )}
        </>)}
      </div>

      {/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ */}
      {DEMO_ALLOWED && isAdmin && !isMobile && (
        <PreviewPanel note="Applies to every Ads Hub page. Tip: pick “Last month” to see Critical insight cards." />
      )}
      {/* ═══ END PREVIEW-ONLY ═══ */}
    </div>
  );
}
