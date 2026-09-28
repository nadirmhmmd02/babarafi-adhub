/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ (hapus seluruh file ini sebelum push produksi)
   ─────────────────────────────────────────────────────────────
   DATA DUMMY untuk preview redesain Ads Hub (Sep 2026). SATU set campaign rekaan
   dipakai SEMUA halaman supaya angkanya saling cocok:
   - buildDemoDashboard      → bentuk respons /api/meta?mode=dashboard (Dashboard, Analytics, Compare)
   - buildDemoCampaigns      → bentuk respons /api/meta (default — halaman Campaigns)
   - buildDemoCampaignDetail → bentuk respons mode=campaign_detail (popup detail campaign)
   - demoCalendar*           → baris tabel Supabase `campaigns` (halaman Calendar), CRUD di memori
   - buildDemoLeads          → baris tabel Supabase `leads` + spend konversi (Dashboard Leads Hub)
   Angka dihitung PER HARI per campaign (tarif harian × pola mingguan × promo × faktor
   bulan × acak deterministik), lalu dijumlah sesuai rentang → rentang apa pun (termasuk
   periode pembanding & Compare) konsisten satu sama lain.
   Cerita delta: bulan ini vs bulan lalu = campur (Spend naik abu, Reach/Traffic/Leads naik
   hijau, Impressions turun & CPM naik merah, CPC/CPL turun hijau); bulan lalu vs 2 bulan
   lalu = "bulan berat" (Leads & CPL memburuk tajam → kartu Critical di Analytics).
   Nama campaign mengikuti konvensi NAMA (AWR REACH / AWR IMPR / TRAFFIC / PROSPEK /
   KONVERSI) supaya semua rumus final berjalan apa adanya. SEMUA ANGKA REKAAN.
   ───────────────────────────────────────────────────────────── */

/* ── Campaign rekaan: tarif = rata-rata PER HARI di bulan berjalan ──
   budget = daily_budget (Rupiah penuh). stopAgo = campaign berhenti tayang N hari lalu
   (Stop/Ended) → tidak ada spend sesudahnya, tapi tetap muncul di rentang yang lebih lama. */
const CAMPAIGNS = [
  { id: 'demo-1',  name: 'KTBR AWR REACH - Brand Awareness Jabodetabek', objective: 'OUTCOME_AWARENESS', status: 'ACTIVE', budget: 90000,
    spend: 85600, impressions: 32600, reach: 11560, clicks: 189, link: 144 },
  { id: 'demo-2',  name: 'KTBR AWR IMPR - Video Kebab Jumbo Reels', objective: 'OUTCOME_AWARENESS', status: 'ACTIVE', budget: 75000,
    spend: 69600, impressions: 28150, reach: 7590, clicks: 233, link: 174 },
  { id: 'demo-3',  name: 'KTBR AWR REACH - Grand Opening Outlet Bekasi', objective: 'OUTCOME_AWARENESS', status: 'PAUSED', budget: 50000, stopAgo: 5,
    spend: 44800, impressions: 15190, reach: 5410, clicks: 89, link: 67 },
  // Kasus nyata: nama "TRAFFIC" tapi objective Meta AWARENESS → di Campaigns hasilnya Impressions
  { id: 'demo-10', name: 'KTBR TRAFFIC - Depo Baru : Jakarta Timur', objective: 'OUTCOME_AWARENESS', status: 'ACTIVE', budget: 40000,
    spend: 36300, impressions: 14630, reach: 4740, clicks: 78, link: 56 },
  { id: 'demo-11', name: 'KTBR AWR IMPR - Teaser Menu Musim Hujan', objective: 'OUTCOME_AWARENESS', status: 'ARCHIVED', budget: 60000, stopAgo: 14,
    spend: 57200, impressions: 24400, reach: 9100, clicks: 101, link: 70 },
  { id: 'demo-4',  name: 'KTBR TRAFFIC - Promo Beli 2 Gratis 1', objective: 'OUTCOME_TRAFFIC', status: 'ACTIVE', budget: 95000,
    spend: 89300, impressions: 9810, reach: 4370, clicks: 467, link: 365 },
  { id: 'demo-5',  name: 'KTBR TRAFFIC - Menu Baru Kebab Keju', objective: 'OUTCOME_TRAFFIC', status: 'ACTIVE', budget: 70000,
    spend: 66300, impressions: 7930, reach: 3560, clicks: 337, link: 264 },
  { id: 'demo-6',  name: 'KTBR TRAFFIC - Link GoFood & GrabFood', objective: 'OUTCOME_TRAFFIC', status: 'ACTIVE', budget: 40000,
    spend: 38900, impressions: 4850, reach: 2260, clicks: 207, link: 160 },
  { id: 'demo-7',  name: 'KTBR PROSPEK - Franchise Package Autopilot', objective: 'OUTCOME_LEADS', status: 'ACTIVE', budget: 130000,
    spend: 126700, impressions: 13040, reach: 4480, clicks: 248, link: 181, instant: 4.44, web: 0.67 },
  { id: 'demo-8',  name: 'KTBR PROSPEK - Franchise Proven Instant Form', objective: 'OUTCOME_LEADS', status: 'ACTIVE', budget: 95000,
    spend: 91100, impressions: 10410, reach: 3630, clicks: 181, link: 133, instant: 3.19, web: 0.37 },
  { id: 'demo-9',  name: 'KTBR KONVERSI - WhatsApp Kemitraan', objective: 'OUTCOME_LEADS', status: 'ACTIVE', budget: 75000,
    spend: 71100, impressions: 6930, reach: 2740, clicks: 119, link: 93, wa: 2.89 },
  // Sengaja boros (CPL jauh di atas median grup) → kartu "Needs attention" di Analytics
  { id: 'demo-12', name: 'KTBR PROSPEK - Franchise Suka-Suka Website Form', objective: 'OUTCOME_LEADS', status: 'PAUSED', budget: 80000, stopAgo: 3,
    spend: 77800, impressions: 8890, reach: 3070, clicks: 144, link: 104, web: 0.96 },
];

const METRICS = ['spend', 'impressions', 'reach', 'clicks', 'link', 'instant', 'web', 'wa'];

/* Faktor per metrik menurut jarak bulan dari bulan berjalan (0 = bulan ini, -1 = bulan
   lalu, -2 = dua bulan lalu). Bulan lebih lama = variasi acak di sekitar -2. */
const MONTH_FX = {
  '0':  { spend: 1,    impressions: 1,    reach: 1,    clicks: 1,    link: 1,    leads: 1 },
  '-1': { spend: 0.88, impressions: 1.09, reach: 0.72, clicks: 0.9,  link: 0.85, leads: 0.78 },
  '-2': { spend: 0.91, impressions: 1.15, reach: 0.7,  clicks: 0.82, link: 0.76, leads: 1.3 },
};

// Hari dalam minggu (Min..Sab) — akhir pekan ramai; promo tanggal 12–15
const DOW = [1.18, 0.86, 0.9, 0.95, 1.0, 1.14, 1.3];

// ── util tanggal (format YYYY-MM-DD, dihitung di UTC supaya tidak bergeser zona waktu) ──
const ymd = d => d.toISOString().slice(0, 10);
const parse = s => new Date(s + 'T00:00:00Z');
function addDays(s, n) { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); }
function daysBetween(a, b) { return Math.round((parse(b) - parse(a)) / 86400000) + 1; }
function localToday() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}
function monthOffset(ds, today) {
  const a = parse(ds), t = parse(today);
  return (a.getUTCFullYear() - t.getUTCFullYear()) * 12 + (a.getUTCMonth() - t.getUTCMonth());
}

// Salinan previousRange() di app/api/meta/route.js — supaya label "vs …" sama persis
function previousRange(since, until) {
  const s = parse(since);
  const u = parse(until);
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

// Acak deterministik (angka sama tiap refresh untuk tanggal & campaign yang sama)
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

function monthFx(offset) {
  if (offset >= 0) return MONTH_FX['0'];
  if (MONTH_FX[String(offset)]) return MONTH_FX[String(offset)];
  const r = seeded(`month${offset}`);
  const base = MONTH_FX['-2'];
  const out = {};
  for (const k of Object.keys(base)) out[k] = base[k] * (0.85 + r() * 0.25);
  return out;
}

/* ── Perubahan lokal dari halaman Campaigns (Stop/Run, Edit Budget) — hanya di memori,
   bertahan selama pindah halaman, hilang saat browser di-refresh. Tidak ada yang ke Meta. */
const overrides = {};
export function demoEditCampaign(id, patch) { overrides[id] = { ...overrides[id], ...patch }; }
const current = c => ({ ...c, ...(overrides[c.id] || {}) });

/* ── Angka satu campaign pada satu hari ── */
function campaignDay(c, ds, today) {
  if (ds > today) return null;
  if (c.stopAgo && ds > addDays(today, -c.stopAgo)) return null;
  const off  = monthOffset(ds, today);
  const fx   = monthFx(off);
  const d    = parse(ds);
  const dom  = d.getUTCDate();
  const dim  = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const rnd  = seeded(`${c.id}|${ds}`);
  const day  = DOW[d.getUTCDay()] * (dom >= 12 && dom <= 15 ? 1.35 : 1) * (0.9 + rnd() * 0.2);
  // Leads: bulan ini makin ramai (momentum naik), bulan lalu makin sepi (momentum turun)
  const pos  = dim > 1 ? (dom - 1) / (dim - 1) : 0;
  const ramp = off === 0 ? 0.65 + 0.7 * pos : off === -1 ? 1.3 - 0.6 * pos : 1;
  // Pembulatan acak (bukan Math.round) supaya angka kecil seperti leads/hari tidak bias
  const rr = v => Math.max(0, Math.floor(v + rnd()));
  return {
    spend:       Math.round(c.spend * fx.spend * day),
    impressions: rr(c.impressions * fx.impressions * day),
    reach:       rr(c.reach * fx.reach * day),
    clicks:      rr(c.clicks * fx.clicks * day),
    link:        rr(c.link * fx.link * day),
    instant:     rr((c.instant || 0) * fx.leads * day * ramp),
    web:         rr((c.web || 0) * fx.leads * day * ramp),
    wa:          rr((c.wa || 0) * fx.leads * day * ramp),
  };
}

function datesOf(since, until, today) {
  const last = until < today ? until : today;
  const out = [];
  for (let ds = since; ds <= last; ds = addDays(ds, 1)) out.push(ds);
  return out;
}

const zero = () => Object.fromEntries(METRICS.map(m => [m, 0]));

/* Total satu campaign dalam rentang. Reach tidak bisa dijumlah per hari (orang yang sama
   terhitung berkali-kali) → dikoreksi kasar supaya reach < impressions tetap masuk akal. */
function campaignRange(c, dates, today) {
  const t = zero();
  let n = 0;
  for (const ds of dates) {
    const v = campaignDay(c, ds, today);
    if (!v) continue;
    n++;
    for (const m of METRICS) t[m] += v[m];
  }
  if (n > 1) t.reach = Math.round(t.reach * (0.45 + 0.55 / Math.sqrt(n)));
  return t;
}

function actionsOf({ link = 0, instant = 0, web = 0, wa = 0 }) {
  const a = [];
  if (link)          a.push({ action_type: 'link_click', value: String(link) });
  if (instant + web) a.push({ action_type: 'lead', value: String(instant + web) });
  if (instant)       a.push({ action_type: 'onsite_conversion.lead_grouped', value: String(instant) });
  if (wa)            a.push({ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: String(wa) });
  return a;
}

function insightsOf(t, full = false) {
  const o = {
    spend: String(t.spend), impressions: String(t.impressions), reach: String(t.reach), clicks: String(t.clicks),
    ctr: String(t.impressions ? (t.clicks / t.impressions) * 100 : 0),
    actions: actionsOf(t),
  };
  if (full) {
    o.cpm = String(t.impressions ? (t.spend / t.impressions) * 1000 : 0);
    o.cpc = String(t.clicks ? t.spend / t.clicks : 0);
  }
  return o;
}

function sumAll(list) {
  const t = zero();
  for (const x of list) for (const m of METRICS) t[m] += x[m];
  t.reach = Math.round(t.reach * 0.66); // reach akun ter-deduplikasi antar campaign
  return t;
}

/* Satu rentang → { per-campaign totals, akun, harian } */
function computeRange(since, until, today, withDaily) {
  const dates = datesOf(since, until, today);
  const camps = CAMPAIGNS.map(current);
  const totals = camps.map(c => ({ c, t: campaignRange(c, dates, today) }));
  const account = sumAll(totals.map(x => x.t));
  let daily = null;
  if (withDaily) {
    daily = dates.map(ds => {
      const t = zero();
      for (const c of camps) {
        const v = campaignDay(c, ds, today);
        if (v) for (const m of METRICS) t[m] += v[m];
      }
      t.reach = Math.round(t.reach * 0.8);
      return { date_start: ds, date_stop: ds, ...insightsOf(t) };
    });
  }
  return { totals, account, daily };
}

const hasData = t => t.spend > 0 || t.impressions > 0 || t.reach > 0;

/* ═══ Dashboard / Analytics / Compare — bentuk respons mode=dashboard ═══
   range = { since, until } (rentang filter), isThisMonth = preset "This month" */
export function buildDemoDashboard({ since, until, isThisMonth }) {
  const today = localToday();
  const prevRange = previousRange(since, until);
  const cur  = computeRange(since, until, today, true);
  const prev = computeRange(prevRange.since, prevRange.until, today, false);

  const campaigns = cur.totals.map(({ c, t }) => ({
    id: c.id, name: c.name, objective: c.objective, status: c.status,
    ...(hasData(t) ? { insights: { data: [insightsOf(t)] } } : {}),
  }));
  const prevCampaigns = prev.totals.map(({ c, t }) => ({
    id: c.id, name: c.name, objective: c.objective,
    ...(hasData(t) ? { insights: { data: [{ spend: String(t.spend), impressions: String(t.impressions), clicks: String(t.clicks), actions: actionsOf(t) }] } } : {}),
  }));

  let chartRange = { since, until };
  if (isThisMonth) {
    const s = parse(since);
    chartRange = { since, until: ymd(new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0))) };
  }

  return {
    summary: insightsOf(cur.account),
    prevSummary: insightsOf(prev.account),
    daily: cur.daily,
    campaigns, prevCampaigns, chartRange, prevRange,
  };
}

/* ═══ Campaigns — bentuk respons /api/meta (default) ═══ */
export function buildDemoCampaigns({ since, until }) {
  const today = localToday();
  const cur = computeRange(since, until, today, false);
  return {
    campaigns: cur.totals.map(({ c, t }) => ({
      id: c.id, name: c.name, objective: c.objective, status: c.status,
      daily_budget: String(c.daily_budget ?? c.budget),
      ...(hasData(t) ? { insights: { data: [insightsOf(t, true)] } } : {}),
    })),
    insights: [insightsOf(cur.account, true)],
    account: { status: 1, disableReason: 0, name: 'Baba Rafi (demo)' },
  };
}

/* ═══ Popup detail campaign — bentuk respons mode=campaign_detail ═══
   Konten iklan = poster SVG rekaan (bukan media Instagram asli), bertanda DEMO. */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PALETTE = {
  Awareness:  [['#24174A', '#6A3FD0', '#F6C548'], ['#1C1440', '#8B5CF6', '#FFD86B']],
  Traffic:    [['#3E1708', '#E0701B', '#FFE08A'], ['#431B0A', '#F59E0B', '#FFF1B8']],
  Conversion: [['#0A332D', '#169A80', '#F9D65C'], ['#08302B', '#2FB673', '#FFE38A']],
};

const CREATIVES = {
  Awareness: [
    { kicker: 'KEBAB TURKI',    title: ['Kebab', 'Jumbo'],        sub: 'Porsi besar, rasa Timur Tengah',  cta: 'Cari outlet terdekat', tall: true },
    { kicker: 'OUTLET BARU',    title: ['Grand', 'Opening'],      sub: 'Diskon 30% minggu pertama',       cta: 'Lihat lokasi',         tall: false },
    { kicker: 'SEGERA HADIR',   title: ['Menu', 'Musim Hujan'],   sub: 'Hangat, pedas, bikin nagih',      cta: 'Ikuti kami',           tall: true },
  ],
  Traffic: [
    { kicker: 'PROMO TERBATAS', title: ['Beli 2', 'Gratis 1'],    sub: 'Berlaku di semua outlet',         cta: 'Pesan sekarang',       tall: true },
    { kicker: 'MENU BARU',      title: ['Kebab', 'Keju Lumer'],   sub: 'Mozzarella tarik yang melimpah',  cta: 'Order via GoFood',     tall: false },
    { kicker: 'ANTAR KE RUMAH', title: ['Pesan', 'Online'],       sub: 'GoFood · GrabFood · ShopeeFood',  cta: 'Order sekarang',       tall: true },
  ],
  Conversion: [
    { kicker: 'PELUANG USAHA',  title: ['Franchise', 'Autopilot'], sub: 'Mulai bisnis kebab tanpa ribet', cta: 'Isi formulir',         tall: false },
    { kicker: 'KEMITRAAN',      title: ['Jadi Mitra', 'Baba Rafi'], sub: 'Konsultasi gratis via WhatsApp', cta: 'Chat WhatsApp',       tall: true },
    { kicker: 'PAKET PROVEN',   title: ['Usaha', 'Siap Jalan'],    sub: 'Paket lengkap, tinggal buka',    cta: 'Daftar sekarang',      tall: false },
  ],
};

function poster(cr, pal, tag) {
  const W = 1080, H = cr.tall ? 1920 : 1350;
  const [bg1, bg2, acc] = pal;
  const cy = H * (cr.tall ? 0.34 : 0.31);
  const s  = cr.tall ? 1.15 : 0.82;
  // Blok teks: kicker → 2 baris judul → sub-judul, lalu tombol CTA di dasar (tanpa tumpang tindih)
  const ty = cr.tall ? 1150 : 715;
  const tf = cr.tall ? 128 : 112;           // ukuran huruf judul
  const t1 = ty + tf + 8, t2 = t1 + tf + 4, ts = t2 + (cr.tall ? 86 : 72);
  const ctaY = cr.tall ? H - 230 : H - 200, ctaH = cr.tall ? 104 : 92;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
<radialGradient id="r" cx="0.78" cy="0.22" r="0.65"><stop offset="0" stop-color="${acc}" stop-opacity="0.42"/><stop offset="1" stop-color="${acc}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<rect width="${W}" height="${H}" fill="url(#r)"/>
<circle cx="540" cy="${cy}" r="${300 * s}" fill="${acc}" opacity="0.14"/>
<g transform="translate(540 ${cy}) rotate(-16) scale(${s})">
<ellipse cx="10" cy="300" rx="190" ry="34" fill="#000" opacity="0.22"/>
<path d="M-150,-200 L150,-200 L108,262 Q0,300 -108,262 Z" fill="#E9C58B"/>
<ellipse cx="0" cy="-200" rx="150" ry="46" fill="#F3DFB4"/>
<circle cx="-84" cy="-228" r="42" fill="#5DAE4B"/>
<circle cx="-12" cy="-250" r="46" fill="#9C5A2E"/>
<circle cx="72" cy="-230" r="40" fill="#D8412F"/>
<circle cx="30" cy="-206" r="34" fill="#B8703A"/>
<circle cx="-50" cy="-204" r="28" fill="#F7F2E8"/>
<path d="M-129,40 L129,40 L112,262 Q0,300 -112,262 Z" fill="#FFFFFF" opacity="0.94"/>
<text x="0" y="168" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="800" fill="#B3261E">BABA RAFI</text>
</g>
<text x="80" y="130" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700" letter-spacing="6" fill="#FFFFFF" opacity="0.9">BABA RAFI</text>
<rect x="${W - 250}" y="88" width="170" height="58" rx="29" fill="#000" opacity="0.28"/>
<text x="${W - 165}" y="127" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" letter-spacing="4" fill="#FFFFFF">${esc(tag)}</text>
<text x="80" y="${ty}" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700" letter-spacing="5" fill="${acc}">${esc(cr.kicker)}</text>
<text x="76" y="${t1}" font-family="Arial, Helvetica, sans-serif" font-size="${tf}" font-weight="800" fill="#FFFFFF">${esc(cr.title[0])}</text>
<text x="76" y="${t2}" font-family="Arial, Helvetica, sans-serif" font-size="${tf}" font-weight="800" fill="#FFFFFF">${esc(cr.title[1])}</text>
<text x="80" y="${ts}" font-family="Arial, Helvetica, sans-serif" font-size="42" fill="#FFFFFF" opacity="0.86">${esc(cr.sub)}</text>
<rect x="80" y="${ctaY}" width="${Math.max(340, cr.cta.length * 25 + 120)}" height="${ctaH}" rx="${ctaH / 2}" fill="${acc}"/>
<text x="140" y="${ctaY + ctaH / 2 + 14}" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700" fill="#1D1405">${esc(cr.cta)}</text>
</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function groupOf(name) {
  const n = (name || '').toUpperCase();
  if (n.includes('PROSPEK') || n.includes('KONVERSI')) return 'Conversion';
  if (n.includes('TRAFFIC')) return 'Traffic';
  return 'Awareness';
}

export function buildDemoCampaignDetail(campaign) {
  const grp  = groupOf(campaign.name);
  const list = CREATIVES[grp];
  const pals = PALETTE[grp];
  const idx  = Math.max(0, CAMPAIGNS.findIndex(c => c.id === campaign.id));
  const label = (campaign.name || '').replace(/^KTBR\s+/i, '').replace(/^(AWR REACH|AWR IMPR|TRAFFIC|PROSPEK|KONVERSI)\s*-\s*/i, '');

  const ads = [0, 1].map(k => {
    const cr  = list[(idx + k) % list.length];
    const pal = pals[k % pals.length];
    // Konten pertama campaign Conversion = carousel 3 slide (panah + titik di popup)
    const carousel = grp === 'Conversion' && k === 0;
    const items = (carousel ? list : [cr]).map((c, j) => {
      const url = poster(carousel ? { ...c, tall: false } : c, pals[j % pals.length], 'DEMO');
      return { type: 'IMAGE', url, thumb: url };
    });
    const id = `${campaign.id}-ad${k + 1}`;
    return {
      id, name: carousel ? `${label} — Carousel (${items.length} slides)` : `${label} — ${cr.title.join(' ')}`, status: 'ACTIVE',
      creative: { id: `${id}-cr`, image_url: items[0].url, thumbnail_url: items[0].url, object_type: 'PHOTO' },
      media: { platform: k === 0 ? 'instagram' : 'facebook', type: carousel ? 'CAROUSEL_ALBUM' : 'IMAGE', permalink: null, items },
    };
  });

  const ci = campaign.insights?.data?.[0] || {};
  const sp = parseFloat(ci.spend || 0), im = parseFloat(ci.impressions || 0), re = parseFloat(ci.reach || 0);
  const SHARES = grp === 'Conversion'
    ? [['facebook', 0.47], ['instagram', 0.41], ['messenger', 0.08], ['audience_network', 0.04]]
    : [['instagram', 0.58], ['facebook', 0.35], ['audience_network', 0.05], ['messenger', 0.02]];
  const platforms = SHARES.map(([p, s]) => ({
    publisher_platform: p, spend: String(Math.round(sp * s)), impressions: String(Math.round(im * s)), reach: String(Math.round(re * s)),
  }));

  return { ads, platforms };
}

/* ═══ Calendar — baris tabel Supabase `campaigns`, CRUD hanya di memori ═══
   Tanggal relatif ke bulan berjalan (ada yang menyeberang ke bulan lalu/depan).
   Status otomatis: sudah lewat = Done, belum mulai = Draft, sedang jalan = Running. */
let calStore = null;
let calSeq = 100;

function seedCalendar() {
  const n = new Date();
  const y = n.getFullYear(), m = n.getMonth();
  const loc = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const d    = (mo, day) => loc(new Date(y, m + mo, day));
  const last = mo => loc(new Date(y, m + mo + 1, 0));
  const today = loc(n);
  const rows = [
    ['KTBR AWR REACH - Brand Awareness Jabodetabek',   'Awareness',  'Reels Kebab Jumbo 15s',         90000,  d(-1, 20), last(0)],
    ['KTBR AWR IMPR - Video Kebab Jumbo Reels',        'Awareness',  'Reels Kebab Jumbo 15s',         75000,  d(0, 3),   d(0, 24)],
    ['KTBR AWR REACH - Grand Opening Outlet Bekasi',   'Awareness',  'Static Grand Opening Bekasi',   50000,  d(0, 8),   d(0, 14)],
    ['KTBR AWR IMPR - Promo Gajian',                   'Awareness',  'Story Promo Gajian',            60000,  d(0, 25),  d(1, 3)],
    ['KTBR TRAFFIC - Promo Beli 2 Gratis 1',           'Traffic',    'Carousel Promo Beli 2 Gratis 1', 95000, d(0, 1),   d(0, 15)],
    ['KTBR TRAFFIC - Menu Baru Kebab Keju',            'Traffic',    'Reels Kebab Keju Lumer',        70000,  d(0, 10),  d(1, 5)],
    ['KTBR TRAFFIC - Link GoFood & GrabFood',          'Traffic',    'Static Order Online',           40000,  d(0, 16),  last(0)],
    ['KTBR TRAFFIC - Weekend Deal',                    'Traffic',    'Reels Weekend Deal',            55000,  d(1, 1),   d(1, 14)],
    ['KTBR PROSPEK - Franchise Package Autopilot',     'Conversion', 'Carousel Franchise Autopilot',  130000, d(-1, 25), d(1, 10)],
    ['KTBR PROSPEK - Franchise Proven Instant Form',   'Conversion', 'Instant Form Paket Proven',     95000,  d(0, 5),   d(0, 26)],
    ['KTBR KONVERSI - WhatsApp Kemitraan',             'Conversion', 'Reels Testimoni Mitra',         75000,  d(0, 12),  d(1, 12)],
    ['KTBR PROSPEK - Franchise Suka-Suka Website Form', 'Conversion', 'Landing Page Franchise',       80000,  d(-1, 1),  d(-1, 28)],
    ['KTBR AWR REACH - Teaser Ramadan 2027',           'Awareness',  'Teaser Video 6s',               60000,  null,      null],
    ['KTBR KONVERSI - Webinar Kemitraan',              'Conversion', '',                              0,      null,      null],
  ];
  return rows.map(([name, obj, konten, bh, mulai, selesai], i) => ({
    id: `demo-cal-${i + 1}`, created_at: new Date(y, m - 1, 1 + i).toISOString(),
    name, obj, konten, bh, mulai, selesai,
    status: !mulai || !selesai ? 'Draft' : selesai < today ? 'Done' : mulai > today ? 'Draft' : 'Running',
  }));
}

function store() { if (!calStore) calStore = seedCalendar(); return calStore; }

export function demoCalendarList() { return store().map(r => ({ ...r })); }
export function demoCalendarSave(payload, id) {
  if (id) calStore = store().map(r => r.id === id ? { ...r, ...payload } : r);
  else calStore = [...store(), { id: `demo-cal-${++calSeq}`, created_at: new Date().toISOString(), ...payload }];
}
export function demoCalendarDelete(id) { calStore = store().filter(r => r.id !== id); }
export function demoCalendarPatch(id, patch) { calStore = store().map(r => r.id === id ? { ...r, ...patch } : r); }
/* ═══ Leads Hub — baris tabel `leads` (approved) + spend konversi + isi Black Box ═══
   Lead per hari mengikuti pola mingguan & faktor bulan yang sama dengan Ads Hub (bulan ini
   naik vs bulan lalu; bulan lalu "bulan berat"). Status bergantung umur lead: lead baru
   kebanyakan belum diproses; Deal hanya dari lead ≥10 hari → "Last 7 days" = baris uang
   dormant (tanpa closing), "This month" = baris uang menyala. Spend = spend campaign
   PROSPEK/KONVERSI dummy periode yang sama (rumus sama dgn /api/leads?mode=spend). */
const LEAD_SALES = [['Akmel', 0.38], ['Hendra', 0.34], ['Dedik', 0.28]];
const DEAL_SIZES = [35000000, 45000000, 55000000, 75000000];

function pickW(r, list) {
  let x = r;
  for (const [v, w] of list) { if (x < w) return v; x -= w; }
  return list[list.length - 1][0];
}

function leadRows(since, until, today) {
  const rows = [];
  for (const ds of datesOf(since, until, today)) {
    const rnd = seeded(`lead|${ds}`);
    const d = parse(ds);
    const fx = monthFx(monthOffset(ds, today));
    const n = Math.floor(7.2 * DOW[d.getUTCDay()] * fx.leads * (0.75 + rnd() * 0.5) + rnd());
    const age = daysBetween(ds, today) - 1;
    for (let i = 0; i < n; i++) {
      const r = rnd();
      const status = age < 2
        ? pickW(r, [['No Status', 0.7], ['Cold', 0.22], ['Warm', 0.08]])
        : age < 10
          ? pickW(r, [['No Status', 0.35], ['Cold', 0.3], ['Warm', 0.2], ['Hot', 0.15]])
          : pickW(r, [['No Status', 0.24], ['Cold', 0.31], ['Warm', 0.22], ['Hot', 0.17], ['Deal', 0.06]]);
      const fuChance = age < 1 ? 0.35 : age < 3 ? 0.7 : 0.9;
      const followed_up = status !== 'No Status' || rnd() < fuChance * 0.6;
      const sales = age < 2 && rnd() < 0.45 ? null : pickW(rnd(), LEAD_SALES);
      const kategori_promo = rnd() < 0.8 ? 'Autopilot' : null;
      const hh = String(8 + Math.floor(rnd() * 14)).padStart(2, '0');
      const mm = String(Math.floor(rnd() * 60)).padStart(2, '0');
      rows.push({
        status, followed_up, sales, kategori_promo,
        closing_amount: status === 'Deal' ? DEAL_SIZES[Math.floor(rnd() * DEAL_SIZES.length)] : null,
        created_at: `${ds}T${hh}:${mm}:00`,
      });
    }
  }
  return rows;
}

export function buildDemoLeads({ since, until }) {
  const today = localToday();
  const dash = buildDemoDashboard({ since, until });
  const spend = dash.campaigns.reduce((s, c) => {
    const n = (c.name || '').toUpperCase();
    return (n.includes('PROSPEK') || n.includes('KONVERSI')) ? s + parseFloat(c.insights?.data?.[0]?.spend || 0) : s;
  }, 0);
  return { rows: leadRows(since, until, today), spend, inboxCount: 7 };
}
/* ═══ END PREVIEW-ONLY ═══ */
