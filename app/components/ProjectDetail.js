'use client';

import { useState } from 'react';
import { FolderKanban, Trash2, X, Plus, UserRound, CalendarDays } from 'lucide-react';
import { RgDialog } from './rgKit';
import { PJ_STATUSES, PJ_PEOPLE } from './useProjects';
import { StatusIcon, personCls, initialOf } from './ProjectCard';
import { todayStr, addDays, dueLabel, isOverdue } from './useTodos';

/* ─────────────────────────────────────────────────────────────
   PROJECT DETAIL — dialog "Open →" di kartu Projects. Semua isi project:
   nama, status, tenggat, langkah (ganti teks · PIC · hapus · tambah),
   dan catatan. Teks disimpan otomatis (debounce di useProjects).
   PIC dipilih lewat baris pilihan yang mekar di bawah langkahnya (bukan
   menu melayang — menu absolut terpotong area scroll dialog). Tenggat langkah
   (sejak To Do digabung, 19 Okt 2026) memakai pola baris mekar yang sama;
   langkah bertenggat ikut tampil di Planned panel To Do.
   ───────────────────────────────────────────────────────────── */

export default function ProjectDetail({ project: p, pj, onClose, onRequestDelete }) {
  const [title, setTitle] = useState(p.title);
  const [notes, setNotes] = useState(p.notes || '');
  const [picFor, setPicFor] = useState(null);     // id langkah yang pilihan PIC-nya terbuka
  const [dueFor, setDueFor] = useState(null);     // id langkah yang pilihan tenggatnya terbuka
  const [draft, setDraft] = useState('');
  const steps = p.steps || [];

  const created = new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  function addStep(e) {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    pj.addStep(p.id, v);
    setDraft('');
  }

  return (
    <RgDialog
      icon={FolderKanban}
      title="Project details"
      sub={`Created ${created}`}
      onClose={onClose}
      width={540}
      foot={<>
        <button type="button" className="rg-btn rg-btn-ghost rgp-del" onClick={() => onRequestDelete(p)}>
          <Trash2 size={15} />Delete project
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" className="rg-btn rg-btn-primary" onClick={onClose}>Done</button>
      </>}
    >
      <div className="rgp-dlg">
        <div className="rg-field">
          <label className="rg-label" htmlFor="rgp-d-title">Project name</label>
          <input id="rgp-d-title" className="rg-input" value={title} placeholder="Untitled project"
            onChange={e => {
              setTitle(e.target.value);
              if (e.target.value.trim()) pj.updateProject(p.id, { title: e.target.value.trim() }, { debounce: true });
            }} />
        </div>

        <div className="rgp-d-row">
          <div className="rg-field" style={{ flex: 1 }}>
            <span className="rg-label">Status</span>
            <div className="rgp-d-status" role="group" aria-label="Status">
              {PJ_STATUSES.map(s => (
                <button key={s.value} type="button" aria-pressed={p.status === s.value}
                  className={`rgp-st rgp-chip is-${s.value}${p.status === s.value ? ' is-cur' : ''}`}
                  onClick={() => pj.updateProject(p.id, { status: s.value })}>
                  <StatusIcon status={s.value} />{s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rg-field rgp-d-due">
            <label className="rg-label" htmlFor="rgp-d-due">Due date</label>
            <div className="rgp-d-due-in">
              <input id="rgp-d-due" type="date" className="rg-input" value={p.due_date || ''}
                onChange={e => pj.updateProject(p.id, { due_date: e.target.value || null })} />
              {p.due_date && (
                <button type="button" className="rg-iconbtn" title="Remove due date" aria-label="Remove due date"
                  onClick={() => pj.updateProject(p.id, { due_date: null })}><X size={14} /></button>
              )}
            </div>
          </div>
        </div>

        <div className="rg-field">
          <span className="rg-label">Steps{steps.length ? ` · ${steps.filter(s => s.done).length} of ${steps.length} done` : ''}</span>
          <div className="rgp-d-steps">
            {steps.map(s => (
              <div key={s.id} className={`rgp-d-step${s.done ? ' is-done' : ''}`}>
                <div className="rgp-d-step-row">
                  <button type="button" className="rgp-chk" aria-pressed={s.done}
                    aria-label={`${s.done ? 'Mark not done' : 'Mark done'}: ${s.title}`}
                    onClick={() => pj.toggleStep(p.id, s.id)}>
                    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.6 6.2l2.2 2.2 4.6-4.8" /></svg>
                  </button>
                  <input className="rgp-d-step-input" defaultValue={s.title} aria-label="Step"
                    onChange={e => { if (e.target.value.trim()) pj.updateStep(p.id, s.id, { title: e.target.value.trim() }, { debounce: true }); }} />
                  <button type="button" className={`rgp-d-pic${s.pic ? '' : ' is-none'}`} aria-expanded={picFor === s.id}
                    title={s.pic ? `PIC: ${s.pic}` : 'Assign a PIC'} aria-label={s.pic ? `PIC: ${s.pic}. Change` : 'Assign a PIC'}
                    onClick={() => { setDueFor(null); setPicFor(cur => (cur === s.id ? null : s.id)); }}>
                    {s.pic
                      ? <span className={`rgp-av is-sm ${personCls(s.pic)}`}>{initialOf(s.pic)}</span>
                      : <UserRound size={14} />}
                  </button>
                  <button type="button" className={`rgp-d-pic rgp-d-duebtn${s.due_date ? ' is-set' : ''}${s.due_date && !s.done && isOverdue(s.due_date) ? ' is-late' : ''}`}
                    aria-expanded={dueFor === s.id}
                    title={s.due_date ? `Due ${dueLabel(s.due_date)}` : 'Set a due date'}
                    aria-label={s.due_date ? `Due ${dueLabel(s.due_date)}. Change` : 'Set a due date'}
                    onClick={() => { setPicFor(null); setDueFor(cur => (cur === s.id ? null : s.id)); }}>
                    {s.due_date ? <span className="rg-mono">{dueLabel(s.due_date)}</span> : <CalendarDays size={14} />}
                  </button>
                  <button type="button" className="rgp-d-x" title="Delete step" aria-label={`Delete step ${s.title}`}
                    onClick={() => pj.removeStep(p.id, s.id)}><X size={14} /></button>
                </div>
                <div className={`rgp-clp rgp-d-pics${picFor === s.id ? ' is-open' : ''}`} inert={picFor !== s.id}>
                  <div>
                    <div className="rgp-d-pics-row">
                      {[...PJ_PEOPLE, null].map((n, i) => (
                        <button key={n || 'none'} type="button" style={{ '--k': i }}
                          className={`rgp-pchip${(s.pic || null) === n ? ' is-cur' : ''}`}
                          onClick={() => { pj.updateStep(p.id, s.id, { pic: n }); setPicFor(null); }}>
                          {n ? <span className={`rgp-av is-sm ${personCls(n)}`}>{initialOf(n)}</span> : <UserRound size={13} />}
                          {n || 'No one'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={`rgp-clp rgp-d-pics${dueFor === s.id ? ' is-open' : ''}`} inert={dueFor !== s.id}>
                  <div>
                    <div className="rgp-d-pics-row">
                      {[['Today', todayStr()], ['Tomorrow', addDays(1)], ['Next week', addDays(7)]].map(([l, v], i) => (
                        <button key={l} type="button" style={{ '--k': i }}
                          className={`rgp-pchip is-text${s.due_date === v ? ' is-cur' : ''}`}
                          onClick={() => { pj.updateStep(p.id, s.id, { due_date: v }); setDueFor(null); }}>{l}</button>
                      ))}
                      <input type="date" className="rg-input rg-mono rgp-d-step-date" value={s.due_date || ''} aria-label="Pick a due date"
                        onChange={e => pj.updateStep(p.id, s.id, { due_date: e.target.value || null })} />
                      {s.due_date && (
                        <button type="button" className="rgp-pchip is-text" style={{ '--k': 4 }}
                          onClick={() => { pj.updateStep(p.id, s.id, { due_date: null }); setDueFor(null); }}>No date</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <form className="rgp-d-add" onSubmit={addStep}>
              <Plus size={15} />
              <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add a step" aria-label="Add a step" autoComplete="off" />
            </form>
          </div>
        </div>

        <div className="rg-field">
          <label className="rg-label" htmlFor="rgp-d-notes">Notes</label>
          <textarea id="rgp-d-notes" className="rg-input rgp-d-notes" value={notes}
            placeholder="Links, briefs, anything to remember about this project"
            onChange={e => { setNotes(e.target.value); pj.updateProject(p.id, { notes: e.target.value }, { debounce: true }); }} />
        </div>
      </div>
    </RgDialog>
  );
}
