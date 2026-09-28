'use client';

/* ══ CAMPAIGNS — redesain "Ridgeline" (LIVE 28 Sep 2026) ═════════════
   Nuansa sama dengan Dashboard: top bar judul + konteks | pil tanggal & aksi,
   tabel di kartu cangkang + panel dalam, angka Geist Mono penuh (Rp 1.440.076),
   warna objektif = entitas dashboard (Awareness ungu · Traffic oranye ·
   Conversion teal), pilihan/aktif netral. Skin: app/ridgeline.css +
   app/campaigns-ridgeline.css. LOGIKA (fetch, getResult objective-aware, sort,
   subtotal, Stop/Run, Edit Budget, hitung gabungan, lebar kolom) TIDAK diubah.
   ══════════════════════════════════════════════════════════════════════════ */

import '../campaigns-ridgeline.css';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Calculator, Check, ChevronDown, ChevronRight,
  CreditCard, Megaphone, Pause, Pencil, Play, RefreshCw, TriangleAlert, X,
} from 'lucide-react';
import { useCampaignsFilter, DATE_PRESETS_CAMPAIGNS } from '../components/DateFilterContext';
import { useAuth } from '../components/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import useIsMobile from '../components/useIsMobile';
import DateFilterPopup from '../components/DateFilterPopup';
import CampaignModal from '../components/CampaignModal';
import CombineModal from '../components/CombineModal';
import { dashboardFontVars } from '../components/dashboardFonts';
import { presetToRange, fmtRangeShort, fmtClock, DatePill } from '../components/rgKit';
import { authFetch } from '../supabase';

/* ─── Format angka — PENUH gaya Indonesia (sama dengan Dashboard: Rp 1.440.076) ─── */
function fmtRp(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function fmtNum(v) {
  if (!v) return '—';
  return Math.round(parseFloat(v)).toLocaleString('id-ID');
}

function getActionValue(actions, types) {
  if (!actions) return null;
  for (const type of types) {
    const a = actions.find(x => x.action_type === type);
    if (a) return parseInt(a.value);
  }
  return null;
}

/* Leads = form (instant form Meta + form website via pixel) + CTA klik-ke-WhatsApp.
   Aturan Nadir 3 Sep 2026 — sinkron dgn page.js/reportData/CompareModal/insightEngine. */
function getLeads(actions) {
  const form = getActionValue(actions, ["lead", "onsite_conversion.lead_grouped"]);
  const wa   = getActionValue(actions, ["onsite_conversion.messaging_conversation_started_7d"]);
  if (form === null && wa === null) return null;   // benar-benar tak ada data → tetap tampil "—"
  return (form || 0) + (wa || 0);
}

function getLinkClicks(actions) {
  return getActionValue(actions, ['link_click']);
}

/* Objective Meta yang berarti campaign Awareness (result = Reach/Impressions). */
const AWARENESS_OBJECTIVES = ['OUTCOME_AWARENESS', 'BRAND_AWARENESS', 'REACH'];

function getResult(campaign, insights) {
  const name = campaign.name?.toUpperCase() || '';
  const actions = insights?.actions || [];

  // Objective asli Meta menang atas nama untuk campaign Awareness — ada campaign
  // bernama "…TRAFFIC…" yang objective-nya OUTCOME_AWARENESS, hasilnya bukan link click.
  if (AWARENESS_OBJECTIVES.includes(campaign.objective)) {
    return name.includes('REACH')
      ? { label: 'Reach', value: fmtNum(insights?.reach) }
      : { label: 'Impressions', value: fmtNum(insights?.impressions) };
  }

  if (name.includes('AWR REACH')) return { label: 'Reach', value: fmtNum(insights?.reach) };
  if (name.includes('AWR IMPR')) return { label: 'Impressions', value: fmtNum(insights?.impressions) };
  if (name.includes('AWR')) return { label: 'Impressions', value: fmtNum(insights?.impressions) };
  if (name.includes('TRAFFIC')) return { label: 'Link Clicks', value: fmtNum(getLinkClicks(actions)) };
  if (name.includes('PROSPEK') || name.includes('KONVERSI')) return { label: 'Leads', value: fmtNum(getLeads(actions)) };
  return { label: '—', value: '—' };
}

const OBJ_GROUP = {
  OUTCOME_AWARENESS: 'Awareness',
  OUTCOME_TRAFFIC: 'Traffic',
  OUTCOME_LEADS: 'Conversion',
  OUTCOME_SALES: 'Conversion',
  OUTCOME_ENGAGEMENT: 'Traffic',
  LINK_CLICKS: 'Traffic',
};

// Warna objektif = entitas yang sama dengan Dashboard (donut, grafik, Top Campaigns)
const OBJ_VAR = { Awareness: 'var(--rg-aware)', Traffic: 'var(--rg-traffic)', Conversion: 'var(--rg-conv)' };

const OBJ_ORDER = ['Awareness', 'Traffic', 'Conversion'];

/* ─── SORT TABEL ───
   Nilai mentah per kolom (versi angka dari sel yang tampil). Sort diterapkan
   di dalam tiap grup objektif DAN tetap menghormati aturan lama "active di atas". */
function resultRaw(c, ci) {
  const name = c.name?.toUpperCase() || '';
  if (AWARENESS_OBJECTIVES.includes(c.objective)) {
    return parseFloat((name.includes('REACH') ? ci?.reach : ci?.impressions) || 0);
  }
  if (name.includes('AWR REACH')) return parseFloat(ci?.reach || 0);
  if (name.includes('AWR')) return parseFloat(ci?.impressions || 0);
  if (name.includes('TRAFFIC')) return getLinkClicks(ci?.actions) || 0;
  if (name.includes('PROSPEK') || name.includes('KONVERSI')) return getLeads(ci?.actions) || 0;
  return 0;
}

const SORT_COLS = {
  name:        { label: 'Campaign',     get: c => (c.name || '').toLowerCase() },
  budget:      { label: 'Daily Budget', get: c => parseFloat(c.daily_budget || 0) },
  result:      { label: 'Result',       get: c => resultRaw(c, c.insights?.data?.[0] || {}) },
  reach:       { label: 'Reach',        get: c => parseFloat(c.insights?.data?.[0]?.reach || 0) },
  impressions: { label: 'Impressions',  get: c => parseFloat(c.insights?.data?.[0]?.impressions || 0) },
  traffic:     { label: 'Traffic',      get: c => getLinkClicks(c.insights?.data?.[0]?.actions) || 0 },
  leads:       { label: 'Leads',        get: c => getLeads(c.insights?.data?.[0]?.actions) || 0 },
  cpm:         { label: 'CPM',          get: c => { const ci = c.insights?.data?.[0] || {}; const im = parseFloat(ci.impressions || 0); return im > 0 ? (parseFloat(ci.spend || 0) / im) * 1000 : null; } },
  cpc:         { label: 'CPC',          get: c => { const ci = c.insights?.data?.[0] || {}; const lc = getLinkClicks(ci.actions); return lc > 0 ? parseFloat(ci.spend || 0) / lc : null; } },
  cpl:         { label: 'CPL',          get: c => { const ci = c.insights?.data?.[0] || {}; const ld = getLeads(ci.actions); return ld > 0 ? parseFloat(ci.spend || 0) / ld : null; } },
  spend:       { label: 'Total Spend',  get: c => parseFloat(c.insights?.data?.[0]?.spend || 0) },
};
const NUM_COLS = ['budget', 'result', 'reach', 'impressions', 'traffic', 'leads', 'cpm', 'cpc', 'cpl', 'spend'];

function applySort(list, sort) {
  const col = sort && SORT_COLS[sort.key];
  if (!col) return list;
  return [...list].sort((a, b) => {
    const va = col.get(a), vb = col.get(b);
    if (typeof va === 'string' || typeof vb === 'string') {
      return sort.dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    }
    // Nilai kosong (—) selalu ditaruh di bawah, apa pun arah sortnya
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return sort.dir === 'asc' ? va - vb : vb - va;
  });
}

/* ─── STATUS AKUN IKLAN META ───
   Kalau iklan mati di Meta (tagihan belum dibayar, akun ditinjau, dsb) angka di
   dashboard/campaigns bisa tetap "kelihatan normal" padahal iklan sudah berhenti
   tayang. account_status dari Graph API memberi sinyal itu. Kita terjemahkan ke
   peringatan berbahasa manusia. Referensi nilai account_status Meta:
   1=aktif · 2=dinonaktifkan · 3=tagihan belum lunas · 7=ditinjau risiko ·
   8=menunggu penyelesaian · 9=masa tenggang · 100=proses tutup · 101=ditutup.
   disable_reason (saat status 2): 3=masalah pembayaran/risiko. */
const ACCOUNT_DISABLE_REASON = {
  1: 'it broke Meta advertising policies',
  2: 'it is under intellectual-property review',
  3: 'a payment or account-risk problem',
  5: 'it is under review by Meta',
  7: 'it was permanently closed by Meta',
};
function accountAlert(account) {
  if (!account || account.status == null || account.status === 1 || account.status === 201) return null;
  const s = account.status;
  const base = { icon: 'card', level: 'error' };
  switch (s) {
    case 3: // UNSETTLED — kasus paling umum: tagihan belum dibayar, iklan berhenti tayang
      return { ...base, title: 'Ads stopped — unpaid balance',
        body: 'There is an unpaid balance on your Meta Ads account, so every ad has stopped running even though the campaigns below may still say "Active". Settle the payment in Meta Ads Manager → Billing to get your ads running again.' };
    case 8:
      return { ...base, level: 'warn', icon: 'card', title: 'Waiting for payment to settle',
        body: 'Your account payment is being processed by Meta. Ads may pause until the payment clears.' };
    case 9:
      return { ...base, level: 'warn', icon: 'card', title: 'Account is in a payment grace period',
        body: 'Your ads are still running for now, but there is a balance that needs to be paid soon in Meta Ads Manager → Billing before the grace period ends.' };
    case 2:
      return { ...base, title: 'Ad account disabled by Meta',
        body: `Your ad account is disabled${account.disableReason && ACCOUNT_DISABLE_REASON[account.disableReason] ? ` because of ${ACCOUNT_DISABLE_REASON[account.disableReason]}` : ''}. All ads have stopped running. Check Account Quality / Ads Manager for the recovery steps.` };
    case 7:
      return { ...base, level: 'warn', icon: 'review', title: 'Account under review by Meta',
        body: 'Meta is reviewing your ad account. Ads may pause until the review is finished.' };
    case 100:
      return { ...base, icon: 'review', title: 'Ad account is being closed',
        body: 'Your ad account is being processed for closure, so ads will not run. Contact Meta support if this is unexpected.' };
    case 101:
      return { ...base, icon: 'review', title: 'Ad account is closed',
        body: 'This ad account has been closed, so no ads are running.' };
    default:
      return { ...base, level: 'warn', icon: 'review', title: 'Ad account has an issue on Meta',
        body: 'Your ad account status is not normal, so ads may stop running. Check Meta Ads Manager for the details.' };
  }
}

/* ─── Skeleton muat pertama (refetch berikutnya: tabel lama diredupkan, tanpa lompat) ─── */
function TableSkeleton() {
  return (
    <div className="rg-card rgc-card">
      <div className="rg-head"><span className="rg-skel" style={{ width: 150, height: 11 }} /></div>
      <div className="rg-well rgc-skel">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rgc-skel-row">
            <span className="rg-skel" style={{ width: 18, height: 18, borderRadius: 6 }} />
            <span className="rg-skel" style={{ width: `${34 - (i % 3) * 7}%`, height: 11 }} />
            <span className="rg-skel" style={{ width: 70, height: 20, borderRadius: 999 }} />
            <span className="rg-skel" style={{ marginLeft: 'auto', width: '32%', height: 11 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const { dateOpt, customSince, setCustomSince, customUntil, setCustomUntil, isCustom, selectPreset, applyCustom } = useCampaignsFilter();
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [showDropdown, setShowDropdown]   = useState(false);

  // Slot top bar mobile (MobileNav) — tombol refresh pindah ke atas via portal
  const [topbarSlot, setTopbarSlot] = useState(null);
  useEffect(() => {
    setTopbarSlot(isMobile ? document.getElementById('wd-topbar-actions') : null);
  }, [isMobile]);

  const [data, setData]                   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [updatedAt, setUpdatedAt]         = useState(null);
  const [showSubtotal, setShowSubtotal]   = useState({ Awareness: false, Traffic: false, Conversion: false });
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedIds, setSelectedIds]           = useState([]);   // pilihan untuk hitung gabungan
  const [showCombine, setShowCombine]           = useState(false);
  const [sort, setSort]                         = useState(null); // { key, dir } — null = urutan default
  // Penanda permintaan terakhir: respons lama yang datang belakangan tidak boleh menimpa
  // hasil yang lebih baru (tabel lama tetap tampil diredupkan selama memuat ulang)
  const fetchToken = useRef(0);

  // Aksi kontrol iklan (admin-only): stop/run + edit daily budget
  const [actionModal, setActionModal] = useState(null);  // { type:'status'|'budget', campaign, nextStatus }
  const [actionBusy, setActionBusy]   = useState(false);
  const [actionError, setActionError] = useState(null);
  const [budgetInput, setBudgetInput] = useState('');    // digit murni, tampil pakai separator
  const [toast, setToast]             = useState(null);  // pesan sukses singkat

  // Lebar kolom Campaign — bisa di-drag lewat handle di batas kolom Campaign|Status
  const [campW, setCampW]     = useState(300);
  const [colDrag, setColDrag] = useState(false);
  const colDragX = useRef(0);
  const colDragW = useRef(300);

  function startColDrag(e) {
    e.preventDefault();
    e.stopPropagation(); // jangan ikut memicu sort di header Campaign
    colDragX.current = e.clientX;
    colDragW.current = campW;
    setColDrag(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const move = (ev) => {
      setCampW(Math.max(150, Math.min(620, colDragW.current + (ev.clientX - colDragX.current))));
    };
    const up = () => {
      setColDrag(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  // Bulan kiri kalender (UI only). Default: bulan lalu → tampil "bulan lalu + bulan ini".
  const _initCal = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const [calY, setCalY] = useState(_initCal.getFullYear());
  const [calM, setCalM] = useState(_initCal.getMonth());

  useEffect(() => { if (!isCustom) fetchData(); }, [dateOpt, isCustom]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e) => {
      if (!e.target.closest('[data-filter]')) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  // Esc menutup popup aksi iklan (kecuali sedang memproses)
  useEffect(() => {
    if (!actionModal) return;
    const onKey = (e) => { if (e.key === 'Escape' && !actionBusy) setActionModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actionModal, actionBusy]);

  async function fetchData(since = '', until = '') {
    const token = ++fetchToken.current;
    setLoading(true);
    setError(null);
    try {
      const url = since && until
        ? `/api/meta?since=${since}&until=${until}`
        : `/api/meta?date_preset=${dateOpt.value}`;
      const res = await authFetch(url);
      const json = await res.json();
      if (token !== fetchToken.current) return;
      if (json.error) throw new Error(json.error);
      setData(json);
      setUpdatedAt(new Date());
    } catch (err) {
      if (token !== fetchToken.current) return;
      setError(err.message);
    }
    if (token === fetchToken.current) setLoading(false);
  }

  function applyCustomRange() {
    if (!customSince || !customUntil) return;
    applyCustom(customSince, customUntil);
    setShowDropdown(false);
    fetchData(customSince, customUntil);
  }

  function refresh() {
    if (isCustom && customSince && customUntil) fetchData(customSince, customUntil);
    else fetchData();
  }

  function handleSelectPreset(opt) {
    selectPreset(opt);
    setShowDropdown(false);
  }

  // ── Kalender (UI only) ──
  function openFilter() {
    const next = !showDropdown;
    if (next && customSince) { const p = customSince.split('-'); setCalY(+p[0]); setCalM(+p[1] - 1); }
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

  // Label yang muncul di tombol filter (HP) & di popup detail/gabungan
  function filterLabel() {
    if (isCustom && customSince && customUntil) {
      const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
      return `${fmt(customSince)} – ${fmt(customUntil)}`;
    }
    return dateOpt.label;
  }
  // Rentang aktif (tanggal nyata) untuk pil filter: "This month │ 1–28 Sep 2026"
  const curRange  = isCustom && customSince && customUntil
    ? { since: customSince, until: customUntil }
    : presetToRange(dateOpt.value);
  const rangeText = fmtRangeShort(curRange.since, curRange.until, true);

  function toggleSubtotal(grp) {
    setShowSubtotal(prev => ({ ...prev, [grp]: !prev[grp] }));
  }

  function toggleSelect(e, id) {
    e.stopPropagation(); // jangan sampai membuka popup detail
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  // ── Aksi kontrol iklan (admin-only) ──
  function openStatusModal(e, c) {
    e.stopPropagation();
    setActionError(null);
    setActionModal({ type: 'status', campaign: c, nextStatus: c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' });
  }
  function openBudgetModal(e, c) {
    e.stopPropagation();
    setActionError(null);
    setBudgetInput(c.daily_budget ? String(parseInt(c.daily_budget)) : '');
    setActionModal({ type: 'budget', campaign: c });
  }
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }
  async function executeAction() {
    if (!actionModal || actionBusy) return;
    const { type, campaign, nextStatus } = actionModal;
    if (type === 'budget' && (!budgetInput || parseInt(budgetInput) < 10000)) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const payload = type === 'status'
        ? { action: 'set_status', campaign_id: campaign.id, status: nextStatus }
        : { action: 'set_budget', campaign_id: campaign.id, daily_budget: parseInt(budgetInput || '0') };
      const res  = await authFetch('/api/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      // Update lokal langsung tanpa reload penuh (Meta sudah konfirmasi sukses)
      setData(prev => prev ? {
        ...prev,
        campaigns: prev.campaigns.map(x => x.id !== campaign.id ? x : (
          type === 'status' ? { ...x, status: nextStatus } : { ...x, daily_budget: String(parseInt(budgetInput)) }
        )),
      } : prev);

      setActionModal(null);
      showToast(type === 'status'
        ? (nextStatus === 'ACTIVE' ? 'Campaign is now running' : 'Campaign stopped')
        : 'Daily budget updated');
    } catch (err) {
      setActionError(err.message);
    }
    setActionBusy(false);
  }

  const allCampaigns = data?.campaigns || [];

  // Tampilkan semua campaign yang punya data di periode ini (spend/reach/impressions > 0)
  const campaignsWithData = allCampaigns.filter(c => {
    const ci = c.insights?.data?.[0];
    if (!ci) return false;
    return parseFloat(ci.spend || 0) > 0 || parseFloat(ci.reach || 0) > 0 || parseFloat(ci.impressions || 0) > 0;
  });

  const selectedCampaigns = campaignsWithData.filter(c => selectedIds.includes(c.id));
  const selectedSpend     = selectedCampaigns.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);

  const activeCampaigns = campaignsWithData.filter(c => c.status === 'ACTIVE');
  const inactiveCampaigns = campaignsWithData.filter(c => c.status !== 'ACTIVE');

  // Dalam tiap grup: aktif dulu, lalu non-aktif — menyatu tanpa pemisah
  const groupCampaigns = (list) =>
    list.reduce((acc, c) => {
      const grp = OBJ_GROUP[c.objective] || 'Awareness';
      if (!acc[grp]) acc[grp] = [];
      acc[grp].push(c);
      return acc;
    }, {});

  // Default: aktif di atas, non-aktif di bawah.
  // Saat sort kolom aktif: campur semua status lalu urutkan murni per nilai kolom —
  // campaign yang sudah berhenti ikut naik kalau angkanya memang paling besar.
  const mergedGrouped = {};
  OBJ_ORDER.forEach(grp => {
    const active = groupCampaigns(activeCampaigns)[grp] || [];
    const inactive = groupCampaigns(inactiveCampaigns)[grp] || [];
    if (!active.length && !inactive.length) return;
    mergedGrouped[grp] = sort
      ? applySort([...active, ...inactive], sort)
      : [...active, ...inactive];
  });

  /* Klik 1 = tertinggi dulu (paling sering dipakai saat analisis), klik 2 = terendah,
     klik 3 = balik ke urutan default. Kolom Campaign mulai dari A–Z. */
  function toggleSort(key) {
    const firstDir = key === 'name' ? 'asc' : 'desc';
    setSort(prev => {
      if (!prev || prev.key !== key) return { key, dir: firstDir };
      if (prev.dir === firstDir) return { key, dir: firstDir === 'asc' ? 'desc' : 'asc' };
      return null;
    });
  }

  // Jumlah kolom tabel — admin dapat kolom Actions ekstra
  const totalCols = isAdmin ? 14 : 13;

  /* Tombol urut di header kolom (fungsi render biasa, BUKAN komponen di dalam komponen —
     supaya tidak di-remount tiap render). Panah samar muncul saat hover lewat CSS,
     panah tegas + label terang saat kolom itu aktif. */
  function sortButton(colKey) {
    const active = sort?.key === colKey;
    const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <button type="button" className={`rgc-sortbtn${active ? ' is-active' : ''}`}
        onClick={() => toggleSort(colKey)}
        title={active
          ? `Sorted by ${SORT_COLS[colKey].label} — click to ${sort.dir === (colKey === 'name' ? 'asc' : 'desc') ? 'reverse' : 'reset'}`
          : `Sort by ${SORT_COLS[colKey].label}`}>
        {SORT_COLS[colKey].label}
        <Icon size={12} strokeWidth={active ? 2.6 : 2} className="rgc-sort-ico" aria-hidden="true" />
      </button>
    );
  }
  const ariaSort = (colKey) => sort?.key === colKey ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined;

  function statusChip(c) {
    if (c.status === 'ACTIVE') return <span className="rg-chip is-pos"><span className="rg-chip-dot" />Active</span>;
    if (c.status === 'PAUSED') return <span className="rg-chip"><span className="rgc-sq" />Stop</span>;
    return <span className="rg-chip is-muted">Ended</span>;
  }

  function renderCampaignRow(c, rowIdx = 0) {
    const isActive = c.status === 'ACTIVE';
    const ci = c.insights?.data?.[0] || {};
    const cLeads = getLeads(ci.actions);
    const cLinkClicks = getLinkClicks(ci.actions);
    const cCPM = parseFloat(ci.impressions || 0) > 0 ? (parseFloat(ci.spend || 0) / parseFloat(ci.impressions)) * 1000 : null;
    const cCPC = cLinkClicks > 0 ? parseFloat(ci.spend || 0) / cLinkClicks : null;
    const cCPL = cLeads > 0 ? parseFloat(ci.spend || 0) / cLeads : null;
    const result = getResult(c, ci);
    const picked = selectedIds.includes(c.id);

    return (
      <tr key={c.id} className={`rgc-row${picked ? ' is-picked' : ''}`}
        title="Click to see campaign details"
        onClick={() => setSelectedCampaign(c)}
        style={{ animationDelay: `${Math.min(rowIdx, 14) * 28}ms` }}>
        <td className="rgc-td-check" onClick={(e) => toggleSelect(e, c.id)} title="Select to calculate a combined total">
          <span className={`rgc-check${picked ? ' is-on' : ''}`} role="checkbox" aria-checked={picked} aria-label={`Select ${c.name}`}>
            {picked && <Check size={11} strokeWidth={3.5} />}
          </span>
        </td>
        <td className="rgc-td-name" title={c.name} style={{ width: campW, minWidth: campW, maxWidth: campW }}>{c.name}</td>
        <td className="rgc-td-status">{statusChip(c)}</td>
        {isAdmin && (
          <td className="rgc-td-actions" onClick={e => e.stopPropagation()}>
            <div className="rgc-acts">
              {(c.status === 'ACTIVE' || c.status === 'PAUSED') && (
                <button type="button" onClick={(e) => openStatusModal(e, c)}
                  className={`rg-iconbtn rgc-act ${isActive ? 'is-neg' : 'is-pos'}`}
                  title={isActive ? 'Stop campaign' : 'Run campaign'}
                  aria-label={isActive ? `Stop ${c.name}` : `Run ${c.name}`}>
                  {isActive ? <Pause size={13} /> : <Play size={13} />}
                </button>
              )}
              {c.daily_budget && (
                <button type="button" onClick={(e) => openBudgetModal(e, c)} className="rg-iconbtn rgc-act"
                  title="Edit daily budget" aria-label={`Edit daily budget of ${c.name}`}>
                  <Pencil size={13} />
                </button>
              )}
            </div>
          </td>
        )}
        <td className="rg-num">{c.daily_budget ? fmtRp(parseInt(c.daily_budget)) : '—'}</td>
        <td>
          <div className="rgc-result">
            <span className="rgc-result-label">{result.label}</span>
            <span className="rg-num">{result.value}</span>
          </div>
        </td>
        <td className="rg-num">{fmtNum(ci.reach)}</td>
        <td className="rg-num">{fmtNum(ci.impressions)}</td>
        <td className="rg-num">{fmtNum(cLinkClicks)}</td>
        <td className="rg-num">{cLeads == null ? '—' : cLeads.toLocaleString('id-ID')}</td>
        <td className="rg-num">{fmtRp(cCPM)}</td>
        <td className="rg-num">{fmtRp(cCPC)}</td>
        <td className="rg-num">{fmtRp(cCPL)}</td>
        <td className="rg-num rgc-spend">{ci.spend ? fmtRp(ci.spend) : '—'}</td>
      </tr>
    );
  }

  function renderGroup(grp, rows) {
    if (!rows.length) return null;

    const subBudget = rows.reduce((s, c) => s + (c.daily_budget ? parseInt(c.daily_budget) : 0), 0);
    const subReach = rows.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.reach || 0), 0);
    const subImpressions = rows.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.impressions || 0), 0);
    const subTraffic = rows.reduce((s, c) => s + (getLinkClicks(c.insights?.data?.[0]?.actions) || 0), 0);
    const subLeads = rows.reduce((s, c) => s + (getLeads(c.insights?.data?.[0]?.actions) || 0), 0);
    const subSpend = rows.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);
    const subCPM = subImpressions > 0 ? (subSpend / subImpressions) * 1000 : null;
    const subCPC = subTraffic > 0 ? subSpend / subTraffic : null;
    const subCPL = subLeads > 0 ? subSpend / subLeads : null;
    const subResultVal = grp === 'Awareness' ? fmtNum(subImpressions) : grp === 'Traffic' ? fmtNum(subTraffic) : fmtNum(subLeads);
    const subResultLabel = grp === 'Awareness' ? 'Impressions' : grp === 'Traffic' ? 'Link Clicks' : 'Leads';

    return [
      <tr key={grp + '-hdr'} className="rgc-group">
        <td colSpan={totalCols}>
          <div className="rgc-group-in">
            <span className="rgc-obj"><span className="rgc-obj-dot" style={{ background: OBJ_VAR[grp] }} />{grp}</span>
            <span className="rgc-group-count">{rows.length} campaign{rows.length > 1 ? 's' : ''}</span>
            {/* Ruang kosong di baris objektif dipakai untuk menandai urutan yang sedang aktif
                di grup ini — klik untuk kembali ke urutan default. */}
            {sort && SORT_COLS[sort.key] && (
              <button type="button" className="rg-chip rgc-sortchip" onClick={() => setSort(null)} title="Back to default order">
                {sort.dir === 'asc' ? <ArrowUp size={11} strokeWidth={2.6} /> : <ArrowDown size={11} strokeWidth={2.6} />}
                {SORT_COLS[sort.key].label}
                <X size={11} strokeWidth={2.6} className="rgc-sortchip-x" />
              </button>
            )}
          </div>
        </td>
      </tr>,

      ...rows.map((c, i) => renderCampaignRow(c, i)),

      showSubtotal[grp] && (
        <tr key={grp + '-sub'} className="rgc-sub">
          <td colSpan={isAdmin ? 4 : 3} className="rgc-sub-label">Subtotal {grp}</td>
          <td className="rg-num">{fmtRp(subBudget)}</td>
          <td>
            <div className="rgc-result">
              <span className="rgc-result-label">{subResultLabel}</span>
              <span className="rg-num">{subResultVal}</span>
            </div>
          </td>
          <td className="rg-num">{fmtNum(subReach)}</td>
          <td className="rg-num">{fmtNum(subImpressions)}</td>
          <td className="rg-num">{subTraffic > 0 ? fmtNum(subTraffic) : '—'}</td>
          <td className="rg-num">{subLeads > 0 ? fmtNum(subLeads) : '—'}</td>
          <td className="rg-num">{fmtRp(subCPM)}</td>
          <td className="rg-num">{fmtRp(subCPC)}</td>
          <td className="rg-num">{fmtRp(subCPL)}</td>
          <td className="rg-num rgc-spend">{fmtRp(subSpend)}</td>
        </tr>
      ),

      <tr key={grp + '-toggle'} className="rgc-toggle">
        <td colSpan={totalCols}>
          <button type="button" className="rgc-toggle-btn" onClick={() => toggleSubtotal(grp)} aria-expanded={showSubtotal[grp]}>
            {showSubtotal[grp] ? 'Hide subtotal' : 'Show subtotal'}
            <ChevronDown size={13} className="rgc-toggle-caret" />
          </button>
        </td>
      </tr>,
    ].filter(Boolean);
  }

  // Peringatan status akun iklan Meta (mis. tagihan belum dibayar / akun ditinjau)
  const acctAlert = accountAlert(data?.account);

  // Tombol refresh HP — dirender via portal ke top bar MobileNav (di luar skin),
  // jadi tetap gaya lama 36px agar serasi dengan theme toggle top bar
  const refreshBtnMobile = (
    <button onClick={refresh} title="Refresh" style={{
      width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '9px', cursor: 'pointer',
      flexShrink: 0, transition: 'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--t3)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--br)'}
    >
      <RefreshCw size={14} color="var(--t2)" style={loading ? { animation: 'wdSpin 0.8s linear infinite' } : undefined} />
    </button>
  );

  const initialLoading = loading && !data;
  const ctxLine = initialLoading
    ? <span>Loading Meta Ads data…</span>
    : error && !data
      ? <span>Could not load data</span>
      : (<>
          <span className="rg-live" aria-hidden="true" />
          <span>Meta Ads</span>
          <span className="rg-ctx-sep" aria-hidden="true" />
          <span>{campaignsWithData.length} campaign{campaignsWithData.length === 1 ? '' : 's'}</span>
          <span className="rg-ctx-sep" aria-hidden="true" />
          <span>{activeCampaigns.length} active · {inactiveCampaigns.length} non-active</span>
          <span className="rg-ctx-sep" aria-hidden="true" />
          <span>{loading ? 'Refreshing…' : updatedAt ? `Updated ${fmtClock(updatedAt)}` : ''}</span>
        </>);

  const budgetInvalid = actionModal?.type === 'budget' && (!budgetInput || parseInt(budgetInput) < 10000);

  return (
    <div className={`rg rg-page ${dashboardFontVars}${isMobile ? ' is-mobile' : ''}`}>

      {/* ══ TOP BAR — judul + konteks (kiri) · filter & aksi (kanan) ══ */}
      <header className="rg-top">
        <div className="rg-top-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="rg-h1">Campaigns</h1>
          </div>
          <div className="rg-ctx">{ctxLine}</div>
        </div>

        <div className="rg-tools">
          <DatePill open={showDropdown} onToggle={openFilter} isMobile={isMobile} isCustom={isCustom}
            presetLabel={dateOpt.label} mobileLabel={filterLabel()} rangeText={rangeText}>
            <DateFilterPopup
              presets={DATE_PRESETS_CAMPAIGNS}
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
            <ThemeToggle className="rg-pill rg-round" />
          </>)}

          {/* Mobile: refresh pindah ke top bar (kiri theme toggle) */}
          {isMobile && topbarSlot && createPortal(refreshBtnMobile, topbarSlot)}
        </div>
      </header>

      {/* ══ ISI ══ */}
      <div className="rg-body rgc-body">

        {/* ── Peringatan status akun iklan Meta (iklan mati karena tagihan/dinonaktifkan/ditinjau) ── */}
        {acctAlert && (() => {
          const isErr = acctAlert.level === 'error';
          const AlertIcon = acctAlert.icon === 'card' ? CreditCard : AlertTriangle;
          return (
            <div className={`rg-error rgc-alert${isErr ? '' : ' is-warn'} rg-rise`} role="alert">
              <span className="rg-error-ico"><AlertIcon size={20} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="rgc-alert-title">
                  <span className="rg-error-title">{acctAlert.title}</span>
                  <span className={`rg-chip ${isErr ? 'is-neg' : 'is-warn'}`}>{isErr ? 'Ads down' : 'Needs attention'}</span>
                </div>
                <div className="rg-error-msg">{acctAlert.body}</div>
              </div>
              <a className="rg-btn" href="https://adsmanager.facebook.com/" target="_blank" rel="noopener noreferrer">
                Open Meta Ads Manager <ChevronRight size={14} />
              </a>
            </div>
          );
        })()}

        {initialLoading && <TableSkeleton />}

        {!loading && error && (
          <div className="rg-error" role="alert">
            <span className="rg-error-ico"><TriangleAlert size={20} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="rg-error-title">Meta Ads data couldn’t be loaded</div>
              <div className="rg-error-msg">{error}</div>
            </div>
            <button type="button" className="rg-pill" onClick={refresh}>
              <RefreshCw size={15} />Try again
            </button>
          </div>
        )}

        {data && !error && (
          <div className={`rg-card rg-rise rgc-card${loading ? ' rg-busy' : ''}`}>
            <div className="rg-head">
              <span className="rg-head-ico"><Megaphone size={15} /></span>
              <span className="rg-title">All campaigns</span>
              <span className="rg-meta rgc-meta">Grouped by objective · click a row for details</span>
            </div>
            <div className="rg-well rgc-well">
              <div className="rgc-scroll">
                <table className={`rg-table rgc-table${colDrag ? ' is-dragging' : ''}`}>
                  <thead>
                    <tr>
                      <th className="rgc-th-check" aria-label="Select" />
                      <th className="rgc-th-name" aria-sort={ariaSort('name')}
                        style={{ width: campW, minWidth: campW, maxWidth: campW }}>
                        {sortButton('name')}
                        {/* Handle drag batas kolom Campaign | Status */}
                        <div className={`rgc-colgrip${colDrag ? ' is-drag' : ''}`} onMouseDown={startColDrag}
                          title="Drag to resize the column" aria-hidden="true" />
                      </th>
                      <th className="rgc-th-left">Status</th>
                      {isAdmin && <th className="rgc-th-left">Actions</th>}
                      {NUM_COLS.map(k => <th key={k} aria-sort={ariaSort(k)}>{sortButton(k)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {campaignsWithData.length > 0
                      ? OBJ_ORDER.map(grp => {
                          const rows = mergedGrouped[grp];
                          if (!rows || !rows.length) return null;
                          return renderGroup(grp, rows);
                        })
                      : (
                        <tr className="rgc-empty-row"><td colSpan={totalCols}>
                          <div className="rg-empty">
                            <strong>No campaign data for {filterLabel()}</strong>
                            <span>Pick a wider date range to see campaigns that delivered.</span>
                          </div>
                        </td></tr>
                      )
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bar melayang: muncul saat ada campaign terpilih untuk dihitung gabungan */}
      {selectedCampaigns.length > 0 && !showCombine && (
        <div className="rg-float">
          <div className="rg-float-in">
            <span className="rgc-float-count"><b className="rg-num">{selectedCampaigns.length}</b> selected</span>
            <span className="rgc-float-sep" aria-hidden="true" />
            <span className="rg-num rgc-float-sum">Rp {Math.round(selectedSpend).toLocaleString('id-ID')}</span>
            <button type="button" className="rg-btn rg-btn-primary" onClick={() => setShowCombine(true)}>
              <Calculator size={14} /> Calculate Total
            </button>
            <button type="button" className="rg-iconbtn rgc-float-x" onClick={() => setSelectedIds([])}
              title="Clear selection" aria-label="Clear selection">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Popup hitung gabungan campaign terpilih */}
      {showCombine && selectedCampaigns.length > 0 && (
        <CombineModal
          campaigns={selectedCampaigns}
          periodLabel={filterLabel()}
          onClose={() => setShowCombine(false)}
        />
      )}

      {/* Popup konfirmasi aksi iklan (admin-only): stop/run + edit budget */}
      {actionModal && (() => {
        const isStatus = actionModal.type === 'status';
        const stopping = actionModal.nextStatus === 'PAUSED';
        return (
          <div className="rg-overlay" onClick={() => { if (!actionBusy) setActionModal(null); }}>
            <div className="rg-dialog" role="dialog" aria-modal="true" aria-labelledby="rgc-act-title"
              onClick={e => e.stopPropagation()}>
              <div className="rg-dialog-head">
                <span className={`rg-dialog-ico${isStatus ? (stopping ? ' is-neg' : ' is-pos') : ''}`}>
                  {isStatus ? (stopping ? <Pause size={16} /> : <Play size={16} />) : <Pencil size={15} />}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div id="rgc-act-title" className="rg-dialog-title">
                    {isStatus ? (stopping ? 'Stop this campaign?' : 'Run this campaign?') : 'Edit daily budget'}
                  </div>
                  <div className="rg-dialog-sub">
                    {isStatus ? 'Takes effect on Meta right away' : 'Set at campaign level on Meta'}
                  </div>
                </div>
              </div>

              <div className="rg-dialog-body">
                <strong className="rgc-dlg-name">{actionModal.campaign.name}</strong>
                {isStatus ? (
                  <p className="rgc-dlg-text">
                    {stopping
                      ? 'This campaign will stop delivering on Meta until you run it again.'
                      : 'This campaign will resume delivering on Meta and start spending its budget.'}
                  </p>
                ) : (<>
                  <div className="rgc-dlg-current">
                    Current budget: <span className="rg-num">Rp {actionModal.campaign.daily_budget ? parseInt(actionModal.campaign.daily_budget).toLocaleString('id-ID') : '—'}</span> / day
                  </div>
                  <label className="rg-input-affix">
                    <span className="rg-affix">Rp</span>
                    <input
                      autoFocus
                      inputMode="numeric"
                      className="rg-num"
                      aria-label="New daily budget in rupiah"
                      value={budgetInput ? parseInt(budgetInput).toLocaleString('id-ID') : ''}
                      onChange={e => setBudgetInput(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={e => { if (e.key === 'Enter') executeAction(); }}
                      placeholder="0"
                    />
                    <span className="rg-affix">/ day</span>
                  </label>
                  <div className="rgc-dlg-hint">Minimum Rp 10.000 per day.</div>
                </>)}

                {actionError && <div className="rg-dialog-err">{actionError}</div>}
              </div>

              <div className="rg-dialog-foot">
                <button type="button" className="rg-btn rg-btn-ghost" onClick={() => setActionModal(null)} disabled={actionBusy}>
                  Cancel
                </button>
                <button type="button"
                  className={`rg-btn ${isStatus ? (stopping ? 'rg-btn-danger' : 'rg-btn-success') : 'rg-btn-primary'}${actionBusy ? ' is-busy' : ''}`}
                  onClick={executeAction} disabled={actionBusy || budgetInvalid}>
                  {actionBusy && <RefreshCw size={13} style={{ animation: 'wdSpin 0.8s linear infinite' }} />}
                  {actionBusy
                    ? 'Processing…'
                    : isStatus
                      ? (stopping ? 'Yes, stop' : 'Yes, run')
                      : 'Save budget'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Toast sukses aksi iklan */}
      {toast && (
        <div className="rg-float rg-toast" role="status">
          <div className="rg-float-in">
            <Check size={15} strokeWidth={3} style={{ color: 'var(--rg-pos)' }} />
            {toast}
          </div>
        </div>
      )}

      {/* Popup detail campaign: konten iklan (kiri) + performa & platform (kanan) */}
      {selectedCampaign && (
        <CampaignModal
          campaign={selectedCampaign}
          query={isCustom && customSince && customUntil
            ? `since=${customSince}&until=${customUntil}`
            : `date_preset=${dateOpt.value}`}
          periodLabel={filterLabel()}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </div>
  );
}
