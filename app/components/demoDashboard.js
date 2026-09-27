/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ (hapus seluruh file ini sebelum push produksi)
   ─────────────────────────────────────────────────────────────
   DATA DUMMY untuk preview redesain Dashboard Ads Hub (Sep 2026).
   Bentuk JSON = PERSIS respons /api/meta?mode=dashboard (summary, prevSummary,
   daily, campaigns, prevCampaigns, chartRange, prevRange), jadi semua
   kalkulasi di app/page.js tetap lewat jalur & rumus yang sama.
   Nama campaign mengikuti konvensi NAMA (AWR REACH / AWR IMPR / TRAFFIC /
   PROSPEK / KONVERSI) supaya tiap panel terisi: 3 objektif, CPL & CTR aktif,
   rincian leads (instant form / website / WhatsApp) lengkap, delta campur
   naik/turun. SEMUA ANGKA REKAAN — bukan data Meta.
   ───────────────────────────────────────────────────────────── */

// Basis angka = periode 27 hari; diskalakan sesuai jumlah hari yang sudah berjalan
const BASE_DAYS = 27;

const CAMPAIGNS = [
  { id: 'demo-1', name: 'KTBR AWR REACH - Brand Awareness Jabodetabek',  objective: 'OUTCOME_AWARENESS',  status: 'ACTIVE',
    spend: 2310000, impressions: 880000, reach: 312000, clicks: 5100,  link: 3900 },
  { id: 'demo-2', name: 'KTBR AWR IMPR - Video Kebab Jumbo Reels',        objective: 'OUTCOME_AWARENESS',  status: 'ACTIVE',
    spend: 1880000, impressions: 760000, reach: 205000, clicks: 6300,  link: 4700 },
  { id: 'demo-3', name: 'KTBR AWR REACH - Grand Opening Outlet Bekasi',  objective: 'OUTCOME_AWARENESS',  status: 'PAUSED',
    spend: 1210000, impressions: 410000, reach: 146000, clicks: 2400,  link: 1800 },
  { id: 'demo-4', name: 'KTBR TRAFFIC - Promo Beli 2 Gratis 1',           objective: 'OUTCOME_TRAFFIC',    status: 'ACTIVE',
    spend: 2410000, impressions: 265000, reach: 118000, clicks: 12600, link: 9850 },
  { id: 'demo-5', name: 'KTBR TRAFFIC - Menu Baru Kebab Keju',            objective: 'OUTCOME_TRAFFIC',    status: 'ACTIVE',
    spend: 1790000, impressions: 214000, reach: 96000,  clicks: 9100,  link: 7120 },
  { id: 'demo-6', name: 'KTBR TRAFFIC - Link GoFood & GrabFood',          objective: 'OUTCOME_TRAFFIC',    status: 'ACTIVE',
    spend: 1050000, impressions: 131000, reach: 61000,  clicks: 5600,  link: 4310 },
  { id: 'demo-7', name: 'KTBR PROSPEK - Franchise Package Autopilot',     objective: 'OUTCOME_LEADS',      status: 'ACTIVE',
    spend: 3420000, impressions: 352000, reach: 121000, clicks: 6700,  link: 4900, instant: 120, web: 18, wa: 0 },
  { id: 'demo-8', name: 'KTBR PROSPEK - Franchise Proven Instant Form',   objective: 'OUTCOME_LEADS',      status: 'ACTIVE',
    spend: 2460000, impressions: 281000, reach: 98000,  clicks: 4900,  link: 3600, instant: 86,  web: 10, wa: 0 },
  { id: 'demo-9', name: 'KTBR KONVERSI - WhatsApp Kemitraan',             objective: 'OUTCOME_ENGAGEMENT', status: 'ACTIVE',
    spend: 1920000, impressions: 187000, reach: 74000,  clicks: 3200,  link: 2500, instant: 0,   web: 0,  wa: 78 },
];

// Faktor periode pembanding → delta sengaja campur: Spend naik (abu), Reach/Traffic/
// Leads naik (hijau), Impressions turun & CPM naik (merah), CPC/CPL turun (hijau).
const PREV = { spend: 0.88, impressions: 1.09, reach: 0.87, clicks: 0.9, link: 0.85, leads: 0.86 };

// ── util tanggal (UTC, format YYYY-MM-DD) ──
const ymd = d => d.toISOString().slice(0, 10);
function addDays(s, n) { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd(d); }
function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000) + 1; }
function localToday() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

// Salinan previousRange() di app/api/meta/route.js — supaya label "vs …" sama persis
function previousRange(since, until) {
  const s = new Date(since + 'T00:00:00Z');
  const u = new Date(until + 'T00:00:00Z');
  if (s.getUTCDate() === 1 && u >= s) {
    const months      = (u.getUTCFullYear() - s.getUTCFullYear()) * 12 + (u.getUTCMonth() - s.getUTCMonth()) + 1;
    const lastOfUntil = new Date(Date.UTC(u.getUTCFullYear(), u.getUTCMonth() + 1, 0)).getUTCDate();
    const prevUntilD  = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 0));
    if (u.getUTCDate() === lastOfUntil) {
      return { since: ymd(new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() - months, 1))), until: ymd(prevUntilD) };
    }
    if (months === 1) {
      const prevSinceD = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() - 1, 1));
      const day        = Math.min(u.getUTCDate(), prevUntilD.getUTCDate());
      return { since: ymd(prevSinceD), until: ymd(new Date(Date.UTC(prevSinceD.getUTCFullYear(), prevSinceD.getUTCMonth(), day))) };
    }
  }
  const len = daysBetween(since, until);
  const prevUntil = addDays(since, -1);
  return { since: addDays(prevUntil, -(len - 1)), until: prevUntil };
}

// Acak deterministik (angka sama tiap refresh untuk rentang yang sama)
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bagi total bulat ke hari-hari sesuai bobot (sisa pembulatan ke bobot terbesar) → jumlah persis
function spread(total, weights) {
  const raw  = weights.map(w => total * w);
  const out  = raw.map(Math.floor);
  let rest   = Math.round(total) - out.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) out[order[k][1]]++;
  return out;
}

function actionsOf({ link = 0, instant = 0, web = 0, wa = 0 }) {
  const a = [];
  if (link)          a.push({ action_type: 'link_click', value: String(link) });
  if (instant + web) a.push({ action_type: 'lead', value: String(instant + web) });
  if (instant)       a.push({ action_type: 'onsite_conversion.lead_grouped', value: String(instant) });
  if (wa)            a.push({ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: String(wa) });
  return a;
}

/* range = { since, until } (rentang filter), isThisMonth = preset "This month" */
export function buildDemoDashboard({ since, until, isThisMonth }) {
  const today   = localToday();
  const lastDay = until < today ? until : today;
  const elapsed = Math.max(1, daysBetween(since, lastDay));
  const k       = elapsed / BASE_DAYS;
  const rnd     = seeded(`${since}|${until}`);

  const scaled = CAMPAIGNS.map(c => ({
    ...c,
    spend: Math.round(c.spend * k), impressions: Math.round(c.impressions * k), reach: Math.round(c.reach * k),
    clicks: Math.round(c.clicks * k), link: Math.round(c.link * k),
    instant: Math.round((c.instant || 0) * k), web: Math.round((c.web || 0) * k), wa: Math.round((c.wa || 0) * k),
  }));

  const sum = (arr, f) => arr.reduce((s, c) => s + f(c), 0);
  const tot = {
    spend: sum(scaled, c => c.spend), impressions: sum(scaled, c => c.impressions), clicks: sum(scaled, c => c.clicks),
    link: sum(scaled, c => c.link), instant: sum(scaled, c => c.instant), web: sum(scaled, c => c.web), wa: sum(scaled, c => c.wa),
    reach: Math.round(sum(scaled, c => c.reach) * 0.66), // reach akun ter-deduplikasi
  };

  const campaigns = scaled.map(c => ({
    id: c.id, name: c.name, objective: c.objective, status: c.status,
    insights: { data: [{
      spend: String(c.spend), impressions: String(c.impressions), reach: String(c.reach), clicks: String(c.clicks),
      ctr: String(c.impressions ? (c.clicks / c.impressions) * 100 : 0),
      actions: actionsOf(c),
    }] },
  }));

  const prevOf = c => ({
    spend: Math.round(c.spend * PREV.spend), impressions: Math.round(c.impressions * PREV.impressions),
    clicks: Math.round(c.clicks * PREV.clicks), link: Math.round(c.link * PREV.link),
    instant: Math.round(c.instant * PREV.leads), web: Math.round(c.web * PREV.leads), wa: Math.round(c.wa * PREV.leads),
  });
  const prevCampaigns = scaled.map(c => {
    const p = prevOf(c);
    return {
      id: c.id, name: c.name, objective: c.objective,
      insights: { data: [{ spend: String(p.spend), impressions: String(p.impressions), clicks: String(p.clicks), actions: actionsOf(p) }] },
    };
  });
  const pAll = scaled.map(prevOf);

  const summary = {
    spend: String(tot.spend), impressions: String(tot.impressions), reach: String(tot.reach), clicks: String(tot.clicks),
    actions: actionsOf(tot),
  };
  const prevSummary = {
    spend: String(sum(pAll, p => p.spend)), impressions: String(sum(pAll, p => p.impressions)),
    reach: String(Math.round(tot.reach * PREV.reach)), clicks: String(sum(pAll, p => p.clicks)),
    actions: actionsOf({ link: sum(pAll, p => p.link), instant: sum(pAll, p => p.instant), web: sum(pAll, p => p.web), wa: sum(pAll, p => p.wa) }),
  };

  // ── Harian: pola mingguan (akhir pekan ramai), promo tgl 12–15, sedikit acak ──
  const DOW = [1.18, 0.86, 0.9, 0.95, 1.0, 1.14, 1.3]; // Min..Sab
  const days = [];
  for (let i = 0; i < elapsed; i++) days.push(addDays(since, i));
  const weightsFor = (jitter) => {
    const w = days.map(ds => {
      const d = new Date(ds + 'T00:00:00Z');
      const promo = d.getUTCDate() >= 12 && d.getUTCDate() <= 15 ? 1.35 : 1;
      return DOW[d.getUTCDay()] * promo * (1 - jitter + rnd() * jitter * 2);
    });
    const s = w.reduce((a, b) => a + b, 0) || 1;
    return w.map(v => v / s);
  };
  const wSpend = weightsFor(0.1), wImpr = weightsFor(0.14), wLink = weightsFor(0.18), wLead = weightsFor(0.3);
  const dSpend = spread(tot.spend, wSpend);
  const dImpr  = spread(tot.impressions, wImpr);
  const dReach = spread(tot.reach, wImpr);
  const dClick = spread(tot.clicks, wLink);
  const dLink  = spread(tot.link, wLink);
  const dInst  = spread(tot.instant, wLead);
  const dWeb   = spread(tot.web, wLead);
  const dWa    = spread(tot.wa, wLead);
  const daily = days.map((ds, i) => ({
    date_start: ds, date_stop: ds,
    spend: String(dSpend[i]), impressions: String(dImpr[i]), reach: String(dReach[i]), clicks: String(dClick[i]),
    actions: actionsOf({ link: dLink[i], instant: dInst[i], web: dWeb[i], wa: dWa[i] }),
  }));

  let chartRange = { since, until };
  if (isThisMonth) {
    const s = new Date(since + 'T00:00:00Z');
    chartRange = { since, until: ymd(new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0))) };
  }

  return { summary, prevSummary, daily, campaigns, prevCampaigns, chartRange, prevRange: previousRange(since, until) };
}
/* ═══ END PREVIEW-ONLY ═══ */
