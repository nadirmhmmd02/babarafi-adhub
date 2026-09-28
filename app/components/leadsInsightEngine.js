/* ─────────────────────────────────────────────────────────────
   LEADS INSIGHT ENGINE — mesin halaman Leads Hub → Analytics & Insights
   (/leads/insights). PURE FUNCTION tanpa React/DB (bisa dites di Node), pola sama
   dengan insightEngine.js milik Ads Hub.

   Input  : baris tabel `leads` (approved, cohort by created_at) periode ini +
            periode pembanding (aturan previousRange), rentang {since, until}.
   Output : buildLeadsAnalysis() → { metrics…, insights[] }.

   DEFINISI (dijaga SAMA dengan Dashboard Leads Hub supaya angka bisa dicocokkan):
   - Qualified  = status Warm, Hot atau Deal (= KPI "Lead Quality" di Dashboard)
   - Contacted  = sudah ditandai follow-up ATAU sudah diberi status (≠ No Status)
   - Time to deal = deal_date − tanggal lead masuk (hari), hanya Deal yang punya deal_date
   - Jam & hari masuk = waktu LOKAL browser (WIB) dari created_at
   Kategori promo & warna: kategori yang ada di data (bukan hanya yang aktif di
   leadsConfig), supaya promo lama tetap terbaca di grafik.
   ───────────────────────────────────────────────────────────── */

import { kategoriLabel } from './leadsConfig';

const DAY = 864e5;
const QUAL = new Set(['Warm', 'Hot', 'Deal']);
const HOT_PLUS = new Set(['Hot', 'Deal']);
export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOW_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* Warna per kategori promo = palet data skin (entitas, bukan arti baik/buruk) */
const CAT_COLOR = {
  Autopilot: 'var(--rg-conv)',
  Proven: 'var(--rg-aware)',
  'Suka Suka': 'var(--rg-traffic)',
  Reguler: 'var(--rg-spend)',
};
export const catColor = (k) => CAT_COLOR[k] || 'var(--rg-other)';
export const catKey = (v) => v || '—';
export const catName = (k) => (k === '—' ? 'Uncategorized' : kategoriLabel(k));

/* ── format gaya Indonesia (koma desimal) ── */
export const fmtInt = (v) => Math.round(v || 0).toLocaleString('id-ID');
export const fmtDec = (v, d = 1) => (v == null || !isFinite(v) ? '—' : v.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const fmtPct = (v) => (v == null || !isFinite(v) ? '—' : `${Math.round(v)}%`);
export const fmtRp = (v) => 'Rp ' + fmtInt(v);
const plural = (n, w) => `${fmtInt(n)} ${w}${n === 1 ? '' : 's'}`;
const hh = (h) => `${String(h).padStart(2, '0')}:00`;

const isContacted = (l) => !!l.followed_up || (l.status && l.status !== 'No Status');
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const shortDate = (s) => { const d = parseYmd(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };
const dayOf = (l) => (l.created_at || '').slice(0, 10);   // sama dgn Dashboard (batas query = tanggal ISO)

/* Nama kota dari isian bebas form: rapikan spasi & kapital supaya "jakarta timur" = "Jakarta Timur" */
function cityName(raw) {
  const s = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!s || s === '-') return null;
  return s.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

/* ── ringkasan satu kumpulan lead ── */
function summarize(rows, range) {
  const total = rows.length;
  const contacted = rows.filter(isContacted).length;
  const qualified = rows.filter(l => QUAL.has(l.status)).length;
  const hotPlus = rows.filter(l => HOT_PLUS.has(l.status)).length;
  const deals = rows.filter(l => l.status === 'Deal');
  const closing = deals.reduce((s, l) => s + (parseFloat(l.closing_amount) || 0), 0);

  // Waktu sampai deal (hari)
  const dealDays = deals
    .filter(l => l.deal_date && l.created_at)
    .map(l => Math.max(0, Math.round((parseYmd(l.deal_date) - parseYmd(dayOf(l))) / DAY)))
    .sort((a, b) => a - b);
  const avgDays = dealDays.length ? dealDays.reduce((s, v) => s + v, 0) / dealDays.length : null;
  const medianDays = dealDays.length
    ? (dealDays.length % 2 ? dealDays[(dealDays.length - 1) / 2] : (dealDays[dealDays.length / 2 - 1] + dealDays[dealDays.length / 2]) / 2)
    : null;

  return {
    total, contacted, qualified, hotPlus, deals: deals.length, closing, dealDays, avgDays, medianDays,
    qualRate: total ? (qualified / total) * 100 : null,
    contactRate: total ? (contacted / total) * 100 : null,
    range,
  };
}

/* ── tren: per hari (≤ 62 hari) atau per minggu (Senin) ── */
function trend(rows, range, cats) {
  const days = [];
  for (let d = parseYmd(range.since), end = parseYmd(range.until); d <= end; d.setDate(d.getDate() + 1)) days.push(ymd(d));
  const weekly = days.length > 62;
  const keyOf = (ds) => {
    if (!weekly) return ds;
    const d = parseYmd(ds);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // mundur ke Senin
    return ymd(d);
  };
  const buckets = new Map();
  for (const ds of days) {
    const k = keyOf(ds);
    if (!buckets.has(k)) buckets.set(k, { key: k, from: ds, to: ds, total: 0, byCat: {} });
    buckets.get(k).to = ds;
  }
  for (const l of rows) {
    const b = buckets.get(keyOf(dayOf(l)));
    if (!b) continue;
    const c = catKey(l.kategori_promo);
    b.total++;
    b.byCat[c] = (b.byCat[c] || 0) + 1;
  }
  const list = [...buckets.values()].map(b => ({
    ...b,
    label: weekly ? `Week of ${shortDate(b.from)}` : shortDate(b.from),
    tick: shortDate(b.from),
    segs: cats.map(c => ({ key: c.key, n: b.byCat[c.key] || 0 })),
  }));
  const max = Math.max(0, ...list.map(b => b.total));
  const peak = list.reduce((p, b) => (b.total > (p?.total ?? -1) ? b : p), null);
  return { weekly, list, max, peak, avg: list.length ? rows.length / (weekly ? days.length / 7 : list.length) : 0 };
}

/* ── sumber lead per campaign ── */
function sources(rows) {
  const map = new Map();
  for (const l of rows) {
    const name = l.campaign_ref?.name || '(No campaign)';
    if (!map.has(name)) map.set(name, { name, leads: 0, contacted: 0, qualified: 0, deals: 0, closing: 0, cats: {} });
    const s = map.get(name);
    s.leads++;
    if (isContacted(l)) s.contacted++;
    if (QUAL.has(l.status)) s.qualified++;
    if (l.status === 'Deal') { s.deals++; s.closing += parseFloat(l.closing_amount) || 0; }
    const c = catKey(l.kategori_promo);
    s.cats[c] = (s.cats[c] || 0) + 1;
  }
  return [...map.values()]
    .map(s => ({
      ...s,
      kategori: Object.entries(s.cats).sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
      qualRate: s.leads ? (s.qualified / s.leads) * 100 : 0,
      contactRate: s.leads ? (s.contacted / s.leads) * 100 : 0,
    }))
    .sort((a, b) => b.leads - a.leads);
}

/* ── kota ── */
function cities(rows) {
  const map = new Map();
  let unknown = 0;
  for (const l of rows) {
    const c = cityName(l.domicile);
    if (!c) { unknown++; continue; }
    const k = c.toLowerCase();
    if (!map.has(k)) map.set(k, { name: c, n: 0, qualified: 0 });
    const e = map.get(k);
    e.n++;
    if (QUAL.has(l.status)) e.qualified++;
  }
  const list = [...map.values()].sort((a, b) => b.n - a.n);
  const known = rows.length - unknown;
  return { list, unknown, known, count: list.length };
}

/* ── jam & hari masuk (waktu lokal) ── */
function heat(rows) {
  const grid = DOW.map(() => Array(24).fill(0));
  const byDow = Array(7).fill(0), byHour = Array(24).fill(0);
  for (const l of rows) {
    const d = new Date(l.created_at);
    if (isNaN(d)) continue;
    const dow = (d.getDay() + 6) % 7, h = d.getHours();
    grid[dow][h]++; byDow[dow]++; byHour[h]++;
  }
  let max = 0, peak = null;
  grid.forEach((r, di) => r.forEach((n, h) => { if (n > max) { max = n; peak = { dow: di, hour: h, n }; } }));
  // Jendela 3 jam tersibuk (gabungan semua hari)
  let win = null;
  for (let h = 0; h <= 21; h++) {
    const n = byHour[h] + byHour[h + 1] + byHour[h + 2];
    if (!win || n > win.n) win = { from: h, to: h + 3, n };
  }
  const topDow = byDow.map((n, i) => ({ i, n })).sort((a, b) => b.n - a.n);
  return { grid, max, peak, byDow, byHour, win, topDow };
}

/* ── sales ── */
function salesSplit(rows) {
  const map = new Map();
  for (const l of rows) {
    if (!l.sales) continue;
    if (!map.has(l.sales)) map.set(l.sales, { name: l.sales, leads: 0, qualified: 0, deals: 0 });
    const s = map.get(l.sales);
    s.leads++;
    if (QUAL.has(l.status)) s.qualified++;
    if (l.status === 'Deal') s.deals++;
  }
  return [...map.values()].sort((a, b) => b.leads - a.leads);
}

/* ══ ANALISIS UTAMA ══ */
export function buildLeadsAnalysis(rows, prevRows, range, prevRange, now = new Date()) {
  rows = rows || [];
  const cur = summarize(rows, range);
  const prev = prevRows ? summarize(prevRows, prevRange) : null;

  // Kategori yang muncul (urut terbanyak) — dasar legenda & batang bertumpuk
  const catCount = {};
  for (const l of rows) { const k = catKey(l.kategori_promo); catCount[k] = (catCount[k] || 0) + 1; }
  const cats = Object.entries(catCount)
    .sort((a, b) => (a[0] === '—') - (b[0] === '—') || b[1] - a[1])
    .map(([key, n]) => ({ key, n, name: catName(key), color: catColor(key) }));

  const funnel = [
    { key: 'all',       label: 'Leads',       n: cur.total,     color: 'var(--rg-t2)',
      hint: 'Approved leads that came in during this period.' },
    { key: 'contacted', label: 'Contacted',   n: cur.contacted, color: 'var(--lh-cold)',
      hint: 'Marked as followed up, or already given a status by sales.' },
    { key: 'qualified', label: 'Qualified',   n: cur.qualified, color: 'var(--lh-warm)',
      hint: 'Moved to Warm, Hot or Deal — the same as Lead Quality on the Dashboard.' },
    { key: 'hot',       label: 'Hot or Deal', n: cur.hotPlus,   color: 'var(--lh-hot)',
      hint: 'Seriously interested or already closed.' },
    { key: 'deal',      label: 'Deal',        n: cur.deals,     color: 'var(--lh-deal)',
      hint: 'Closed — has a closing amount.' },
  ].map((s, i, arr) => ({
    ...s,
    pct: cur.total ? (s.n / cur.total) * 100 : 0,
    stepPct: i === 0 ? null : arr[i - 1].n ? (s.n / arr[i - 1].n) * 100 : null,
  }));

  // Waktu sampai deal: sebaran
  const BUCKETS = [[0, 7, '0–7'], [8, 14, '8–14'], [15, 30, '15–30'], [31, 60, '31–60'], [61, Infinity, '60+']];
  const speedBuckets = BUCKETS.map(([a, b, label]) => ({ label, n: cur.dealDays.filter(d => d >= a && d <= b).length }));

  // Antrean: lead > 2 hari belum dihubungi · lead > 1 hari tanpa sales
  const ageDays = (l) => (now - new Date(l.created_at)) / DAY;
  const older2 = rows.filter(l => ageDays(l) > 2);
  const stale = older2.filter(l => !isContacted(l)).length;
  const unassigned = rows.filter(l => ageDays(l) > 1 && !l.sales).length;
  const young = rows.filter(l => ageDays(l) < 3).length;

  const an = {
    range, prevRange, cur, prev, cats, funnel,
    pctLeads: prev && prev.total ? ((cur.total - prev.total) / prev.total) * 100 : null,
    qualPts: prev && prev.total && cur.total ? cur.qualRate - prev.qualRate : null,
    trend: trend(rows, range, cats),
    sources: sources(rows),
    cities: cities(rows),
    heat: heat(rows),
    sales: salesSplit(rows),
    speed: { buckets: speedBuckets, avg: cur.avgDays, median: cur.medianDays, n: cur.dealDays.length, missing: cur.deals - cur.dealDays.length, prevAvg: prev?.avgDays ?? null },
    backlog: { stale, eligible: older2.length, unassigned, young },
  };
  an.insights = buildInsights(an);
  return an;
}

/* ══ INSIGHT OTOMATIS (rule-based) ══
   Tiap aturan menulis kalimat yang bisa dipahami atasan tanpa penjelasan tambahan
   (lihat catatan "metric clarity"): pakai definisi yang sama dengan Dashboard. */
const SEV_ORDER = { critical: 0, warning: 1, positive: 2, info: 3 };

function buildInsights(an) {
  const { cur, prev, trend: tr, sources: src, cities: ct, heat: ht, sales, speed, backlog } = an;
  const out = [];
  const prevLabel = an.prevRange ? `${shortDate(an.prevRange.since)}–${shortDate(an.prevRange.until)}` : 'the previous period';

  if (cur.total < 5) {
    return [{
      severity: 'info', icon: 'Lightbulb', title: 'Not enough leads to find patterns yet',
      body: `Only ${plural(cur.total, 'lead')} in this period. Pick a longer date range to see trends, sources and timing.`,
      chips: [],
    }];
  }

  // 1. Volume
  if (an.pctLeads != null && prev.total >= 10 && Math.abs(an.pctLeads) >= 15) {
    const up = an.pctLeads > 0;
    out.push({
      severity: up ? 'positive' : an.pctLeads <= -35 ? 'critical' : 'warning',
      icon: up ? 'TrendingUp' : 'TrendingDown',
      title: up ? `Leads are up ${fmtPct(an.pctLeads)}` : `Leads are down ${fmtPct(Math.abs(an.pctLeads))}`,
      body: `${plural(cur.total, 'lead')} came in this period, against ${fmtInt(prev.total)} in ${prevLabel}.${up ? '' : ' Check whether a conversion campaign was paused or its budget dropped.'}`,
      chips: [
        { label: 'This period', value: fmtInt(cur.total) },
        { label: 'Previous', value: fmtInt(prev.total) },
        { label: 'Change', value: `${up ? '+' : '−'}${fmtPct(Math.abs(an.pctLeads))}`, tone: up ? 'pos' : 'neg' },
      ],
      spark: tr.list.map(b => b.total),
    });
  }

  // 2. Antrean follow-up
  if (backlog.eligible >= 10) {
    const share = (backlog.stale / backlog.eligible) * 100;
    if (backlog.stale >= 3 && share >= 10) {
      out.push({
        severity: share >= 25 && backlog.stale >= 5 ? 'critical' : 'warning', icon: 'CircleAlert',
        title: `${plural(backlog.stale, 'lead')} still waiting for a first contact`,
        body: `These came in more than 2 days ago and still have no status and no follow-up. Open Leads List and filter by No Status to work through them.`,
        chips: [
          { label: 'Waiting', value: fmtInt(backlog.stale), tone: 'neg' },
          { label: 'Of older leads', value: fmtPct(share) },
        ],
      });
    } else if (backlog.stale === 0) {
      out.push({
        severity: 'positive', icon: 'BadgeCheck', title: 'Every older lead has been contacted',
        body: `All ${fmtInt(backlog.eligible)} leads that came in more than 2 days ago were followed up or given a status.`,
        chips: [{ label: 'Contacted', value: fmtPct(cur.contactRate) }],
      });
    }
  }

  // 3. Lead Quality vs periode lalu
  if (an.qualPts != null && prev.total >= 10 && Math.abs(an.qualPts) >= 5) {
    const up = an.qualPts > 0;
    const youngShare = cur.total ? (backlog.young / cur.total) * 100 : 0;
    out.push({
      severity: up ? 'positive' : 'warning', icon: up ? 'Gem' : 'TrendingDown',
      title: up ? `Lead quality improved by ${fmtDec(an.qualPts)} pts` : `Lead quality dropped ${fmtDec(Math.abs(an.qualPts))} pts`,
      body: up
        ? `${fmtPct(cur.qualRate)} of leads reached Warm, Hot or Deal, up from ${fmtPct(prev.qualRate)} in ${prevLabel}.`
        : `${fmtPct(cur.qualRate)} of leads reached Warm, Hot or Deal, down from ${fmtPct(prev.qualRate)}.${youngShare >= 15 ? ` Part of this is timing: ${fmtPct(youngShare)} of this period’s leads are less than 3 days old and not processed yet.` : ''}`,
      chips: [
        { label: 'This period', value: fmtPct(cur.qualRate) },
        { label: 'Previous', value: fmtPct(prev.qualRate) },
        { label: 'Change', value: `${up ? '+' : '−'}${fmtDec(Math.abs(an.qualPts))} pts`, tone: up ? 'pos' : 'neg' },
      ],
    });
  }

  // 4 & 5. Sumber terbaik / terlemah (min. volume supaya tidak kebetulan)
  const avgQual = cur.qualRate || 0;
  const big = src.filter(s => s.leads >= 15 && s.name !== '(No campaign)');
  if (big.length >= 2) {
    const best = [...big].sort((a, b) => b.qualRate - a.qualRate)[0];
    if (best.qualRate >= avgQual + 5) {
      out.push({
        severity: 'positive', icon: 'Award', title: 'Best lead source this period',
        body: `“${best.name}” brought ${plural(best.leads, 'lead')} and ${fmtPct(best.qualRate)} of them qualified — above the ${fmtPct(avgQual)} average.`,
        chips: [
          { label: 'Leads', value: fmtInt(best.leads) },
          { label: 'Qualified', value: fmtPct(best.qualRate), tone: 'pos' },
          { label: 'Deals', value: fmtInt(best.deals) },
        ],
      });
    }
    const weak = [...big].filter(s => s.leads >= 20).sort((a, b) => a.qualRate - b.qualRate)[0];
    if (weak && weak !== best && weak.qualRate <= avgQual * 0.6) {
      out.push({
        severity: 'warning', icon: 'Target', title: 'A source with low-quality leads',
        body: `Only ${fmtPct(weak.qualRate)} of the ${fmtInt(weak.leads)} leads from “${weak.name}” qualified, against a ${fmtPct(avgQual)} average. Review its form questions or targeting.`,
        chips: [
          { label: 'Leads', value: fmtInt(weak.leads) },
          { label: 'Qualified', value: fmtPct(weak.qualRate), tone: 'neg' },
        ],
      });
    }
  }

  // 6. Kecepatan closing
  if (speed.n >= 3) {
    const diff = speed.prevAvg != null ? speed.avg - speed.prevAvg : null;
    const faster = diff != null && diff <= -2, slower = diff != null && diff >= 3;
    out.push({
      severity: faster ? 'positive' : slower ? 'warning' : 'info', icon: 'Zap',
      title: `Deals close in about ${fmtDec(speed.avg)} days`,
      body: `On average a lead becomes a deal ${fmtDec(speed.avg)} days after it comes in (median ${fmtDec(speed.median, speed.median % 1 ? 1 : 0)}).${diff != null ? ` That is ${fmtDec(Math.abs(diff))} days ${diff < 0 ? 'faster' : 'slower'} than ${prevLabel}.` : ''} Leads younger than that may still close.`,
      chips: [
        { label: 'Average', value: `${fmtDec(speed.avg)} days` },
        { label: 'Deals', value: fmtInt(speed.n) },
      ],
    });
  } else if (cur.deals === 0 && tr.list.length >= 7) {
    out.push({
      severity: 'info', icon: 'Lightbulb', title: 'No deals from this period’s leads yet',
      body: speed.prevAvg != null
        ? `Last period, deals took about ${fmtDec(speed.prevAvg)} days to close — these leads may simply be too new.`
        : 'Deals are counted by the date the lead came in, so recent leads can still turn into deals later.',
      chips: [],
    });
  }

  // 7. Jam & hari tersibuk
  if (ht.win && ht.win.n >= 5) {
    const share = (ht.win.n / cur.total) * 100;
    const d1 = ht.topDow[0], d2 = ht.topDow[1];
    out.push({
      severity: 'info', icon: 'Clock',
      title: `Most leads arrive ${hh(ht.win.from)}–${hh(ht.win.to)}`,
      body: `${fmtPct(share)} of leads come in during these 3 hours, and ${DOW_LONG[d1.i]} and ${DOW_LONG[d2.i]} are the busiest days. Keep sales on WhatsApp then for the fastest reply.`,
      chips: [
        { label: 'Busiest day', value: DOW_LONG[d1.i] },
        { label: 'Peak hour', value: ht.peak ? `${DOW[ht.peak.dow]} ${hh(ht.peak.hour)}` : '—' },
      ],
    });
  }

  // 8. Tanpa sales
  if (backlog.unassigned >= 5) {
    out.push({
      severity: 'warning', icon: 'UserX', title: `${plural(backlog.unassigned, 'lead')} have no sales assigned`,
      body: 'They came in more than a day ago and nobody owns them yet. Assign them in Leads List (select rows → Assign sales).',
      chips: [{ label: 'Unassigned', value: fmtInt(backlog.unassigned), tone: 'neg' }],
    });
  }

  // 9. Beban sales timpang
  const assigned = sales.reduce((s, x) => s + x.leads, 0);
  if (sales.length >= 2 && assigned >= 20 && sales[0].leads / assigned >= 0.5) {
    out.push({
      severity: 'info', icon: 'Users', title: `${sales[0].name} handles ${fmtPct((sales[0].leads / assigned) * 100)} of assigned leads`,
      body: `The rest is split between ${sales.slice(1).map(s => s.name).join(' and ')}. A more even split can speed up first contact.`,
      chips: sales.map(s => ({ label: s.name, value: fmtInt(s.leads) })),
    });
  }

  // 10. Konsentrasi kota
  if (ct.known >= 20 && ct.list.length >= 3) {
    const top3 = ct.list.slice(0, 3);
    const share = (top3.reduce((s, c) => s + c.n, 0) / ct.known) * 100;
    out.push({
      severity: 'info', icon: 'MapPin', title: `${top3[0].name} sends the most leads`,
      body: `${top3.map(c => c.name).join(', ')} together make up ${fmtPct(share)} of leads that filled in a city — useful for choosing where to open or promote next.`,
      chips: top3.map(c => ({ label: c.name, value: fmtInt(c.n) })),
    });
  }

  return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]).slice(0, 6);
}
