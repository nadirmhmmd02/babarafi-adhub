'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { ChartLine, Info } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   GRAFIK HARIAN — Dashboard Ads Hub (redesain "Ridgeline", Sep 2026)
   Dipakai HANYA di app/page.js. Styling: app/dashboard-ridgeline.css (.rg-*).
   Warna seri mengikuti ENTITAS (sama dengan donut & kartu efisiensi):
   Impressions = ungu Awareness · Traffic = oranye · Leads = teal Conversion ·
   Spend = biru (uang, bukan objektif). Data & rumus TIDAK berubah — hanya tampilan.

   Mode "All" (permintaan Nadir 28 Sep 2026): keempat garis sekaligus. Satuannya
   berbeda (Rupiah vs jumlah), jadi SENGAJA tidak memakai dua sumbu-Y (letak dua skala
   itu arbitrer → menciptakan korelasi palsu). Satu sumbu yang diindeks: tiap garis
   diskalakan ke hari puncaknya sendiri (= 100%). Angka asli tetap ada di legenda
   (rata-rata harian) & tooltip. Label nama di ujung garis = pembeda kedua selain warna.
   ───────────────────────────────────────────────────────────── */
const METRICS = [
  { key: 'spend', label: 'Spend', title: 'Daily Spend', color: 'var(--rg-spend)', money: true,
    info: 'Amount spent per day across all campaigns.' },
  { key: 'awareness', label: 'Impressions', short: 'Impr.', title: 'Daily Impressions', color: 'var(--rg-aware)',
    info: 'Times your ads were shown per day, across all campaigns.' },
  { key: 'traffic', label: 'Traffic', title: 'Daily Traffic', color: 'var(--rg-traffic)',
    info: 'Link clicks per day at account level (all campaigns). The Traffic card above counts Traffic campaigns only, so the totals can differ.' },
  { key: 'leads', label: 'Leads', title: 'Daily Leads', color: 'var(--rg-conv)',
    info: 'Leads per day at account level: instant forms, website forms and WhatsApp chats from all campaigns. The Leads card above counts Conversion campaigns only.' },
];
const ALL = {
  key: 'all', label: 'All', title: 'Daily Trends',
  info: 'All four metrics on one chart. Their units differ (Rupiah vs counts), so each line is scaled to its own best day in this period (= 100%). Hover a day to see the real numbers.',
};
// Urutan gambar mode All (terakhir = paling atas): Spend di atas sebagai seri utama
const DRAW_ORDER = ['awareness', 'traffic', 'leads', 'spend'];

const ID = 'id-ID';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Angka ringkas gaya Indonesia untuk sumbu: 150 rb · 1,2 jt
function fmtCompact(v) {
  if (v >= 1e9) return (v / 1e9).toLocaleString(ID, { maximumFractionDigits: 1 }) + ' M';
  if (v >= 1e6) return (v / 1e6).toLocaleString(ID, { maximumFractionDigits: 1 }) + ' jt';
  if (v >= 1e3) return (v / 1e3).toLocaleString(ID, { maximumFractionDigits: 1 }) + ' rb';
  return Math.round(v).toLocaleString(ID);
}
function fmtFull(m, v) {
  const n = Math.round(v).toLocaleString(ID);
  return m.money ? 'Rp ' + n : n;
}
function fmtAvg(m, v) {
  if (m.money) return 'Rp ' + Math.round(v).toLocaleString(ID);
  return v < 10 ? v.toLocaleString(ID, { maximumFractionDigits: 1 }) : Math.round(v).toLocaleString(ID);
}

// Langkah sumbu "bulat" (1 / 2 / 2,5 / 5 × 10^n) → tick 0, 50 rb, 100 rb, …
function niceStep(x) {
  if (!(x > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

// Kurva monoton (Fritsch–Carlson): mulus tapi TIDAK pernah menukik di bawah 0.
// Dipakai juga sparkline kartu KPI di app/page.js.
export function monotonePath(p) {
  const n = p.length;
  if (n === 0) return '';
  if (n === 1) return `M${p[0].x},${p[0].y}`;
  if (n === 2) return `M${p[0].x},${p[0].y}L${p[1].x},${p[1].y}`;
  const dx = [], ms = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1].x - p[i].x; ms[i] = (p[i + 1].y - p[i].y) / dx[i]; }
  const t = [ms[0]];
  for (let i = 1; i < n - 1; i++) {
    if (ms[i - 1] * ms[i] <= 0) t[i] = 0;
    else {
      const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1];
      t[i] = (w1 + w2) / (w1 / ms[i - 1] + w2 / ms[i]);
    }
  }
  t[n - 1] = ms[n - 2];
  let d = `M${p[0].x.toFixed(1)},${p[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${(p[i].x + h).toFixed(1)},${(p[i].y + t[i] * h).toFixed(1)} ${(p[i + 1].x - h).toFixed(1)},${(p[i + 1].y - t[i + 1] * h).toFixed(1)} ${p[i + 1].x.toFixed(1)},${p[i + 1].y.toFixed(1)}`;
  }
  return d;
}

function dateAt(since, idx) {
  if (!since) return null;
  const d = new Date(since + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + idx);
  return d;
}

// Statistik satu seri. Meta tidak mengirim baris untuk hari tanpa delivery → hari yang
// SUDAH lewat tampil 0 (garis turun ke dasar, bukan berhenti misterius). Hari setelah
// hari ini tetap kosong.
function seriesStats(raw, lastIdx) {
  const vals = raw.map((v, i) => (v != null ? v : i <= lastIdx ? 0 : null));
  const elapsed = vals.filter(v => v != null);
  let peakIdx = -1;
  vals.forEach((v, i) => { if (v != null && (peakIdx < 0 || v > vals[peakIdx])) peakIdx = i; });
  return {
    vals, peakIdx,
    avg: elapsed.length ? elapsed.reduce((s, v) => s + v, 0) / elapsed.length : 0,
    days: elapsed.length,
    activeDays: elapsed.filter(v => v > 0).length,
    max: elapsed.length ? Math.max(...elapsed) : 0,
  };
}

const PAD_L = 50, PAD_R = 10, PAD_T = 12, PAD_B = 24;
// Mode All: label nama di ujung garis — lebar yang disediakan, jarak minimum antar label,
// dan lebar plot minimum supaya label ditampilkan (HP/kartu sempit: legenda + tooltip saja)
const END_W = 96, END_GAP = 15, END_MIN_PLOT = 420;

// Ruang kanan untuk label ujung. Di bulan berjalan sisa hari "masa depan" di kanan titik
// terakhir biasanya sudah cukup → padding tidak ditambah. f = porsi lebar plot setelah
// titik terakhir; syarat: f·(W−PAD_L) + (1−f)·padR ≥ END_W.
function endPad(W, n, lastIdx) {
  const f = n > 1 ? (n - 1 - lastIdx) / (n - 1) : 0.5;
  if (f >= 1) return PAD_R;
  return Math.max(PAD_R, Math.ceil((END_W - f * (W - PAD_L)) / (1 - f)));
}

export default function AreaChart({ data, dates, today, since, delay = 300 }) {
  const [metric, setMetric]     = useState('spend');
  const [hover, setHover]       = useState(null); // indeks hari yang disorot
  const [focusKey, setFocusKey] = useState(null); // mode All: seri yang disorot dari legenda
  const [box, setBox]           = useState({ w: 0, h: 0 });
  const plotRef = useRef(null);
  const gid = useId().replace(/:/g, '');

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      setBox({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isAll = metric === 'all';
  const m = isAll ? ALL : (METRICS.find(x => x.key === metric) || METRICS[0]);
  const n = Math.max(0, ...METRICS.map(x => ((data && data[x.key]) || []).length));
  const lastIdx = today >= 0 ? today : n - 1;
  const S = {};
  METRICS.forEach(x => { S[x.key] = seriesStats((data && data[x.key]) || [], lastIdx); });
  const cur = isAll ? null : S[m.key];

  const dayLabel = (i) => {
    const d = dateAt(since, i);
    return d ? `${d.getUTCDate()} ${MON[d.getUTCMonth()]}` : `Day ${dates?.[i] ?? i + 1}`;
  };
  const tipLabel = (i) => {
    const d = dateAt(since, i);
    return d ? `${DOW[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` : `Day ${dates?.[i] ?? i + 1}`;
  };

  // ── Geometri (piksel asli → titik & garis putus-putus tidak terdistorsi) ──
  const W = box.w, H = box.h;
  const showEnds = isAll && W - PAD_L - PAD_R >= END_MIN_PLOT;
  const padR = showEnds ? endPad(W, n, lastIdx) : PAD_R;
  const pw = Math.max(0, W - PAD_L - padR);
  const ph = Math.max(0, H - PAD_T - PAD_B);
  // Sumbu-Y: mode tunggal = nilai asli dgn tick bulat · mode All = 0–100% puncak tiap seri
  const step = isAll ? 0.25 : niceStep(cur.max / 4);
  const top  = step * 4;
  const X = (i) => PAD_L + (n > 1 ? (i / (n - 1)) * pw : pw / 2);
  const Y = (v) => PAD_T + ph - (top > 0 ? (v / top) * ph : 0);
  const ptsOf = (st, norm) => {
    const out = [];
    st.vals.forEach((v, i) => {
      if (v != null) out.push({ i, v, x: X(i), y: Y(norm ? (st.max > 0 ? v / st.max : 0) : v) });
    });
    return out;
  };

  // Mode tunggal: satu garis + area
  const pts  = isAll ? [] : ptsOf(cur, false);
  const line = monotonePath(pts);
  const area = pts.length > 1
    ? `${line}L${pts[pts.length - 1].x.toFixed(1)},${PAD_T + ph}L${pts[0].x.toFixed(1)},${PAD_T + ph}Z`
    : '';

  // Mode All: empat garis (tanpa area — empat lapis gradasi jadi keruh)
  const lines = isAll
    ? DRAW_ORDER.map(k => {
        const meta = METRICS.find(x => x.key === k);
        const p = ptsOf(S[k], true);
        return { ...meta, pts: p, d: monotonePath(p) };
      })
    : [];
  const dimmed = (k) => isAll && focusKey != null && focusKey !== k;

  // Titik acuan sumbu-X untuk hover (keempat seri punya indeks hari yang sama)
  const basePts = isAll ? (lines[0]?.pts || []) : pts;

  // Label sumbu-X: jarak minimum ±30px supaya tanggal tidak bertabrakan
  const gap = n > 1 ? pw / (n - 1) : pw;
  const every = Math.max(1, Math.ceil(30 / Math.max(gap, 1)));
  const xTicks = [];
  for (let i = 0; i < n; i += every) xTicks.push(i);

  const showDots    = pts.length <= 16;
  const showDotsAll = basePts.length <= 8;
  const hp   = !isAll && hover != null ? pts.find(p => p.i === hover) : null;
  const hAll = isAll && hover != null
    ? lines.map(l => ({ l, p: l.pts.find(p => p.i === hover) })).filter(x => x.p)
    : [];

  // Label ujung garis (mode All). Yang bertabrakan didorong renggang min END_GAP px lalu
  // disambung garis pemandu berwarna seri ke ujung garisnya — label tidak "lepas" dari
  // garisnya (pedoman dataviz). Kalau terdorong keluar dasar plot, semua digeser naik.
  let ends = [];
  if (showEnds) {
    ends = METRICS.map(mm => {
      const l = lines.find(x => x.key === mm.key);
      const p = l && l.pts[l.pts.length - 1];
      return p ? { key: mm.key, label: mm.label, color: mm.color, x: p.x, y: p.y, ly: p.y } : null;
    }).filter(Boolean).sort((a, b) => a.y - b.y);
    for (let k = 1; k < ends.length; k++) {
      if (ends[k].ly - ends[k - 1].ly < END_GAP) ends[k].ly = ends[k - 1].ly + END_GAP;
    }
    const over = ends.length ? ends[ends.length - 1].ly - (PAD_T + ph) : 0;
    if (over > 0) ends.forEach(e => { e.ly -= over; });
  }

  function onMove(e) {
    if (!plotRef.current || basePts.length === 0) return;
    const r = plotRef.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    let best = basePts[0];
    for (const p of basePts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    setHover(best.i);
  }

  const summary = isAll
    ? 'Daily trends, each line scaled to its own peak day. ' + METRICS.map(mm => {
        const st = S[mm.key];
        return st.max > 0 ? `${mm.label} peaked on ${dayLabel(st.peakIdx)} at ${fmtFull(mm, st.max)}` : `${mm.label}: no data`;
      }).join('; ') + '.'
    : cur.days
      ? `${m.title}: average ${fmtAvg(m, cur.avg)} per day, peak ${fmtFull(m, cur.vals[cur.peakIdx] || 0)} on ${dayLabel(cur.peakIdx)}.`
      : `${m.title}: no data in this period.`;

  function pick(key) {
    setMetric(key);
    setHover(null);
    setFocusKey(null);
  }

  return (
    <div className="rg-card rg-rise" style={{ height: '100%', animationDelay: `${delay}ms` }}>
      <div className="rg-head rg-chart-head">
        <span className="rg-head-ico"><ChartLine size={15} /></span>
        <span key={metric} className="rg-title" style={{ animation: 'wdSoftIn .3s cubic-bezier(.22,1,.36,1)' }}>{m.title}</span>
        <button type="button" className="rg-info" data-tip={m.info} aria-label={m.info}><Info size={13} /></button>
        <div className="rg-segs" role="group" aria-label="Chart metric" style={{ marginLeft: 'auto' }}>
          {[...METRICS, ALL].map(x => (
            <button key={x.key} type="button" aria-pressed={metric === x.key}
              title={x.key === 'all' ? 'Show all four lines together' : undefined}
              onClick={() => pick(x.key)}>
              {x.key === 'all' ? (
                <span className="rg-seg-multi" aria-hidden="true">
                  {METRICS.map(y => <i key={y.key} style={{ background: y.color }} />)}
                </span>
              ) : (
                <span className="rg-seg-key" style={{ background: x.color }} />
              )}
              {x.short
                ? (<><span className="rg-seg-long">{x.label}</span><span className="rg-seg-short">{x.short}</span></>)
                : x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rg-well rg-chart-well">
        {isAll ? (
          // Legenda = kunci garis + nama + rata-rata harian (angka asli, bukan persen)
          <div className="rg-stats">
            {METRICS.map(mm => (
              <div key={mm.key} className={`rg-stat-key${dimmed(mm.key) ? ' is-dim' : ''}`}
                onMouseEnter={() => setFocusKey(mm.key)} onMouseLeave={() => setFocusKey(null)}>
                <div className="rg-stat-label">
                  <span className="rg-tipcard-key" style={{ background: mm.color }} />
                  {mm.label}
                </div>
                <div className="rg-stat-value rg-mono">
                  {fmtAvg(mm, S[mm.key].avg)}<span className="rg-stat-sub">avg/day</span>
                </div>
              </div>
            ))}
            <div className="rg-stat-note">Each line is scaled to its own peak day (= 100%)</div>
          </div>
        ) : (
          <div className="rg-stats">
            <div>
              <div className="rg-stat-label">Daily average</div>
              <div className="rg-stat-value rg-mono">{fmtAvg(m, cur.avg)}</div>
            </div>
            <div>
              <div className="rg-stat-label">Peak day</div>
              <div className="rg-stat-value rg-mono">
                {cur.peakIdx >= 0 ? fmtFull(m, cur.vals[cur.peakIdx]) : '—'}
                {cur.peakIdx >= 0 && cur.vals[cur.peakIdx] > 0 && <span className="rg-stat-sub">{dayLabel(cur.peakIdx)}</span>}
              </div>
            </div>
            <div>
              <div className="rg-stat-label">Days with results</div>
              <div className="rg-stat-value rg-mono">
                {cur.activeDays}<span className="rg-stat-sub">of {cur.days} days</span>
              </div>
            </div>
          </div>
        )}

        <div ref={plotRef} className="rg-plot" role="img" aria-label={summary}
          onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {W > 0 && H > 0 && (
            <svg width={W} height={H} aria-hidden="true">
              {!isAll && (
                <defs>
                  <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: m.color, stopOpacity: 0.22 }} />
                    <stop offset="100%" style={{ stopColor: m.color, stopOpacity: 0 }} />
                  </linearGradient>
                </defs>
              )}

              {/* Grid + label sumbu-Y (angka bulat · mode All: persen dari puncak) */}
              {[0, 1, 2, 3, 4].map(k => {
                const y = Y(step * k);
                return (
                  <g key={k}>
                    <line x1={PAD_L} x2={W - padR} y1={y} y2={y} className="rg-gridline" />
                    <text x={PAD_L - 10} y={y} className="rg-axis" textAnchor="end" dominantBaseline="middle">
                      {isAll ? `${k * 25}%` : fmtCompact(step * k)}
                    </text>
                  </g>
                );
              })}

              {/* Penanda hari ini (bulan berjalan) */}
              {today >= 0 && today < n - 1 && (
                <line x1={X(today)} x2={X(today)} y1={PAD_T} y2={PAD_T + ph} className="rg-today-line" />
              )}

              {/* ── Mode tunggal ── */}
              {area && <path key={`a-${metric}`} d={area} fill={`url(#${gid}-fill)`} className="rg-area" />}
              {line && (
                <path key={`l-${metric}`} d={line} fill="none" pathLength="1" strokeDasharray="1"
                  className="rg-line"
                  style={{ stroke: m.color, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
              )}
              {showDots && pts.map(p => (
                <circle key={p.i} cx={p.x} cy={p.y} r="4" className="rg-pt" style={{ fill: m.color }} />
              ))}
              {!showDots && pts.length > 0 && (
                <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="4" className="rg-pt" style={{ fill: m.color }} />
              )}

              {/* ── Mode All: empat garis bertahap + titik ujung + label nama ── */}
              {lines.map((l, idx) => l.d && (
                <path key={`l-all-${l.key}`} d={l.d} fill="none" pathLength="1" strokeDasharray="1"
                  className={`rg-line rg-mline${dimmed(l.key) ? ' is-dim' : ''}`}
                  style={{ stroke: l.color, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round', animationDelay: `${idx * 90}ms` }} />
              ))}
              {lines.map(l => (showDotsAll ? l.pts : l.pts.slice(-1)).map(p => (
                <circle key={`${l.key}-${p.i}`} cx={p.x} cy={p.y} r="4"
                  className={`rg-pt rg-mline${dimmed(l.key) ? ' is-dim' : ''}`} style={{ fill: l.color }} />
              )))}
              {ends.map(e => (
                <g key={e.key} className={`rg-endlabel-g${dimmed(e.key) ? ' is-dim' : ''}`}>
                  <path d={`M${(e.x + 7).toFixed(1)},${e.y.toFixed(1)}L${(e.x + 9).toFixed(1)},${e.y.toFixed(1)}L${(e.x + 17).toFixed(1)},${e.ly.toFixed(1)}L${(e.x + 21).toFixed(1)},${e.ly.toFixed(1)}`}
                    fill="none" style={{ stroke: e.color, strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
                  <text x={e.x + 25} y={e.ly} dominantBaseline="middle" className="rg-endlabel">{e.label}</text>
                </g>
              ))}

              {/* Label sumbu-X (tanggal) */}
              {xTicks.map(i => (
                <text key={i} x={X(i)} y={PAD_T + ph + 17} textAnchor="middle"
                  className={`rg-axis${i === today ? ' is-today' : ''}`}>
                  {dates?.[i] ?? i + 1}
                </text>
              ))}

              {/* Crosshair + titik sorot */}
              {hp && (
                <g>
                  <line x1={hp.x} x2={hp.x} y1={PAD_T} y2={PAD_T + ph} className="rg-crosshair" />
                  <circle cx={hp.x} cy={hp.y} r="5.5" className="rg-pt" style={{ fill: m.color }} />
                </g>
              )}
              {hAll.length > 0 && (
                <g>
                  <line x1={hAll[0].p.x} x2={hAll[0].p.x} y1={PAD_T} y2={PAD_T + ph} className="rg-crosshair" />
                  {hAll.map(h => (
                    <circle key={h.l.key} cx={h.p.x} cy={h.p.y} r="5.5" className="rg-pt" style={{ fill: h.l.color }} />
                  ))}
                </g>
              )}
            </svg>
          )}

          {hp && (
            <div className={`rg-tipcard${hp.x > W * 0.62 ? ' is-left' : ''}`}
              style={{ left: hp.x, top: Math.min(Math.max(hp.y, 44), Math.max(44, H - 44)) }}>
              <div className="rg-tipcard-head">{tipLabel(hp.i)}{hp.i === today ? ' · Today' : ''}</div>
              <div className="rg-tipcard-row">
                <span className="rg-tipcard-key" style={{ background: m.color }} />
                {m.label}
                <b className="rg-mono">{fmtFull(m, hp.v)}</b>
              </div>
            </div>
          )}
          {hAll.length > 0 && (() => {
            // Satu tooltip, keempat seri — angka ASLI (bukan persen), urutan = legenda
            const x  = hAll[0].p.x;
            const ty = hAll.reduce((s, h) => s + h.p.y, 0) / hAll.length;
            const half = 72;
            return (
              <div className={`rg-tipcard${x > W * 0.62 ? ' is-left' : ''}`}
                style={{ left: x, top: Math.min(Math.max(ty, half), Math.max(half, H - half)) }}>
                <div className="rg-tipcard-head">{tipLabel(hover)}{hover === today ? ' · Today' : ''}</div>
                {METRICS.map(mm => (
                  <div key={mm.key} className="rg-tipcard-row">
                    <span className="rg-tipcard-key" style={{ background: mm.color }} />
                    {mm.label}
                    <b className="rg-mono">{fmtFull(mm, S[mm.key].vals[hover] ?? 0)}</b>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
