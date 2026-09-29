'use client';

import { useState } from 'react';
import {
  Star, Sun, CalendarDays, Inbox, Plus, X, Trash2, ChevronLeft, ListTodo,
} from 'lucide-react';
import { RgMenu } from './rgKit';
import { todayStr, addDays, dueLabel, isOverdue } from './useTodos';
import { useSpringCheck, CheckCircle } from './springCheck';

/* ─────────────────────────────────────────────────────────────
   TODO DETAIL — isi kartu kanan saat sebuah tugas dipilih (menggantikan
   editor catatan). Isi ala Microsoft To Do: judul + selesai + bintang,
   Steps (sub-tugas), Add to My Day, Due date, pindah List, catatan,
   footer created + hapus.
   Redesain "Ridgeline" (Sep 2026): kepala kartu (Task · daftar · tutup) +
   panel dalam + kaki kartu. Styling di notes-ridgeline.css.
   ───────────────────────────────────────────────────────────── */

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* Satu baris step — di level modul (bukan di dalam TodoDetail) supaya tidak di-remount
   tiap render; tiap baris punya pegas centangnya sendiri (springCheck.js) */
function StepRow({ t, s, td, xBtn }) {
  const rowRef = useSpringCheck(s.done);
  return (
    <div ref={rowRef} className={`rgn-step${s.done ? ' is-done' : ''}`}>
      <button type="button" className={`rgn-circle${s.done ? ' is-done' : ''}`} onClick={() => td.toggleStep(t, s.id)}
        role="checkbox" aria-checked={s.done} aria-label={s.done ? 'Mark step as not done' : 'Mark step as done'}>
        <CheckCircle size={16} />
      </button>
      <input value={s.title} onChange={e => td.renameStep(t, s.id, e.target.value)} aria-label="Step" />
      {xBtn(() => td.removeStep(t, s.id), 'Remove step', 'rgn-step-x')}
    </div>
  );
}

export default function TodoDetail({ task: t, td, onRequestDelete, isMobile, onBack, onClose }) {
  const [stepDraft, setStepDraft] = useState('');
  const [pickDate, setPickDate] = useState(false);
  const titleRef = useSpringCheck(!!t.done);

  const steps = t.steps || [];
  const inMyDay = t.my_day_date === todayStr();
  const overdue = !t.done && isOverdue(t.due_date);
  const list = t.list_id ? td.lists.find(l => l.id === t.list_id) : null;

  function addStep() {
    const s = stepDraft.trim();
    if (!s) return;
    td.addStep(t, s);
    setStepDraft('');
  }

  const dueOptions = [
    { value: todayStr(),  label: 'Today',     hint: new Date().toLocaleDateString('en-GB', { weekday: 'short' }) },
    { value: addDays(1),  label: 'Tomorrow',  hint: new Date(Date.now() + 864e5).toLocaleDateString('en-GB', { weekday: 'short' }) },
    { value: addDays(7),  label: 'Next week', hint: dueLabel(addDays(7)) },
    { value: '__pick',    label: 'Pick a date…' },
    ...(t.due_date ? [{ value: '__none', label: 'Remove due date', tone: 'neg' }] : []),
  ];
  const listOptions = [
    { value: '', label: 'Tasks', Icon: Inbox },
    ...td.lists.map(l => ({ value: l.id, label: l.name, dot: l.color || 'var(--rg-t3)' })),
  ];

  const xBtn = (onClick, title, cls = '') => (
    <button type="button" className={`rg-iconbtn${cls ? ' ' + cls : ''}`} onClick={e => { e.stopPropagation(); onClick(); }} title={title} aria-label={title}>
      <X size={13} />
    </button>
  );

  return (
    <>
      {/* Kepala kartu: Task · daftar tempat tugas · tutup */}
      <div className="rg-head">
        {isMobile && onBack && (
          <button type="button" className="rg-iconbtn" onClick={onBack} title="Back" aria-label="Back"><ChevronLeft size={15} /></button>
        )}
        <span className="rg-head-ico"><ListTodo size={15} /></span>
        <span className="rg-title">Task</span>
        <span className="rgn-crumb">
          <span aria-hidden="true">·</span>
          {list ? <span className="rg-menu-dot" style={{ background: list.color || 'var(--rg-t3)' }} /> : <Inbox size={13} />}
          <span className="rg-clip">{list ? list.name : 'Tasks'}</span>
        </span>
        <span style={{ flex: 1 }} />
        {onClose && !isMobile && (
          <button type="button" className="rg-iconbtn" onClick={onClose} title="Close task" aria-label="Close task"><X size={15} /></button>
        )}
      </div>

      <div className="rg-well rgn-detail">
        <div className="rgn-detail-scroll">
          {/* Judul: selesai + judul + bintang */}
          <div ref={titleRef} className="rgn-detail-title">
            <button type="button" className={`rgn-circle${t.done ? ' is-done' : ''}`} onClick={() => td.toggleDone(t)}
              role="checkbox" aria-checked={t.done}
              title={t.done ? 'Mark as not done' : 'Mark as done'} aria-label={t.done ? 'Mark as not done' : 'Mark as done'}>
              <CheckCircle size={24} />
            </button>
            <input
              className={`rgn-task-input${t.done ? ' is-done' : ''}`}
              value={t.title}
              onChange={e => td.updateTask(t.id, { title: e.target.value }, { debounce: true })}
              placeholder="Task title"
              aria-label="Task title"
            />
            <button type="button" className={`rgn-star${t.starred ? ' is-on' : ''}`} onClick={() => td.toggleStar(t)}
              title={t.starred ? 'Remove importance' : 'Mark as important'} aria-label={t.starred ? 'Remove importance' : 'Mark as important'}>
              <Star size={18} fill={t.starred ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* Steps */}
          <div className="rgn-steps">
            {steps.map(s => <StepRow key={s.id} t={t} s={s} td={td} xBtn={xBtn} />)}
            <label className="rgn-step is-add">
              <Plus size={16} />
              <input
                value={stepDraft}
                onChange={e => setStepDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addStep(); }}
                placeholder={steps.length ? 'Next step' : 'Add step'}
              />
            </label>
            {steps.length > 0 && (
              <div className="rgn-steps-meta"><span className="rg-mono">{steps.filter(s => s.done).length}/{steps.length}</span> steps done</div>
            )}
          </div>

          {/* Aksi: My Day · Due date · List */}
          <div className="rgn-actions">
            <div className="rgn-act-row">
              <button type="button" className={`rgn-act${inMyDay ? ' is-on is-sun' : ''}`} onClick={() => td.toggleMyDay(t)}>
                <Sun size={16} />
                <span className="rg-clip">{inMyDay ? 'Added to My Day' : 'Add to My Day'}</span>
              </button>
              {inMyDay && xBtn(() => td.toggleMyDay(t), 'Remove from My Day')}
            </div>
            <div className="rgn-act-row">
              <RgMenu
                block
                caret={false}
                className={`rgn-act${overdue ? ' is-late' : t.due_date ? ' is-on' : ''}`}
                icon={CalendarDays}
                label={t.due_date ? `Due ${dueLabel(t.due_date)}` : 'Add due date'}
                options={dueOptions}
                value={t.due_date || undefined}
                onSelect={(v) => {
                  if (v === '__pick') { setPickDate(true); return; }
                  if (v === '__none') { td.setDue(t, null); setPickDate(false); return; }
                  td.setDue(t, v); setPickDate(false);
                }}
                minWidth={220}
                title="Due date"
              />
              {t.due_date && xBtn(() => { td.setDue(t, null); setPickDate(false); }, 'Remove due date')}
            </div>
            {pickDate && (
              <div className="rgn-pick">
                <input
                  type="date"
                  className="rg-input rg-mono"
                  autoFocus
                  value={t.due_date || ''}
                  onChange={e => { if (e.target.value) td.setDue(t, e.target.value); }}
                  aria-label="Pick a due date"
                />
                <button type="button" className="rg-btn rg-btn-ghost" style={{ height: 34 }} onClick={() => setPickDate(false)}>Done</button>
              </div>
            )}
            <div className="rgn-act-row">
              <RgMenu
                block
                caret={false}
                className="rgn-act is-on"
                icon={list ? undefined : Inbox}
                dot={list ? (list.color || 'var(--rg-t3)') : undefined}
                label={list ? list.name : 'Tasks'}
                options={listOptions}
                value={t.list_id || ''}
                onSelect={(v) => td.moveToList(t, v || null)}
                minWidth={220}
                title="Move to list"
              />
            </div>
          </div>

          {/* Catatan tugas */}
          <div className="rg-field">
            <label className="rg-label" htmlFor="rgn-task-note">Note</label>
            <textarea
              id="rgn-task-note"
              className="rg-input rgn-textarea"
              value={t.notes || ''}
              onChange={e => td.updateTask(t.id, { notes: e.target.value }, { debounce: true })}
              placeholder="Add a note"
              rows={5}
            />
          </div>
        </div>
      </div>

      {/* Kaki kartu */}
      <div className="rg-foot rgn-detail-foot">
        <span className="rg-clip">{t.done && t.done_at ? `Completed ${fmtDate(t.done_at)}` : `Created ${fmtDate(t.created_at)}`}</span>
        <button type="button" className="rg-btn rg-btn-ghost rgn-del" onClick={() => onRequestDelete(t)} title="Delete task">
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </>
  );
}
