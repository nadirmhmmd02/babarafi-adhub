'use client';

import '../maps-ridgeline.css';
import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  MapPinned, RefreshCw, CloudDownload, Settings2, Search, X,
  CheckCircle2, AlertTriangle, Navigation, CircleOff, ExternalLink,
  Globe2, Database, Check, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../components/AuthContext';
import { authFetch } from '../supabase';
import ThemeToggle from '../components/ThemeToggle';
import CountUp from '../components/CountUp';
import MapView from '../components/MapView';
import useIsMobile from '../components/useIsMobile';
import { dashboardFontVars } from '../components/dashboardFonts';
import { RgMenu, RgDialog } from '../components/rgKit';
import {
  MAPS_STATUS, STATUS_LABEL, REVIEW_COLOR, statusColor,
  PROVINSI, UNMAPPED_PROVINSI,
} from '../components/mapsConfig';
/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ */
import PreviewPanel from '../components/PreviewPanel';
import { DEMO_ALLOWED, useDemoMode, DemoChip } from '../components/demoMode';
import { demoMapsCall } from '../components/demoMaps';
/* ═══ END PREVIEW-ONLY ═══ */

/* ─────────────────────────────────────────────────────────────
   MAPS HUB — halaman /maps (ADMIN-ONLY fase 1, lihat MAPS-HUB-PLAN.md).
   Monitoring status pendaftaran Google Maps 500+ outlet dari Google
   Sheets (read-only). AppShell sudah me-redirect role non-admin.

   Redesain "Ridgeline" (Sep 2026, PREVIEW LOKAL) — skin .rg + maps-ridgeline.css
   (prefix .rgm-). Atas→bawah: top bar → banner geocode (kalau ada kota kosong) →
   "Outlets by status" (5 sel = filter status) → toolbar filter (cari · Depo ·
   Province · City — berlaku untuk peta & tabel) → peta + panel Alerts/Data quality
   → tabel outlet. Logika data (sync, geocode, mark done, mapping provinsi) TIDAK
   berubah. Peta dasar = OpenStreetMap abu-abu (CARTO kini minta API key).
   ───────────────────────────────────────────────────────────── */

const FIELD_LABEL = { alamat: 'Address', ordinat_raw: 'Coordinates', nama_gmaps: 'Google Maps name' };

function relTime(iso) {
  if (!iso) return null;
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}
const fmtInt = (n) => (n || 0).toLocaleString('id-ID');
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

/* Chip status (tabel). Kuning memakai tinta lebih gelap untuk teks (kontras). */
function StatusChip({ status, coordBroken }) {
  const color = statusColor(status, coordBroken);
  const label = coordBroken ? 'Needs Review' : (STATUS_LABEL[status] || status || '—');
  const ink = !coordBroken && status === 'Belum di Daftarkan' ? 'var(--mp-unreg-ink)' : color;
  return (
    <span className="rg-chip rgm-chip" style={{ '--c': color, '--ct': ink }}>
      <span className="rg-chip-dot" />{label}
    </span>
  );
}

const ALERT_META = {
  relokasi:       { icon: Navigation,    color: 'var(--mp-claim)',  title: 'Relocated' },
  perubahan_info: { icon: AlertTriangle, color: 'var(--mp-unreg)',  title: 'Info changed' },
  hilang:         { icon: CircleOff,     color: 'var(--mp-review)', title: 'Missing from sheet' },
};

function alertDesc(a) {
  if (a.type === 'relokasi') return `Moved from "${a.detail?.dari || '?'}" — update the Google Maps listing.`;
  if (a.type === 'perubahan_info') {
    const fields = (a.detail?.changed || []).map(c => FIELD_LABEL[c.field] || c.field).join(', ');
    return `${fields || 'Data'} changed in the sheet — check the listing.`;
  }
  return 'No longer in the spreadsheet — check manually (closed? renamed without "Nama Lama"?).';
}

export default function MapsPage() {
  const { role, ready, theme } = useAuth();
  const isMobile = useIsMobile();

  /* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ (saklar Demo data bersama; saat nyala semua
     panggilan /api/maps dijawab demoMaps.js dari memori — Supabase & Google Sheets tidak
     disentuh. Saat dicabut: hapus blok ini, ganti `callApi(x)` kembali ke authFetch) */
  const demo = useDemoMode();
  /* ═══ END PREVIEW-ONLY ═══ */
  // Satu pintu ke /api/maps: body null = GET (daftar), selain itu POST {action,…}
  async function callApi(body) {
    if (demo) return demoMapsCall(body);   // PREVIEW-ONLY — JANGAN DI-PUSH (baris ini dibuang)
    const res = body
      ? await authFetch('/api/maps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await authFetch('/api/maps');
    return res.json();   // 504/timeout Vercel → bukan JSON → melempar (ditangkap pemanggil)
  }

  const [data, setData]         = useState(null);   // { outlets, alerts, depoProvinsi, lastSync }
  const [loading, setLoading]   = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [toast, setToast]       = useState(null);   // { kind:'ok'|'err', lines:[] }
  const [toastClosing, setToastClosing] = useState(false);

  const [fStatus, setFStatus] = useState('all');    // all | <status> | review
  const [fDepo, setFDepo]     = useState('all');
  const [fProv, setFProv]     = useState('all');
  const [fKota, setFKota]     = useState('all');
  const [search, setSearch]   = useState('');
  const [focus, setFocus]     = useState(null);
  const [panelTab, setPanelTab] = useState('alerts');

  const [showAllRows, setShowAllRows] = useState(false);
  const [showWilayah, setShowWilayah] = useState(false);
  const [expandedDepo, setExpandedDepo] = useState(null);

  const [geo, setGeo] = useState({ running: false, done: 0, total: 0 });
  const geoStop = useRef(false);
  const toastTimer = useRef(null);
  const mapCardRef = useRef(null);
  const [topbarSlot, setTopbarSlot] = useState(null);   // HP: tombol refresh di top bar MobileNav

  useEffect(() => { if (isMobile) setTopbarSlot(document.getElementById('wd-topbar-actions')); }, [isMobile]);

  /* ── Data ── */
  async function load() {
    try {
      const json = await callApi(null);
      if (json.needsSetup) { setNeedsSetup(true); setLoading(false); return; }
      if (json.error) throw new Error(json.error);
      setNeedsSetup(false);
      setData(json);
    } catch (e) {
      showToast('err', ['Failed to load: ' + e.message]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (ready && role === 'admin') { setLoading(true); load(); }
    return () => { geoStop.current = true; if (toastTimer.current) clearTimeout(toastTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, role, demo]);

  function showToast(kind, lines) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastClosing(false);
    setToast({ kind, lines });
    toastTimer.current = setTimeout(closeToast, 9000);
  }
  function closeToast() {
    setToastClosing(true);
    setTimeout(() => { setToast(null); setToastClosing(false); }, 200);
  }

  async function doSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const json = await callApi({ action: 'sync' });
      if (json.needsSetup) { setNeedsSetup(true); return; }
      if (json.error) throw new Error(json.error);
      const s = json.summary || {};
      const lines = [
        `${s.total ?? 0} outlets synced`,
        s.baru ? `${s.baru} new` : null,
        s.relokasi ? `${s.relokasi} relocated` : null,
        s.berubah ? `${s.berubah} info changed` : null,
        s.hilang ? `${s.hilang} missing from sheet` : null,
        (s.duplikat || []).length ? `${s.duplikat.length} duplicate names skipped` : null,
        s.dilewati ? `${s.dilewati} rows without name skipped` : null,
        s.needs_review ? `${s.needs_review} coordinates need review` : null,
      ].filter(Boolean);
      showToast('ok', lines);
      await load();
    } catch (e) {
      showToast('err', [e.message]);
    } finally {
      setSyncing(false);
    }
  }

  async function markDone(alert) {
    setData(d => ({ ...d, alerts: d.alerts.filter(a => a.id !== alert.id) })); // optimistik
    await callApi({ action: 'mark_done', alert_id: alert.id });
  }

  async function setProvinsi(depo, provinsi) {
    setExpandedDepo(null);
    setData(d => {
      const rest = (d.depoProvinsi || []).filter(m => m.depo !== depo);
      return { ...d, depoProvinsi: [...rest, { depo, provinsi }] };
    });
    await callApi({ action: 'set_provinsi', depo, provinsi });
  }

  async function startGeocode() {
    if (geo.running) return;
    geoStop.current = false;
    const total = pendingGeocode;
    setGeo({ running: true, done: 0, total });
    let done = 0;
    let fails = 0; // gangguan berturut-turut (timeout server / jaringan) — coba lagi, jangan langsung nyerah
    try {
      for (let i = 0; i < 200 && !geoStop.current; i++) {
        let json;
        try {
          json = await callApi({ action: 'geocode' }); // 504/timeout Vercel → bukan JSON → masuk catch
        } catch (e) {
          if (++fails >= 3) throw new Error('Server tidak merespons 3× berturut-turut.');
          continue;
        }
        if (json.error) throw new Error(json.error);
        done += json.processed || 0;
        // total akurat dari server (done + sisa), bukan tebakan awal
        setGeo({ running: true, done, total: done + (json.remaining || 0) });
        if (json.blocked) throw new Error('OpenStreetMap menolak permintaan sementara (rate limit). Tunggu 1–2 menit lalu klik "Geocode now" lagi.');
        if (!json.remaining) break;
        if (!json.processed) { if (++fails >= 3) throw new Error('Tidak ada kemajuan 3× berturut-turut.'); continue; }
        fails = 0;
      }
      showToast('ok', [`Geocoding done — ${done} outlets got a city name.`]);
    } catch (e) {
      showToast('err', ['Geocoding stopped: ' + e.message, `${done} processed this round — progress is saved, click "Geocode now" again to continue.`]);
    }
    setGeo({ running: false, done: 0, total: 0 });
    await load();
  }

  /* Klik baris tabel → peta terbang ke outlet; kartu peta digulir ke layar dulu
     (kalau pengguna sedang di bawah, di tabel, peta tidak kelihatan). */
  function focusOutlet(o) {
    if (o.lat == null || o.missing_since) return;
    mapCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setFocus({ ...o, _t: Date.now() });
  }

  /* ── Derivasi ── */
  const outlets = data?.outlets || [];
  const alerts  = data?.alerts || [];
  const lastSync = data?.lastSync || null;

  const provMap = useMemo(() =>
    new Map((data?.depoProvinsi || []).map(m => [m.depo, m.provinsi])), [data]);

  const enriched = useMemo(() => outlets.map(o => ({
    ...o,
    provinsi: (o.depo && provMap.get(o.depo)) || UNMAPPED_PROVINSI,
  })), [outlets, provMap]);

  const counts = useMemo(() => {
    const c = { total: enriched.length, review: 0 };
    for (const s of MAPS_STATUS) c[s.value] = 0;
    for (const o of enriched) {
      if (o.coord_error) c.review++;
      if (c[o.status] !== undefined) c[o.status]++;
    }
    return c;
  }, [enriched]);

  const depoOptions = useMemo(() => {
    const set = [...new Set(enriched.map(o => o.depo).filter(Boolean))].sort();
    return [{ value: 'all', label: 'All depos' }, ...set.map(d => ({ value: d, label: d }))];
  }, [enriched]);

  const provOptions = useMemo(() => {
    const set = [...new Set(enriched.map(o => o.provinsi))].sort();
    return [{ value: 'all', label: 'All provinces' }, ...set.map(p => ({ value: p, label: p }))];
  }, [enriched]);

  const kotaOptions = useMemo(() => {
    const set = [...new Set(enriched.map(o => o.kota).filter(k => k && k !== '-'))].sort();
    return [{ value: 'all', label: 'All cities' }, ...set.map(k => ({ value: k, label: k }))];
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter(o => {
      if (fStatus === 'review') { if (!o.coord_error) return false; }
      else if (fStatus !== 'all' && o.status !== fStatus) return false;
      if (fDepo !== 'all' && o.depo !== fDepo) return false;
      if (fProv !== 'all' && o.provinsi !== fProv) return false;
      if (fKota !== 'all' && o.kota !== fKota) return false;
      if (q) {
        const hay = `${o.nama} ${o.alamat || ''} ${o.nama_gmaps || ''} ${o.depo || ''} ${o.kota || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, fStatus, fDepo, fProv, fKota, search]);

  const mapOutlets = useMemo(() =>
    filtered.filter(o => o.lat != null && o.lng != null && !o.missing_since), [filtered]);

  /* Render tabel dibatasi 100 baris (klik "Show all" utk sisanya) — ~490 baris
     sekaligus bikin animasi sidebar patah-patah (paint tiap frame terlalu berat).
     Search/filter tetap bekerja atas SEMUA data. */
  const ROWS_CAP = 100;
  const visibleRows = useMemo(() =>
    showAllRows ? filtered : filtered.slice(0, ROWS_CAP), [filtered, showAllRows]);

  const pendingGeocode = useMemo(() =>
    outlets.filter(o => o.lat != null && o.kota == null).length, [outlets]);

  const unmappedDepos = useMemo(() => {
    const all = [...new Set(outlets.map(o => o.depo).filter(Boolean))];
    return all.filter(d => !provMap.get(d)).sort();
  }, [outlets, provMap]);

  const allDepos = useMemo(() => {
    const countByDepo = {};
    outlets.forEach(o => { if (o.depo) countByDepo[o.depo] = (countByDepo[o.depo] || 0) + 1; });
    const names = Object.keys(countByDepo).sort();
    // Yang belum dipetakan tampil paling atas
    return [
      ...names.filter(d => !provMap.get(d)),
      ...names.filter(d => provMap.get(d)),
    ].map(d => ({ depo: d, n: countByDepo[d], provinsi: provMap.get(d) || null }));
  }, [outlets, provMap]);

  const quality = useMemo(() => {
    const s = lastSync?.summary || {};
    return {
      duplicates: s.duplikat || [],
      skipped: s.dilewati || 0,
      coordErr: enriched.filter(o => o.coord_error),
      emptyDepo: enriched.filter(o => !o.depo),
    };
  }, [lastSync, enriched]);

  const qualityCount = quality.duplicates.length + quality.coordErr.length + quality.emptyDepo.length + (quality.skipped ? 1 : 0);
  const filterActive = fStatus !== 'all' || fDepo !== 'all' || fProv !== 'all' || fKota !== 'all' || search.trim();

  function resetFilters() {
    setFStatus('all'); setFDepo('all'); setFProv('all'); setFKota('all'); setSearch('');
  }

  if (!ready || role !== 'admin') return null;

  const rootCls = `rg rg-page rgm ${dashboardFontVars}${isMobile ? ' is-mobile' : ''}`;
  const refreshBtn = (
    <button type="button" className="rg-pill rg-round" title="Refresh data" aria-label="Refresh data"
      onClick={() => { setLoading(true); load(); }} disabled={loading}>
      <RefreshCw size={15} style={loading ? { animation: 'wdSpin 0.8s linear infinite' } : undefined} />
    </button>
  );

  /* ── Setup hint (tabel Supabase belum dibuat) ── */
  if (needsSetup) {
    return (
      <div className={rootCls}>
        <div className="rg-body" style={{ justifyContent: 'center', alignItems: 'center', paddingTop: 16 }}>
          <section className="rg-card rg-rise" style={{ width: 'min(480px, 100%)' }}>
            <div className="rg-well">
              <div className="rg-empty" style={{ padding: '30px 26px' }}>
                <span className="rgm-ok-ico" style={{ background: 'var(--rg-hover)', color: 'var(--rg-t1)' }}><Database size={20} /></span>
                <strong>Maps Hub is not set up yet</strong>
                <span style={{ lineHeight: 1.6 }}>
                  Jalankan file <b>supabase-maps-setup.sql</b> (ada di folder project) di Supabase → <b>SQL Editor</b> →
                  New query → paste → Run. Cukup sekali saja, lalu klik tombol di bawah.
                </span>
                <button type="button" className="rg-btn rg-btn-primary" style={{ marginTop: 12 }}
                  onClick={() => { setLoading(true); load(); }}>I&apos;ve run it — check again</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const initialLoading = loading && !data;
  const ctxLine = initialLoading
    ? <span>Loading outlets…</span>
    : (<>
        <span className="rg-live" aria-hidden="true" />
        <span>Maps Hub</span>
        <span className="rg-ctx-sep" aria-hidden="true" />
        <span>{outlets.length ? `${fmtInt(outlets.length)} outlets` : 'No data yet'}</span>
        {!isMobile && (<>
          <span className="rg-ctx-sep" aria-hidden="true" />
          <span>Google Sheets (read-only)</span>
        </>)}
        <span className="rg-ctx-sep" aria-hidden="true" />
        <span>{syncing ? 'Syncing…' : lastSync ? `Last sync ${relTime(lastSync.run_at)}` : 'Never synced'}</span>
      </>);

  /* Sel "Outlets by status" — klik = filter peta & tabel, klik lagi = hapus filter */
  const statusCells = [
    { key: 'all', label: 'Total outlets', n: counts.total, note: `${fmtInt(mapOutlets.length)} shown on the map`, dot: 'var(--rg-t2)' },
    ...MAPS_STATUS.map(s => ({ key: s.value, label: s.label, n: counts[s.value] || 0, note: `${pct(counts[s.value] || 0, counts.total)}% of outlets`, dot: s.color })),
    { key: 'review', label: 'Needs review', n: counts.review, note: counts.review ? 'Coordinates to fix' : 'All coordinates OK', dot: REVIEW_COLOR },
  ];

  return (
    <div className={rootCls}>

      {/* ══ TOP BAR — judul + konteks (kiri) · aksi (kanan) ══ */}
      <header className="rg-top">
        <div className="rg-top-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="rg-h1">Outlet Maps</h1>
            {/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ */}
            {demo && <DemoChip />}
            {/* ═══ END PREVIEW-ONLY ═══ */}
          </div>
          <div className="rg-ctx">{ctxLine}</div>
        </div>

        <div className="rg-tools">
          {/* Wilayah (mapping Depo → Provinsi) — badge = depo belum dipetakan */}
          <button type="button" className="rg-pill rg-round" onClick={() => setShowWilayah(true)}
            title={unmappedDepos.length ? `Depo → Province mapping · ${unmappedDepos.length} not mapped yet` : 'Depo → Province mapping'}
            aria-label="Depo to province mapping">
            <Settings2 size={15} />
            {unmappedDepos.length > 0 && <span className="rgm-badge rg-mono">{unmappedDepos.length}</span>}
          </button>
          <button type="button" className="rg-pill is-primary" onClick={doSync} disabled={syncing}
            title="Pull the latest data from Google Sheets">
            <CloudDownload size={15} style={syncing ? { animation: 'wdSpin 1s linear infinite' } : undefined} />
            {syncing ? 'Syncing…' : 'Sync sheet'}
          </button>
          {!isMobile && (<>
            <span className="rg-vsep" aria-hidden="true" />
            {refreshBtn}
            <ThemeToggle className="rg-pill rg-round" />
          </>)}
          {isMobile && topbarSlot && createPortal(refreshBtn, topbarSlot)}
        </div>
      </header>

      {/* ══ ISI ══ */}
      <div className="rg-body">

        {/* ── Banner geocode kota ── */}
        {pendingGeocode > 0 && (
          <div className="rgm-banner rg-rise" role="status">
            <Globe2 size={18} />
            {geo.running ? (<>
              <div className="rgm-banner-main">
                <div>
                  Geocoding cities… <span className="rg-mono">{geo.done}</span> of <span className="rg-mono">{geo.total}</span>
                  <span className="rgm-banner-sub"> — ±3 seconds per outlet (OpenStreetMap rate limit). Leave this tab open; progress is saved if you stop.</span>
                </div>
                <div className="rgm-progress"><i style={{ transform: `scaleX(${geo.total ? geo.done / geo.total : 0})` }} /></div>
              </div>
              <button type="button" className="rg-btn" onClick={() => { geoStop.current = true; }}>Stop</button>
            </>) : (<>
              <div className="rgm-banner-main">
                <span className="rg-mono">{pendingGeocode}</span> {pendingGeocode > 1 ? 'outlets don’t' : 'outlet doesn’t'} have a city name yet
                <span className="rgm-banner-sub"> — needed for the City filter (one-time, cached).</span>
              </div>
              <button type="button" className="rg-btn rg-btn-primary" onClick={startGeocode}>Geocode now</button>
            </>)}
          </div>
        )}

        {/* ── Outlets by status (klik = filter) ── */}
        <section className="rg-card rg-rise" aria-label="Outlets by status">
          <div className="rg-head">
            <span className="rg-head-ico"><MapPinned size={15} /></span>
            <span className="rg-title">Outlets by status</span>
            {!isMobile && <span className="rg-meta">Click a status to filter the map and table</span>}
          </div>
          <div className="rg-well">
            <div className="rgm-status">
              {statusCells.map((c, i) => {
                const on = fStatus === c.key;
                return (
                  <button key={c.key} type="button" className="rgm-st" aria-pressed={on}
                    onClick={() => setFStatus(on || c.key === 'all' ? 'all' : c.key)}
                    title={c.key === 'all' ? 'Show all outlets' : on ? 'Click to clear filter' : `Show ${c.label.toLowerCase()} only`}>
                    <span className="rgm-st-name">
                      <span className="rgm-dot" style={{ background: c.dot }} />
                      <span>{c.label}</span>
                      {on && c.key !== 'all' && <span className="rgm-st-on">Filtering</span>}
                    </span>
                    <span className="rgm-st-num rg-mono">
                      {initialLoading ? '—' : <CountUp value={c.n} display={fmtInt(c.n)} duration={700} delay={100 + i * 40} />}
                    </span>
                    <span className="rgm-st-pct">{initialLoading ? ' ' : c.note}</span>
                    <span className="rgm-bar" aria-hidden="true">
                      {c.key === 'all'
                        ? MAPS_STATUS.map(s => (
                            <i key={s.value} style={{ width: `${pct(counts[s.value] || 0, counts.total)}%`, background: s.color }} />
                          ))
                        : <i style={{ width: `${c.key === 'review' ? Math.max(pct(c.n, counts.total), c.n ? 2 : 0) : pct(c.n, counts.total)}%`, background: c.dot }} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Toolbar filter (peta & tabel) ── */}
        <div className="rgm-bar-row">
          <label className="rgm-search">
            <Search size={15} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search outlet, address, city…" aria-label="Search outlets" />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={13} /></button>}
          </label>
          <RgMenu className={`rg-pill rgm-filter${fDepo !== 'all' ? ' is-set' : ''}`} label={fDepo === 'all' ? 'All depos' : fDepo}
            options={depoOptions} value={fDepo} onSelect={setFDepo} minWidth={200} title="Filter by depo" />
          <RgMenu className={`rg-pill rgm-filter${fProv !== 'all' ? ' is-set' : ''}`} label={fProv === 'all' ? 'All provinces' : fProv}
            options={provOptions} value={fProv} onSelect={setFProv} minWidth={210} title="Filter by province" />
          <RgMenu className={`rg-pill rgm-filter${fKota !== 'all' ? ' is-set' : ''}`} label={fKota === 'all' ? 'All cities' : fKota}
            options={kotaOptions} value={fKota} onSelect={setFKota} minWidth={210} align={isMobile ? 'right' : 'left'} title="Filter by city" />
          {filterActive && (
            <button type="button" className="rg-btn rg-btn-ghost" onClick={resetFilters}><X size={14} />Reset</button>
          )}
          <span className="rgm-count"><span className="rg-mono">{fmtInt(filtered.length)}</span> of <span className="rg-mono">{fmtInt(enriched.length)}</span> outlets</span>
        </div>

        {/* ── PETA + PANEL ── */}
        <div className="rgm-row">
          <section ref={mapCardRef} className="rg-card rgm-map-card rg-rise" style={{ animationDelay: '40ms' }} aria-label="Map">
            <div className="rg-head">
              <span className="rg-head-ico"><Globe2 size={15} /></span>
              <span className="rg-title">Map</span>
              <span className="rgm-onmap"><span className="rg-mono">{fmtInt(mapOutlets.length)}</span> on map</span>
              <span className="rgm-legend" aria-hidden="true">
                {MAPS_STATUS.map(s => <span key={s.value}><span className="rgm-dot" style={{ background: s.color }} />{s.label}</span>)}
              </span>
            </div>
            <div className="rg-well rgm-map-well">
              {outlets.length === 0 && !loading ? (
                <div className="rg-empty rgm-empty-map">
                  <span className="rgm-ok-ico" style={{ background: 'var(--rg-hover)', color: 'var(--rg-t2)' }}><MapPinned size={20} /></span>
                  <strong>No outlets yet</strong>
                  <span style={{ maxWidth: 320, lineHeight: 1.55 }}>Click <b>Sync sheet</b> to pull all outlets from Google Sheets — the map, filters and alerts fill in automatically.</span>
                </div>
              ) : (
                <MapView outlets={mapOutlets} theme={theme} focus={focus} />
              )}
            </div>
          </section>

          {/* Panel Alerts / Data quality */}
          <section className="rg-card rgm-panel rg-rise" style={{ animationDelay: '80ms' }} aria-label="Alerts and data quality">
            <div className="rg-head">
              <div className="rg-segs is-block" role="tablist" aria-label="Panel">
                {[
                  { key: 'alerts', label: 'Alerts', n: alerts.length },
                  { key: 'quality', label: 'Data quality', n: qualityCount },
                ].map(t => (
                  <button key={t.key} type="button" role="tab" aria-selected={panelTab === t.key} aria-pressed={panelTab === t.key}
                    onClick={() => setPanelTab(t.key)}>
                    {t.label}
                    {t.n > 0 && <span className="rgm-seg-n rg-mono">{t.n}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="rg-well rgm-panel-well">
              {panelTab === 'alerts' ? (<>
                {/* Kerjaan dari status (hilang sendiri saat sheet diubah) */}
                {(counts['Belum di Daftarkan'] > 0 || counts['Perlu Klaim Bisnis'] > 0) && (
                  <div className="rgm-todo">
                    {counts['Belum di Daftarkan'] > 0 && (
                      <button type="button" className="rg-chip is-warn" onClick={() => setFStatus('Belum di Daftarkan')} title="Show outlets to register">
                        <span className="rg-chip-dot" /><span className="rg-mono">{counts['Belum di Daftarkan']}</span> to register
                      </button>
                    )}
                    {counts['Perlu Klaim Bisnis'] > 0 && (
                      <button type="button" className="rg-chip is-info" onClick={() => setFStatus('Perlu Klaim Bisnis')} title="Show outlets to claim">
                        <span className="rg-chip-dot" /><span className="rg-mono">{counts['Perlu Klaim Bisnis']}</span> to claim
                      </button>
                    )}
                  </div>
                )}
                {alerts.length === 0 ? (
                  <div className="rg-empty" style={{ padding: '28px 12px' }}>
                    <span className="rgm-ok-ico"><CheckCircle2 size={20} /></span>
                    <strong>All clear</strong>
                    <span>Changes detected on the next sync will show up here.</span>
                  </div>
                ) : alerts.map((a, i) => {
                  const meta = ALERT_META[a.type] || ALERT_META.perubahan_info;
                  const AIcon = meta.icon;
                  return (
                    <div key={a.id} className="rgm-alert" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                      <span className="rgm-alert-ico" style={{ '--c': meta.color }}><AIcon size={14} /></span>
                      <div className="rgm-alert-main">
                        <div className="rgm-alert-name">{a.outlet_nama}</div>
                        <div className="rgm-alert-desc">{alertDesc(a)}</div>
                        <div className="rgm-alert-meta">{meta.title} · {relTime(a.created_at)}</div>
                      </div>
                      <button type="button" className="rg-iconbtn is-pos" title="Mark as done" aria-label={`Mark "${a.outlet_nama}" as done`}
                        onClick={() => markDone(a)}><Check size={14} /></button>
                    </div>
                  );
                })}
              </>) : (
                qualityCount === 0 ? (
                  <div className="rg-empty" style={{ padding: '28px 12px' }}>
                    <span className="rgm-ok-ico"><CheckCircle2 size={20} /></span>
                    <strong>Spreadsheet is clean</strong>
                    <span>Duplicate names, broken coordinates and skipped rows will show up here after a sync.</span>
                  </div>
                ) : (<>
                  {quality.duplicates.length > 0 && (
                    <QualitySection title="Duplicate outlet names" n={quality.duplicates.length}
                      hint="These rows are NOT processed until fixed in the sheet — rename or remove the doubles.">
                      {quality.duplicates.map(n => <div key={n}>{n}</div>)}
                    </QualitySection>
                  )}
                  {quality.coordErr.length > 0 && (
                    <QualitySection title="Coordinate issues" n={quality.coordErr.length}
                      hint="Fix the Titik Ordinat cell in the sheet — these outlets can't be shown on the map.">
                      {quality.coordErr.map(o => <div key={o.id}>{o.nama} <span>— {o.coord_error}</span></div>)}
                    </QualitySection>
                  )}
                  {quality.emptyDepo.length > 0 && (
                    <QualitySection title="Missing depo" n={quality.emptyDepo.length} hint="Depo cell is empty in the sheet.">
                      {quality.emptyDepo.map(o => <div key={o.id}>{o.nama}</div>)}
                    </QualitySection>
                  )}
                  {quality.skipped > 0 && (
                    <QualitySection title="Rows skipped" n={quality.skipped}
                      hint='Rows without "Nama Outlet" (parked data) — they are ignored by sync.' />
                  )}
                </>)
              )}
            </div>
          </section>
        </div>

        {/* ── TABEL OUTLET ── */}
        <section className="rg-card rgm-table-card rg-rise" style={{ animationDelay: '120ms' }} aria-label="Outlets">
          <div className="rg-head">
            <span className="rg-head-ico"><Database size={15} /></span>
            <span className="rg-title">Outlets</span>
            <span className="rg-meta">Click a row to find it on the map</span>
          </div>
          <div className={`rg-well rgm-table-well${loading && data ? ' rg-busy' : ''}`}>
            <div className="rgm-scroll">
              <table className="rg-table rgm-table">
                <colgroup>
                  <col />{/* Outlet = sisa lebar */}
                  <col style={{ width: 130 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 64 }} />
                  <col style={{ width: 190 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Outlet</th>
                    <th>Depo</th>
                    <th>Province</th>
                    <th>City</th>
                    <th>Status</th>
                    <th className="is-c">Maps</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {initialLoading ? (
                    [0, 1, 2, 3, 4].map(i => (
                      <tr key={i}>{[70, 60, 70, 60, 64, 30, 70].map((w, j) => <td key={j}><span className="rg-skel" style={{ height: 12, width: `${w}%` }} /></td>)}</tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ height: 'auto' }}>
                        <div className="rg-empty" style={{ padding: '32px 16px' }}>
                          <strong>{enriched.length === 0 ? 'No data yet' : 'No outlets match your filters'}</strong>
                          <span>{enriched.length === 0 ? 'Click Sync sheet to pull outlets from Google Sheets.' : 'Try another status, depo or city.'}</span>
                          {filterActive && <button type="button" className="rg-btn" style={{ marginTop: 8 }} onClick={resetFilters}>Reset filters</button>}
                        </div>
                      </td>
                    </tr>
                  ) : visibleRows.map((o, i) => {
                    const canGo = o.lat != null && !o.missing_since;
                    const flag = o.catatan && o.catatan.toLowerCase() !== 'clear';
                    return (
                      <tr key={o.id}
                        className={`rgm-tr${canGo ? ' is-go' : ''}${o.missing_since ? ' is-missing' : ''}${i < 25 ? ' is-anim' : ''}`}
                        style={i < 25 ? { animationDelay: `${i * 18}ms` } : undefined}
                        onClick={() => focusOutlet(o)}
                        title={canGo ? 'Show on map' : o.missing_since ? 'Missing from the sheet' : 'No valid coordinates'}
                      >
                        <td>
                          <div className="rgm-name">
                            <span title={o.nama}>{o.nama}</span>
                            {o.missing_since && <span className="rgm-missing">Missing</span>}
                          </div>
                          {o.nama_gmaps && <div className="rgm-sub" title={o.nama_gmaps}>{o.nama_gmaps}</div>}
                        </td>
                        <td><span className={`rgm-cell${o.depo ? '' : ' is-dim'}`}>{o.depo || '-'}</span></td>
                        <td><span className={`rgm-cell${o.provinsi === UNMAPPED_PROVINSI ? ' is-dim' : ''}`} title={o.provinsi === UNMAPPED_PROVINSI ? 'Depo not mapped to a province yet' : undefined}>{o.provinsi === UNMAPPED_PROVINSI ? '—' : o.provinsi}</span></td>
                        <td><span className={`rgm-cell${o.kota && o.kota !== '-' ? '' : ' is-dim'}`}>{o.kota && o.kota !== '-' ? o.kota : '-'}</span></td>
                        <td><StatusChip status={o.status} coordBroken={!!o.coord_error} /></td>
                        <td className="is-c">
                          {o.link_gmaps ? (
                            <a href={o.link_gmaps} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                              className="rg-iconbtn rgm-link" title="Open Google Maps listing" aria-label={`Open ${o.nama} in Google Maps`}>
                              <ExternalLink size={13} />
                            </a>
                          ) : <span className="rgm-cell is-dim">-</span>}
                        </td>
                        <td><span className={`rgm-note${flag ? ' is-flag' : ''}`} title={o.catatan || ''}>{o.catatan || '-'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rg-foot">
            <span>Showing <span className="rg-mono">{fmtInt(visibleRows.length)}</span> of <span className="rg-mono">{fmtInt(filtered.length)}</span></span>
            {filtered.length > visibleRows.length && (
              <button type="button" className="rg-btn rgm-foot-btn" onClick={() => setShowAllRows(true)}>
                Show all {fmtInt(filtered.length)} outlets
              </button>
            )}
          </div>
        </section>
      </div>

      {/* ══ DIALOG Depo → Province (chip provinsi, bukan dropdown — anti terpotong di area scroll) ══ */}
      {showWilayah && (
        <RgDialog
          icon={Settings2}
          title="Depo → Province"
          sub={unmappedDepos.length ? `${unmappedDepos.length} depo${unmappedDepos.length > 1 ? 's' : ''} not mapped yet` : 'All depos are mapped'}
          onClose={() => { setShowWilayah(false); setExpandedDepo(null); }}
          width={580}
        >
          <p className="rgm-dlg-note">New depos from the sheet appear here automatically after each sync. Pick a province once — the Province filter uses it.</p>
          {allDepos.length === 0 ? (
            <div className="rg-empty" style={{ padding: 24 }}><span>No depos yet — run a sync first.</span></div>
          ) : allDepos.map(d => {
            const open = expandedDepo === d.depo;
            return (
              <div key={d.depo} className="rgm-depo">
                <button type="button" className="rgm-depo-btn" aria-expanded={open} onClick={() => setExpandedDepo(open ? null : d.depo)}>
                  <span className="rgm-dot" style={{ background: d.provinsi ? 'var(--mp-reg)' : 'var(--mp-unreg)' }} />
                  <span className="rgm-depo-name">{d.depo} <span>· {d.n} outlet{d.n > 1 ? 's' : ''}</span></span>
                  <span className={`rgm-depo-prov${d.provinsi ? '' : ' is-missing'}`}>{d.provinsi || 'Pick a province'}</span>
                  {open ? <ChevronDown size={14} color="var(--rg-t3)" /> : <ChevronRight size={14} color="var(--rg-t3)" />}
                </button>
                {open && (
                  <div className="rgm-provs">
                    {PROVINSI.map(p => (
                      <button key={p} type="button" className={`rgm-prov${p === d.provinsi ? ' is-on' : ''}`} aria-pressed={p === d.provinsi}
                        onClick={() => setProvinsi(d.depo, p)}>{p}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </RgDialog>
      )}

      {/* ══ TOAST hasil sync / geocode ══ */}
      {toast && (
        <div className="rgm-toast-pos" role="status">
          <div className={`rgm-toast${toastClosing ? ' is-out' : ''}`}>
            <div className="rgm-toast-head">
              {toast.kind === 'ok'
                ? <CheckCircle2 size={16} color="var(--rg-pos)" />
                : <AlertTriangle size={16} color="var(--rg-neg)" />}
              <span>{toast.kind === 'ok' ? toast.lines[0] : 'Something went wrong'}</span>
              <button type="button" className="rg-iconbtn" onClick={closeToast} aria-label="Close"><X size={13} /></button>
            </div>
            {(toast.kind === 'ok' ? toast.lines.slice(1) : toast.lines).length > 0 && (
              <div className="rgm-toast-body">
                {(toast.kind === 'ok' ? toast.lines.slice(1) : toast.lines).map((l, i) => <div key={i}>• {l}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ */}
      {DEMO_ALLOWED && !isMobile && !toast && (
        <PreviewPanel note="Also applies here. Made-up outlets across 25 depos — Sync, Mark as done, province mapping and geocoding only change this browser." />
      )}
      {/* ═══ END PREVIEW-ONLY ═══ */}
    </div>
  );
}

/* Bagian di panel Data quality */
function QualitySection({ title, n, hint, children }) {
  return (
    <div className="rgm-q">
      <div className="rgm-q-title">{title}<span className="rgm-seg-n rg-mono">{n}</span></div>
      {hint && <div className="rgm-q-hint">{hint}</div>}
      {children && <div className="rgm-q-list">{children}</div>}
    </div>
  );
}
