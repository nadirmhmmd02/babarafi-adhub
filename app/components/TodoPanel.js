'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ListTodo, Sun, Star, CalendarDays, Inbox, Plus,
  ChevronRight, Check, Pencil, Trash2, CircleAlert, Minus, ChevronUp,
} from 'lucide-react';
import { RgMenu, RgDialog } from './rgKit';
import { TODO_LIST_COLORS, todayStr, dueLabel, isOverdue } from './useTodos';
import { useSpringCheck, CheckCircle, StrikeText } from './springCheck';
import { playDoneSound } from './todoSound';

// Jeda sebelum tugas yang dicentang pindah ke "Completed" — cukup untuk animasi
// centang + garis coret terlihat utuh (seperti Microsoft To Do)
const DONE_MOVE_MS = 550;

/* ─────────────────────────────────────────────────────────────
   TODO PANEL — daftar tugas ala Microsoft To Do, kartu di bagian
   bawah kolom kiri halaman Notes. Tampilan (view):
   My Day · Important · Planned · Tasks (bawaan) · daftar kustom.
   Klik tugas → detailnya tampil di panel kanan (TodoDetail).
   Redesain "Ridgeline" (Sep 2026): kepala kartu (judul · jumlah · minimize ·
   pil view) + panel dalam (tambah tugas · daftar). Styling di notes-ridgeline.css.
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

export default function TodoPanel({
  td, view, setView, selectedId, onSelect, onRequestDeleteList, isMobile,
  minimized = false, onToggleMinimize, compact = false,
}) {
  const { lists, todos, error } = td;
  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [listEdit, setListEdit] = useState(null);   // null | { mode:'new'|'rename', id, name, color }

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

  async function commitListEdit() {
    if (!listEdit) return;
    const name = listEdit.name.trim();
    if (!name) { setListEdit(null); return; }
    if (listEdit.mode === 'new') {
      const l = await td.createList(name, listEdit.color);
      if (l) setView(listViewId(l.id));
    } else {
      await td.updateList(listEdit.id, { name, color: listEdit.color });
    }
    setListEdit(null);
  }

  const viewOptions = [
    ...BUILTIN_VIEWS.map(v => ({ value: v.id, label: v.label, Icon: v.Icon })),
    ...lists.map(l => ({ value: listViewId(l.id), label: l.name, dot: l.color || 'var(--rg-t3)' })),
  ];

  const openCount = open.length;
  const rowProps = (t) => ({
    t, td, view, isSel: t.id === selectedId, onSelect: clickRow,
    onPress: t.done ? null : pressRow, onEnter: t.done ? null : enterRow,
    isDragging: dragId === t.id, canDrag: canDrag && !t.done,
  });

  return (
    <div className="rgn-todo-in">
      {/* Kepala kartu — tinggi kartu saat minimized = kepala ini saja (TODO_HEADER_H di notes/page.js) */}
      <div className="rg-head rgn-todo-head">
        <span className="rg-head-ico"><ListTodo size={15} /></span>
        <span className="rg-title">To Do</span>
        {todos !== null && !error && !compact && <span className="rgn-count rg-mono">{openCount} open</span>}
        {/* Minimize / restore ala Windows — di antara judul dan pilihan view */}
        {onToggleMinimize && (
          <button type="button" className="rg-iconbtn rgn-min" onClick={onToggleMinimize}
            title={minimized ? 'Restore To Do' : 'Minimize To Do'} aria-label={minimized ? 'Restore To Do' : 'Minimize To Do'}
            aria-expanded={!minimized}>
            {minimized ? <ChevronUp size={14} strokeWidth={2.25} /> : <Minus size={14} strokeWidth={2.25} />}
          </button>
        )}
        <span style={{ flex: 1 }} />
        {/* Menu view membuka ke ATAS — kartu To Do ada di dasar layar */}
        <RgMenu
          className="rg-pill rgn-view"
          label={meta.label}
          icon={meta.Icon || undefined}
          dot={meta.Icon ? undefined : (meta.color || 'var(--rg-t3)')}
          options={viewOptions}
          value={view}
          onSelect={setView}
          align="right"
          direction="up"
          minWidth={210}
          title="Choose a view"
          footer={(close) => (<>
            <button type="button" className="rg-menu-item" onClick={() => { close(); setListEdit({ mode: 'new', id: null, name: '', color: TODO_LIST_COLORS[1] }); }}>
              <Plus size={15} className="rg-menu-ico" /><span>New list</span>
            </button>
            {meta.list && (
              <button type="button" className="rg-menu-item" onClick={() => { close(); setListEdit({ mode: 'rename', id: meta.list.id, name: meta.list.name, color: meta.list.color }); }}>
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
              tabIndex={minimized ? -1 : undefined}
            />
            {draft.trim() && (
              <button type="button" className="rgn-field-go" onClick={quickAdd} title="Add task" aria-label="Add task">
                <Check size={13} strokeWidth={3} />
              </button>
            )}
          </label>
        )}

        {/* Daftar tugas — saat minimized tetap dirender (ikut terpotong animasi tinggi) tapi tak bisa di-scroll */}
        <div className={`rgn-tasks${dragId ? ' is-dragmode' : ''}`} style={minimized ? { overflowY: 'hidden' } : undefined}>
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
            <div className="rgn-hint">
              {view === 'myday' ? 'My Day is empty — add what you want to focus on today.' : 'No tasks here yet.'}
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

      {/* Daftar baru / ganti nama — dialog skin */}
      {listEdit && (
        <RgDialog
          icon={listEdit.mode === 'new' ? Plus : Pencil}
          title={listEdit.mode === 'new' ? 'New list' : 'Rename list'}
          sub="To Do"
          onClose={() => setListEdit(null)}
          width={380}
          foot={<>
            <button type="button" className="rg-btn rg-btn-ghost" onClick={() => setListEdit(null)}>Cancel</button>
            <button type="button" className="rg-btn rg-btn-primary" disabled={!listEdit.name.trim()} onClick={commitListEdit}>
              {listEdit.mode === 'new' ? 'Create list' : 'Save'}
            </button>
          </>}
        >
          <div className="rgn-dlg">
            <div className="rg-field">
              <label className="rg-label" htmlFor="rgn-list-name">Name</label>
              <input id="rgn-list-name" className="rg-input" autoFocus value={listEdit.name}
                onChange={e => setListEdit(le => ({ ...le, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') commitListEdit(); }}
                placeholder={listEdit.mode === 'new' ? 'e.g. Campaign ops' : 'List name'} />
            </div>
            <div className="rg-field">
              <span className="rg-label">Color</span>
              <div className="rgn-swatches">
                {TODO_LIST_COLORS.map(c => {
                  const on = listEdit.color === c;
                  return (
                    <button key={c} type="button" className={`rgn-swatch${on ? ' is-on' : ''}`} style={{ '--c': c }}
                      aria-pressed={on} aria-label={`Color ${c}`} title={c}
                      onClick={() => setListEdit(le => ({ ...le, color: on ? null : c }))} />
                  );
                })}
              </div>
            </div>
          </div>
        </RgDialog>
      )}
    </div>
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
