'use client';

/* ══ LEADS HUB — ANALYTICS & INSIGHTS (dibangun 28 Sep 2026, gaya "Ridgeline", LIVE) ══
   Dulu placeholder "under development". Isi dipilih Nadir (28 Sep 2026), atas → bawah:
     1. Temuan otomatis (kartu insight rule-based — gaya sama dengan Analytics Ads Hub)
     2. Leads over time (batang bertumpuk per kategori promo) + Lead funnel
     3. Lead sources (per campaign) + Time to deal
     4. Top cities + When leads arrive (peta panas hari × jam, waktu lokal)
   Semua angka dari mesin murni app/components/leadsInsightEngine.js. Definisi SAMA dengan
   Dashboard Leads Hub (lead approved, cohort by created_at, Qualified = Warm/Hot/Deal =
   "Lead Quality"), periode pembanding = previousRange (aturan Ads Hub).
   Skin: app/ridgeline.css + kartu insight app/reports-ridgeline.css + warna status
   app/leads-ridgeline.css + khusus halaman app/leads-insights-ridgeline.css (.rgi-).
   Filter tanggal terpisah (useLeadsInsightsFilter) + filter kategori promo.
   ══════════════════════════════════════════════════════════════════════════ */

import '../../reports-ridgeline.css';
import '../../leads-ridgeline.css';
import '../../leads-insights-ridgeline.css';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  RefreshCw, Tags, TriangleAlert, Sparkles, ChartColumnStacked, Funnel, Megaphone, Timer, MapPin,
  CalendarClock, ArrowUp, ArrowDown, TrendingUp, TrendingDown, CircleAlert, BadgeCheck, Gem, Award,
  Target, Zap, Lightbulb, Clock, UserX, Users,
} from 'lucide-react';
import { useAuth } from '../../components/AuthContext';
import { supabase } from '../../supabase';
import useIsMobile from '../../components/useIsMobile';
import ThemeToggle from '../../components/ThemeToggle';
import DateFilterPopup from '../../components/DateFilterPopup';
import CountUp from '../../components/CountUp';
import { CATEGORIES, kategoriLabel } from '../../components/leadsConfig';
import { useLeadsInsightsFilter, DATE_PRESETS_DASHBOARD } from '../../components/DateFilterContext';
import { dashboardFontVars } from '../../components/dashboardFonts';
import { fmtRangeShort, fmtClock, Delta, InfoTip, DatePill, previousRange, RgMenu } from '../../components/rgKit';
import { monotonePath } from '../../components/AreaChart';
import {
  buildLeadsAnalysis, DOW, fmtInt, fmtDec, fmtPct, fmtRp, catColor, catName,
} from '../../components/leadsInsightEngine';

const plural = (n, w) => `${fmtInt(n)} ${w}${n === 1 ? '' : 's'}`;

/* preset → {since, until} — SAMA dengan Dashboard Leads Hub (app/leads/page.js) supaya
   angka periode yang sama identik di dua halaman */
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

/* Sumbu Y "rapi": maks dibulatkan ke 4 langkah bernilai 1/2/2,5/5 × 10^k */
function niceMax(max) {
  if (max <= 4) return 4;
  const raw = max / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw);
  return Math.ceil(step) * 4;
}

/* ═══ Kartu insight (sama dengan Analytics Ads Hub — reports-ridgeline.css) ═══ */
const SEV = {
  critical: { tone: 'neg',  label: 'Critical' },
  warning:  { tone: 'warn', label: 'Warning'  },
  positive: { tone: 'pos',  label: 'Positive' },
  info:     { tone: 'info', label: 'Info'     },
};
const TONE_VAR = { neg: 'var(--rg-neg)', warn: 'var(--rg-warn)', pos: 'var(--rg-pos)', info: 'var(--rg-spend)' };
const ICONS = { TrendingUp, TrendingDown, CircleAlert, BadgeCheck, Gem, Award, Target, Zap, Lightbulb, Clock, UserX, Users, MapPin };

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

function InsightCard({ insight, index }) {
  const sev = SEV[insight.severity] || SEV.info;
  const Icon = ICONS[insight.icon] || Lightbulb;
  return (
    <div className="rg-card rg-rise rgr-card" style={{ animationDelay: `${80 + Math.min(index, 8) * 55}ms` }}>
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

/* Kepala kartu standar skin */
function CardHead({ icon: Icon, title, info, tipAlign, children }) {
  return (
    <div className="rg-head">
      <span className="rg-head-ico"><Icon size={15} /></span>
      <span className="rg-title">{title}</span>
      {info && <InfoTip text={info} align={tipAlign} />}
      {children}
    </div>
  );
}

/* ═══ 1 · Leads over time — batang bertumpuk per kategori promo ═══ */
function TrendCard({ an, isMobile, delay }) {
  const [hover, setHover] = useState(null);
  const tr = an.trend, cats = an.cats;
  const n = tr.list.length;
  const top = niceMax(tr.max);
  const ticks = [0, 1, 2, 3, 4].map(i => (top / 4) * i);
  const every = Math.max(1, Math.ceil(n / (isMobile ? 5 : 9)));
  const gap = n > 60 ? 1 : n > 31 ? 2 : 3;
  const hb = hover != null ? tr.list[hover] : null;
  const side = hover == null ? 0 : hover < n * 0.18 ? -12 : hover > n * 0.82 ? -88 : -50;
  return (
    <section className="rg-card rg-rise rgi-span2" style={{ animationDelay: `${delay}ms` }} aria-label="Leads over time">
      <CardHead icon={ChartColumnStacked} title="Leads over time"
        info={`Approved leads per ${tr.weekly ? 'week (Monday start)' : 'day'}, split by promo category — the same leads as the Dashboard total.`}>
        <span className="rgi-count"><span className="rg-mono">{fmtInt(an.cur.total)}</span> leads</span>
        <Delta pct={an.pctLeads} good="up" />
        <span className="rgi-legend" aria-hidden="true">
          {cats.map(c => (
            <span key={c.key}><span className="rgi-dot" style={{ background: c.color }} />{c.name}<span className="rgi-legend-n rg-mono">{fmtInt(c.n)}</span></span>
          ))}
        </span>
      </CardHead>
      <div className="rg-well" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {an.cur.total === 0 ? (
          <div className="rg-empty rgi-empty"><strong>No leads in this period</strong><span>Pick another date range or category.</span></div>
        ) : (
          <div className="rgi-chart" style={{ '--gap': `${gap}px` }} onMouseLeave={() => setHover(null)}>
            <div className="rgi-yaxis" aria-hidden="true">
              {ticks.map(t => <span key={t} style={{ bottom: `${(t / top) * 100}%` }}>{fmtInt(t)}</span>)}
            </div>
            <div className="rgi-plot">
              {ticks.map(t => <span key={t} className={`rgi-gridline${t === 0 ? ' is-base' : ''}`} style={{ bottom: `${(t / top) * 100}%` }} />)}
              <div className="rgi-cols" role="img" aria-label={`Leads per ${tr.weekly ? 'week' : 'day'}: peak ${tr.peak ? fmtInt(tr.peak.total) : 0}`}>
                {tr.list.map((b, i) => (
                  <div key={b.key} className={`rgi-col${hover === i ? ' is-on' : ''}`} onMouseEnter={() => setHover(i)}>
                    {b.total > 0 && (
                      <div className="rgi-stack" style={{ height: `${(b.total / top) * 100}%`, animationDelay: `${Math.min(i, 40) * 12}ms` }}>
                        {b.segs.filter(s => s.n).map(s => (
                          <i key={s.key} style={{ height: `${(s.n / b.total) * 100}%`, background: catColor(s.key) }} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {hb && (
                <div className="rgi-tip" style={{ left: `${((hover + 0.5) / n) * 100}%`, transform: `translateX(${side}%)`, bottom: `calc(${Math.min(92, (hb.total / top) * 100)}% + 10px)` }}>
                  <div className="rgi-tip-head">{tr.weekly ? `${hb.label} – ${fmtRangeShort(hb.to, hb.to)}` : hb.label}</div>
                  <div className="rgi-tip-body">
                    <div className="rgi-tip-row">Total<b>{fmtInt(hb.total)}</b></div>
                    {cats.map(c => (
                      <div key={c.key} className="rgi-tip-row"><span className="rgi-dot" style={{ background: c.color }} />{c.name}<b>{fmtInt(hb.byCat[c.key] || 0)}</b></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="rgi-xaxis" aria-hidden="true">
              {tr.list.map((b, i) => <span key={b.key}>{i % every === 0 ? b.tick : ''}</span>)}
            </div>
          </div>
        )}
      </div>
      <div className="rg-foot">
        <span>Average per {tr.weekly ? 'week' : 'day'} <span className="rg-mono rg-foot-val">{fmtDec(tr.avg)}</span></span>
        <span>Busiest {tr.weekly ? 'week' : 'day'} <span className="rg-mono rg-foot-val">{tr.peak && tr.peak.total ? `${tr.peak.tick} · ${fmtInt(tr.peak.total)}` : '—'}</span></span>
      </div>
    </section>
  );
}

/* ═══ 2 · Lead funnel ═══ */
function FunnelCard({ an, delay }) {
  const f = an.funnel;
  const prevQual = an.prev?.qualRate;
  return (
    <section className="rg-card rg-rise" style={{ animationDelay: `${delay}ms` }} aria-label="Lead funnel">
      <CardHead icon={Funnel} title="Lead funnel" tipAlign="end"
        info="How far this period’s leads have moved. Each step counts leads at that stage or further. Newer leads may not have moved yet." />
      <div className="rg-well" style={{ flex: 1, display: 'flex' }}>
        <div className="rgi-funnel">
          {f.map((s, i) => (
            <div key={s.key}>
              <div className="rgi-fn-top">
                <span className="rgi-dot" style={{ background: s.color }} />
                <span>{s.label}</span>
                <span className="rgi-fn-n rg-mono">{fmtInt(s.n)}</span>
              </div>
              <div className="rgi-fn-track"><i style={{ width: `${Math.max(s.pct, s.n ? 1.5 : 0)}%`, background: s.color, animationDelay: `${120 + i * 70}ms` }} /></div>
              <div className="rgi-fn-sub">
                {i === 0 ? 'Everything that came in'
                  : i === 1 ? <><span className="rg-mono">{fmtPct(s.pct)}</span> of leads</>
                  : <><span className="rg-mono">{fmtPct(s.pct)}</span> of leads · <span className="rg-mono">{fmtPct(s.stepPct)}</span> of {f[i - 1].label.toLowerCase()}</>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rg-foot">
        <span>Qualified <span className="rg-mono rg-foot-val">{fmtPct(an.cur.qualRate)}</span></span>
        <span>Previous <span className="rg-mono rg-foot-val">{fmtPct(prevQual)}</span></span>
      </div>
    </section>
  );
}

/* ═══ 3 · Lead sources (per campaign) ═══ */
function SourcesCard({ an, delay }) {
  const all = an.sources;
  const MAX = 7;
  const rows = all.length > MAX + 1
    ? [...all.slice(0, MAX), all.slice(MAX).reduce((o, s) => ({
        ...o, leads: o.leads + s.leads, contacted: o.contacted + s.contacted, qualified: o.qualified + s.qualified,
        deals: o.deals + s.deals, closing: o.closing + s.closing,
      }), { name: `${all.length - MAX} other campaigns`, kategori: null, leads: 0, contacted: 0, qualified: 0, deals: 0, closing: 0, isOther: true })]
    : all;
  const t = an.cur;
  const rate = (a, b) => (b ? (a / b) * 100 : 0);
  return (
    <section className="rg-card rg-rise rgi-span2" style={{ animationDelay: `${delay}ms` }} aria-label="Lead sources">
      <CardHead icon={Megaphone} title="Lead sources"
        info="Leads per Meta campaign they came from. Qualified = moved to Warm, Hot or Deal. Closing = total deal value (cohort: counted in the period the lead came in).">
        <span className="rg-meta">{plural(all.length, 'campaign')}</span>
      </CardHead>
      <div className="rg-well rgi-src-well">
        {all.length === 0 ? (
          <div className="rg-empty" style={{ padding: 28 }}><strong>No sources yet</strong><span>Leads in this period will be grouped by campaign here.</span></div>
        ) : (
          <div className="rgi-src-scroll">
            <table className="rg-table rgi-src">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Leads</th>
                  <th>Contacted</th>
                  <th>Qualified</th>
                  <th>Deals</th>
                  <th>Closing</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => {
                  const q = rate(s.qualified, s.leads);
                  return (
                    <tr key={s.name} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                      <td>
                        <span className="rgi-src-name" title={s.name}>{s.name}</span>
                        {!s.isOther && (
                          <span className="rgi-src-cat"><span className="rgi-dot" style={{ background: catColor(s.kategori) }} />{catName(s.kategori)}</span>
                        )}
                      </td>
                      <td className="rg-num">{fmtInt(s.leads)}</td>
                      <td className="rg-num">{fmtPct(rate(s.contacted, s.leads))}</td>
                      <td>
                        <span className="rgi-qual">
                          <span className="rgi-qual-bar" aria-hidden="true"><i style={{ width: `${q}%` }} /></span>
                          <span className="rg-num">{fmtPct(q)}</span>
                        </span>
                      </td>
                      <td className="rg-num">{fmtInt(s.deals)}</td>
                      <td className={`rg-num${s.closing ? '' : ' rg-dim'}`}>{s.closing ? fmtRp(s.closing) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>All sources</td>
                  <td className="rg-num">{fmtInt(t.total)}</td>
                  <td className="rg-num">{fmtPct(t.contactRate)}</td>
                  <td className="rg-num">{fmtPct(t.qualRate)}</td>
                  <td className="rg-num">{fmtInt(t.deals)}</td>
                  <td className="rg-num">{t.closing ? fmtRp(t.closing) : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

/* Selisih hari (lebih cepat = hijau) */
function DeltaDays({ diff }) {
  if (diff == null || !isFinite(diff)) return <span className="rg-delta is-na" title="No deals in the comparison period">—</span>;
  const tone = Math.abs(diff) < 0.05 ? 'neu' : diff < 0 ? 'pos' : 'neg';
  const Arrow = diff <= 0 ? ArrowDown : ArrowUp;
  return (
    <span className={`rg-delta is-${tone}`}>
      <span className="rg-delta-ico" aria-hidden="true"><Arrow size={10} strokeWidth={3} /></span>
      <span className="rg-sr">{diff <= 0 ? 'Faster by' : 'Slower by'} </span>{fmtDec(Math.abs(diff))} days
    </span>
  );
}

/* ═══ 4 · Time to deal ═══ */
function SpeedCard({ an, delay }) {
  const sp = an.speed;
  const empty = sp.n === 0;
  const maxB = Math.max(1, ...sp.buckets.map(b => b.n));
  const prevLabel = an.prevRange ? fmtRangeShort(an.prevRange.since, an.prevRange.until) : '';
  return (
    <section className={`rg-card rg-rise${empty ? ' rgi-dormant' : ''}`} style={{ animationDelay: `${delay}ms` }} aria-label="Time to deal">
      <CardHead icon={Timer} title="Time to deal" tipAlign="end"
        info="Days from the day a lead came in to its closing date, for this period’s deals. Deals without a closing date are left out." />
      <div className="rg-well" style={{ flex: 1, display: 'flex' }}>
        {empty ? (
          <div className="rg-empty rgi-empty">
            <strong>No deals from these leads yet</strong>
            <span>{sp.prevAvg != null ? `Last period, deals took about ${fmtDec(sp.prevAvg)} days — newer leads can still close.` : 'Deals are counted by the day the lead came in, so they can still arrive later.'}</span>
          </div>
        ) : (
          <div className="rgi-speed">
            <div className="rgi-big rg-mono">{fmtDec(sp.avg)}<small>days on average</small></div>
            <div className="rgi-sub">
              <DeltaDays diff={sp.prevAvg != null ? sp.avg - sp.prevAvg : null} />
              {prevLabel && <span>vs {prevLabel}</span>}
            </div>
            <div className="rgi-hist" aria-label="Deals by days to close">
              {sp.buckets.map((b, i) => (
                <div key={b.label} className="rgi-hist-col">
                  <span className="rgi-hist-n rg-mono">{b.n}</span>
                  <span className={`rgi-hist-bar${b.n ? '' : ' is-zero'}`} style={{ height: `${Math.max(4, (b.n / maxB) * 100)}%`, animationDelay: `${100 + i * 60}ms` }} />
                  <span className="rgi-hist-lbl">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="rg-foot">
        <span>Median <span className="rg-mono rg-foot-val">{sp.median != null ? `${fmtDec(sp.median, sp.median % 1 ? 1 : 0)} days` : '—'}</span></span>
        <span>{sp.missing > 0 ? `${sp.missing} without date` : 'Deals'} <span className="rg-mono rg-foot-val">{fmtInt(sp.n)}</span></span>
      </div>
    </section>
  );
}

/* ═══ 5 · Top cities ═══ */
function CitiesCard({ an, delay }) {
  const ct = an.cities;
  const top = ct.list.slice(0, 8);
  const max = Math.max(1, ...top.map(c => c.n));
  const unknownPct = an.cur.total ? (ct.unknown / an.cur.total) * 100 : 0;
  return (
    <section className="rg-card rg-rise" style={{ animationDelay: `${delay}ms` }} aria-label="Top cities">
      <CardHead icon={MapPin} title="Top cities"
        info="From the city (domicile) that leads typed in the form. Spelling is tidied up, so “jakarta timur” and “Jakarta Timur” count together.">
        <span className="rg-meta">{plural(ct.count, 'city')}</span>
      </CardHead>
      <div className="rg-well" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {top.length === 0 ? (
          <div className="rg-empty rgi-empty"><strong>No cities yet</strong><span>Leads in this period didn’t fill in a city.</span></div>
        ) : (
          <div className="rgi-cities">
            {top.map((c, i) => (
              <div key={c.name} className="rgi-city">
                <span className="rgi-city-rank rg-mono">{i + 1}</span>
                <span className="rgi-city-name" title={c.name}>{c.name}</span>
                <span className="rgi-city-val">
                  <span className="rg-mono">{fmtInt(c.n)}</span>
                  <span className="rg-mono">{fmtPct((c.n / Math.max(1, ct.known)) * 100)}</span>
                </span>
                <span className="rgi-city-bar" aria-hidden="true"><i style={{ width: `${(c.n / max) * 100}%`, animationDelay: `${100 + i * 45}ms` }} /></span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rg-foot">
        <span>No city filled in</span>
        <span className="rg-mono rg-foot-val">{fmtInt(ct.unknown)} · {fmtPct(unknownPct)}</span>
      </div>
    </section>
  );
}

/* ═══ 6 · When leads arrive — peta panas hari × jam (waktu lokal) ═══ */
function HeatCard({ an, delay }) {
  const ht = an.heat;
  const cellBg = (n) => (n === 0 ? undefined : `color-mix(in srgb, var(--rg-conv) ${Math.round(16 + 84 * (n / ht.max))}%, var(--rg-well-2))`);
  const hh = (h) => `${String(h).padStart(2, '0')}:00`;
  return (
    <section className="rg-card rg-rise rgi-span2" style={{ animationDelay: `${delay}ms` }} aria-label="When leads arrive">
      <CardHead icon={CalendarClock} title="When leads arrive" tipAlign="end"
        info="Number of leads by weekday and hour they came in (your local time, WIB). Darker = more leads. The outlined cell is the busiest hour.">
        {ht.peak && <span className="rg-meta">Busiest: <span className="rg-mono">{DOW[ht.peak.dow]} {hh(ht.peak.hour)}</span></span>}
      </CardHead>
      <div className="rg-well rgi-heat-well" style={{ flex: 1, minHeight: 0 }}>
        {an.cur.total === 0 ? (
          <div className="rg-empty rgi-empty"><strong>No leads in this period</strong></div>
        ) : (<>
          <div className="rgi-heat-scroll">
            <div className="rgi-heat" role="img" aria-label={`Busiest time: ${ht.peak ? `${DOW[ht.peak.dow]} ${hh(ht.peak.hour)}` : 'none'}`}>
              {DOW.map((d, di) => (
                [<span key={`d${di}`} className="rgi-heat-day">{d}</span>,
                 ...ht.grid[di].map((n, h) => (
                  <span key={`${di}-${h}`}
                    className={`rgi-cell${ht.peak && ht.peak.dow === di && ht.peak.hour === h ? ' is-peak' : ''}`}
                    style={{ background: cellBg(n), animationDelay: `${Math.min(di * 24 + h, 160) * 3}ms` }}
                    title={`${d} ${hh(h)}–${String(h).padStart(2, '0')}:59 · ${plural(n, 'lead')}`} />
                ))]
              ))}
              <span />
              {Array.from({ length: 24 }, (_, h) => <span key={`h${h}`} className="rgi-heat-hour">{h % 3 === 0 ? String(h).padStart(2, '0') : ''}</span>)}
            </div>
          </div>
          <div className="rgi-heat-legend">
            <span>Hours in your local time (WIB)</span>
            <span className="rgi-scale" aria-hidden="true">
              Fewer
              {[0, 0.25, 0.5, 0.75, 1].map(f => (
                <i key={f} style={{ background: f === 0 ? 'var(--rg-well-2)' : `color-mix(in srgb, var(--rg-conv) ${Math.round(16 + 84 * f)}%, var(--rg-well-2))`, border: f === 0 ? '1px solid var(--rg-line-soft)' : 0 }} />
              ))}
              More
            </span>
          </div>
        </>)}
      </div>
    </section>
  );
}

function SkelCard({ span, h = 340 }) {
  return (
    <div className={`rg-card${span ? ' rgi-span2' : ''}`} style={{ height: h }}>
      <div className="rg-head"><span className="rg-skel" style={{ width: '30%', height: 11 }} /></div>
      <div className="rg-well" style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span className="rg-skel" style={{ width: '45%', height: 20 }} />
        <span className="rg-skel" style={{ width: '80%', height: 10 }} />
        <span className="rg-skel" style={{ width: '62%', height: 10 }} />
      </div>
    </div>
  );
}

/* ═══ MAIN ═══ */
export default function LeadsInsightsPage() {
  const { role } = useAuth();
  const isMobile = useIsMobile();
  const { dateOpt, customSince, customUntil, isCustom, selectPreset, applyCustom } = useLeadsInsightsFilter();

  const [showDropdown, setShowDropdown] = useState(false);
  const [kategori, setKategori] = useState('Semua');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [an, setAn] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const fetchToken = useRef(0);   // respons lama (ganti filter cepat) tidak menimpa yang baru

  const _initCal = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const [calY, setCalY] = useState(_initCal.getFullYear());
  const [calM, setCalM] = useState(_initCal.getMonth());
  const [localSince, setLocalSince] = useState('');
  const [localUntil, setLocalUntil] = useState('');

  const [topbarSlot, setTopbarSlot] = useState(null);
  useEffect(() => { setTopbarSlot(isMobile ? document.getElementById('wd-topbar-actions') : null); }, [isMobile]);

  const range = isCustom && customSince && customUntil ? { since: customSince, until: customUntil } : presetToRange(dateOpt.value);
  const prevR = previousRange(range.since, range.until);

  useEffect(() => { if (!role) return; fetchData(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, dateOpt, isCustom, customSince, customUntil, kategori]);

  useEffect(() => {
    if (!showDropdown) return;
    const h = e => { if (!e.target.closest('[data-filter]')) setShowDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showDropdown]);

  async function fetchData() {
    const token = ++fetchToken.current;
    setLoading(true); setError(null);
    try {
      let rows, prevRows = null;
      // Lead approved dalam periode (cohort by created_at) + periode pembanding — pola query Dashboard
      const cols = 'status, followed_up, closing_amount, kategori_promo, sales, created_at, domicile, deal_date, campaign_ref(name)';
      const q = (r) => {
        let query = supabase
          .from('leads')
          .select(cols)
          .eq('verification', 'approved')
          .gte('created_at', r.since + 'T00:00:00')
          .lte('created_at', r.until + 'T23:59:59.999');
        if (kategori !== 'Semua') query = query.eq('kategori_promo', kategori);
        return query.limit(10000);
      };
      const [curRes, prevRes] = await Promise.all([q(range), q(prevR)]);
      if (curRes.error) throw new Error(curRes.error.message);
      rows = curRes.data;
      prevRows = prevRes.error ? null : prevRes.data;   // gagal → perbandingan "—", halaman tetap jalan
      if (token !== fetchToken.current) return;
      setAn(buildLeadsAnalysis(rows, prevRows, range, prevR));
      setUpdatedAt(new Date());
    } catch (err) {
      if (token !== fetchToken.current) return;
      setError(err.message);
    }
    if (token === fetchToken.current) setLoading(false);
  }

  /* ── Filter tanggal (pola sama Dashboard Leads Hub) ── */
  function openFilter() {
    const next = !showDropdown;
    if (next) {
      setLocalSince(customSince || ''); setLocalUntil(customUntil || '');
      if (customSince) { const p = customSince.split('-'); setCalY(+p[0]); setCalM(+p[1] - 1); }
    }
    setShowDropdown(next);
  }
  function shiftCal(delta) { const dt = new Date(calY, calM + delta, 1); setCalY(dt.getFullYear()); setCalM(dt.getMonth()); }
  function pickDay(ds) {
    if (!localSince || (localSince && localUntil)) { setLocalSince(ds); setLocalUntil(''); }
    else if (ds < localSince) { setLocalUntil(localSince); setLocalSince(ds); }
    else setLocalUntil(ds);
  }
  function pickRange(s, u) { setLocalSince(s); setLocalUntil(u); const p = s.split('-'); setCalY(+p[0]); setCalM(+p[1] - 1); }
  function applyCustomRange() { if (!localSince || !localUntil) return; applyCustom(localSince, localUntil); setShowDropdown(false); }
  function handleSelectPreset(opt) { selectPreset(opt); setShowDropdown(false); }
  function filterLabel() {
    if (isCustom && customSince && customUntil) {
      const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
      return `${fmt(customSince)} – ${fmt(customUntil)}`;
    }
    return dateOpt.label;
  }

  if (!role) return null;

  const initialLoading = loading && !an;
  const busy = loading && an ? ' rg-busy' : '';
  const prevLabel = fmtRangeShort(prevR.since, prevR.until);
  const rangeText = fmtRangeShort(range.since, range.until, true);

  const ctxLine = initialLoading
    ? <span>Loading leads…</span>
    : error && !an
      ? <span>Could not load data</span>
      : (<>
          <span className="rg-live" aria-hidden="true" />
          <span>Leads Hub</span>
          <span className="rg-ctx-sep" aria-hidden="true" />
          <span>{plural(an?.cur.total || 0, 'lead')}{kategori !== 'Semua' ? ` · ${kategoriLabel(kategori)}` : ''}</span>
          {!isMobile && (<>
            <span className="rg-ctx-sep" aria-hidden="true" />
            <span>compared with {prevLabel}</span>
          </>)}
          <span className="rg-ctx-sep" aria-hidden="true" />
          <span>{loading ? 'Refreshing…' : updatedAt ? `Updated ${fmtClock(updatedAt)}` : ''}</span>
        </>);

  const refreshBtnMobile = (
    <button onClick={fetchData} title="Refresh" style={{
      width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '9px', cursor: 'pointer', flexShrink: 0,
    }}>
      <RefreshCw size={14} color="var(--t2)" style={loading ? { animation: 'wdSpin 0.8s linear infinite' } : undefined} />
    </button>
  );

  const catOptions = [{ value: 'Semua', label: 'All categories' }, ...CATEGORIES.map(c => ({ value: c.value, label: c.label }))];
  const catLabel = catOptions.find(o => o.value === kategori)?.label || 'All categories';

  return (
    <div className={`rg rg-page rgi ${dashboardFontVars}${isMobile ? ' is-mobile' : ''}`}>

      {/* ══ TOP BAR ══ */}
      <header className="rg-top">
        <div className="rg-top-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="rg-h1">Analytics &amp; Insights</h1>
          </div>
          <div className="rg-ctx">{ctxLine}</div>
        </div>

        <div className="rg-tools">
          <RgMenu className={`rg-pill${kategori !== 'Semua' ? ' is-set' : ''}`} icon={Tags} label={catLabel}
            options={catOptions} value={kategori} onSelect={setKategori} align="center" minWidth={240} title="Lead category" />

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
            <button type="button" className="rg-pill rg-round" title="Refresh data" aria-label="Refresh data" onClick={fetchData} disabled={loading}>
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
            <button type="button" className="rg-pill" onClick={fetchData}><RefreshCw size={15} />Try again</button>
          </div>
        )}

        {initialLoading && (<>
          <div className="rgr-grid">{[0, 1, 2].map(i => <SkelCard key={i} h={190} />)}</div>
          <div className="rgi-grid"><SkelCard span h={372} /><SkelCard h={372} /></div>
          <div className="rgi-grid"><SkelCard span h={320} /><SkelCard h={320} /></div>
        </>)}

        {an && (<div className={busy} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ── 1 · Temuan otomatis ── */}
          <div className="rgr-section">
            <Sparkles size={15} color="var(--rg-t2)" />
            <span className="rgr-section-title">What stands out</span>
            <span className="rg-chip rg-mono">{an.insights.length}</span>
            {!isMobile && <span className="rg-meta" style={{ marginLeft: 'auto' }}>Written automatically from this period’s leads</span>}
          </div>
          <div className="rgr-grid">
            {an.insights.map((ins, i) => <InsightCard key={`${ins.title}-${i}`} insight={ins} index={i} />)}
          </div>

          {/* ── 2 · Tren + funnel ── */}
          <div className="rgi-grid rgi-row-a">
            <TrendCard an={an} isMobile={isMobile} delay={200} />
            <FunnelCard an={an} delay={250} />
          </div>

          {/* ── 3 · Sumber + waktu sampai deal ── */}
          <div className="rgi-grid">
            <SourcesCard an={an} delay={300} />
            <SpeedCard an={an} delay={350} />
          </div>

          {/* ── 4 · Kota + jam masuk ── */}
          <div className="rgi-grid rgi-row-c">
            <CitiesCard an={an} delay={400} />
            <HeatCard an={an} delay={450} />
          </div>
        </div>)}
      </div>
    </div>
  );
}
