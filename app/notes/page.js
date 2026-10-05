'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import '../notes-ridgeline.css';
import {
  X, Plus, Search, Pin, Trash2, Copy, Check, ChevronLeft, ChevronDown,
  Bold, Italic, Strikethrough, List, ListOrdered, NotebookPen, FileText,
  Highlighter, SquareCheck, Heading, RemoveFormatting, CircleAlert, RefreshCw, GripVertical,
} from 'lucide-react';
import { useAuth, homeFor } from '../components/AuthContext';
import { supabase } from '../supabase';
import useIsMobile from '../components/useIsMobile';
import ThemeToggle from '../components/ThemeToggle';
import { dashboardFontVars } from '../components/dashboardFonts';
import { RgDialog } from '../components/rgKit';

/* ─────────────────────────────────────────────────────────────
   NOTES — catatan pribadi admin (halaman penuh, /notes)
   Tersimpan di Supabase (tabel `notes`, RLS per pemilik) sehingga
   catatan yang sama ikut terbuka dari perangkat lain selama login
   dengan akun yang sama. Auto-save 700 ms setelah berhenti mengetik.

   Editor pakai contenteditable + document.execCommand: cukup untuk
   catatan kerja dan tidak menambah dependency baru. ATURAN PENTING —
   innerHTML editor HANYA di-set ulang saat catatan yang dibuka
   berganti, JANGAN saat mengetik, kalau tidak kursor melompat ke awal.

   Redesain "Ridgeline" (LIVE 28 Sep 2026): skin .rg + notes-ridgeline.css
   (prefix .rgn-). Kartu Notes di kolom kiri, kartu editor di kanan.
   To Do yang dulu menumpang di sini (panel bawah kolom kiri + detail tugas
   di kanan) PINDAH jadi halaman sendiri /todo pada 5 Okt 2026.
   ───────────────────────────────────────────────────────────── */

const HIGHLIGHTS = [
  { name: 'Yellow', value: '#FDE68A' },
  { name: 'Green',  value: '#BBF7D0' },
  { name: 'Blue',   value: '#BFDBFE' },
  { name: 'Pink',   value: '#FBCFE8' },
];

const AUTOSAVE_MS = 700;

/* Lebar kolom daftar bisa digeser (pola sama dengan drag handle Sidebar):
   garisnya transparan, hanya kursor yang berubah saat disentuh. */
const LIST_MIN = 240, LIST_MAX = 520, LIST_DEFAULT = 300;
const LIST_W_KEY = 'wd-notes-list-w';
const GROUPS_KEY = 'wd-notes-groups-min';   // grup daftar catatan yang dilipat { pinned, all }
const ACTIVE_KEY = 'wd-notes-active-id';    // catatan terakhir dibuka — dibuka lagi setelah refresh

/* ── Auto-link ──
   URL di dalam catatan otomatis dibungkus <a> warna aksen (styling di globals.css
   .wd-note-editor a). Klik biasa tetap mengedit teks; Ctrl+klik membuka link. */
const URL_RE  = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
const URL_ONE = /^(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)$/i;
function cleanUrl(raw) { return (raw || '').replace(/[.,;:!?)\]}'"»…]+$/, ''); }
function makeLinkEl(url) {
  const a = document.createElement('a');
  a.href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  a.className = 'wd-link';
  a.title = 'Ctrl+click to open link';
  a.setAttribute('rel', 'noopener');
  return a;
}
/* Bungkus semua URL polos di dalam root jadi <a>; teks yang sudah di dalam link
   atau checkbox dilewati. Return true kalau ada yang berubah. */
function linkifyDom(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets = [];
  let tn;
  while ((tn = walker.nextNode())) {
    const p = tn.parentNode;
    if (p?.closest?.('a, .wd-check')) continue;
    URL_RE.lastIndex = 0;
    if (URL_RE.test(tn.textContent)) targets.push(tn);
  }
  for (const node of targets) {
    const text = node.textContent;
    const frag = document.createDocumentFragment();
    let last = 0;
    URL_RE.lastIndex = 0;   // regex global menyimpan posisi — wajib reset, kalau tidak matchAll mulai dari posisi basi
    for (const m of text.matchAll(URL_RE)) {
      const url = cleanUrl(m[0]);
      if (!url) continue;
      frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const a = makeLinkEl(url);
      a.textContent = url;
      frag.appendChild(a);
      last = m.index + url.length;
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    node.replaceWith(frag);
  }
  return targets.length > 0;
}
function linkifyHtml(html) {
  if (typeof document === 'undefined') return html || '';
  const root = document.createElement('div');
  root.innerHTML = html || '';
  linkifyDom(root);
  return root.innerHTML;
}

function plainText(html) {
  if (typeof document === 'undefined') return '';
  const el = document.createElement('div');
  el.innerHTML = html || '';
  el.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
  el.querySelectorAll('div,p,li,h3').forEach(b => b.append('\n'));   // h3 (Heading) juga baris sendiri — dulu menempel ke baris berikutnya
  return (el.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

/* Urutan tampil: pinned dulu; di dalam grup pakai sort_order hasil geser manual.
   Catatan tanpa sort_order (baru dibuat / belum pernah digeser) tampil paling atas,
   diurutkan updated_at terbaru — sama seperti perilaku lama. */
function sortNotes(list) {
  return [...list].sort((a, b) => {
    const pin = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    if (pin !== 0) return pin;
    const ao = a.sort_order, bo = b.sort_order;
    if (ao != null && bo != null && ao !== bo) return ao - bo;
    if (ao != null && bo == null) return 1;
    if (ao == null && bo != null) return -1;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });
}

function relativeTime(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function NotesPage() {
  const { role, ready } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();

  const [notes, setNotes] = useState(null);      // null = loading
  const [activeId, setActiveId] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');      // 'saving' | 'saved' | ''
  const [copied, setCopied] = useState(false);
  const [showHl, setShowHl] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [mobileView, setMobileView] = useState('list'); // mobile: 'list' | 'editor'

  // Grup daftar catatan (PINNED / ALL NOTES) bisa dilipat — isi "tersedot" ke atas
  // masuk ke header grup, diingat di localStorage.
  const [groupMin, setGroupMin] = useState({ pinned: false, all: false });

  // Geser urutan catatan (drag handle di daftar). canReorder = false kalau kolom
  // sort_order belum ada di DB (supabase-notes-update-1.sql belum dijalankan).
  const [canReorder, setCanReorder] = useState(true);
  const [dragId, setDragId] = useState(null);
  const dragIdRef = useRef(null);

  const editorRef = useRef(null);
  const titleRef = useRef(null);
  const saveTimer = useRef(null);
  const loadedIdRef = useRef(null);

  // Lebar kolom daftar (drag) — diingat di localStorage supaya tidak reset tiap buka
  const [listWidth, setListWidth] = useState(LIST_DEFAULT);
  const [listDragging, setListDragging] = useState(false);
  const sideRef = useRef(null);          // kolom kiri (kartu Notes)
  const draggingRef = useRef(false);

  useEffect(() => {
    const saved = parseInt(localStorage.getItem(LIST_W_KEY) || '', 10);
    // lebar lama di luar rentang baru (min naik 210→240) dijepit, bukan dibuang
    if (saved > 0) setListWidth(Math.min(LIST_MAX, Math.max(LIST_MIN, saved)));
    try {
      const g = JSON.parse(localStorage.getItem(GROUPS_KEY) || '{}');
      setGroupMin({ pinned: !!g.pinned, all: !!g.all });
    } catch { /* nilai rusak → pakai default terbuka */ }
  }, []);

  function toggleGroup(id) {
    setGroupMin(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
      return next;
    });
  }
  // Buka paksa satu grup (dipakai saat catatan baru dibuat / di-pin) supaya
  // hasil aksinya tidak "hilang" di dalam grup yang sedang dilipat.
  function expandGroup(id) {
    setGroupMin(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev, [id]: false };
      localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
      return next;
    });
  }
  // Saat sedang mencari, lipatan diabaikan supaya hasil pencarian selalu terlihat
  const isGroupMin = (id) => !q.trim() && groupMin[id];

  useEffect(() => {
    function onMove(e) {
      if (!draggingRef.current || !sideRef.current) return;
      const left = sideRef.current.getBoundingClientRect().left;
      let w = e.clientX - left;
      if (w < LIST_MIN) w = LIST_MIN;
      if (w > LIST_MAX) w = LIST_MAX;
      setListWidth(w);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setListDragging(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setListWidth(w => { localStorage.setItem(LIST_W_KEY, String(Math.round(w))); return w; });
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Kursor body ikut diganti selama menggeser supaya tidak berkedip saat keluar dari celah pembatas
  function startDrag(e) {
    draggingRef.current = true;
    setListDragging(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  }

  function selectNote(id) {
    setActiveId(id);
    if (isMobile) setMobileView('editor');
  }

  // Catatan pribadi — hanya admin
  useEffect(() => {
    if (ready && role && role !== 'admin') router.replace(homeFor(role));
  }, [ready, role, router]);

  const active = useMemo(
    () => (notes || []).find(n => n.id === activeId) || null,
    [notes, activeId],
  );

  const load = useCallback(async () => {
    // Coba ambil dengan kolom sort_order; kalau kolomnya belum ada (SQL update
    // belum dijalankan), fallback ke query lama supaya Notes tetap jalan.
    let { data, error: err } = await supabase
      .from('notes')
      .select('id,title,content,pinned,updated_at,sort_order')
      .order('updated_at', { ascending: false });
    let hasOrderCol = true;
    if (err && (err.code === '42703' || /sort_order/i.test(err.message || ''))) {
      hasOrderCol = false;
      ({ data, error: err } = await supabase
        .from('notes')
        .select('id,title,content,pinned,updated_at')
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false }));
    }
    if (err) {
      const missingTable = err.code === 'PGRST205' || err.code === '42P01'
        || /could not find the table|does not exist/i.test(err.message || '');
      setError(missingTable
        ? 'Notes is not set up yet — run the notes SQL once in the Supabase SQL Editor, then refresh this page.'
        : err.message);
      setNotes([]);
      return;
    }
    setCanReorder(hasOrderCol);
    const sorted = sortNotes(data || []);
    setNotes(sorted);
    // Buka lagi catatan yang terakhir dibuka (localStorage); kalau sudah
    // dihapus / belum pernah ada → catatan paling atas seperti biasa.
    const savedId = localStorage.getItem(ACTIVE_KEY);
    const restored = savedId && sorted.some(n => n.id === savedId) ? savedId : null;
    setActiveId(prev => prev || restored || sorted[0]?.id || null);
  }, []);

  // Simpan catatan aktif tiap berganti — satu tempat, mencakup semua jalur
  // (klik daftar, catatan baru, hapus catatan aktif, dst.)
  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);

  useEffect(() => { if (role === 'admin') load(); }, [role, load]);

  /* Isi editor HANYA saat catatan aktif berganti. Editor sedang tidak dirender
     (HP: sedang di daftar) → penanda di-reset, supaya editor yang muncul lagi
     diisi ulang walau catatannya sama (elemen barunya kosong). */
  useEffect(() => {
    if (!editorRef.current) { loadedIdRef.current = null; return; }
    if (loadedIdRef.current === activeId) return;
    // URL polos di catatan lama ikut dijadikan link saat catatan dibuka
    editorRef.current.innerHTML = linkifyHtml(active?.content || '');
    loadedIdRef.current = activeId;
    setStatus('');
    // Catatan dipakai seperti log/history — begitu dibuka langsung scroll ke
    // PALING BAWAH supaya tulisan terbaru langsung kelihatan (rAF: tunggu layout).
    const ed = editorRef.current;
    requestAnimationFrame(() => { ed.scrollTop = ed.scrollHeight; });
  }, [activeId, active, mobileView]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  /* Ctrl/Cmd ditekan → editor diberi class `wd-ctrl`: kursor di atas link berubah
     jadi pointer (icon klik) sebagai isyarat "klik = buka tab baru". Lepas tombol
     atau jendela kehilangan fokus (mis. Alt+Tab saat Ctrl masih ditekan) → normal.
     Toggle langsung via classList (bukan state) supaya tidak re-render halaman. */
  useEffect(() => {
    const set = (on) => editorRef.current?.classList.toggle('wd-ctrl', on);
    const down = (e) => { if (e.key === 'Control' || e.key === 'Meta') set(true); };
    const up   = (e) => { if (e.key === 'Control' || e.key === 'Meta') set(false); };
    const off  = () => set(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', off);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', off);
    };
  }, []);

  function queueSave(patch) {
    if (!activeId) return;
    setStatus('saving');
    setNotes(prev => (prev || []).map(n => (n.id === activeId ? { ...n, ...patch } : n)));
    clearTimeout(saveTimer.current);
    const id = activeId;
    saveTimer.current = setTimeout(async () => {
      const { error: err } = await supabase.from('notes').update(patch).eq('id', id);
      if (err) { setError(err.message); setStatus(''); return; }
      setStatus('saved');
      setNotes(prev => (prev || []).map(n => (n.id === id ? { ...n, updated_at: new Date().toISOString() } : n)));
      setTimeout(() => setStatus(s => (s === 'saved' ? '' : s)), 1600);
    }, AUTOSAVE_MS);
  }

  async function createNote() {
    const { data, error: err } = await supabase
      .from('notes')
      .insert({ title: 'Untitled note', content: '' })
      .select(canReorder ? 'id,title,content,pinned,updated_at,sort_order' : 'id,title,content,pinned,updated_at')
      .single();
    if (err) { setError(err.message); return; }
    setNotes(prev => [data, ...(prev || [])]);
    expandGroup('all');   // catatan baru masuk All notes — pastikan grupnya terbuka
    setActiveId(data.id);
    loadedIdRef.current = null;
    setMobileView('editor');
    setTimeout(() => titleRef.current?.focus(), 60);
  }

  async function removeNote(id) {
    const { error: err } = await supabase.from('notes').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    const rest = (notes || []).filter(n => n.id !== id);
    setNotes(rest);
    setConfirmDelete(null);
    if (activeId === id) { setActiveId(rest[0]?.id || null); loadedIdRef.current = null; }
  }

  /* Eksekusi konfirmasi hapus — confirmDelete = catatan yang mau dihapus */
  async function confirmDeleteNow() {
    if (!confirmDelete || deleting) return;
    setDeleting(true);   // tombol dialog terkunci selama proses (anti klik dobel)
    try {
      await removeNote(confirmDelete.id);
    } finally {
      setDeleting(false);
    }
  }

  async function togglePin(n) {
    const next = !n.pinned;
    expandGroup(next ? 'pinned' : 'all');   // grup tujuan dibuka biar catatannya kelihatan pindah
    setNotes(prev => (prev || []).map(x => (x.id === n.id ? { ...x, pinned: next } : x)));
    const { error: err } = await supabase.from('notes').update({ pinned: next }).eq('id', n.id);
    if (err) setError(err.message);
  }

  /* ── Geser urutan catatan (drag handle) ──
     Saat handle digeser melewati catatan lain di grup yang sama (pinned/biasa),
     posisinya langsung ditukar di layar; saat dilepas, urutan final disimpan
     sebagai sort_order (index) untuk semua catatan. */
  function moveNote(srcId, targetId) {
    setNotes(prev => {
      const list = [...(prev || [])];
      const si = list.findIndex(x => x.id === srcId);
      const ti = list.findIndex(x => x.id === targetId);
      if (si < 0 || ti < 0 || si === ti) return prev;
      if (!!list[si].pinned !== !!list[ti].pinned) return prev; // hanya dalam grup yang sama
      const [moved] = list.splice(si, 1);
      list.splice(ti, 0, moved);
      return list;
    });
  }

  function endReorder() {
    dragIdRef.current = null;
    setDragId(null);
    setNotes(prev => {
      const list = (prev || []).map((n, i) => ({ ...n, sort_order: i }));
      // Simpan idempotent — aman walau updater sempat jalan dua kali (StrictMode)
      Promise.all(list.map(n => supabase.from('notes').update({ sort_order: n.sort_order }).eq('id', n.id)))
        .then(results => {
          const bad = results.find(r => r.error);
          if (bad) setError(bad.error.message);
        });
      return list;
    });
  }

  function copyNote() {
    if (!editorRef.current) return;
    navigator.clipboard?.writeText(plainText(editorRef.current.innerHTML));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function exec(cmd, value) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    queueSave({ content: editorRef.current.innerHTML });
  }

  /* ── Checklist ──
     Span checkbox dibuat manual via Range API, BUKAN execCommand('insertHTML'):
     dengan insertHTML Chrome sering menaruh kursor sebelum/di dalam span
     contenteditable=false sehingga tidak bisa mengetik di samping checkbox.
     Kursor selalu ditaruh eksplisit setelah spasi pengiring. */
  function makeCheck() {
    const span = document.createElement('span');
    span.className = 'wd-check';
    span.setAttribute('data-done', '0');
    span.setAttribute('contenteditable', 'false');
    span.textContent = '☐';
    return span;
  }

  function placeCaretAfter(textNode) {
    const sel = window.getSelection();
    const r = document.createRange();
    r.setStart(textNode, textNode.length);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  /* Checkbox untuk BLOK teks (beberapa baris di-block lalu klik checkbox):
     berperilaku seperti bullet/numbered list — tiap baris dalam seleksi dapat
     checkbox di awal barisnya (teks tidak dihapus). Kalau SEMUA baris terpilih
     sudah ber-checkbox → checkbox dicabut (toggle, sama seperti list). */
  function toggleCheckboxOnSelection(ed, sel) {
    // Bungkus tiap baris jadi <div> dulu (teks polos di level atas editor jadi punya blok)
    const anchorEl = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
    if (!anchorEl?.closest?.('li')) document.execCommand('formatBlock', false, '<div>');
    const range = sel.getRangeAt(0);
    // Kumpulkan blok baris yang tersentuh seleksi (li di dalam list dihitung per item)
    const blocks = [];
    for (const node of Array.from(ed.childNodes)) {
      if (!range.intersectsNode(node)) continue;
      if (node.nodeType !== 1) continue;
      if (node.tagName === 'UL' || node.tagName === 'OL') {
        node.querySelectorAll('li').forEach(li => { if (range.intersectsNode(li)) blocks.push(li); });
      } else if (node.tagName !== 'BR') {
        blocks.push(node);
      }
    }
    if (!blocks.length) return false;
    const firstCheck = (b) => {
      // checkbox dianggap "di awal baris" kalau anak elemen pertama yang bukan whitespace = .wd-check
      for (const c of Array.from(b.childNodes)) {
        if (c.nodeType === 3 && !c.textContent.trim()) continue;
        return c.nodeType === 1 && c.classList?.contains('wd-check') ? c : null;
      }
      return null;
    };
    const allChecked = blocks.every(b => firstCheck(b));
    for (const b of blocks) {
      const existing = firstCheck(b);
      if (allChecked) {
        // cabut checkbox + spasi pengiringnya
        const next = existing.nextSibling;
        if (next && next.nodeType === 3 && /^[  ]/.test(next.textContent)) next.textContent = next.textContent.replace(/^[  ]/, '');
        existing.remove();
        if (!b.textContent.replace(/\s/g, '') && !b.querySelector('br,img')) b.innerHTML = '<br>';
      } else if (!existing) {
        // baris kosong (cuma <br>) → buang <br> supaya checkbox tidak turun baris
        if (b.childNodes.length === 1 && b.firstChild.nodeName === 'BR') b.innerHTML = '';
        b.insertBefore(document.createTextNode(' '), b.firstChild);
        b.insertBefore(makeCheck(), b.firstChild);
      }
    }
    // Seleksi tetap menyorot baris-baris yang sama (biar bisa lanjut format/aksi lain)
    const r = document.createRange();
    r.setStartBefore(blocks[0]);
    r.setEndAfter(blocks[blocks.length - 1]);
    sel.removeAllRanges();
    sel.addRange(r);
    return true;
  }

  function insertCheckbox() {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    // Ada teks yang di-block → mode massal per baris (seperti bullet/numbered list)
    if (!sel.isCollapsed) {
      if (toggleCheckboxOnSelection(ed, sel)) { queueSave({ content: ed.innerHTML }); return; }
    }
    // Pastikan baris jadi block <div> supaya perilaku Enter (lanjut checkbox)
    // bisa mengenali batas baris. Di dalam bullet/numbered list jangan —
    // formatBlock bakal merusak strukturnya.
    const anchorEl = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
    if (!anchorEl?.closest?.('li')) document.execCommand('formatBlock', false, '<div>');
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const span = makeCheck();
    // Spasi pengiring = nbsp, bukan spasi biasa — spasi biasa di ujung baris
    // di-collapse browser sehingga kursor "hilang" di samping checkbox.
    const space = document.createTextNode(' ');
    range.insertNode(space);
    range.insertNode(span);   // urutan akhir: span lalu spasi
    placeCaretAfter(space);
    queueSave({ content: ed.innerHTML });
  }

  /* Kata tepat sebelum kursor = URL → bungkus jadi <a>, kursor ditaruh setelahnya
     supaya spasi/Enter yang sedang diketik jatuh DI LUAR link. */
  function linkifyAtCaret() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3) return false;
    if (node.parentNode?.closest?.('a')) return false;
    const offset = sel.anchorOffset;
    const m = node.textContent.slice(0, offset).match(/(\S+)$/);
    if (!m) return false;
    const word = cleanUrl(m[1]);
    if (!URL_ONE.test(word)) return false;
    const start = offset - m[1].length;
    const r = document.createRange();
    r.setStart(node, start);
    r.setEnd(node, start + word.length);
    const a = makeLinkEl(word);
    try { r.surroundContents(a); } catch { return false; }
    const after = document.createRange();
    after.setStartAfter(a);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    return true;
  }

  /* Enter di baris checklist berperilaku seperti bullet list:
     baris berisi teks → baris baru dengan checkbox baru;
     baris checkbox kosong (Enter kedua) → checkbox dihapus, jadi baris polos. */
  function onEditorKeyDown(e) {
    /* Tab = respon di DALAM tulisan ala Notepad Windows (31 Agu 2026) — bukan
       loncat fokus ke elemen lain. Di dalam bullet/numbered list: Tab/Shift+Tab
       menggeser level list; di teks biasa: sisipkan karakter tab (dirender via
       white-space pre-wrap + tab-size di globals.css). */
    if (e.key === 'Tab') {
      e.preventDefault();
      const ed = editorRef.current;
      const s = window.getSelection();
      const el = s?.anchorNode?.nodeType === 3 ? s.anchorNode.parentNode : s?.anchorNode;
      if (el?.closest?.('li')) {
        document.execCommand(e.shiftKey ? 'outdent' : 'indent');
      } else if (!e.shiftKey) {
        document.execCommand('insertText', false, '\t');
      }
      if (ed) queueSave({ content: ed.innerHTML });
      return;
    }
    // URL yang baru selesai diketik langsung jadi link begitu spasi/Enter ditekan
    if ((e.key === ' ' || e.key === 'Enter') && !e.shiftKey) {
      if (linkifyAtCaret()) queueSave({ content: editorRef.current.innerHTML });
    }
    if (e.key !== 'Enter' || e.shiftKey) return;
    const ed = editorRef.current;
    const sel = window.getSelection();
    if (!ed || !sel || !sel.rangeCount) return;
    const anchorEl = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
    if (!anchorEl || anchorEl.closest?.('li')) return;   // list asli: biarkan browser
    // Blok baris = ancestor kursor yang anak langsung editor
    let block = sel.getRangeAt(0).startContainer;
    while (block && block.parentNode !== ed) block = block.parentNode;
    if (!block || block.nodeType !== 1 || !block.querySelector('.wd-check')) return;
    e.preventDefault();
    const isEmpty = block.textContent.replace(/[☐☑ \s]/g, '') === '';
    if (isEmpty) {
      // Enter kedua: buang checkbox, baris ini jadi baris kosong biasa
      block.innerHTML = '<br>';
      const r = document.createRange();
      r.setStart(block, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    } else {
      // Enter pertama: pecah baris di posisi kursor, baris baru diawali checkbox
      const range = sel.getRangeAt(0);
      const tailRange = range.cloneRange();
      tailRange.setEnd(block, block.childNodes.length);
      const tail = tailRange.extractContents();   // sisa teks setelah kursor ikut pindah
      const nd = document.createElement('div');
      const space = document.createTextNode(' ');
      nd.appendChild(makeCheck());
      nd.appendChild(space);
      nd.appendChild(tail);
      block.after(nd);
      placeCaretAfter(space);
    }
    queueSave({ content: ed.innerHTML });
  }

  /* ── Klik di tepi KIRI sebuah baris = block satu baris itu (ala Notepad/Word,
        31 Agu 2026). "Gutter" = area padding kiri editor (22px): kursor di sana
        berubah jadi panah (class wd-gutter), klik memilih seluruh blok baris
        pada ketinggian klik. Baris = div/p/h3 anak langsung editor, atau li. ── */
  const GUTTER_W = isMobile ? 16 : 24;   // = padding kiri editor (notes-ridgeline.css .rgn-editor-body)

  function lineBlockFromPoint(x, y) {
    const ed = editorRef.current;
    let node = null;
    if (document.caretRangeFromPoint) node = document.caretRangeFromPoint(x, y)?.startContainer;
    else if (document.caretPositionFromPoint) node = document.caretPositionFromPoint(x, y)?.offsetNode;
    if (!node || node === ed || !ed.contains(node)) return null;
    let block = node;
    while (block.parentNode !== ed && !(block.nodeType === 1 && block.tagName === 'LI')) {
      block = block.parentNode;
      if (!block || block === ed) return null;
    }
    return block;
  }

  function onEditorMouseDown(e) {
    const ed = editorRef.current;
    if (!ed || e.button !== 0) return;
    if (e.clientX - ed.getBoundingClientRect().left > GUTTER_W) return;
    const block = lineBlockFromPoint(ed.getBoundingClientRect().left + GUTTER_W + 6, e.clientY);
    if (!block) return;
    e.preventDefault();   // jangan pindahkan kursor ke awal baris — kita mau block
    ed.focus({ preventScroll: true });   // toolbar (bold dsb.) tetap bisa langsung dipakai
    const sel = window.getSelection();
    const r = document.createRange();
    r.selectNodeContents(block);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  function onEditorMouseMove(e) {
    const ed = editorRef.current;
    if (!ed) return;
    // Toggle class langsung (bukan state) — pola sama dengan wd-ctrl, anti re-render
    ed.classList.toggle('wd-gutter', e.clientX - ed.getBoundingClientRect().left <= GUTTER_W);
  }

  function onEditorClick(e) {
    // Ctrl/Cmd+klik pada link → buka di tab baru; klik biasa tetap mengedit teks
    const link = e.target.closest?.('a');
    if (link && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      window.open(link.href, '_blank', 'noopener');
      return;
    }
    const box = e.target.closest?.('.wd-check');
    if (!box) return;
    const done = box.getAttribute('data-done') === '1';
    box.setAttribute('data-done', done ? '0' : '1');
    box.textContent = done ? '☐' : '☑';
    queueSave({ content: editorRef.current.innerHTML });
  }

  /* Paste: SELALU teks polos — format bawaan sumber (tabel/warna/font dari
     spreadsheet atau web) TIDAK ikut terbawa, tampilan mengikuti gaya Notes.
     URL tunggal → langsung link di posisi kursor. Teks panjang → ditempel via
     insertText (plain), lalu seluruh isi di-linkify; posisi kursor dijaga
     pakai penanda sementara (span) yang dihapus lagi setelahnya. */
  function onEditorPaste(e) {
    const ed = editorRef.current;
    if (!ed) return;
    const plain = e.clipboardData?.getData('text/plain') || '';
    if (!plain) return;   // clipboard tanpa teks (mis. gambar) → biarkan default
    const raw = plain.trim();
    const single = cleanUrl(raw);
    if (single && !/\s/.test(raw) && URL_ONE.test(single)) {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const r = sel.getRangeAt(0);
      r.deleteContents();
      const a = makeLinkEl(single);
      a.textContent = single;
      const space = document.createTextNode(' ');   // nbsp — spasi biasa di ujung baris di-collapse browser
      r.insertNode(space);
      r.insertNode(a);
      placeCaretAfter(space);
      queueSave({ content: ed.innerHTML });
      return;
    }
    // Teks umum: tempel versi PLAIN-nya saja (execCommand insertText menjaga
    // undo stack + memicu onInput → auto-save), format sumber dibuang.
    e.preventDefault();
    document.execCommand('insertText', false, plain);
    setTimeout(() => {
      const sel = window.getSelection();
      let marker = null;
      if (sel && sel.rangeCount) {
        marker = document.createElement('span');
        sel.getRangeAt(0).insertNode(marker);
      }
      const changed = linkifyDom(ed);
      if (marker) {
        const parent = marker.parentNode;
        const idx = Array.prototype.indexOf.call(parent.childNodes, marker);
        marker.remove();
        const r = document.createRange();
        r.setStart(parent, idx);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
      if (changed) queueSave({ content: ed.innerHTML });
    }, 0);
  }

  const visible = useMemo(() => {
    const list = notes || [];
    if (!q.trim()) return list;
    const s = q.trim().toLowerCase();
    return list.filter(n =>
      (n.title || '').toLowerCase().includes(s) ||
      plainText(n.content).toLowerCase().includes(s));
  }, [notes, q]);

  const pinned = visible.filter(n => n.pinned);
  const rest = visible.filter(n => !n.pinned);

  /* Popover stabilo: tutup saat klik di luar (guard closest — lihat outside-click-listener-guard) / Esc */
  useEffect(() => {
    if (!showHl) return;
    const onDown = (e) => { if (!e.target.closest?.('[data-hl]')) setShowHl(false); };
    const onKey = (e) => { if (e.key === 'Escape') setShowHl(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [showHl]);

  if (!role || role !== 'admin') return null;

  const showList   = !isMobile || mobileView === 'list';
  const showEditor = !isMobile || mobileView === 'editor';
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  const ctxLine = notes === null
    ? <span>Loading notes…</span>
    : (<>
        {!isMobile && (<>
          <span className="rg-live" aria-hidden="true" />
          <span>Workspace</span>
          <span className="rg-ctx-sep" aria-hidden="true" />
        </>)}
        <span>{plural(notes.length, 'note')}</span>
        {!isMobile && (<>
          <span className="rg-ctx-sep" aria-hidden="true" />
          <span>Synced across your devices</span>
        </>)}
      </>);

  /* Tombol toolbar editor — onMouseDown preventDefault menjaga seleksi teks */
  const toolBtn = (onClick, title, children, extra) => (
    <button type="button" className="rgn-tool" onMouseDown={e => e.preventDefault()} onClick={onClick}
      title={title} aria-label={title} {...extra}>{children}</button>
  );

  /* Baris catatan — dirender lewat FUNGSI biasa (bukan komponen di dalam komponen):
     komponen yang didefinisikan di dalam render di-remount tiap ketikan (animasi &
     hover ikut reset). Pola sama dengan groupHeader/groupBody. */
  const renderNoteRow = (n) => {
    const isActive = n.id === activeId && (!isMobile || mobileView === 'editor');
    const preview = plainText(n.content).slice(0, 90);
    const showHandle = !isMobile && canReorder;
    return (
      <div
        key={n.id}
        className={`rgn-note${isActive ? ' is-on' : ''}${dragId === n.id ? ' is-drag' : ''}`}
        onClick={() => selectNote(n.id)}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); selectNote(n.id); } }}
        role="button"
        tabIndex={0}
        aria-current={isActive || undefined}
        onDragOver={e => {
          if (!dragIdRef.current || dragIdRef.current === n.id) return;
          e.preventDefault();
          moveNote(dragIdRef.current, n.id);
        }}
        onDrop={e => e.preventDefault()}
      >
        {showHandle && (
          <span
            className="rgn-grip"
            draggable
            onClick={e => e.stopPropagation()}
            onDragStart={e => {
              dragIdRef.current = n.id;
              setDragId(n.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={endReorder}
            title="Drag to reorder"
          ><GripVertical size={12} /></span>
        )}
        <div className="rgn-note-top">
          <span className="rgn-note-title">{n.title || 'Untitled note'}</span>
          <button type="button" className={`rgn-note-act${n.pinned ? ' is-on' : ''}`}
            onClick={e => { e.stopPropagation(); togglePin(n); }}
            title={n.pinned ? 'Unpin' : 'Pin to top'} aria-label={n.pinned ? 'Unpin note' : 'Pin note to top'}>
            <Pin size={13} fill={n.pinned ? 'currentColor' : 'none'} />
          </button>
          <button type="button" className="rgn-note-act is-del"
            onClick={e => { e.stopPropagation(); setConfirmDelete(n); }}
            title="Delete note" aria-label="Delete note">
            <Trash2 size={13} />
          </button>
        </div>
        <div className="rgn-note-sub">
          <span className="rgn-note-prev">{preview || 'Empty note'}</span>
          <span className="rgn-note-time">{relativeTime(n.updated_at)}</span>
        </div>
      </div>
    );
  };

  /* ── Grup daftar yang bisa dilipat ──
     Dipanggil sebagai FUNGSI biasa (bukan komponen JSX) supaya elemennya tidak
     di-remount tiap render — kalau remount, transisi lipatnya tidak jalan.
     Animasi tinggi pakai grid-template-rows 1fr→0fr: isi grup "tersedot" ke atas
     masuk ke header, keluar lagi ke bawah saat dibuka. */
  const groupHeader = (id, label, count) => {
    const min = isGroupMin(id);
    return (
      <button type="button" className={`rgn-group${min ? ' is-min' : ''}`} onClick={() => toggleGroup(id)}
        aria-expanded={!min} title={min ? 'Show notes' : 'Hide notes'}>
        <ChevronDown size={13} />
        <span>{label}</span>
        <span className="rgn-group-n rg-mono">{count}</span>
      </button>
    );
  };
  const groupBody = (id, children) => (
    <div className={`rgn-group-body${isGroupMin(id) ? ' is-min' : ''}`}>
      <div className="rgn-group-in">{children}</div>
    </div>
  );

  return (
    <div className={`rg rg-page rgn ${dashboardFontVars}${isMobile ? ' is-mobile' : ''}`}>

      {/* ══ TOP BAR — judul + konteks (kiri) · aksi (kanan) ══ */}
      <header className="rg-top">
        <div className="rg-top-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isMobile && mobileView === 'editor' && (
            <button type="button" className="rg-iconbtn rgn-back" onClick={() => setMobileView('list')}
              title="Back to list" aria-label="Back to list"><ChevronLeft size={18} /></button>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="rg-h1">Notes</h1>
            </div>
            <div className="rg-ctx">{ctxLine}</div>
          </div>
        </div>

        <div className="rg-tools">
          <button type="button" className="rg-pill is-primary" onClick={createNote}>
            <Plus size={15} />New note
          </button>
          {!isMobile && (<>
            <span className="rg-vsep" aria-hidden="true" />
            <ThemeToggle className="rg-pill rg-round" />
          </>)}
        </div>
      </header>

      {/* ══ ISI ══ */}
      <div className="rgn-body">

        {/* ── Kolom kiri: kartu Notes ── */}
        {showList && (
          <div ref={sideRef} className="rgn-side" style={isMobile ? undefined : { width: `${listWidth}px` }}>
            <section className="rg-card rgn-notes rg-rise" aria-label="Notes">
              <div className="rg-head">
                <span className="rg-head-ico"><FileText size={15} /></span>
                <span className="rg-title">Notes</span>
                {notes !== null && <span className="rgn-count rg-mono">{notes.length}</span>}
              </div>
              <div className="rg-well rgn-list-well">
                <label className="rgn-field">
                  <Search size={15} />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search notes…" aria-label="Search notes" />
                  {q && (
                    <button type="button" className="rgn-field-x" onClick={() => setQ('')} title="Clear search" aria-label="Clear search">
                      <X size={13} />
                    </button>
                  )}
                </label>
                <div className="rgn-list">
                  {notes === null && (
                    <div className="rgn-skel" aria-label="Loading notes">
                      {[62, 78, 55, 70].map((w, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '7px 0' }}>
                          <span className="rg-skel" style={{ height: 12, width: `${w}%` }} />
                          <span className="rg-skel" style={{ height: 10, width: '88%' }} />
                        </div>
                      ))}
                    </div>
                  )}
                  {notes !== null && visible.length === 0 && (
                    <div className="rgn-hint">
                      {q ? 'No note matches your search.' : 'No notes yet — hit New note to write your first one.'}
                    </div>
                  )}
                  {pinned.length > 0 && groupHeader('pinned', 'Pinned', pinned.length)}
                  {pinned.length > 0 && groupBody('pinned', pinned.map(renderNoteRow))}
                  {rest.length > 0 && groupHeader('all', 'All notes', rest.length)}
                  {rest.length > 0 && groupBody('all', rest.map(renderNoteRow))}
                  {notes !== null && notes.length > 1 && !canReorder && !isMobile && (
                    <div className="rgn-hint">
                      Mau geser urutan catatan? Jalankan <strong>supabase-notes-update-1.sql</strong> sekali di Supabase SQL Editor, lalu refresh halaman ini.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ── Pembatas geser kolom kiri ↔ editor (desktop) ── */}
        {!isMobile && showList && showEditor && (
          <div className={`rgn-vsplit${listDragging ? ' is-drag' : ''}`} onMouseDown={startDrag}
            title="Drag to resize" aria-hidden="true" />
        )}

        {/* ── Kartu kanan: editor catatan ── */}
        {showEditor && (
          <section className="rg-card rgn-editor rg-rise" style={{ animationDelay: '40ms' }}
            aria-label="Note editor">
            {active ? (
              <>
                <div className="rg-head rgn-ed-head">
                  <div className="rgn-toolbar" role="toolbar" aria-label="Formatting">
                    {toolBtn(() => exec('bold'), 'Bold', <Bold size={15} />)}
                    {toolBtn(() => exec('italic'), 'Italic', <Italic size={15} />)}
                    {toolBtn(() => exec('strikeThrough'), 'Strikethrough', <Strikethrough size={15} />)}
                    {toolBtn(() => exec('formatBlock', '<h3>'), 'Heading', <Heading size={15} />)}
                    <span className="rgn-tsep" aria-hidden="true" />
                    {toolBtn(() => exec('insertUnorderedList'), 'Bullet list', <List size={15} />)}
                    {toolBtn(() => exec('insertOrderedList'), 'Numbered list', <ListOrdered size={15} />)}
                    {toolBtn(insertCheckbox, 'Checklist item', <SquareCheck size={15} />)}
                    <span className="rgn-tsep" aria-hidden="true" />
                    <div className="rgn-hl-wrap" data-hl>
                      {toolBtn(() => setShowHl(v => !v), 'Highlight', <Highlighter size={15} />,
                        { 'aria-expanded': showHl, 'aria-haspopup': 'true' })}
                      {showHl && (
                        <div className="rgn-hl-pos">{/* lapisan posisi — tidak dianimasikan */}
                          <div className="rgn-hl" role="group" aria-label="Highlight color">
                            {HIGHLIGHTS.map(h => (
                              <button key={h.value} type="button" className="rgn-hl-sw" title={h.name} aria-label={`${h.name} highlight`}
                                style={{ background: h.value }}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => { exec('hiliteColor', h.value); setShowHl(false); }} />
                            ))}
                            <button type="button" className="rgn-hl-sw is-none" title="Remove highlight" aria-label="Remove highlight"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => { exec('hiliteColor', 'transparent'); setShowHl(false); }}><X size={13} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                    {toolBtn(() => exec('removeFormat'), 'Clear formatting', <RemoveFormatting size={15} />)}
                  </div>
                  {toolBtn(copyNote, copied ? 'Copied' : 'Copy note as plain text',
                    copied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} />,
                    copied ? { className: 'rgn-tool rgn-copied' } : undefined)}
                </div>

                <div className="rg-well rgn-doc">
                  <div className="rgn-doc-head">
                    <input
                      ref={titleRef}
                      className="rgn-doc-title"
                      value={active.title || ''}
                      onChange={e => queueSave({ title: e.target.value })}
                      placeholder="Note title"
                      aria-label="Note title"
                    />
                    <div className="rgn-doc-meta">
                      {active.pinned && <span className="rg-chip"><Pin size={11} fill="currentColor" />Pinned</span>}
                      <span className={`rgn-status${status === 'saving' ? ' is-saving' : status === 'saved' ? ' is-saved' : ''}`}>
                        {status === 'saving' ? 'Saving…'
                          : status === 'saved' ? <><Check size={13} strokeWidth={2.5} />Saved</>
                          : `Edited ${relativeTime(active.updated_at)}`}
                      </span>
                    </div>
                  </div>
                  <div className="rgn-rule" aria-hidden="true" />
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => queueSave({ content: editorRef.current.innerHTML })}
                    onClick={onEditorClick}
                    onKeyDown={onEditorKeyDown}
                    onPaste={onEditorPaste}
                    onMouseDown={onEditorMouseDown}
                    onMouseMove={onEditorMouseMove}
                    onDragStart={e => e.preventDefault()}
                    onDrop={e => e.preventDefault()}
                    className="wd-note-editor rgn-editor-body"
                    role="textbox"
                    aria-multiline="true"
                    aria-label="Note content"
                  />
                </div>
              </>
            ) : notes === null ? (
              <div className="rg-well rgn-doc" aria-label="Loading note">
                <div className="rgn-doc-head">
                  <span className="rg-skel" style={{ height: 22, width: '42%' }} />
                  <span className="rg-skel" style={{ height: 11, width: 120, marginTop: 12 }} />
                </div>
                <div className="rgn-rule" aria-hidden="true" />
                <div className="rgn-skel" style={{ padding: '20px 24px', gap: 12 }}>
                  {[92, 78, 86, 58].map((w, i) => <span key={i} className="rg-skel" style={{ height: 12, width: `${w}%` }} />)}
                </div>
              </div>
            ) : (
              <div className="rg-well rgn-doc">
                <div className="rg-empty rgn-empty">
                  <span className="rgn-empty-ico"><NotebookPen size={20} /></span>
                  <strong>Nothing open</strong>
                  <span>Create a note to jot down campaign ideas, follow-up scripts, or anything you need on hand from any device.</span>
                  <button type="button" className="rg-btn rg-btn-primary" onClick={createNote}><Plus size={15} />New note</button>
                </div>
              </div>
            )}

            {error && (
              <div className="rgn-err" role="alert">
                <CircleAlert size={15} />
                <span>{error}</span>
                <button type="button" className="rg-btn" onClick={() => { setError(null); load(); }}>
                  <RefreshCw size={13} />Retry
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* ══ KONFIRMASI HAPUS CATATAN — Esc & klik latar menutup ══ */}
      {confirmDelete && (
        <RgDialog
          icon={Trash2}
          tone="neg"
          title="Delete this note?"
          sub={confirmDelete.title || 'Untitled note'}
          onClose={() => setConfirmDelete(null)}
          busy={deleting}
          width={400}
          foot={<>
            <button type="button" className="rg-btn rg-btn-ghost" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</button>
            <button type="button" className={`rg-btn rg-btn-danger${deleting ? ' is-busy' : ''}`} onClick={confirmDeleteNow} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </>}
        >
          It will be removed from every device. This can’t be undone.
        </RgDialog>
      )}
    </div>
  );
}
