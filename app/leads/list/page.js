'use client';

/* ══ LEADS HUB — LEADS LIST + BLACK BOX, redesain "Ridgeline" (LIVE 28 Sep 2026) ══
   Nuansa sama dengan Dashboard Ads Hub & Leads Hub: top bar judul + konteks | aksi,
   toolbar pil 40px, tabel di kartu cangkang + panel dalam, chip warna per status &
   per sales, dialog & bar melayang skin. Skin: app/ridgeline.css + app/leads-ridgeline.css
   (warna --lh-*) + app/leads-list-ridgeline.css (prefix .rgll-).
   LOGIKA SAMA dgn v3.0 (tidak diubah):
     Admin    : tab Black Box (verifikasi lead Meta) + All leads, Add leads (Sync Meta /
                Import from File placeholder).
     Marketing: All leads saja (RLS: hanya lead approved). User: read-only + kontak disensor
                (nomor 6 digit terakhir → xxxxxx, email 2 huruf + xxxxxx; copy & cari by
                nomor/email dimatikan).
     Label NEW (hilang setelah aksi apa pun, approve/reject TIDAK menghapus), kolom
     hide/show (persist wd-leads-cols-hidden), filter kategori (split button) / status /
     sales / tanggal, bulk copy · follow-up context-aware · set status non-Deal · assign
     sales, popup Deal WAJIB nominal, paginasi 100, urutan terbaru di atas.
   Tata letak: tab Black Box · All leads (segmen, panah = kategori) → cari → status →
   sales → Columns (kanan). Fitur nonaktif tampil abu-abu + not-allowed.
   ══════════════════════════════════════════════════════════════════════════ */

import '../../leads-ridgeline.css';
import '../../leads-list-ridgeline.css';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Inbox, Users, RefreshCw, Download, Upload, Search, Copy, Check, X, Minus,
  CheckCircle2, CircleAlert, SlidersHorizontal, UserRound, Plus, CalendarDays,
  Calendar, ChevronDown, ChevronLeft, ChevronRight, HandCoins, StickyNote, TriangleAlert, FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../../components/AuthContext';
import { supabase, authFetch } from '../../supabase';
import useIsMobile from '../../components/useIsMobile';
import ThemeToggle from '../../components/ThemeToggle';
import DateFilterPopup from '../../components/DateFilterPopup';
import { DATE_PRESETS_DASHBOARD } from '../../components/DateFilterContext';
import { STATUSES, SALES, CATEGORIES, kategoriLabel } from '../../components/leadsConfig';
import { dashboardFontVars } from '../../components/dashboardFonts';
import { fmtRangeShort, fmtClock } from '../../components/rgKit';

const PAGE_SIZE = 100;
const COLS_KEY = 'wd-leads-cols-hidden';

// Kolom tabel All leads yang bisa disembunyikan lewat tombol Columns
const ALL_COLUMNS = [
  { key: 'date',     label: 'Date' },
  { key: 'name',     label: 'Name' },
  { key: 'phone',    label: 'Phone' },
  { key: 'email',    label: 'Email' },
  { key: 'city',     label: 'City' },
  { key: 'category', label: 'Category' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'sales',    label: 'Sales' },
  { key: 'status',   label: 'Status' },
  { key: 'fu',       label: 'Follow-up' },
  { key: 'notes',    label: 'Notes' },
  { key: 'closing',  label: 'Closing' },
];

/* Warna status & sales = token skin (app/leads-ridgeline.css) */
const STATUS_VAR = {
  'No Status': 'var(--lh-none)', Cold: 'var(--lh-cold)', Warm: 'var(--lh-warm)', Hot: 'var(--lh-hot)', Deal: 'var(--lh-deal)',
};
const SALES_VAR = { Akmel: 'var(--lh-akmel)', Hendra: 'var(--lh-hendra)', Dedik: 'var(--lh-dedik)' };

const fmtInt = v => Math.round(v || 0).toLocaleString('id-ID');
function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtRp(v) {
  if (v == null || v === '') return '-';
  return 'Rp ' + Math.round(parseFloat(v)).toLocaleString('id-ID');
}
const plural = (n, w) => `${fmtInt(n)} ${w}${n === 1 ? '' : 's'}`;
// Data kosong dari form → "-"
const has = v => v && String(v).trim();
function Dash({ v }) { return has(v) ? v : <span className="rgll-dash">-</span>; }

/* Opsi "off" filter tanggal */
const DF_ALL = { label: 'All dates', value: 'all' };

/* preset → {since, until} (client; SAMA PERSIS logika dashboard Leads Hub) */
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
    default: return null;
  }
}

/* ─── Sensor kontak untuk role viewer (user) ───
   Viewer boleh melihat volume & kualitas lead, tapi bukan data kontak yang bisa
   dipakai menghubungi calon mitra di luar jalur sales. */
function maskPhone(v) {
  if (!v) return v;
  const s = String(v).trim();
  if (s.length <= 6) return 'x'.repeat(s.length);
  return s.slice(0, s.length - 6) + 'xxxxxx';
}
function maskEmail(v) {
  if (!v) return v;
  const s = String(v).trim();
  const at = s.indexOf('@');
  if (at <= 0) return s.slice(0, 2) + 'xxxxxx';
  return s.slice(0, Math.min(2, at)) + 'xxxxxx' + s.slice(at);
}

/* ─── Menu pil: tombol .rg-pill + daftar .rg-menu ───
   Lapisan POSISI (.rgll-menu-pos, rata tengah/kanan thd tombol) dipisah dari lapisan
   ANIMASI (.rg-menu wdScaleIn) — kalau digabung popup "loncat". Klik di luar / Esc menutup. */
function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

function MenuList({ options, value, onPick, footer, minWidth = 180 }) {
  return (
    <div className="rg-menu" role="menu" style={{ minWidth }}>
      {options.map(o => {
        const isCheck = o.checked != null;
        const on = isCheck ? o.checked : (value !== undefined && o.value === value);
        const OIcon = o.Icon;
        return (
          <button key={o.value} type="button" role={isCheck ? 'menuitemcheckbox' : 'menuitemradio'} aria-checked={on}
            className={`rg-menu-item${!isCheck && on ? ' is-on' : ''}`} onClick={() => onPick(o.value)}>
            {isCheck && <span className={`rgll-menu-box${on ? ' is-on' : ''}`}><Check size={11} strokeWidth={3} /></span>}
            {OIcon && <OIcon size={15} style={{ color: 'var(--rg-t2)', flexShrink: 0 }} />}
            {o.color && <span className="rgll-pill-dot" style={{ background: o.color }} />}
            <span>{o.label}</span>
            {o.hint && <span className="rgll-menu-hint">{o.hint}</span>}
            {!isCheck && on && <Check size={14} className="rg-menu-check" />}
          </button>
        );
      })}
      {footer && <div className="rgll-menu-foot">{footer}</div>}
    </div>
  );
}

function PillMenu({ icon: Icon, label, dot, options, value, onSelect, disabled, title, align = 'center',
  direction = 'down', keepOpen, footer, className = '', minWidth, spin }) {
  const { open, setOpen, ref } = useMenu();
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className={`rg-pill${disabled ? ' is-off' : ''}${className ? ' ' + className : ''}`}
        aria-expanded={open} aria-haspopup="menu" aria-disabled={disabled || undefined} title={title}
        onClick={() => { if (!disabled) setOpen(o => !o); }}>
        {Icon && <Icon size={15} style={spin ? { animation: 'wdSpin 0.8s linear infinite' } : undefined} />}
        {dot && <span className="rgll-pill-dot" style={{ background: dot }} />}
        {label && <span>{label}</span>}
        <ChevronDown size={14} className="rg-caret" />
      </button>
      {open && (
        <div className={`rgll-menu-pos is-${direction} is-${align}`}>
          <MenuList options={options} value={value} footer={footer} minWidth={minWidth}
            onPick={v => { onSelect(v); if (!keepOpen) setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

/* Panah kategori yang menempel di tab All leads (split button — permintaan Nadir) */
function CategoryCaret({ value, onSelect, active }) {
  const { open, setOpen, ref } = useMenu();
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" className={`rgll-tab rgll-split-caret${active ? ' is-on' : ''}`} aria-expanded={open}
        aria-haspopup="menu" title="Filter by category" onClick={() => setOpen(o => !o)}>
        <ChevronDown size={14} className="rg-caret" />
      </button>
      {open && (
        <div className="rgll-menu-pos is-down is-center">
          <MenuList value={value} minWidth={240}
            options={[{ value: 'Semua', label: 'All leads' }, ...CATEGORIES.map(c => ({ value: c.value, label: c.label }))]}
            onPick={v => { onSelect(v); setOpen(false); }} />
        </div>
      )}
    </span>
  );
}

/* ─── Menu per baris (Sales / Status) — position:fixed supaya tidak terpotong scroll tabel.
   Tutup saat klik di luar (dikecualikan lewat data-rowmenu), scroll, resize, Esc. ─── */
function RowMenu({ menu, options, current, onPick, onClose }) {
  useEffect(() => {
    const close = e => { if (e?.target?.closest?.('[data-rowmenu]')) return; onClose(); };
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div className="rgll-rowmenu" data-rowmenu style={menu.up ? { left: menu.x, bottom: menu.bottom } : { left: menu.x, top: menu.top }}>
      <MenuList options={options} value={current} minWidth={150} onPick={onPick} />
    </div>
  );
}

/* ─── Dialog (skin .rg-dialog) — Esc & klik latar menutup ─── */
function Dialog({ icon: Icon, tone, title, sub, onClose, busy, children, foot }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);
  return (
    <div className="rg-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="rg-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="rg-dialog-head">
          <span className={`rg-dialog-ico${tone ? ' is-' + tone : ''}`}><Icon size={17} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="rg-dialog-title">{title}</div>
            {sub && <div className="rg-dialog-sub rgll-clip">{sub}</div>}
          </div>
          <button type="button" className="rg-iconbtn" onClick={onClose} disabled={busy} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="rg-dialog-body">{children}</div>
        {foot && <div className="rg-dialog-foot">{foot}</div>}
      </div>
    </div>
  );
}

/* ─── Popup Deal: nominal closing (wajib) + tanggal + alasan ─── */
function DealDialog({ lead, onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const numeric = parseInt((amount || '').replace(/\D/g, '') || '0');
  function handleAmount(e) {
    const n = e.target.value.replace(/\D/g, '');
    setAmount(n ? parseInt(n).toLocaleString('id-ID') : '');
  }
  async function save() {
    if (!numeric || busy) return;
    setBusy(true);
    await onSave({ closing_amount: numeric, deal_date: date, deal_reason: reason.trim() || null });
    setBusy(false);
  }
  return (
    <Dialog icon={HandCoins} tone="pos" title="Close the deal" sub={lead.name || 'Lead'} onClose={onClose} busy={busy}
      foot={(<>
        <button type="button" className="rg-btn rg-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={`rg-btn rg-btn-success${busy ? ' is-busy' : ''}`} onClick={save} disabled={!numeric || busy}>
          {busy && <RefreshCw size={13} style={{ animation: 'wdSpin 0.8s linear infinite' }} />}
          {busy ? 'Saving…' : `Save deal${numeric ? ' — Rp ' + numeric.toLocaleString('id-ID') : ''}`}
        </button>
      </>)}>
      <div className="rgll-dlg-body">
        <div className="rg-field">
          <label className="rg-label" htmlFor="rgll-amount">Closing amount (required)</label>
          <div className="rg-input-affix">
            <span className="rg-affix">Rp</span>
            <input id="rgll-amount" className="rg-mono" value={amount} onChange={handleAmount} placeholder="0" autoFocus inputMode="numeric"
              onKeyDown={e => { if (e.key === 'Enter') save(); }} />
          </div>
        </div>
        <div className="rg-field">
          <label className="rg-label" htmlFor="rgll-date">Closing date</label>
          <input id="rgll-date" type="date" className="rg-input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="rg-field">
          <label className="rg-label" htmlFor="rgll-reason">Why did it close? (optional)</label>
          <input id="rgll-reason" className="rg-input" value={reason} onChange={e => setReason(e.target.value)}
            placeholder="e.g. promo discount, strategic location…" />
        </div>
      </div>
    </Dialog>
  );
}

/* ─── Popup Notes ─── */
function NotesDialog({ lead, onClose, onSave }) {
  const [notes, setNotes] = useState(lead.notes || '');
  const [busy, setBusy] = useState(false);
  async function save() { setBusy(true); await onSave(notes.trim()); setBusy(false); }
  return (
    <Dialog icon={StickyNote} title="Notes" sub={lead.name || 'Lead'} onClose={onClose} busy={busy}
      foot={(<>
        <button type="button" className="rg-btn rg-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={`rg-btn rg-btn-primary${busy ? ' is-busy' : ''}`} onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save notes'}
        </button>
      </>)}>
      <textarea className="rg-input rgll-textarea" value={notes} onChange={e => setNotes(e.target.value)} autoFocus
        placeholder="Short note for team handover…" aria-label="Notes" />
    </Dialog>
  );
}

/* ═══ MAIN ═══ */
export default function LeadsListPage() {
  const { role, isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const canEdit = role === 'admin' || role === 'marketing';
  // Viewer (role user): nomor & email disensor, tombol copy nomor disembunyikan
  const maskContacts = role === 'user';

  const [tab, setTab] = useState('list');            // 'inbox' (Black Box) | 'list'
  const [rows, setRows] = useState(null);
  const [inboxCount, setInboxCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const fetchToken = useRef(0);

  // Filter & seleksi
  const [q, setQ] = useState('');
  const [fKategori, setFKategori] = useState('Semua');
  const [fStatus, setFStatus] = useState('Semua');
  const [fSales, setFSales] = useState('Semua');
  const [selected, setSelected] = useState(() => new Set());
  const [page, setPage] = useState(1);

  // Slot top bar mobile (refresh via portal, pola halaman lain)
  const [topbarSlot, setTopbarSlot] = useState(null);
  useEffect(() => {
    setTopbarSlot(isMobile ? document.getElementById('wd-topbar-actions') : null);
  }, [isMobile]);

  // ── Filter tanggal (state lokal; default "All dates" = off). Tampilan & logika = dashboard Leads.
  const [dfOpt, setDfOpt]           = useState(DF_ALL);
  const [dfIsCustom, setDfIsCustom] = useState(false);
  const [dfSince, setDfSince]       = useState('');
  const [dfUntil, setDfUntil]       = useState('');
  const [showDate, setShowDate]     = useState(false);
  const _initCal = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const [calY, setCalY] = useState(_initCal.getFullYear());
  const [calM, setCalM] = useState(_initCal.getMonth());
  const [localSince, setLocalSince] = useState('');
  const [localUntil, setLocalUntil] = useState('');
  useEffect(() => {
    if (!showDate) return;
    const h = e => { if (!e.target.closest('[data-datefilter]')) setShowDate(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showDate]);

  // Kolom tersembunyi (persist di localStorage)
  const [hiddenCols, setHiddenCols] = useState(() => new Set());
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLS_KEY) || '[]');
      if (Array.isArray(saved)) setHiddenCols(new Set(saved));
    } catch (e) {}
  }, []);
  function toggleCol(key) {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem(COLS_KEY, JSON.stringify([...next])); } catch (e) {}
      return next;
    });
  }
  const col = (key) => tab === 'inbox' || !hiddenCols.has(key);

  // Popup & menu baris
  const [dealLead, setDealLead] = useState(null);
  const [notesLead, setNotesLead] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [rowMenu, setRowMenu] = useState(null);      // { kind:'sales'|'status', id, x, top|bottom, up }
  const closeRowMenu = useCallback(() => setRowMenu(null), []);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 2600);
  }

  /* ── Data (urutan selalu terbaru di atas) ── */
  const fetchRows = useCallback(async (activeTab = tab) => {
    const token = ++fetchToken.current;
    setLoading(true); setError(null);
    const verif = activeTab === 'inbox' ? 'unverified' : 'approved';
    const { data, error } = await supabase
      .from('leads')
      .select('*, campaign_ref(name)')
      .eq('verification', verif)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (token !== fetchToken.current) return;
    if (error) setError(error.message);
    else { setRows(data || []); setUpdatedAt(new Date()); }
    setLoading(false);
  }, [tab]);

  const fetchInboxCount = useCallback(async () => {
    if (!isAdmin) return;
    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('verification', 'unverified');
    setInboxCount(count || 0);
  }, [isAdmin]);

  useEffect(() => {
    if (!role) return;
    // Ganti tab → kosongkan tabel dulu (skeleton). Baris tab lama JANGAN tampil
    // dengan tombol tab baru (mis. Approve/Reject di atas lead yang sudah approved).
    setRows(null);
    fetchRows();
    fetchInboxCount();
    setSelected(new Set());
    setPage(1);
    setRowMenu(null);
  }, [role, tab, fetchRows, fetchInboxCount]);

  /* ── Tulis ke tabel leads (satu id → eq, banyak → in; sama dgn v3.0) ── */
  async function dbUpdate(ids, patch) {
    const query = supabase.from('leads').update(patch);
    const { error } = ids.length === 1 ? await query.eq('id', ids[0]) : await query.in('id', ids);
    return error;
  }

  /* ── Sync leads dari Meta (admin) ── */
  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res  = await authFetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync' }) });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const inserted = json.inserted;
      showToast(`Sync complete — ${inserted} new lead${inserted === 1 ? '' : 's'} in Black Box`);
      await fetchRows();
      await fetchInboxCount();
    } catch (err) {
      showToast('Sync failed: ' + err.message, true);
    }
    setSyncing(false);
  }

  /* ── Update helper (optimistik) — setiap aksi apa pun menghapus label NEW ── */
  async function updateLead(id, patch, successMsg) {
    const full = { ...patch, is_new: false };
    const error = await dbUpdate([id], full);
    if (error) { showToast('Failed: ' + error.message, true); return false; }
    setRows(prev => prev ? prev.map(r => (r.id === id ? { ...r, ...full } : r)) : prev);
    if (successMsg) showToast(successMsg);
    return true;
  }

  async function verify(id, to) {
    // Approve/reject TIDAK menghapus NEW — biar di All leads masih ketahuan lead baru
    const error = await dbUpdate([id], { verification: to });
    if (error) { showToast('Failed: ' + error.message, true); return; }
    setRows(prev => prev.filter(r => r.id !== id));
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    setInboxCount(c => Math.max(0, c - 1));
    showToast(to === 'approved' ? 'Lead approved → moved to All leads' : 'Lead rejected');
  }

  async function bulkVerify(to) {
    const ids = [...selected];
    if (!ids.length) return;
    const error = await dbUpdate(ids, { verification: to });
    if (error) { showToast('Failed: ' + error.message, true); return; }
    setRows(prev => prev.filter(r => !selected.has(r.id)));
    setInboxCount(c => Math.max(0, c - ids.length));
    setSelected(new Set());
    showToast(`${ids.length} lead${ids.length === 1 ? '' : 's'} ${to === 'approved' ? 'approved' : 'rejected'}`);
  }

  async function bulkPatch(patch, msg) {
    const ids = [...selected];
    if (!ids.length) return;
    const full = { ...patch, is_new: false };
    const error = await dbUpdate(ids, full);
    if (error) { showToast('Failed: ' + error.message, true); return; }
    setRows(prev => prev.map(r => (selected.has(r.id) ? { ...r, ...full } : r)));
    setSelected(new Set());
    showToast(msg(ids.length));
  }

  function bulkCopy() {
    const list = (rows || []).filter(r => selected.has(r.id));
    if (!list.length) return;
    navigator.clipboard?.writeText(list.map(r => `${r.name}\t${r.phone}`).join('\n'));
    dbUpdate(list.map(r => r.id), { is_new: false });
    setRows(prev => prev.map(r => (selected.has(r.id) ? { ...r, is_new: false } : r)));
    setSelected(new Set());
    showToast(`${list.length} name${list.length === 1 ? '' : 's'} + number${list.length === 1 ? '' : 's'} copied — ready to paste`);
  }

  function copyPhone(r) {
    navigator.clipboard?.writeText(r.phone || '');
    if (r.is_new) {
      dbUpdate([r.id], { is_new: false });
      setRows(prev => prev.map(x => (x.id === r.id ? { ...x, is_new: false } : x)));
    }
    showToast(`${r.name || 'Lead'}’s number copied`);
  }

  function pickStatus(r, s) {
    if (s === r.status) return;
    if (s === 'Deal') { setDealLead(r); return; } // wajib isi nominal closing
    updateLead(r.id, { status: s }, `Status → ${s}`);
  }

  function openRowMenu(e, kind, r) {
    const b = e.currentTarget.getBoundingClientRect();
    const h = kind === 'status' ? 190 : 156;
    const up = b.bottom + 6 + h > window.innerHeight;
    setRowMenu(prev => (prev && prev.id === r.id && prev.kind === kind) ? null : {
      kind, id: r.id, x: b.left + b.width / 2, up,
      top: b.bottom + 6, bottom: window.innerHeight - b.top + 6,
    });
  }

  /* ── Filter client-side ── */
  const filtered = useMemo(() => {
    let list = rows || [];
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      // Viewer tidak bisa mencari lewat nomor/email — kalau bisa, sensornya jadi percuma
      list = list.filter(r =>
        (r.name || '').toLowerCase().includes(s) ||
        (!maskContacts && (r.phone || '').includes(s)) ||
        (!maskContacts && (r.email || '').toLowerCase().includes(s)));
    }
    if (fKategori !== 'Semua') list = list.filter(r => r.kategori_promo === fKategori);
    if (tab === 'list' && fStatus !== 'Semua') list = list.filter(r => r.status === fStatus);
    if (tab === 'list' && fSales !== 'Semua') {
      list = fSales === 'none' ? list.filter(r => !r.sales) : list.filter(r => r.sales === fSales);
    }
    return list;
  }, [rows, q, fKategori, fStatus, fSales, tab, maskContacts]);

  // Rentang filter tanggal aktif (null = off). Custom pakai rentang, preset dihitung presetToRange.
  const dfActive = dfIsCustom || dfOpt.value !== 'all';
  const dfRange  = !dfActive ? null
    : (dfIsCustom && dfSince && dfUntil ? { since: dfSince, until: dfUntil } : presetToRange(dfOpt.value));
  const dfSinceActive = dfRange?.since || '';
  const dfUntilActive = dfRange?.until || '';
  const dateFilterOn  = !!(dfSinceActive && dfUntilActive);

  // Filter tanggal aktif → lead di rentang itu; off → semua lead (paginasi PAGE_SIZE per halaman)
  const visible = useMemo(() => {
    if (dfSinceActive && dfUntilActive) {
      const start = new Date(dfSinceActive + 'T00:00:00').getTime();
      const end   = new Date(dfUntilActive + 'T23:59:59.999').getTime();
      return filtered.filter(r => {
        if (!r.created_at) return false;
        const t = new Date(r.created_at).getTime();
        return t >= start && t <= end;
      });
    }
    return filtered;
  }, [filtered, dfSinceActive, dfUntilActive]);

  /* ── Handler filter tanggal (mirror dashboard Leads Hub) ── */
  function dateLabel() {
    if (!dfActive) return 'All dates';
    if (dfIsCustom && dfSince && dfUntil) {
      const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
      return `${fmt(dfSince)} – ${fmt(dfUntil)}`;
    }
    return dfOpt.label;
  }
  function openDateFilter() {
    const next = !showDate;
    if (next) {
      setLocalSince(dfIsCustom ? dfSince : ''); setLocalUntil(dfIsCustom ? dfUntil : '');
      if (dfIsCustom && dfSince) { const p = dfSince.split('-'); setCalY(+p[0]); setCalM(+p[1] - 1); }
    }
    setShowDate(next);
  }
  function shiftCalDate(delta) { const dt = new Date(calY, calM + delta, 1); setCalY(dt.getFullYear()); setCalM(dt.getMonth()); }
  function pickDayDate(ds) {
    if (!localSince || (localSince && localUntil)) { setLocalSince(ds); setLocalUntil(''); }
    else if (ds < localSince) { setLocalUntil(localSince); setLocalSince(ds); }
    else setLocalUntil(ds);
  }
  function pickRangeDate(s, u) { setLocalSince(s); setLocalUntil(u); const p = s.split('-'); setCalY(+p[0]); setCalM(+p[1] - 1); }
  function applyDateCustom() {
    if (!localSince || !localUntil) return;
    setDfIsCustom(true); setDfSince(localSince); setDfUntil(localUntil);
    setShowDate(false); setPage(1);
  }
  function selectDatePreset(opt) {
    setDfOpt(opt); setDfIsCustom(false); setDfSince(''); setDfUntil('');
    setShowDate(false); setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);

  const allPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(r.id));
  const somePageSelected = !allPageSelected && pageRows.some(r => selected.has(r.id));
  const allSelected = selected.size === visible.length && visible.length > 0;

  /* Status follow-up baris terpilih → tombol bulk yang ditampilkan:
     semua belum di-mark → hanya "Mark", semua sudah → hanya "Unmark", campuran → dua-duanya. */
  const selectedFu = useMemo(() => {
    const list = (rows || []).filter(r => selected.has(r.id));
    const marked = list.filter(r => r.followed_up).length;
    const unmarked = list.length - marked;
    return { marked, unmarked, hasMarked: marked > 0, hasUnmarked: unmarked > 0, mixed: marked > 0 && unmarked > 0 };
  }, [rows, selected]);
  function toggleAllPage() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allPageSelected) pageRows.forEach(r => next.delete(r.id));
      else pageRows.forEach(r => next.add(r.id));
      return next;
    });
  }
  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (!role) return null;

  const initialLoading = loading && rows === null;
  const busy = loading && rows !== null ? ' rg-busy' : '';
  const menuLead = rowMenu ? (rows || []).find(r => r.id === rowMenu.id) : null;
  const inboxTab = tab === 'inbox';
  const listTitle = inboxTab ? 'Black Box' : (fKategori === 'Semua' ? 'All leads' : kategoriLabel(fKategori));
  const firstIdx = visible.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastIdx = Math.min(page * PAGE_SIZE, visible.length);

  const ctxLine = initialLoading
    ? <span>Loading leads…</span>
    : (<>
        <span className="rg-live" aria-hidden="true" />
        <span>Leads Hub</span>
        <span className="rg-ctx-sep" aria-hidden="true" />
        <span>{plural(visible.length, 'lead')}{dateFilterOn ? ` · ${dateLabel()}` : ''}</span>
        {isAdmin && inboxCount > 0 && !inboxTab && (<>
          <span className="rg-ctx-sep" aria-hidden="true" />
          <span>{fmtInt(inboxCount)} in Black Box</span>
        </>)}
        <span className="rg-ctx-sep" aria-hidden="true" />
        <span>{loading ? 'Refreshing…' : updatedAt ? `Updated ${fmtClock(updatedAt)}` : ''}</span>
      </>);

  const refresh = () => { fetchRows(); fetchInboxCount(); };
  // Tombol refresh HP — dirender via portal ke top bar MobileNav (di luar skin)
  const refreshBtnMobile = (
    <button onClick={refresh} title="Refresh" style={{
      width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '9px', cursor: 'pointer', flexShrink: 0,
    }}>
      <RefreshCw size={14} color="var(--t2)" style={loading || syncing ? { animation: 'wdSpin 0.8s linear infinite' } : undefined} />
    </button>
  );

  const statusOptions = STATUSES.map(s => ({ value: s, label: s, color: STATUS_VAR[s] }));
  const salesOptions = [...SALES.map(s => ({ value: s, label: s, color: SALES_VAR[s] })), { value: 'none', label: 'Unassigned' }];
  const offTitle = inboxTab ? 'Only available in All leads' : undefined;
  // Kolom menempel: centang di kiri (lebar 44px) + Name tepat setelahnya
  const stickCheck = { left: 0 };
  const stickName = { left: canEdit ? 44 : 0 };

  return (
    <div className={`rg rg-page ${dashboardFontVars}${isMobile ? ' is-mobile' : ''}`}>

      {/* ══ TOP BAR — judul + konteks (kiri) · aksi (kanan) ══ */}
      <header className="rg-top">
        <div className="rg-top-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="rg-h1">Leads List</h1>
          </div>
          <div className="rg-ctx">{ctxLine}</div>
        </div>

        <div className="rg-tools">
          {isAdmin && (
            <PillMenu icon={syncing ? RefreshCw : Plus} spin={syncing} className="is-primary" minWidth={220}
              label={syncing ? 'Syncing…' : 'Add leads'} disabled={syncing}
              options={[
                { value: 'sync',   label: 'Sync Meta leads',  Icon: Download, hint: 'instant form' },
                { value: 'import', label: 'Import from file', Icon: Upload,   hint: 'xlsx / csv' },
              ]}
              onSelect={(v) => { if (v === 'sync') handleSync(); else setShowImport(true); }} />
          )}

          {/* Filter tanggal — popup sama persis dashboard Leads */}
          <div style={{ position: 'relative' }} data-datefilter>
            <button type="button" className={`rg-pill${dfActive ? ' is-set' : ''}`} aria-expanded={showDate}
              aria-haspopup="dialog" title="Filter by date" onClick={openDateFilter}>
              <Calendar size={15} />
              {dateFilterOn && !isMobile ? (<>
                <span className="rg-date-preset">{dfIsCustom ? 'Custom range' : dfOpt.label}</span>
                <span className="rg-date-sep" aria-hidden="true" />
                <span>{fmtRangeShort(dfSinceActive, dfUntilActive, true)}</span>
              </>) : <span>{dateLabel()}</span>}
              <ChevronDown size={14} className="rg-caret" />
            </button>
            {showDate && (
              <DateFilterPopup
                presets={[DF_ALL, ...DATE_PRESETS_DASHBOARD]}
                dateOpt={dfOpt}
                isCustom={dfIsCustom}
                customSince={localSince}
                customUntil={localUntil}
                calY={calY} calM={calM}
                isMobile={isMobile}
                onSelectPreset={selectDatePreset}
                onPickDay={pickDayDate}
                onPickRange={pickRangeDate}
                onShiftCal={shiftCalDate}
                onApply={applyDateCustom}
                onClose={() => setShowDate(false)}
              />
            )}
          </div>

          {!isMobile && (<>
            <span className="rg-vsep" aria-hidden="true" />
            <button type="button" className="rg-pill rg-round" title="Refresh" aria-label="Refresh" onClick={refresh} disabled={loading}>
              <RefreshCw size={15} style={loading ? { animation: 'wdSpin 0.8s linear infinite' } : undefined} />
            </button>
            <ThemeToggle className="rg-pill rg-round" />
          </>)}
          {isMobile && topbarSlot && createPortal(refreshBtnMobile, topbarSlot)}
        </div>
      </header>

      {/* ══ ISI ══ */}
      <div className="rg-body">

        {/* ── Toolbar: Black Box · All leads (▾ kategori) · cari · status · sales · Columns ── */}
        <div className="rgll-bar">
          <div className="rgll-tabs" role="tablist" aria-label="Lead views">
            {isAdmin && (
              <button type="button" role="tab" aria-selected={inboxTab} className={`rgll-tab${inboxTab ? ' is-on' : ''}`}
                onClick={() => setTab('inbox')}>
                <Inbox size={14} />Black Box
                {inboxCount > 0 && <span className="rgll-count rg-mono">{fmtInt(inboxCount)}</span>}
              </button>
            )}
            <div className={`rgll-split${!inboxTab ? ' is-on' : ''}`}>
              <button type="button" role="tab" aria-selected={!inboxTab} className="rgll-tab rgll-split-main" onClick={() => setTab('list')}>
                <Users size={14} />{fKategori === 'Semua' ? 'All leads' : kategoriLabel(fKategori)}
              </button>
              <CategoryCaret value={fKategori} active={!inboxTab}
                onSelect={(v) => { setTab('list'); setFKategori(v); setPage(1); }} />
            </div>
          </div>

          <label className="rgll-search">
            <Search size={15} />
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }}
              placeholder={maskContacts ? 'Search name…' : 'Search name, phone, email…'} aria-label="Search leads" />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search"><X size={13} /></button>}
          </label>

          <PillMenu label={fStatus === 'Semua' ? 'All status' : fStatus}
            dot={fStatus !== 'Semua' && !inboxTab ? STATUS_VAR[fStatus] : undefined}
            className={fStatus !== 'Semua' && !inboxTab ? 'is-set' : ''}
            value={fStatus} disabled={inboxTab} title={offTitle} minWidth={160}
            options={[{ value: 'Semua', label: 'All status' }, ...statusOptions]}
            onSelect={(v) => { setFStatus(v); setPage(1); }} />

          <PillMenu icon={UserRound}
            label={fSales === 'Semua' ? 'All sales' : fSales === 'none' ? 'Unassigned' : fSales}
            dot={fSales !== 'Semua' && fSales !== 'none' && !inboxTab ? SALES_VAR[fSales] : undefined}
            className={fSales !== 'Semua' && !inboxTab ? 'is-set' : ''}
            value={fSales} disabled={inboxTab} title={offTitle} minWidth={160}
            options={[{ value: 'Semua', label: 'All sales' }, ...salesOptions]}
            onSelect={(v) => { setFSales(v); setPage(1); }} />

          {!inboxTab && !isMobile && (
            <div className="rgll-bar-end">
              <PillMenu icon={SlidersHorizontal} label="Columns" align="right" keepOpen minWidth={190}
                className={hiddenCols.size ? 'is-set' : ''}
                options={ALL_COLUMNS.map(c => ({ value: c.key, label: c.label, checked: !hiddenCols.has(c.key) }))}
                onSelect={toggleCol}
                footer={hiddenCols.size ? `${hiddenCols.size} hidden · click to show / hide` : 'Click to show / hide'} />
            </div>
          )}
        </div>

        {error && (
          <div className="rg-error" role="alert">
            <span className="rg-error-ico"><TriangleAlert size={20} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="rg-error-title">Leads couldn’t be loaded</div>
              <div className="rg-error-msg">{error}</div>
            </div>
            <button type="button" className="rg-pill" onClick={refresh}><RefreshCw size={15} />Try again</button>
          </div>
        )}

        {/* ── Tabel ── */}
        <div className="rg-card rg-rise rgll-card" style={{ animationDelay: '60ms' }}>
          <div className="rg-head">
            <span className="rg-head-ico">{inboxTab ? <Inbox size={15} /> : <Users size={15} />}</span>
            <span className="rg-title">{listTitle}</span>
            <span className="rg-meta">
              {inboxTab ? 'Meta leads waiting for verification' : 'Newest first'}
            </span>
          </div>

          <div className={`rg-well rgll-well${busy}`}>
            {initialLoading ? (
              <div className="rgll-skel">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="rgll-skel-row">
                    <span className="rg-skel" style={{ width: 18, height: 18, borderRadius: 6 }} />
                    <span className="rg-skel" style={{ width: 80, height: 10 }} />
                    <span className="rg-skel" style={{ width: `${16 + (i % 3) * 5}%`, height: 11 }} />
                    <span className="rg-skel" style={{ width: 110, height: 10 }} />
                    <span className="rg-skel" style={{ marginLeft: 'auto', width: 74, height: 24, borderRadius: 999 }} />
                    <span className="rg-skel" style={{ width: 74, height: 24, borderRadius: 999 }} />
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="rg-empty rgll-empty">
                <span className={`rgll-empty-ico${inboxTab ? ' is-pos' : ''}`}>
                  {inboxTab ? <CheckCircle2 size={22} /> : (dateFilterOn ? <CalendarDays size={22} /> : <Users size={22} />)}
                </span>
                <strong>
                  {inboxTab
                    ? 'Black Box clear — every lead has been verified'
                    : (dateFilterOn ? 'No leads in this period' : (rows?.length ? 'No leads match your filters' : 'No leads yet'))}
                </strong>
                <span>
                  {inboxTab
                    ? 'New leads from Meta instant forms will appear here after a sync. Approve them to move them into All leads.'
                    : (dateFilterOn
                        ? `No leads came in during ${dateLabel()}. Pick a different period, or choose “All dates” to reset.`
                        : (rows?.length ? 'Try a different keyword or reset the filters.' : (isAdmin ? 'Use “Add leads” → Sync Meta leads to pull leads from your instant forms, then approve them from Black Box.' : 'Leads verified by the admin will show up here.')))}
                </span>
              </div>
            ) : (
              <div className="rgll-scroll">
              <table key={`${tab}-${page}`} className={`rg-table rgll-table ${inboxTab ? 'is-inbox' : 'is-list'}`}>
                <thead>
                  <tr>
                    {canEdit && (
                      <th className="rgll-th-check rgll-stick" style={stickCheck}>
                        <button type="button" role="checkbox" aria-checked={allPageSelected ? 'true' : somePageSelected ? 'mixed' : 'false'}
                          aria-label="Select all on this page" onClick={toggleAllPage}
                          className={`rgll-check${allPageSelected ? ' is-on' : somePageSelected ? ' is-some' : ''}`}>
                          {allPageSelected ? <Check size={12} strokeWidth={3} /> : somePageSelected ? <Minus size={12} strokeWidth={3} /> : null}
                        </button>
                      </th>
                    )}
                    {col('date')     && <th>Date</th>}
                    {col('name')     && <th className="rgll-stick rgll-stick-edge" style={stickName}>Name</th>}
                    {col('phone')    && <th>Phone</th>}
                    {col('email')    && <th>Email</th>}
                    {col('city')     && <th>City</th>}
                    {col('category') && <th>Category</th>}
                    {col('campaign') && <th>Campaign</th>}
                    {inboxTab ? (
                      <th className="is-c">Verify</th>
                    ) : (<>
                      {col('sales')   && <th className="is-c">Sales</th>}
                      {col('status')  && <th className="is-c">Status</th>}
                      {col('fu')      && <th className="is-c">Follow-up</th>}
                      {col('notes')   && <th className="is-c">Notes</th>}
                      {col('closing') && <th className="is-r">Closing</th>}
                    </>)}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, ri) => {
                    const picked = selected.has(r.id);
                    const phone = maskContacts ? maskPhone(r.phone) : r.phone;
                    const email = maskContacts ? maskEmail(r.email) : r.email;
                    return (
                      <tr key={r.id} className={`rgll-row${picked ? ' is-picked' : ''}`}
                        // Entrance stagger — hanya ±15 baris pertama biar tetap ringan
                        style={{ animationDelay: `${Math.min(ri, 15) * 24}ms` }}>
                        {canEdit && (
                          <td className="rgll-td-check rgll-stick" style={stickCheck}>
                            <button type="button" role="checkbox" aria-checked={picked} aria-label={`Select ${r.name || 'lead'}`}
                              className={`rgll-check${picked ? ' is-on' : ''}`} onClick={() => toggleOne(r.id)}>
                              {picked && <Check size={12} strokeWidth={3} />}
                            </button>
                          </td>
                        )}
                        {col('date') && <td className="rgll-date">{fmtDate(r.created_at)}</td>}
                        {col('name') && (
                          <td title={r.name} className="rgll-stick rgll-stick-edge" style={stickName}>
                            <span className="rgll-name">
                              <span><Dash v={r.name} /></span>
                              {r.is_new && <span className="rgll-new">New</span>}
                            </span>
                          </td>
                        )}
                        {col('phone') && (
                          <td>
                            <span className={`rgll-phone rg-mono${maskContacts ? ' is-masked' : ''}`}>
                              <Dash v={phone} />
                              {r.phone && !maskContacts && (
                                <button type="button" className="rgll-copy" onClick={() => copyPhone(r)} title="Copy number" aria-label="Copy number">
                                  <Copy size={12} />
                                </button>
                              )}
                            </span>
                          </td>
                        )}
                        {col('email') && (
                          <td title={email || ''}><span className="rgll-clip rgll-email rgll-muted"><Dash v={email} /></span></td>
                        )}
                        {col('city') && <td><Dash v={r.domicile} /></td>}
                        {col('category') && (
                          <td>{r.kategori_promo
                            ? <span className="rg-chip rgll-cat" title={kategoriLabel(r.kategori_promo)}><span>{kategoriLabel(r.kategori_promo)}</span></span>
                            : <span className="rgll-dash">-</span>}</td>
                        )}
                        {col('campaign') && (
                          <td title={r.campaign_ref?.name || ''}><span className="rgll-clip rgll-camp rgll-muted"><Dash v={r.campaign_ref?.name} /></span></td>
                        )}

                        {inboxTab ? (
                          <td className="is-c">
                            <span className="rgll-verify">
                              <button type="button" className="rg-btn rgll-approve" onClick={() => verify(r.id, 'approved')}>
                                <Check size={13} strokeWidth={2.6} />Approve
                              </button>
                              <button type="button" className="rg-btn rgll-reject" onClick={() => verify(r.id, 'rejected')}>
                                <X size={13} strokeWidth={2.6} />Reject
                              </button>
                            </span>
                          </td>
                        ) : (<>
                          {/* Sales (siapa yang handle) */}
                          {col('sales') && (
                            <td className="is-c">
                              {canEdit ? (
                                <button type="button" className={`rgll-pick${r.sales ? '' : ' is-empty'}`}
                                  style={r.sales ? { '--c': SALES_VAR[r.sales] || 'var(--rg-t2)' } : undefined}
                                  aria-haspopup="menu" aria-expanded={rowMenu?.id === r.id && rowMenu.kind === 'sales'}
                                  onClick={(e) => openRowMenu(e, 'sales', r)}>
                                  {r.sales && <span className="rgll-pick-dot" />}
                                  {r.sales || 'Assign'}
                                  <ChevronDown size={12} className="rgll-pick-caret" />
                                </button>
                              ) : r.sales ? (
                                <span className="rgll-pick" style={{ '--c': SALES_VAR[r.sales] || 'var(--rg-t2)' }}>
                                  <span className="rgll-pick-dot" />{r.sales}
                                </span>
                              ) : <span className="rgll-dash">-</span>}
                            </td>
                          )}

                          {/* Status */}
                          {col('status') && (
                            <td className="is-c">
                              {(() => {
                                const cls = `rgll-pick${r.status === 'No Status' ? ' is-none' : ''}`;
                                const style = { '--c': STATUS_VAR[r.status] || 'var(--rg-t2)' };
                                return canEdit ? (
                                  <button type="button" className={cls} style={style} aria-haspopup="menu"
                                    aria-expanded={rowMenu?.id === r.id && rowMenu.kind === 'status'}
                                    onClick={(e) => openRowMenu(e, 'status', r)}>
                                    <span className="rgll-pick-dot" />{r.status}
                                    <ChevronDown size={12} className="rgll-pick-caret" />
                                  </button>
                                ) : (
                                  <span className={cls} style={style}><span className="rgll-pick-dot" />{r.status}</span>
                                );
                              })()}
                            </td>
                          )}

                          {/* Follow-up */}
                          {col('fu') && (
                            <td className="is-c">
                              <button type="button" disabled={!canEdit}
                                className={`rgll-dot-btn${r.followed_up ? ' is-fu' : ''}`}
                                aria-pressed={!!r.followed_up}
                                title={r.followed_up ? (canEdit ? 'Followed up (click to undo)' : 'Followed up') : (canEdit ? 'Not followed up yet (click to mark)' : 'Not followed up yet')}
                                onClick={() => canEdit && updateLead(r.id, { followed_up: !r.followed_up }, r.followed_up ? 'Follow-up unmarked' : 'Marked as followed up')}>
                                <Check size={14} strokeWidth={r.followed_up ? 2.8 : 2} />
                              </button>
                            </td>
                          )}

                          {/* Notes */}
                          {col('notes') && (
                            <td className="is-c">
                              <button type="button" disabled={!canEdit}
                                className={`rgll-dot-btn${r.notes ? ' is-note' : ''}`}
                                title={r.notes || (canEdit ? 'Add a note' : 'No note')}
                                onClick={() => canEdit && setNotesLead(r)}>
                                <StickyNote size={13} />
                              </button>
                            </td>
                          )}

                          {/* Closing */}
                          {col('closing') && (
                            <td className={`is-r rg-num rgll-closing${r.status === 'Deal' && r.closing_amount ? ' is-deal' : ''}`}>
                              {r.status === 'Deal' ? fmtRp(r.closing_amount) : <span className="rgll-dash">-</span>}
                            </td>
                          )}
                        </>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {/* Kaki: jumlah + paginasi */}
          {!initialLoading && visible.length > 0 && (
            <div className="rg-foot">
              <span>Showing <span className="rg-mono rg-foot-val">{fmtInt(firstIdx)}–{fmtInt(lastIdx)}</span> of <span className="rg-mono rg-foot-val">{fmtInt(visible.length)}</span></span>
              {totalPages > 1 && (
                <span className="rgll-pager">
                  <button type="button" className="rg-iconbtn" disabled={page === 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
                  <span>Page <span className="rg-mono rg-foot-val">{page}</span> of <span className="rg-mono rg-foot-val">{totalPages}</span></span>
                  <button type="button" className="rg-iconbtn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ MENU BARIS (Sales / Status) ══ */}
      {rowMenu && menuLead && (
        <RowMenu menu={rowMenu} onClose={closeRowMenu}
          options={rowMenu.kind === 'status' ? statusOptions : salesOptions}
          current={rowMenu.kind === 'status' ? menuLead.status : (menuLead.sales || 'none')}
          onPick={(v) => {
            setRowMenu(null);
            if (rowMenu.kind === 'status') pickStatus(menuLead, v);
            else if ((menuLead.sales || 'none') !== v) {
              updateLead(menuLead.id, { sales: v === 'none' ? null : v }, v === 'none' ? 'Sales unassigned' : `Assigned to ${v}`);
            }
          }} />
      )}

      {/* ══ BAR MELAYANG AKSI MASSAL ══ (lapisan posisi .rg-float dipisah dari animasi .rg-float-in) */}
      {canEdit && selected.size > 0 && (
        <div className="rg-float rgll-float">
          <div className="rg-float-in">
            <span className="rgll-float-count">
              <b className="rg-mono">{fmtInt(selected.size)}</b> {allSelected ? `selected — all` : 'selected'}
            </span>
            {inboxTab ? (<>
              <button type="button" className="rg-btn rg-btn-success" onClick={() => bulkVerify('approved')}>
                <Check size={14} strokeWidth={2.6} />{allSelected ? 'Approve all' : `Approve (${selected.size})`}
              </button>
              <button type="button" className="rg-btn rgll-reject" onClick={() => bulkVerify('rejected')}>
                <X size={14} strokeWidth={2.6} />{allSelected ? 'Reject all' : `Reject (${selected.size})`}
              </button>
            </>) : (<>
              <button type="button" className="rg-btn rg-btn-primary" onClick={bulkCopy}><Copy size={14} />Copy name + number</button>
              {/* Tombol follow-up context-aware: hanya aksi yang masuk akal untuk baris terpilih */}
              {selectedFu.hasUnmarked && (
                <button type="button" className="rg-btn" onClick={() => bulkPatch({ followed_up: true }, n => `${n} lead${n === 1 ? '' : 's'} marked as followed up`)}>
                  <Check size={14} />Mark followed-up{selectedFu.mixed ? ` (${selectedFu.unmarked})` : ''}
                </button>
              )}
              {selectedFu.hasMarked && (
                <button type="button" className="rg-btn" onClick={() => bulkPatch({ followed_up: false }, n => `${n} lead${n === 1 ? '' : 's'} follow-up unmarked`)}>
                  <X size={14} />Unmark followed-up{selectedFu.mixed ? ` (${selectedFu.marked})` : ''}
                </button>
              )}
              <PillMenu label="Set status" direction="up" minWidth={170}
                options={STATUSES.filter(s => s !== 'Deal').map(s => ({ value: s, label: s, color: STATUS_VAR[s] }))}
                onSelect={(s) => bulkPatch({ status: s }, n => `${n} lead${n === 1 ? '' : 's'} → ${s}`)}
                footer="Deal is set per lead (closing amount)" />
              <PillMenu icon={UserRound} label="Assign sales" direction="up" minWidth={160}
                options={salesOptions}
                onSelect={(v) => bulkPatch({ sales: v === 'none' ? null : v }, n => v === 'none' ? `${n} lead${n === 1 ? '' : 's'} unassigned` : `${n} lead${n === 1 ? '' : 's'} → ${v}`)} />
            </>)}
            <button type="button" className="rg-iconbtn rgll-x" onClick={() => setSelected(new Set())} title="Clear selection" aria-label="Clear selection">
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ══ DIALOG DEAL ══ */}
      {dealLead && (
        <DealDialog lead={dealLead} onClose={() => setDealLead(null)}
          onSave={async (patch) => {
            const ok = await updateLead(dealLead.id, { status: 'Deal', ...patch }, `Deal closed — ${fmtRp(patch.closing_amount)}`);
            if (ok) setDealLead(null);
          }} />
      )}

      {/* ══ DIALOG NOTES ══ */}
      {notesLead && (
        <NotesDialog lead={notesLead} onClose={() => setNotesLead(null)}
          onSave={async (notes) => {
            const ok = await updateLead(notesLead.id, { notes: notes || null }, 'Notes saved');
            if (ok) setNotesLead(null);
          }} />
      )}

      {/* ══ DIALOG IMPORT (placeholder — dibangun setelah file contoh dari Nadir) ══ */}
      {showImport && (
        <Dialog icon={FileSpreadsheet} title="Import from file" sub="Spreadsheet → Leads List" onClose={() => setShowImport(false)}
          foot={<button type="button" className="rg-btn rg-btn-primary" onClick={() => setShowImport(false)}>Got it</button>}>
          <div className="rgll-import">
            <strong>Smart Import is on the way</strong>
            <span>
              Upload your spreadsheet, then map its columns to Leads List fields with a guided
              data-cleaning step (just like Meta’s import flow) before anything is saved.
            </span>
            <span className="rg-chip">Coming in the next update</span>
          </div>
        </Dialog>
      )}

      {/* ══ TOAST ══ */}
      {toast && (
        <div className={`rg-float rg-toast${canEdit && selected.size > 0 ? ' is-up' : ''}${toast.isError ? ' is-err' : ''}`} role="status">
          <div className="rg-float-in">
            {toast.isError ? <CircleAlert size={15} /> : <Check size={15} strokeWidth={3} style={{ color: 'var(--rg-pos)' }} />}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
