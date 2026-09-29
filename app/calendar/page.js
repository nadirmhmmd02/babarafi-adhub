'use client';

/* ══ CALENDAR — redesain "Ridgeline" (LIVE 28 Sep 2026) ═════════════
   Nuansa sama dengan Dashboard: top bar judul + konteks | navigasi bulan & aksi,
   Gantt di kartu cangkang + panel dalam, angka Geist Mono, warna objektif =
   entitas dashboard (Awareness ungu · Traffic oranye · Conversion teal),
   pilihan/aktif netral. Skin: app/ridgeline.css + app/calendar-ridgeline.css.
   LOGIKA (Supabase `campaigns`, urutan objektif→tanggal mulai, budget per bulan,
   ganti status optimistik, lebar kolom + auto-fit, autocomplete Ad Content) TIDAK
   diubah. Baru: Objective/Status di form = segmen (bukan <select> bawaan),
   konfirmasi hapus = dialog bergaya (bukan confirm() browser), Esc menutup popup.
   ══════════════════════════════════════════════════════════════════════════ */

import '../calendar-ridgeline.css';
import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, Pencil, Trash2, Check,
  CalendarRange, CalendarClock, Wallet, TriangleAlert, RefreshCw,
} from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../components/AuthContext';
import useIsMobile from '../components/useIsMobile';
import { dashboardFontVars } from '../components/dashboardFonts';
import { MenuGlide } from '../components/rgKit';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const OBJ_ORDER = ['Awareness','Traffic','Conversion'];
// Warna objektif = entitas yang sama dengan Dashboard (donut, grafik, Top Campaigns)
const OBJ_VAR = { Awareness: 'var(--rg-aware)', Traffic: 'var(--rg-traffic)', Conversion: 'var(--rg-conv)' };

function daysInMonth(y,m){ return new Date(y,m+1,0).getDate() }
// "YYYY-MM-DD" WAJIB di-parse sebagai tanggal LOKAL. new Date("2026-07-15") dibaca UTC —
// di WIB (UTC+7) itu berarti jam 07:00, sehingga perbandingan tengah-malam lokal meleset 1 hari.
function parseLocal(v){ if(!v)return null; const [y,m,d]=String(v).slice(0,10).split('-').map(Number); return new Date(y,m-1,d) }
function isActive(c,y,m,d){ if(!c.mulai||!c.selesai)return false; const s=parseLocal(c.mulai),e=parseLocal(c.selesai),cur=new Date(y,m,d); return cur>=s&&cur<=e }
function hasActivity(c,y,m){ if(!c.mulai||!c.selesai)return false; const s=parseLocal(c.mulai),e=parseLocal(c.selesai),ms=new Date(y,m,1),me=new Date(y,m+1,0); return s<=me&&e>=ms }
function budgetForMonth(c,y,m){ const days=daysInMonth(y,m); let t=0; for(let d=1;d<=days;d++){ if(isActive(c,y,m,d))t++ } return t*(c.bh||0) }
// Angka penuh gaya Indonesia (sama dengan Dashboard): Rp 1.440.000
function fmtRp(v){ if(!v)return'—'; return 'Rp '+Math.round(v).toLocaleString('id-ID') }
function fmtDay(v){ return v ? parseLocal(v).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '—' }

const STATUSES = ['Draft','Running','Done'];
// Status = chip netral (Draft), hijau (Running), redup (Done) — ikon lucide, bukan emoji
const STATUS_TONE = { Draft: '', Running: 'is-pos', Done: 'is-muted' };
function StatusIcon({ s, size = 11 }) {
  if (s === 'Running') return <span className="rg-chip-dot" />;
  if (s === 'Done') return <Check size={size} strokeWidth={3} />;
  return <Pencil size={size - 1} strokeWidth={2.4} />;
}

const emptyForm = { name:'', obj:'Awareness', konten:'', bh:'', mulai:'', selesai:'', status:'Draft' };

export default function CalendarPage() {
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const now = new Date();
  const [year, setYear]         = useState(now.getFullYear());
  const [month, setMonth]       = useState(now.getMonth());
  const [showModal, setShowModal]       = useState(false);
  const [campaigns, setCampaigns]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [form, setForm]                 = useState(emptyForm);
  const [editId, setEditId]             = useState(null);
  const [saving, setSaving]             = useState(false);
  const [tableKey, setTableKey]         = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [confirmDel, setConfirmDel]     = useState(null); // campaign yang mau dihapus
  // Dropdown ganti status langsung dari tabel (admin) — posisi fixed dari rect pill
  const [statusDrop, setStatusDrop]     = useState(null); // { id, x, y }

  // Lebar kolom Campaign — drag di batas Campaign|Objective (pola sama dgn halaman Campaigns),
  // double-click handle = auto-fit ke nama campaign terpanjang (seperti Excel). Desktop only.
  const CAMP_MIN = 120, CAMP_MAX = 620, CAMP_DEFAULT = 220;
  const [campW, setCampW]       = useState(CAMP_DEFAULT);
  const [colDrag, setColDrag]   = useState(false);
  const colDragX = useRef(0);
  const colDragW = useRef(CAMP_DEFAULT);

  useEffect(() => {
    const saved = parseInt(localStorage.getItem('wd-cal-camp-w'), 10);
    if (saved >= CAMP_MIN && saved <= CAMP_MAX) setCampW(saved);
  }, []);

  function saveCampW(w) {
    setCampW(w);
    try { localStorage.setItem('wd-cal-camp-w', String(w)); } catch {}
  }

  function startColDrag(e) {
    e.preventDefault();
    colDragX.current = e.clientX;
    colDragW.current = campW;
    setColDrag(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const clamp = (x) => Math.max(CAMP_MIN, Math.min(CAMP_MAX, colDragW.current + (x - colDragX.current)));
    const move = (ev) => setCampW(clamp(ev.clientX));
    const up = (ev) => {
      saveCampW(clamp(ev.clientX));
      setColDrag(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  function autoFitCampW() {
    // Ukur dengan font sel nama yang sebenarnya (Geist) supaya hasil auto-fit pas
    const cell = document.querySelector('.rgk-td-name');
    const cs = cell ? getComputedStyle(cell) : getComputedStyle(document.body);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    let max = 0;
    sorted.forEach(c => { max = Math.max(max, ctx.measureText(c.name || '').width); });
    const pad = cell ? parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) : 24;
    // + padding sel kiri-kanan + buffer kecil biar tidak kepotong ellipsis
    saveCampW(Math.max(CAMP_MIN, Math.min(CAMP_MAX, Math.ceil(max) + pad + 6)));
  }

  const today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const days  = daysInMonth(year, month);
  // Urutan tabel: grup objektif dulu, lalu tanggal mulai TERCEPAT di atas
  // (semua baris di sini pasti punya mulai+selesai karena lolos hasActivity).
  const sorted = [...campaigns]
    .filter(c => hasActivity(c, year, month))
    .sort((a,b) =>
      (OBJ_ORDER.indexOf(a.obj) - OBJ_ORDER.indexOf(b.obj)) ||
      (parseLocal(a.mulai) - parseLocal(b.mulai)));

  useEffect(() => { loadCampaigns(); }, []);

  async function loadCampaigns() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.from('campaigns').select('*').order('created_at', { ascending: true });
    if (err) setError(err.message);
    else setCampaigns(data || []);
    setLoading(false);
  }

  function prevMonth() {
    setTableKey(k => k+1);
    if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1);
  }
  function nextMonth() {
    setTableKey(k => k+1);
    if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1);
  }

  function openAdd()  { setForm(emptyForm); setEditId(null); setShowModal(true); }
  function openEdit(c) {
    setForm({ name:c.name, obj:c.obj, konten:c.konten||'', bh:c.bh||'', mulai:c.mulai||'', selesai:c.selesai||'', status:c.status });
    setEditId(c.id); setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || saving) return;
    setSaving(true);
    const payload = { name:form.name, obj:form.obj, konten:form.konten, bh:parseInt(form.bh)||0, mulai:form.mulai||null, selesai:form.selesai||null, status:form.status };
    if (editId) { await supabase.from('campaigns').update(payload).eq('id', editId); }
    else         { await supabase.from('campaigns').insert([payload]); }
    setSaving(false);
    setShowModal(false); setForm(emptyForm); setEditId(null);
    loadCampaigns();
  }

  async function handleDelete(id) {
    setConfirmDel(null);
    await supabase.from('campaigns').delete().eq('id', id);
    loadCampaigns();
  }

  // Ganti status langsung dari pill di tabel — optimistik, rollback kalau gagal
  async function changeStatus(id, status) {
    setStatusDrop(null);
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    const { error: err } = await supabase.from('campaigns').update({ status }).eq('id', id);
    if (err) { setError(err.message); loadCampaigns(); }
  }

  // Dropdown status tutup saat klik di luar / scroll / resize (posisinya fixed).
  // PENTING: listener React di app router menempel di `document` juga, dan
  // stopPropagation TIDAK menahan listener lain di node yang sama — jadi klik di
  // dalam dropdown harus dikecualikan lewat penanda data-wd-status, kalau tidak
  // dropdown keburu ditutup sebelum klik pilihannya sempat diproses.
  useEffect(() => {
    if (!statusDrop) return;
    const close = (e) => {
      if (e?.target?.closest?.('[data-wd-status]')) return;
      setStatusDrop(null);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [statusDrop]);

  // Esc menutup popup yang sedang terbuka (form, konfirmasi hapus, dropdown status)
  useEffect(() => {
    if (!showModal && !confirmDel && !statusDrop) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (statusDrop) setStatusDrop(null);
      else if (confirmDel) setConfirmDel(null);
      else if (showModal && !saving) setShowModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal, confirmDel, statusDrop, saving]);

  const totalBudget  = sorted.reduce((sum,c) => sum + budgetForMonth(c,year,month), 0);
  const budgetByObj  = OBJ_ORDER.reduce((acc,o) => {
    acc[o] = sorted.filter(c => c.obj===o).reduce((s,c) => s + budgetForMonth(c,year,month), 0);
    return acc;
  }, {});
  const undated = campaigns.filter(c => !c.mulai || !c.selesai);
  const isThisMonth = year === today.y && month === today.m;
  const totalCols = (isAdmin ? 9 : 8) + days;

  const ctxLine = loading
    ? <span>Loading schedule…</span>
    : (<>
        <span>Ad schedule</span>
        <span className="rg-ctx-sep" aria-hidden="true" />
        <span>{sorted.length} campaign{sorted.length === 1 ? '' : 's'} in {MONTHS[month]}</span>
        {undated.length > 0 && (<>
          <span className="rg-ctx-sep" aria-hidden="true" />
          <span>{undated.length} not scheduled yet</span>
        </>)}
      </>);

  return (
    <div className={`rg rg-page ${dashboardFontVars}${isMobile ? ' is-mobile' : ''}`}>

      {/* ══ TOP BAR — judul + konteks (kiri) · bulan & aksi (kanan) ══ */}
      <header className="rg-top">
        <div className="rg-top-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="rg-h1">Calendar</h1>
          </div>
          <div className="rg-ctx">{ctxLine}</div>
        </div>

        <div className="rg-tools">
          <div className="rgk-month" role="group" aria-label="Month">
            <button type="button" className="rg-iconbtn" onClick={prevMonth} aria-label="Previous month" title="Previous month">
              <ChevronLeft size={16} />
            </button>
            <span className="rgk-month-label">{MONTHS[month]} {year}</span>
            <button type="button" className="rg-iconbtn" onClick={nextMonth} aria-label="Next month" title="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
          {isAdmin && (<>
            <span className="rg-vsep" aria-hidden="true" />
            <button type="button" className="rg-pill" onClick={openAdd}>
              <Plus size={15} />Add campaign
            </button>
          </>)}
        </div>
      </header>

      {/* ══ ISI ══ */}
      <div className="rg-body rgk-body">

        {error && (
          <div className="rg-error" role="alert">
            <span className="rg-error-ico"><TriangleAlert size={20} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="rg-error-title">The schedule couldn’t be loaded</div>
              <div className="rg-error-msg">{error}</div>
            </div>
            <button type="button" className="rg-pill" onClick={loadCampaigns}>
              <RefreshCw size={15} />Try again
            </button>
          </div>
        )}

        {/* ── Gantt ── */}
        <div className="rg-card rg-rise rgk-card">
          <div className="rg-head">
            <span className="rg-head-ico"><CalendarRange size={15} /></span>
            <span className="rg-title">Schedule</span>
            <div className="rgk-legend" aria-label="Objectives">
              {OBJ_ORDER.map(o => (
                <span key={o} className="rgk-legend-item"><span className="rgk-legend-dot" style={{ background: OBJ_VAR[o] }} />{o}</span>
              ))}
            </div>
          </div>
          <div className="rg-well rgk-well">
            {loading ? (
              <div className="rgk-skel">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rgk-skel-row">
                    <span className="rg-skel" style={{ width: `${22 - (i % 3) * 4}%`, height: 11 }} />
                    <span className="rg-skel" style={{ width: 72, height: 20, borderRadius: 999 }} />
                    <span className="rg-skel" style={{ marginLeft: `${8 + (i * 7) % 30}%`, width: `${18 + (i * 11) % 26}%`, height: 12, borderRadius: 6 }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rgk-scroll" key={tableKey}>
                {/* Kolom info = lebar px pas isinya (chip & angka Geist Mono); kolom hari berbagi
                    sisa ruang. Tabel min 1180px → di layar sempit / HP digeser ke kanan (kolom
                    Campaign menempel), bukan tergencet. */}
                <table className={`rg-table rgk-table${colDrag ? ' is-dragging' : ''}`}>
                  <colgroup>
                    {/* Desktop: lebar px dari state (resizable). Mobile: tetap. */}
                    <col style={{ width: (isMobile ? 150 : campW) + 'px' }}/>
                    <col style={{ width: 88 }}/>
                    <col style={{ width: 96 }}/>
                    <col style={{ width: 84 }}/>
                    <col style={{ width: 52 }}/>
                    <col style={{ width: 52 }}/>
                    <col style={{ width: 100 }}/>
                    <col style={{ width: 96 }}/>
                    {isAdmin && <col style={{ width: 68 }}/>}
                    {Array.from({ length:days }).map((_,i) => <col key={i} />)}
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="rgk-th-name">
                        Campaign
                        {/* Handle resize batas Campaign|Objective — drag = atur lebar, double-click = auto-fit */}
                        {!isMobile && (
                          <div className={`rgk-colgrip${colDrag ? ' is-drag' : ''}`}
                            onMouseDown={startColDrag} onDoubleClick={autoFitCampW}
                            title="Drag to resize · double-click to fit" aria-hidden="true" />
                        )}
                      </th>
                      <th className="rgk-left">Objective</th>
                      <th className="rgk-left">Ad content</th>
                      <th>Budget/day</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Total budget</th>
                      <th className="rgk-left">Status</th>
                      {isAdmin && <th className="rgk-left">Action</th>}
                      {Array.from({ length:days }, (_,i) => i+1).map(d => {
                        const isToday = isThisMonth && d === today.d;
                        return (
                          <th key={d} className={`rgk-day${isToday ? ' is-today' : ''}`}
                            aria-label={isToday ? `${d} (today)` : undefined}>{d}</th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr className="rgk-empty-row"><td colSpan={totalCols}>
                        <div className="rg-empty">
                          <strong>No campaigns scheduled in {MONTHS[month]}</strong>
                          <span>{isAdmin ? 'Use “Add campaign” to plan one, or check another month.' : 'Check another month with the arrows above.'}</span>
                        </div>
                      </td></tr>
                    ) : sorted.map((c, rowIdx) => {
                      const bt = budgetForMonth(c, year, month);
                      const st = STATUSES.includes(c.status) ? c.status : 'Draft';
                      return (
                        <tr key={c.id} className="rgk-row" style={{ animationDelay: `${Math.min(rowIdx, 14) * 30}ms` }}>
                          <td className="rgk-td-name" title={c.name}>{c.name}</td>
                          <td className="rgk-left">
                            <span className="rgk-obj"><span className="rgk-obj-dot" style={{ background: OBJ_VAR[c.obj] }} />{c.obj}</span>
                          </td>
                          <td className="rgk-left rgk-content" title={c.konten || undefined}>{c.konten || '—'}</td>
                          <td className="rg-num">{c.bh ? fmtRp(c.bh) : '—'}</td>
                          <td className="rg-num rgk-date">{fmtDay(c.mulai)}</td>
                          <td className="rg-num rgk-date">{fmtDay(c.selesai)}</td>
                          <td className="rg-num rgk-total">{fmtRp(bt)}</td>
                          <td className="rgk-left">
                            {/* Admin: pill jadi tombol dropdown — ganti status langsung tanpa buka modal Edit */}
                            {isAdmin ? (
                              <button type="button" data-wd-status="pill"
                                className={`rg-chip rgk-status ${STATUS_TONE[st]}${statusDrop?.id === c.id ? ' is-open' : ''}`}
                                title="Change status" aria-haspopup="menu" aria-expanded={statusDrop?.id === c.id}
                                onClick={e => {
                                  const r = e.currentTarget.getBoundingClientRect();
                                  setStatusDrop(prev => prev?.id === c.id ? null : { id:c.id, x:r.left, y:r.bottom + 6 });
                                }}>
                                <StatusIcon s={st} />{st}<ChevronDown size={11} className="rgk-status-caret" />
                              </button>
                            ) : (
                              <span className={`rg-chip rgk-status ${STATUS_TONE[st]}`}><StatusIcon s={st} />{st}</span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="rgk-left">
                              <div className="rgk-acts">
                                <button type="button" className="rg-iconbtn rgk-act" onClick={() => openEdit(c)}
                                  title="Edit campaign" aria-label={`Edit ${c.name}`}><Pencil size={13} /></button>
                                <button type="button" className="rg-iconbtn rgk-act is-neg" onClick={() => setConfirmDel(c)}
                                  title="Delete campaign" aria-label={`Delete ${c.name}`}><Trash2 size={13} /></button>
                              </div>
                            </td>
                          )}
                          {Array.from({ length:days }, (_,i) => i+1).map((d, di) => {
                            const isToday = isThisMonth && d === today.d;
                            const active  = isActive(c, year, month, d);
                            const prev    = isActive(c, year, month, d-1);
                            const next    = isActive(c, year, month, d+1);
                            const cls = !prev && !next ? ' is-solo' : !prev ? ' is-start' : !next ? ' is-end' : '';
                            return (
                              <td key={d} className={`rgk-daycell${isToday ? ' is-today' : ''}`}>
                                {active && (
                                  <div className={`rgk-bar${cls}`} style={{
                                    background: OBJ_VAR[c.obj],
                                    animation: !prev ? `wdGrowX 0.4s cubic-bezier(.22,1,.36,1) ${Math.min(rowIdx, 14) * 0.03 + di * 0.004}s backwards` : 'none',
                                  }}/>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Ringkasan budget bulan ini ── */}
        <div className="rg-card rg-rise rgk-card" style={{ animationDelay: '80ms' }}>
          <div className="rg-head">
            <span className="rg-head-ico"><Wallet size={15} /></span>
            <span className="rg-title">Monthly budget</span>
            <span className="rg-meta">{MONTHS[month]} {year}</span>
          </div>
          <div className="rg-well rgk-budget">
            <div className="rgk-budget-total">
              <div className="rgk-budget-label">Total ad budget</div>
              <div className="rg-num rgk-budget-value">{fmtRp(totalBudget)}</div>
              <div className="rgk-budget-sub">daily budget × days running in {MONTHS[month]}</div>
            </div>
            <div className="rgk-budget-split">
              <div className="rgk-budget-objs">
                {OBJ_ORDER.map(o => (
                  <div key={o} className="rgk-budget-obj">
                    <div className="rgk-budget-obj-label"><span className="rgk-obj-dot" style={{ background: OBJ_VAR[o] }} />{o}</div>
                    <div className={`rg-num rgk-budget-obj-value${budgetByObj[o] > 0 ? '' : ' rg-dim'}`}>{budgetByObj[o] > 0 ? fmtRp(budgetByObj[o]) : '—'}</div>
                    <div className="rgk-budget-obj-pct">{totalBudget > 0 && budgetByObj[o] > 0 ? `${Math.round(budgetByObj[o] / totalBudget * 100)}% of month` : 'no budget'}</div>
                  </div>
                ))}
              </div>
              {totalBudget > 0 && (
                <div className="rgk-share" aria-hidden="true">
                  {OBJ_ORDER.filter(o => budgetByObj[o] > 0).map(o => (
                    <span key={o} style={{ flex: budgetByObj[o], background: OBJ_VAR[o] }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Campaign tanpa tanggal ── */}
        {undated.length > 0 && (
          <div className="rg-card rg-rise rgk-card" style={{ animationDelay: '140ms' }}>
            <div className="rg-head">
              <span className="rg-head-ico"><CalendarClock size={15} /></span>
              <span className="rg-title">Not scheduled yet</span>
              <span className="rg-meta">{undated.length} campaign{undated.length === 1 ? '' : 's'} without dates</span>
            </div>
            <div className="rg-well rgk-undated">
              {undated.map(c => (
                <div key={c.id} className="rgk-undated-row">
                  <span className="rgk-obj"><span className="rgk-obj-dot" style={{ background: OBJ_VAR[c.obj] }} />{c.obj}</span>
                  <span className="rgk-undated-name" title={c.name}>{c.name}</span>
                  <span className="rgk-undated-note">No dates yet</span>
                  {isAdmin && (
                    <button type="button" className="rg-btn rgk-setdates" onClick={() => openEdit(c)}>Set dates</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dropdown status (fixed — di luar tabel supaya tidak kepotong overflow scroll) */}
      {statusDrop && (() => {
        const c = campaigns.find(x => x.id === statusDrop.id);
        if (!c) return null;
        return (
          <div data-wd-status="drop" className="rg-menu rgk-statusmenu" role="menu"
            style={{ position:'fixed', left: statusDrop.x, top: statusDrop.y, zIndex: 60 }}>
            <MenuGlide />
            {STATUSES.map(s => {
              const isCur = s === c.status;
              return (
                <button key={s} type="button" role="menuitem"
                  className={`rg-menu-item${isCur ? ' is-on' : ''}`}
                  // onMouseDown (bukan onClick) — pola sama dengan autocomplete Ad Content
                  // di halaman ini: aksi tetap jalan walau elemen keburu di-unmount.
                  onMouseDown={() => { if (!isCur) changeStatus(c.id, s); else setStatusDrop(null); }}>
                  <span className={`rg-chip rgk-status-mini ${STATUS_TONE[s]}`}><StatusIcon s={s} size={10} /></span>
                  {s}
                  {isCur && <Check size={14} className="rg-menu-check" />}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* ── Konfirmasi hapus ── */}
      {confirmDel && (
        <div className="rg-overlay" onClick={() => setConfirmDel(null)}>
          <div className="rg-dialog" role="dialog" aria-modal="true" aria-labelledby="rgk-del-title" onClick={e => e.stopPropagation()}>
            <div className="rg-dialog-head">
              <span className="rg-dialog-ico is-neg"><Trash2 size={16} /></span>
              <div style={{ minWidth: 0 }}>
                <div id="rgk-del-title" className="rg-dialog-title">Delete this campaign?</div>
                <div className="rg-dialog-sub">It will be removed from the schedule</div>
              </div>
            </div>
            <div className="rg-dialog-body">
              <strong className="rgk-dlg-name">{confirmDel.name}</strong>
              <p className="rgk-dlg-text">This can’t be undone.</p>
            </div>
            <div className="rg-dialog-foot">
              <button type="button" className="rg-btn rg-btn-ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button type="button" className="rg-btn rg-btn-danger" onClick={() => handleDelete(confirmDel.id)} autoFocus>
                <Trash2 size={14} />Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Form tambah / ubah campaign ── */}
      {showModal && (
        <div className="rg-overlay" onClick={e => { if (e.target === e.currentTarget && !saving) setShowModal(false); }}>
          <div className="rg-dialog rgk-form" role="dialog" aria-modal="true" aria-labelledby="rgk-form-title">
            <div className="rg-dialog-head">
              <span className="rg-dialog-ico">{editId ? <Pencil size={15} /> : <Plus size={16} />}</span>
              <div style={{ minWidth: 0 }}>
                <div id="rgk-form-title" className="rg-dialog-title">{editId ? 'Edit campaign' : 'Add campaign'}</div>
                <div className="rg-dialog-sub">Planned schedule · not synced to Meta</div>
              </div>
            </div>

            <div className="rg-dialog-body rgk-form-body">
              {/* Campaign Name */}
              <label className="rg-field">
                <span className="rg-label">Campaign name</span>
                <input className="rg-input" type="text" placeholder="Enter campaign name…" autoFocus
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
              </label>

              {/* Ad Content — dengan autocomplete */}
              <div className="rg-field" style={{ position:'relative' }}>
                <label className="rg-label" htmlFor="rgk-konten">Ad content</label>
                <input
                  id="rgk-konten"
                  className="rg-input"
                  type="text"
                  placeholder="Instagram post, video, etc…"
                  value={form.konten}
                  autoComplete="off"
                  onChange={e => { setForm(f => ({ ...f, konten: e.target.value })); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                />
                {(() => {
                  // Unique values saja, exclude yg sudah persis sama dengan input
                  const allKonten = [...new Set(campaigns.map(c => c.konten).filter(Boolean))];
                  const filtered = allKonten
                    .filter(k => k.toLowerCase().includes((form.konten || '').toLowerCase()) && k.toLowerCase() !== (form.konten || '').toLowerCase())
                    .slice(0, 5);
                  if (!showSuggestions || filtered.length === 0) return null;
                  return (
                    <div className="rg-menu rgk-suggest" role="listbox">
                      {filtered.map((k, i) => (
                        <button key={i} type="button" role="option" aria-selected="false" className="rg-menu-item"
                          onMouseDown={() => { setForm(f => ({ ...f, konten: k })); setShowSuggestions(false); }}>
                          {k}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div className="rg-field">
                <span className="rg-label">Objective</span>
                <div className="rg-segs is-block" role="group" aria-label="Objective">
                  {OBJ_ORDER.map(o => (
                    <button key={o} type="button" aria-pressed={form.obj === o} onClick={() => setForm(f => ({ ...f, obj: o }))}>
                      <span className="rgk-obj-dot" style={{ background: OBJ_VAR[o] }} />{o}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rg-field">
                <span className="rg-label">Status</span>
                <div className="rg-segs is-block" role="group" aria-label="Status">
                  {STATUSES.map(s => (
                    <button key={s} type="button" aria-pressed={form.status === s} onClick={() => setForm(f => ({ ...f, status: s }))}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rgk-form-grid">
                <label className="rg-field">
                  <span className="rg-label">Start date</span>
                  <input className="rg-input rg-num" type="date" value={form.mulai} onChange={e => setForm(f => ({ ...f, mulai:e.target.value }))}/>
                </label>
                <label className="rg-field">
                  <span className="rg-label">End date</span>
                  <input className="rg-input rg-num" type="date" value={form.selesai} onChange={e => setForm(f => ({ ...f, selesai:e.target.value }))}/>
                </label>
              </div>

              <div className="rg-field">
                <span className="rg-label">Daily budget</span>
                {/* Titik ribuan otomatis saat mengetik (100000 → 100.000) —
                    pola sama dgn popup Edit Daily Budget di halaman Campaigns:
                    tampilan diformat id-ID, state tetap digit mentah. */}
                <label className="rg-input-affix">
                  <span className="rg-affix">Rp</span>
                  <input
                    className="rg-num"
                    type="text"
                    inputMode="numeric"
                    placeholder="100.000"
                    aria-label="Daily budget in rupiah"
                    value={form.bh ? parseInt(form.bh).toLocaleString('id-ID') : ''}
                    onChange={e => setForm(f => ({ ...f, bh: e.target.value.replace(/\D/g, '') }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                  />
                  <span className="rg-affix">/ day</span>
                </label>
              </div>
            </div>

            <div className="rg-dialog-foot">
              <button type="button" className="rg-btn rg-btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button type="button" className={`rg-btn rg-btn-primary${saving ? ' is-busy' : ''}`} onClick={handleSave} disabled={!form.name || saving}>
                {saving && <RefreshCw size={13} style={{ animation: 'wdSpin 0.8s linear infinite' }} />}
                {saving ? 'Saving…' : editId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
