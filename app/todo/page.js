'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import '../notes-ridgeline.css';
import '../todo-ridgeline.css';
import { Plus, Pencil, Trash2, ChevronLeft, ListTodo } from 'lucide-react';
import { useAuth, homeFor } from '../components/AuthContext';
import useIsMobile from '../components/useIsMobile';
import ThemeToggle from '../components/ThemeToggle';
import useTodos, { TODO_LIST_COLORS, todayStr, isOverdue } from '../components/useTodos';
import TodoPanel, { BUILTIN_VIEWS, listViewId, tasksForView } from '../components/TodoPanel';
import TodoDetail from '../components/TodoDetail';
import { dashboardFontVars } from '../components/dashboardFonts';
import { RgDialog } from '../components/rgKit';

/* ─────────────────────────────────────────────────────────────
   TO DO — daftar tugas pribadi admin ala Microsoft To Do (halaman
   penuh, /todo; sub menu Workspace di Sidebar). Sampai 5 Okt 2026
   fitur ini menumpang di halaman Notes; data & perilakunya TIDAK
   berubah (hook useTodos, tabel todo_lists + todos, RLS per pemilik).

   Desktop, kiri → kanan: kartu "Lists" (My Day · Important · Planned ·
   Tasks · daftar kustom + New list) → kartu tugas (TodoPanel) → kartu
   detail tugas (TodoDetail) yang meluncur masuk saat sebuah tugas
   diklik (klik lagi / tombol X = tutup).
   HP: satu kolom — kartu tugas (view dipilih dari menu pil) ↔ detail.
   Styling: todo-ridgeline.css (.rgt-) + notes-ridgeline.css (.rgn-).
   ───────────────────────────────────────────────────────────── */

const DETAIL_CLOSE_MS = 340;   // = lama transisi lebar .rgt-slot (todo-ridgeline.css)

export default function TodoPage() {
  const { role, ready } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();

  const td = useTodos(role === 'admin');
  const [view, setView] = useState('myday');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [listEdit, setListEdit] = useState(null);         // null | { mode:'new'|'rename', id, name, color }
  const [confirmDelete, setConfirmDelete] = useState(null); // null | { kind:'task'|'list', item }
  const [deleting, setDeleting] = useState(false);

  const selectedTask = useMemo(
    () => (td.todos || []).find(t => t.id === selectedTaskId) || null,
    [td.todos, selectedTaskId],
  );

  // Tugas pribadi — hanya admin
  useEffect(() => {
    if (ready && role && role !== 'admin') router.replace(homeFor(role));
  }, [ready, role, router]);

  /* Kartu detail menutup dengan animasi: isi tugas terakhir tetap dirender (inert)
     sampai lebar slotnya habis, baru dilepas. */
  const lastTask = useRef(null);
  if (selectedTask) lastTask.current = selectedTask;
  const detailOpen = !!selectedTask;
  const [detailKeep, setDetailKeep] = useState(false);
  useEffect(() => {
    if (detailOpen) { setDetailKeep(true); return undefined; }
    const id = setTimeout(() => setDetailKeep(false), DETAIL_CLOSE_MS);
    return () => clearTimeout(id);
  }, [detailOpen]);
  const detailTask = selectedTask || (detailKeep ? lastTask.current : null);

  /* Pil penanda view aktif di kartu Lists — MELUNCUR ke baris yang dipilih.
     Posisinya diukur dari baris .is-on (bukan dihitung dari index), jadi tetap pas
     kalau tinggi baris / pemisah berubah. Muncul pertama kali tanpa meluncur. */
  const navRef = useRef(null);
  const pillRef = useRef(null);
  const pillPlaced = useRef(false);
  useLayoutEffect(() => {
    const nav = navRef.current, pill = pillRef.current;
    if (!nav || !pill) { pillPlaced.current = false; return; }
    const on = nav.querySelector('.rgt-view.is-on');
    if (!on) { pill.style.opacity = '0'; pillPlaced.current = false; return; }
    const jump = !pillPlaced.current;
    if (jump) pill.style.transition = 'none';
    pill.style.transform = `translateY(${on.offsetTop}px)`;
    pill.style.height = `${on.offsetHeight}px`;
    if (jump) { void pill.offsetWidth; pill.style.transition = ''; }
    pill.style.opacity = '1';
    pillPlaced.current = true;
  }, [view, td.lists, isMobile, role]);

  // Jumlah tugas belum selesai per view (angka kecil di kartu Lists)
  const counts = useMemo(() => {
    const c = {};
    const ids = [...BUILTIN_VIEWS.map(v => v.id), ...td.lists.map(l => listViewId(l.id))];
    for (const id of ids) c[id] = tasksForView(td.todos, id).filter(t => !t.done).length;
    return c;
  }, [td.todos, td.lists]);

  // Ganti view → detail tugas ditutup (seperti Microsoft To Do)
  function changeView(v) {
    setView(v);
    setSelectedTaskId(null);
  }
  // Desktop: klik tugas yang sedang terbuka = tutup detailnya
  function selectTask(id) {
    setSelectedTaskId(cur => (!isMobile && cur === id ? null : id));
  }

  function openNewList() {
    setListEdit({ mode: 'new', id: null, name: '', color: TODO_LIST_COLORS[1] });
  }
  function openRenameList(l) {
    setListEdit({ mode: 'rename', id: l.id, name: l.name, color: l.color });
  }
  async function commitListEdit() {
    if (!listEdit) return;
    const name = listEdit.name.trim();
    if (!name) { setListEdit(null); return; }
    if (listEdit.mode === 'new') {
      const l = await td.createList(name, listEdit.color);
      if (l) changeView(listViewId(l.id));
    } else {
      await td.updateList(listEdit.id, { name, color: listEdit.color });
    }
    setListEdit(null);
  }

  /* Eksekusi konfirmasi hapus — confirmDelete = { kind: 'task'|'list', item } */
  async function confirmDeleteNow() {
    const c = confirmDelete;
    if (!c || deleting) return;
    setDeleting(true);   // tombol dialog terkunci selama proses (anti klik dobel)
    try {
      if (c.kind === 'task') {
        await td.removeTask(c.item.id);
        if (selectedTaskId === c.item.id) setSelectedTaskId(null);
      } else {
        await td.removeList(c.item.id);
        if (view === listViewId(c.item.id)) setView('tasks');
        if (selectedTask && selectedTask.list_id === c.item.id) setSelectedTaskId(null);
      }
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  if (!role || role !== 'admin') return null;

  const showDetailMobile = isMobile && !!selectedTask;
  const openAll = td.todos && !td.error ? td.todos.filter(t => !t.done) : null;
  const myDayN  = openAll ? openAll.filter(t => t.my_day_date === todayStr()).length : 0;
  const lateN   = openAll ? openAll.filter(t => isOverdue(t.due_date)).length : 0;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  const ctxLine = td.todos === null
    ? <span>Loading tasks…</span>
    : (<>
        {!isMobile && (<>
          <span className="rg-live" aria-hidden="true" />
          <span>Workspace</span>
          <span className="rg-ctx-sep" aria-hidden="true" />
        </>)}
        {openAll && (<>
          <span>{plural(openAll.length, 'open task')}</span>
          <span className="rg-ctx-sep" aria-hidden="true" />
          <span>{myDayN} in My Day</span>
          {lateN > 0 && (<>
            <span className="rg-ctx-sep" aria-hidden="true" />
            <span>{lateN} overdue</span>
          </>)}
        </>)}
        {!isMobile && (<>
          {openAll && <span className="rg-ctx-sep" aria-hidden="true" />}
          <span>Synced across your devices</span>
        </>)}
      </>);

  /* Baris view di kartu Lists — dirender lewat FUNGSI biasa (bukan komponen di dalam
     komponen) supaya tidak di-remount tiap render. */
  const viewRow = (id, label, Icon, color) => {
    const on = view === id;
    const n = counts[id] || 0;
    return (
      <button key={id} type="button" className={`rgt-view${on ? ' is-on' : ''}`}
        onClick={() => changeView(id)} aria-current={on ? 'true' : undefined}>
        {Icon
          ? <Icon size={16} />
          : <span className="rgt-view-dot"><span className="rg-menu-dot" style={{ background: color || 'var(--rg-t3)' }} /></span>}
        <span className="rgt-view-name rg-clip">{label}</span>
        {n > 0 && <span className="rgt-view-n rg-mono">{n}</span>}
      </button>
    );
  };

  const detail = (task) => (
    <TodoDetail
      key={task.id}
      task={task}
      td={td}
      onRequestDelete={(t) => setConfirmDelete({ kind: 'task', item: t })}
      onClose={() => setSelectedTaskId(null)}
      isMobile={isMobile}
    />
  );

  return (
    <div className={`rg rg-page rgn rgt ${dashboardFontVars}${isMobile ? ' is-mobile' : ''}`}>

      {/* ══ TOP BAR — judul + konteks (kiri) · tema (kanan) ══ */}
      <header className="rg-top">
        <div className="rg-top-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {showDetailMobile && (
            <button type="button" className="rg-iconbtn rgn-back" onClick={() => setSelectedTaskId(null)}
              title="Back to tasks" aria-label="Back to tasks"><ChevronLeft size={18} /></button>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 className="rg-h1">To Do</h1>
            <div className="rg-ctx">{ctxLine}</div>
          </div>
        </div>

        {!isMobile && (
          <div className="rg-tools">
            <ThemeToggle className="rg-pill rg-round" />
          </div>
        )}
      </header>

      {/* ══ ISI ══ */}
      <div className="rgt-body">

        {/* ── Kartu Lists: pilih view (desktop) ── */}
        {!isMobile && (
          <section className="rg-card rgt-nav rg-rise" aria-label="Lists">
            <div className="rg-head">
              <span className="rg-head-ico"><ListTodo size={15} /></span>
              <span className="rg-title">Lists</span>
            </div>
            <div className="rg-well rgt-nav-well">
              <nav ref={navRef} className="rgt-views" aria-label="To Do lists">
                <span ref={pillRef} className="rgt-view-pill" aria-hidden="true" />
                {BUILTIN_VIEWS.map(v => viewRow(v.id, v.label, v.Icon))}
                {td.lists.length > 0 && <div className="rgt-nav-sep" aria-hidden="true" />}
                {td.lists.map(l => viewRow(listViewId(l.id), l.name, null, l.color))}
              </nav>
              <div className="rgt-nav-foot">
                <button type="button" className="rgt-view rgt-newlist" onClick={openNewList}>
                  <Plus size={16} />
                  <span className="rgt-view-name">New list</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── Kartu tugas ── */}
        {!showDetailMobile && (
          <section className="rg-card rgt-main rg-rise" style={{ animationDelay: '40ms' }} aria-label="Tasks">
            <TodoPanel
              td={td}
              view={view}
              setView={changeView}
              selectedId={selectedTaskId}
              onSelect={selectTask}
              onNewList={openNewList}
              onRenameList={openRenameList}
              onRequestDeleteList={(l) => setConfirmDelete({ kind: 'list', item: l })}
              isMobile={isMobile}
              viewMenu={isMobile}
            />
          </section>
        )}

        {/* ── Kartu detail tugas — HP: menggantikan kartu tugas; desktop: slot di kanan
            yang melebar/menyempit (lapisan lebar dipisah dari kartunya) ── */}
        {isMobile ? (
          showDetailMobile && (
            <section className="rg-card rgt-main rg-rise" aria-label="Task details">
              {detail(selectedTask)}
            </section>
          )
        ) : (
          <div className={`rgt-slot${detailOpen ? ' is-open' : ''}`} inert={!detailOpen}>
            {detailTask && (
              <section className="rg-card rgt-detail" aria-label="Task details">
                {detail(detailTask)}
              </section>
            )}
          </div>
        )}
      </div>

      {/* ══ DAFTAR BARU / GANTI NAMA ══ */}
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

      {/* ══ KONFIRMASI HAPUS (tugas / daftar) — Esc & klik latar menutup ══ */}
      {confirmDelete && (
        <RgDialog
          icon={Trash2}
          tone="neg"
          title={confirmDelete.kind === 'list' ? 'Delete this list?' : 'Delete this task?'}
          sub={confirmDelete.kind === 'list' ? confirmDelete.item.name : (confirmDelete.item.title || 'Untitled task')}
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
          {confirmDelete.kind === 'list'
            ? <>The list and <strong>all tasks inside it</strong> will be removed from every device. This can’t be undone.</>
            : <>It will be removed from every device. This can’t be undone.</>}
        </RgDialog>
      )}
    </div>
  );
}
