'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ListTodo, Sun, Star, CalendarDays, Inbox, Plus,
  ChevronRight, Check, Pencil, Trash2, CircleAlert,
} from 'lucide-react';
import { RgMenu } from './rgKit';
import { todayStr, dueLabel, isOverdue } from './useTodos';
import { useSpringCheck, CheckCircle, StrikeText } from './springCheck';
import { playDoneSound } from './todoSound';

// Jeda sebelum tugas yang dicentang pindah ke "Completed" — cukup untuk animasi
// centang + garis coret terlihat utuh (seperti Microsoft To Do)
const DONE_MOVE_MS = 550;

/* ─────────────────────────────────────────────────────────────
   TODO PANEL — isi kartu tugas di halaman To Do (/todo), ala Microsoft
   To Do. Tampilan (view): My Day · Important · Planned · Tasks (bawaan) ·
   daftar kustom. Desktop: view dipilih dari kartu "Lists" di kiri halaman,
   kepala kartu ini menampilkan nama view + ganti nama/hapus daftar kustom.
   HP (viewMenu): tidak ada kartu Lists → view dipilih dari menu pil di
   kepala kartu. Klik tugas → detailnya tampil di kartu kanan (TodoDetail).
   Dialog daftar baru/ganti nama & konfirmasi hapus ada di app/todo/page.js.
   Styling di notes-ridgeline.css (.rgn-task* dst.) + todo-ridgeline.css.
   ───────────────────────────────────────────────────────────── */

export const BUILTIN_VIEWS = [
  { id: 'myday',     label: 'My Day',    Icon: Sun },
  { id: 'important', label: 'Important', Icon: Star },
  { id: 'planned',   label: 'Planned',   Icon: CalendarDays },
  { id: 'tasks',     label: 'Tasks',     Icon: Inbox },
];
export const listViewId = (id) => `list:${id}`;
export const listIdOfView = (view) => (view?.startsWith('list:') ? view.slice(5) : null);

export function viewMeta(view, lists) {
  const b = BUILTIN_VIEWS.find(v => v.id === view);
  if (b) return { ...b, list: null };
  const l = lists.find(x => listViewId(x.id) === view);
  if (l) return { id: view, label: l.name, Icon: null, color: l.color, list: l };
  return { ...BUILTIN_VIEWS[3], list: null };
}

/* Tugas mana yang masuk view ini (belum termasuk pemisahan selesai/belum) */
export function tasksForView(todos, view) {
  const today = todayStr();
  const lid = listIdOfView(view);
  return (todos || []).filter(t => {
    if (view === 'myday')     return t.my_day_date === today;
    if (view === 'important') return !!t.starred;
    if (view === 'planned')   return !!t.due_date;
    if (view === 'tasks')     return !t.list_id;
    if (lid)                  return t.list_id === lid;
    return true;
  });
}

/* Teks saat view belum punya tugas sama sekali: [judul, keterangan] */
const EMPTY_COPY = {
  myday:     ['Focus on your day', 'Add what you want to get done today. My Day starts fresh every morning.'],
  important: ['No important tasks', 'Star a task to keep it within reach here.'],
  planned:   ['Nothing planned', 'Tasks with a due date show up here, sorted by deadline.'],
};
const EMPTY_DEFAULT = ['No tasks yet', 'Type in the box above and press Enter to add one.'];

export default function TodoPanel({
  td, view, setView, selectedId, onSelect, isMobile,
  onNewList, onRenameList, onRequestDeleteList, viewMenu = false,
}) {
  const { lists, todos, error } = td;
  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);

  /* ── Geser urutan tugas (tekan kiri di baris → kursor tangan → geser atas/bawah) ──
     Tanpa HTML5 drag: mousedown di baris mencatat titik awal; begitu bergerak >5px jadi
     mode geser (body cursor grabbing), baris lain yang dilewati kursor (onMouseEnter)
     memicu td.moveTask; mouseup → commitOrder + klik berikutnya ditelan (bukan pilih). */
  const dragRef = useRef({ id: null, startY: 0, active: false, moved: false });
  const suppressClick = useRef(false);
  const tdRef = useRef(td); tdRef.current = td;   // listener global pakai td terbaru tanpa re-subscribe
  const [dragId, setDragId] = useState(null);
  const canDrag = !isMobile && view !== 'planned';   // Planned urut tenggat, tidak bisa digeser

  useEffect(() => {
    function onMove(e) {
      const d = dragRef.current;
      if (!d.id) return;
      if (!d.active && Math.abs(e.clientY - d.startY) > 5) {
        d.active = true;
        setDragId(d.id);
        document.body.style.userSelect = 'none';
      }
    }
    function onUp() {
      const d = dragRef.current;
      if (!d.id) return;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (d.active) {
        if (d.moved) tdRef.current.commitOrder();
        suppressClick.current = true;                       // klik yang menyusul mouseup ditelan
        setTimeout(() => { suppressClick.current = false; }, 0);
      }
      d.id = null; d.active = false; d.moved = false;
      setDragId(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  function pressRow(id, e) {
    if (!canDrag || e.button !== 0) return;
    if (e.target.closest('button,input,a')) return;   // tombol selesai/⭐ bukan pegangan
    dragRef.current = { id, startY: e.clientY, active: false, moved: false };
    document.body.style.cursor = 'grabbing';           // "tangan" begitu ditekan
  }
  function enterRow(id) {
    const d = dragRef.current;
    if (!d.active || d.id === id) return;
    td.moveTask(d.id, id);
    d.moved = true;
  }
  function clickRow(id) {
    if (suppressClick.current) return;   // setelah geser, jangan dianggap klik pilih
    onSelect(id);
  }

  const meta = viewMeta(view, lists);
  const ViewIcon = meta.Icon;
  const inView = useMemo(() => tasksForView(todos, view), [todos, view]);
  const open = useMemo(() => {
    const o = inView.filter(t => !t.done);
    if (view === 'planned') return [...o].sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));
    return o; // urutan array todos = sort_order (geser manual), tugas baru paling atas
  }, [inView, view]);
  const done = useMemo(() => [...inView.filter(t => t.done)].sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')), [inView]);

  async function quickAdd() {
    const title = draft.trim();
    if (!title) return;
    setDraft('');
    const lid = listIdOfView(view);
    await td.createTask({
      title,
      listId: lid,
      starred: view === 'important',
      myDay: view === 'myday',
      dueDate: view === 'planned' ? todayStr() : null,
    });
  }

  const viewOptions = [
    ...BUILTIN_VIEWS.map(v => ({ value: v.id, label: v.label, Icon: v.Icon })),
    ...lists.map(l => ({ value: listViewId(l.id), label: l.name, dot: l.color || 'var(--rg-t3)' })),
  ];

  const openCount = open.length;
  const [emptyTitle, emptyText] = meta.list ? EMPTY_DEFAULT : (EMPTY_COPY[view] || EMPTY_DEFAULT);
  const rowProps = (t) => ({
    t, td, view, isSel: t.id === selectedId, onSelect: clickRow,
    onPress: t.done ? null : pressRow, onEnter: t.done ? null : enterRow,
    isDragging: dragId === t.id, canDrag: canDrag && !t.done,
  });

  return (
    <>
      {/* Kepala kartu — desktop: nama view · jumlah · aksi daftar kustom; HP: menu pil view */}
      <div className="rg-head rgn-todo-head">
        {viewMenu ? (
          <RgMenu
            className="rg-pill rgn-view"
            label={meta.label}
            icon={ViewIcon || undefined}
            dot={ViewIcon ? undefined : (meta.color || 'var(--rg-t3)')}
            options={viewOptions}
            value={view}
            onSelect={setView}
            align="left"
            minWidth={210}
            title="Choose a view"
            footer={(close) => (<>
              <button type="button" className="rg-menu-item" onClick={() => { close(); onNewList(); }}>
                <Plus size={15} className="rg-menu-ico" /><span>New list</span>
              </button>
              {meta.list && (
                <button type="button" className="rg-menu-item" onClick={() => { close(); onRenameList(meta.list); }}>
                  <Pencil size={15} className="rg-menu-ico" /><span>Rename list</span>
                </button>
              )}
              {meta.list && (
                <button type="button" className="rg-menu-item is-neg" onClick={() => { close(); onRequestDeleteList(meta.list); }}>
                  <Trash2 size={15} className="rg-menu-ico" /><span>Delete list</span>
                </button>
              )}
            </>)}
          />
        ) : (<>
          <span className="rg-head-ico">
            {ViewIcon ? <ViewIcon size={15} /> : <span className="rg-menu-dot" style={{ background: meta.color || 'var(--rg-t3)' }} />}
          </span>
          <span className="rg-title">{meta.label}</span>
        </>)}
        {todos !== null && !error && <span className="rgn-count rg-mono">{openCount} open</span>}
        <span style={{ flex: 1 }} />
        {!viewMenu && view === 'myday' && (
          <span className="rgn-count">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        )}
        {!viewMenu && meta.list && (<>
          <button type="button" className="rg-iconbtn" onClick={() => onRenameList(meta.list)}
            title="Rename list" aria-label="Rename list"><Pencil size={13} /></button>
          <button type="button" className="rg-iconbtn rgt-del" onClick={() => onRequestDeleteList(meta.list)}
            title="Delete list" aria-label="Delete list"><Trash2 size={13} /></button>
        </>)}
      </div>

      <div className="rg-well rgn-todo-well">
        {/* Tambah tugas cepat — konteks view ikut (My Day / Important / Planned / daftar) */}
        {!error && (
          <label className="rgn-field">
            <Plus size={15} />
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') quickAdd(); }}
              placeholder={`Add a task${meta.list ? ` to ${meta.label}` : view === 'myday' ? ' to My Day' : ''}…`}
              aria-label="Add a task"
            />
            {draft.trim() && (
              <button type="button" className="rgn-field-go" onClick={quickAdd} title="Add task" aria-label="Add task">
                <Check size={13} strokeWidth={3} />
              </button>
            )}
          </label>
        )}

        <div className={`rgn-tasks${dragId ? ' is-dragmode' : ''}`}>
          {error?.missing && (
            <div className="rgn-hint" style={{ display: 'flex', gap: 8 }}>
              <CircleAlert size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>To Do is not set up yet — run <strong>supabase-todo-setup.sql</strong> once in the Supabase SQL Editor, then refresh this page.</span>
            </div>
          )}
          {error && !error.missing && <div className="rgn-hint" style={{ color: 'var(--rg-neg)' }}>{error.message}</div>}
          {!error && todos === null && (
            <div className="rgn-skel" aria-label="Loading tasks">
              {[70, 52, 62].map((w, i) => <span key={i} className="rg-skel" style={{ height: 12, width: `${w}%` }} />)}
            </div>
          )}
          {!error && todos !== null && open.length === 0 && done.length === 0 && (
            <div className="rg-empty rgn-empty">
              <span className="rgn-empty-ico">{ViewIcon ? <ViewIcon size={20} /> : <ListTodo size={20} />}</span>
              <strong>{emptyTitle}</strong>
              <span>{emptyText}</span>
            </div>
          )}
          {open.map(t => <TaskRow key={t.id} {...rowProps(t)} />)}
          {done.length > 0 && (
            <>
              <button type="button" className="rgn-done-toggle" aria-expanded={showDone} onClick={() => setShowDone(v => !v)}>
                <ChevronRight size={13} />
                Completed <span className="rgn-group-n rg-mono">{done.length}</span>
              </button>
              {showDone && done.map(t => <TaskRow key={t.id} {...rowProps(t)} />)}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* Baris tugas — di level modul supaya tidak di-remount tiap render panel */
function TaskRow({ t, td, view, isSel, onSelect, onPress, onEnter, isDragging = false, canDrag = false }) {
  const steps = t.steps || [];
  const stepsDone = steps.filter(s => s.done).length;
  const inMyDay = t.my_day_date === todayStr();
  const overdue = !t.done && isOverdue(t.due_date);
  const dueIsToday = t.due_date === todayStr();
  const hasMeta = (inMyDay && view !== 'myday') || t.due_date || steps.length > 0;

  /* Centang ala Microsoft To Do: klik → bunyi + animasi pegas langsung, tugas baru
     disimpan & pindah ke "Completed" setelah DONE_MOVE_MS. Klik lagi selama jeda =
     batal. Baris keburu hilang (ganti view) → langsung disimpan, klik tidak hilang. */
  const [pending, setPending] = useState(false);
  const pendingTimer = useRef(0);
  const commitRef = useRef(null);
  commitRef.current = () => td.toggleDone(t, { sound: false });
  useEffect(() => () => {
    if (pendingTimer.current) { clearTimeout(pendingTimer.current); commitRef.current(); }
  }, []);
  function onCheck(e) {
    e.stopPropagation();
    if (t.done) { td.toggleDone(t); return; }
    if (pendingTimer.current) {
      clearTimeout(pendingTimer.current);
      pendingTimer.current = 0;
      setPending(false);
      return;
    }
    playDoneSound();
    setPending(true);
    pendingTimer.current = setTimeout(() => { pendingTimer.current = 0; commitRef.current(); }, DONE_MOVE_MS);
  }
  const shownDone = t.done || pending;
  const rowRef = useSpringCheck(shownDone);

  return (
    <div
      ref={rowRef}
      className={`rgn-task${isSel ? ' is-sel' : ''}${isDragging ? ' is-drag' : ''}${shownDone ? ' is-done' : ''}`}
      onClick={() => onSelect(t.id)}
      onMouseDown={onPress ? (e) => onPress(t.id, e) : undefined}
      onMouseEnter={onEnter ? () => onEnter(t.id) : undefined}
      title={canDrag ? 'Click to open · press & drag to reorder' : undefined}
    >
      <button type="button" className={`rgn-circle${shownDone ? ' is-done' : ''}`} onClick={onCheck}
        role="checkbox" aria-checked={shownDone}
        title={shownDone ? 'Mark as not done' : 'Mark as done'} aria-label={shownDone ? 'Mark as not done' : 'Mark as done'}>
        <CheckCircle size={17} />
      </button>
      <div className="rgn-task-main">
        <span className="rgn-task-title"><StrikeText>{t.title || 'Untitled task'}</StrikeText></span>
        {hasMeta && (
          <span className="rgn-task-meta">
            {inMyDay && view !== 'myday' && <span><Sun size={11} /> My Day</span>}
            {t.due_date && (
              <span className={`rgn-due${overdue ? ' is-late' : dueIsToday ? ' is-today' : ''}`}>
                <CalendarDays size={11} /> {dueLabel(t.due_date)}
              </span>
            )}
            {steps.length > 0 && <span><span className="rg-mono">{stepsDone}/{steps.length}</span> steps</span>}
          </span>
        )}
      </div>
      <button type="button" className={`rgn-star${t.starred ? ' is-on' : ''}`}
        onClick={e => { e.stopPropagation(); td.toggleStar(t); }}
        title={t.starred ? 'Remove importance' : 'Mark as important'} aria-label={t.starred ? 'Remove importance' : 'Mark as important'}>
        <Star size={14} fill={t.starred ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}
