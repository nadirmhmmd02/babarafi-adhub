'use client';

import { useState, useRef, useLayoutEffect, useEffect, memo } from 'react';
import { ChevronDown, ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { PJ_STATUSES, PJ_STATUS_LABEL } from './useProjects';
import { dueLabel, isOverdue } from './useTodos';

/* ─────────────────────────────────────────────────────────────
   PROJECT CARD — kartu di papan Projects (/projects). Adaptasi video
   referensi Nadir (12 Okt 2026): kepala ringkas (cincin progres bersegmen ·
   judul · pil status · tenggat · avatar PIC) → klik = daftar langkah
   memanjang + "laci" info di bawah kartu. Default TERBUKA (page.js).
   Klik di kepala diputuskan oleh halaman (pointerup tanpa geser) lewat
   onHeadClick(target) — tekan & geser kepala = memindah kartu (page.js).
   Styling: app/projects-ridgeline.css (.rgp-).
   ───────────────────────────────────────────────────────────── */

const RELATIVE = ['Today', 'Tomorrow', 'Yesterday'];
const STEP_HOLD_MS = 300;   // tekan & tahan selama ini → sub-tugas "terangkat" dan bisa digeser
const STEP_SLOP_PX = 5;     // kursor bergeser lebih dari ini sebelum terangkat = bukan geser urutan (mis. blok teks)
const STEP_FLIP_MS = 220;
export function dueText(d) {
  if (!d) return 'No due date';
  const l = dueLabel(d);
  return `Due ${RELATIVE.includes(l) ? l.toLowerCase() : l}`;
}
export const personCls = name => `is-${String(name || '').toLowerCase()}`;
export const initialOf = name => String(name || '?').trim().charAt(0).toUpperCase();

/* Ikon status kecil (lucide tidak punya lingkaran setengah isi) */
export function StatusIcon({ status, size = 11 }) {
  const p = { width: size, height: size, viewBox: '0 0 12 12', 'aria-hidden': true };
  const ring = <circle cx="6" cy="6" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.5" />;
  if (status === 'todo') return <svg {...p}><circle cx="6" cy="6" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.2 1.7" /></svg>;
  if (status === 'progress') return <svg {...p}>{ring}<path d="M6 3.3a2.7 2.7 0 0 1 0 5.4z" fill="currentColor" /></svg>;
  if (status === 'waiting') return <svg {...p}>{ring}<path d="M6 3.8V6l1.5 1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
  return <svg {...p}>{ring}<path d="M4.1 6.1l1.3 1.3 2.6-2.7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* Cincin progres bersegmen: 1 potong = 1 langkah, terisi = selesai, angka = jumlah selesai */
function arc(a0, a1) {
  const pt = a => { const t = a * Math.PI / 180; return `${(15 + 12 * Math.cos(t)).toFixed(2)} ${(15 + 12 * Math.sin(t)).toFixed(2)}`; };
  return `M${pt(a0)}A12 12 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${pt(a1)}`;
}
export function ProgressRing({ total, done }) {
  let marks;
  if (!total) marks = <circle cx="15" cy="15" r="12" className="is-empty" />;
  else if (total === 1) marks = <circle cx="15" cy="15" r="12" className={done ? 'is-on' : undefined} />;
  else {
    const gap = total > 8 ? 9 : 15, seg = 360 / total;
    marks = Array.from({ length: total }, (_, k) => (
      <path key={k} d={arc(k * seg + gap / 2 - 90, (k + 1) * seg - gap / 2 - 90)} className={k < done ? 'is-on' : undefined} />
    ));
  }
  return (
    <span className="rgp-ring" title={`${done} of ${total} steps done`}>
      <svg viewBox="0 0 30 30" aria-hidden="true">{marks}</svg>
      <b key={done} className="rgp-ring-n rg-mono">{done}</b>
    </span>
  );
}

function ProjectCard({
  p, open, picking, editingTitle, placeholder, isNew, isMobile,
  onHeadClick, onToggleOpen, onTitleCommit, onStatus, onToggleStep, onAddStep, onEditStep, onRemoveStep, onReorderSteps, onOpen,
}) {
  const [hover, setHover] = useState(null);   // null | { step } | { person }
  const [draft, setDraft] = useState('');
  const [editStepId, setEditStepId] = useState(null);   // langkah yang sedang diganti teksnya

  /* ── Geser urutan sub-tugas (desktop): tekan & TAHAN baris ±0,3 detik → baris terangkat,
     kursor jadi tangan menggenggam; geser naik/turun → baris lain bergeser memberi tempat
     (FLIP); lepas → urutan disimpan. Bergeser sebelum terangkat = batal (blok teks tetap
     bisa). Tidak berlaku di tombol centang/edit/hapus & kolom ketik. ── */
  const [stepOrder, setStepOrder] = useState(null);   // urutan id sementara selama digeser
  const [stepDrag, setStepDrag] = useState(null);     // id langkah yang sedang digeser
  const listRef = useRef(null);
  const pressRef = useRef(null);                      // { sid, x0, y0, timer, active, order }
  const rowFlip = useRef(null);

  function snapRows() {
    const ul = listRef.current;
    if (!ul) return;
    const tops = {};
    ul.querySelectorAll('li[data-sid]').forEach(li => { tops[li.dataset.sid] = li.getBoundingClientRect().top; });
    rowFlip.current = tops;
  }
  useLayoutEffect(() => {
    const tops = rowFlip.current, ul = listRef.current;
    if (!tops || !ul) return;
    rowFlip.current = null;
    ul.querySelectorAll('li[data-sid]').forEach(li => {
      const from = tops[li.dataset.sid];
      if (from == null) return;
      const dy = from - li.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      li.style.transition = 'none';
      li.style.translate = `0 ${dy}px`;
      void li.offsetHeight;
      li.style.transition = `translate ${STEP_FLIP_MS}ms cubic-bezier(.22,1,.36,1)`;
      li.style.translate = '0 0';
      clearTimeout(li._flipT);
      li._flipT = setTimeout(() => { li.style.transition = ''; li.style.translate = ''; }, STEP_FLIP_MS + 40);
    });
  });

  function endStepPress(commit) {
    const pr = pressRef.current;
    pressRef.current = null;
    if (!pr) return;
    clearTimeout(pr.timer);
    window.removeEventListener('pointermove', pr.onMove);
    window.removeEventListener('pointerup', pr.onUp);
    window.removeEventListener('pointercancel', pr.onCancel);
    window.removeEventListener('keydown', pr.onKey);
    if (!pr.active) return;
    document.documentElement.classList.remove('rgp-step-dragging');
    const changed = pr.order.some((id, i) => id !== pr.start[i]);
    if (commit && changed) onReorderSteps(p.id, pr.order);
    else if (changed) snapRows();   // batal (Esc) → baris meluncur kembali ke tempat semula
    setStepDrag(null);
    setStepOrder(null);
  }
  useEffect(() => () => endStepPress(false), []);   // eslint-disable-line react-hooks/exhaustive-deps

  function onStepPointerDown(e, sid) {
    if (isMobile || e.button !== 0 || editStepId) return;
    if (e.target.closest('button, input')) return;
    endStepPress(false);
    const start = steps.map(s => s.id);
    const pr = { sid, x0: e.clientX, y0: e.clientY, active: false, start, order: start };
    pr.timer = setTimeout(() => {
      pr.active = true;
      window.getSelection()?.removeAllRanges();
      document.documentElement.classList.add('rgp-step-dragging');
      setStepDrag(sid);
      setStepOrder(start);
    }, STEP_HOLD_MS);
    pr.onMove = ev => {
      if (!pr.active) {
        if (Math.hypot(ev.clientX - pr.x0, ev.clientY - pr.y0) > STEP_SLOP_PX) endStepPress(false);
        return;
      }
      ev.preventDefault();
      // posisi sisip = sebelum baris pertama (selain yang digeser) yang titik tengahnya di bawah kursor
      const ul = listRef.current;
      if (!ul) return;
      const rest = pr.order.filter(id => id !== sid);
      let at = rest.length;
      for (let i = 0; i < rest.length; i++) {
        const li = ul.querySelector(`li[data-sid="${rest[i]}"]`);
        if (!li) continue;
        const r = li.getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) { at = i; break; }
      }
      const next = [...rest.slice(0, at), sid, ...rest.slice(at)];
      if (next.every((id, i) => id === pr.order[i])) return;
      pr.order = next;
      snapRows();
      setStepOrder(next);
    };
    pr.onUp = () => endStepPress(true);
    pr.onCancel = () => endStepPress(false);
    pr.onKey = ev => { if (ev.key === 'Escape') endStepPress(false); };
    window.addEventListener('pointermove', pr.onMove);
    window.addEventListener('pointerup', pr.onUp);
    window.addEventListener('pointercancel', pr.onCancel);
    window.addEventListener('keydown', pr.onKey);
    pressRef.current = pr;
  }

  // Simpan teks langkah: kosong / sama = batal (teks lama tetap)
  function commitStep(s, value) {
    setEditStepId(null);
    const v = (value || '').trim();
    if (v && v !== s.title) onEditStep(p.id, s.id, v);
  }

  const steps = p.steps || [];
  const shownSteps = stepOrder
    ? stepOrder.map(id => steps.find(s => s.id === id)).filter(Boolean)
    : steps;
  const done = steps.filter(s => s.done).length;
  const people = [...new Set(steps.map(s => s.pic).filter(Boolean))];
  const late = p.status !== 'done' && isOverdue(p.due_date);
  const person = hover?.person || null;

  let tray;
  if (person) {
    const mine = steps.filter(s => s.pic === person);
    tray = <><b>{person}</b> · {mine.filter(s => s.done).length} of {mine.length} done</>;
  } else if (hover?.step) {
    const s = hover.step;
    tray = s.pic ? <>{s.done ? 'Done by' : 'Assigned to'} <b>{s.pic}</b></> : (s.done ? 'Done' : 'Not assigned');
  } else {
    tray = !steps.length ? 'No steps yet' : done === steps.length ? 'All done' : `${steps.length - done} left`;
  }
  const trayKey = person ? `p:${person}` : hover?.step ? `s:${hover.step.id}:${hover.step.done}` : `d:${steps.length}:${done}`;

  const cls = ['rgp-card'];
  if (open) cls.push('is-open');
  if (picking) cls.push('is-picking');
  if (person) cls.push('is-person');
  if (placeholder) cls.push('is-placeholder');
  if (isNew) cls.push('is-new');

  function addStep(e) {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    onAddStep(p.id, v);
    setDraft('');
  }

  return (
    <article className={cls.join(' ')} data-pid={p.id}>
      <div className="rgp-well">
        <div className="rgp-head" tabIndex={0} role="button" aria-expanded={open}
          aria-label={`${p.title}. ${open ? 'Hide' : 'Show'} steps`}
          onKeyDown={e => {
            if (e.target !== e.currentTarget) return;
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleOpen(p.id); }
          }}
          onClick={e => { if (isMobile || e.detail === 0) onHeadClick(e.target, p.id); }}>
          <ProgressRing total={steps.length} done={done} />
          <span className="rgp-main">
            {editingTitle ? (
              <input className="rgp-title-input" defaultValue={p.title} autoFocus aria-label="Project name"
                onFocus={e => e.target.select()}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                  else if (e.key === 'Escape') { e.currentTarget.dataset.cancel = '1'; e.currentTarget.blur(); }
                }}
                onBlur={e => onTitleCommit(p.id, e.currentTarget.dataset.cancel ? null : e.currentTarget.value)} />
            ) : (
              <span className="rgp-title" data-pj="title" title="Click to rename">{p.title || 'Untitled project'}</span>
            )}
            <span className="rgp-meta">
              <button type="button" className={`rgp-st is-${p.status}`} data-pj="status" aria-expanded={picking}
                aria-label={`Status: ${PJ_STATUS_LABEL[p.status]}. Change status`}>
                <StatusIcon status={p.status} />
                <span key={p.status} className="rgp-swap">{PJ_STATUS_LABEL[p.status]}</span>
              </button>
              <span className={`rgp-due rg-mono${late ? ' is-late' : ''}`}>{dueText(p.due_date)}</span>
            </span>
          </span>
          {people.length > 0 && (
            <span className="rgp-avs" data-pj="avs" onMouseLeave={() => setHover(null)}>
              {people.map(n => (
                <span key={n} className={`rgp-av ${personCls(n)}${person === n ? ' is-on' : ''}`} title={n}
                  onMouseEnter={() => setHover({ person: n })}>{initialOf(n)}</span>
              ))}
            </span>
          )}
          <span className="rgp-chev" aria-hidden="true"><ChevronDown size={15} /></span>
        </div>

        <div className="rgp-clp rgp-pick" inert={!picking}>
          <div>
            <div className="rgp-pick-row">
              {PJ_STATUSES.map((s, i) => (
                <button key={s.value} type="button" style={{ '--k': i }}
                  className={`rgp-st rgp-chip is-${s.value}${s.value === p.status ? ' is-cur' : ''}`}
                  onClick={() => onStatus(p.id, s.value)}>
                  <StatusIcon status={s.value} />{s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rgp-clp rgp-body" inert={!open}>
          <div>
            <div className="rgp-body-in">
              {steps.length > 0 && (
                <ul ref={listRef} className={`rgp-steps${stepDrag ? ' is-sorting' : ''}`}
                  onMouseLeave={() => setHover(h => (h?.step ? null : h))}>
                  {shownSteps.map((s, k) => (
                    <li key={s.id} data-sid={s.id} style={{ '--k': k }}
                      className={`${s.done ? 'is-done' : ''}${person && s.pic === person ? ' is-mine' : ''}${stepDrag === s.id ? ' is-lifted' : ''}`}
                      onPointerDown={e => onStepPointerDown(e, s.id)}
                      onMouseEnter={() => { if (!person) setHover({ step: s }); }}>
                      <button type="button" className="rgp-chk" aria-pressed={s.done}
                        aria-label={`${s.done ? 'Mark not done' : 'Mark done'}: ${s.title}`}
                        onClick={() => { onToggleStep(p.id, s.id); setHover({ step: { ...s, done: !s.done } }); }}>
                        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.6 6.2l2.2 2.2 4.6-4.8" /></svg>
                      </button>
                      {editStepId === s.id ? (
                        <input className="rgp-step-input" defaultValue={s.title} autoFocus aria-label="Step"
                          onFocus={e => e.target.select()}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                            else if (e.key === 'Escape') { e.currentTarget.dataset.cancel = '1'; e.currentTarget.blur(); }
                          }}
                          onBlur={e => commitStep(s, e.currentTarget.dataset.cancel ? null : e.currentTarget.value)} />
                      ) : (
                        <span className="rgp-step-t" title="Double-click to edit" onDoubleClick={() => setEditStepId(s.id)}>{s.title}</span>
                      )}
                      {editStepId !== s.id && (
                        <span className="rgp-step-acts">
                          <button type="button" className="rgp-step-act" title="Edit step" aria-label={`Edit step: ${s.title}`}
                            onClick={() => setEditStepId(s.id)}><Pencil size={13} /></button>
                          <button type="button" className="rgp-step-act is-del" title="Delete step" aria-label={`Delete step: ${s.title}`}
                            onClick={() => { setHover(null); onRemoveStep(p.id, s.id); }}><Trash2 size={13} /></button>
                        </span>
                      )}
                      {s.pic && <span className={`rgp-av is-sm ${personCls(s.pic)}`} title={s.pic}>{initialOf(s.pic)}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <form className="rgp-add" onSubmit={addStep}>
                <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add a step"
                  aria-label={`Add a step to ${p.title}`} autoComplete="off" />
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="rgp-clp rgp-tray" inert={!open}>
        <div>
          <div className="rgp-tray-in">
            <span key={trayKey} className="rgp-tray-txt rgp-swap">{tray}</span>
            <button type="button" className="rgp-open" onClick={() => onOpen(p.id)}>
              Open <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default memo(ProjectCard);
