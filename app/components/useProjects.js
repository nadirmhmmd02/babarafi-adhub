'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../supabase';
import { SALES } from './leadsConfig';

/* ─────────────────────────────────────────────────────────────
   useProjects — lapisan data halaman Projects (/projects, admin).
   Tabel Supabase: project_groups + projects (supabase-projects-setup.sql).
   Papan = deretan GRUP (lajur kiri → kanan); tiap grup berisi 1+ kartu
   project (atas → bawah). Kartu yang berdiri sendiri juga punya grup
   (nama kosong) — grup kosong dihapus otomatis.
   Semua update OPTIMISTIK (layar dulu, DB menyusul). Field teks di-debounce
   600ms per project (patch digabung, bukan saling menimpa). Operasi yang
   urutannya penting (buat, geser, hapus) diantrekan satu per satu.
   Kalau tabel belum dibuat → error.missing = true (UI tampilkan hint SQL).
   ───────────────────────────────────────────────────────────── */

export const PJ_STATUSES = [
  { value: 'todo',     label: 'To do' },
  { value: 'progress', label: 'In progress' },
  { value: 'waiting',  label: 'Waiting' },
  { value: 'done',     label: 'Done' },
];
export const PJ_STATUS_LABEL = Object.fromEntries(PJ_STATUSES.map(s => [s.value, s.label]));

// PIC langkah: Nadir + tim sales (leadsConfig). Label saja — mereka tidak punya akses halaman ini.
export const PJ_PEOPLE = ['Nadir', ...SALES];
export const PJ_DEFAULT_PIC = 'Nadir';

// '*' (bukan daftar kolom) supaya papan tetap terbuka walau kolom width belum ditambahkan
const COLS_G = '*';
export const PJ_CARD_W = 300, PJ_CARD_W_MIN = 260, PJ_CARD_W_MAX = 640;   // lebar kartu (px)
const COLS_P = 'id,group_id,title,status,due_date,notes,steps,sort_order,created_at,updated_at';
const TEXT_DEBOUNCE_MS = 600;

function missingTable(err) {
  return err && (err.code === 'PGRST205' || err.code === '42P01'
    || /could not find the table|does not exist/i.test(err.message || ''));
}
const byOrder = (a, b) => (a.sort_order - b.sort_order) || String(a.created_at).localeCompare(String(b.created_at));

/* Grup + project → deretan lajur untuk papan: [{ id, name, width, cards: [projectId] }].
   width = lebar kartu di lajur itu (null = bawaan). Grup tanpa kartu tidak ditampilkan.
   null = masih memuat. */
export function buildStacks(groups, projects) {
  if (!groups || !projects) return null;
  const inGroup = {};
  [...projects].sort(byOrder).forEach(p => { (inGroup[p.group_id] ||= []).push(p.id); });
  return [...groups].sort(byOrder)
    .map(g => ({ id: g.id, name: g.name || '', width: g.width ?? null, cards: inGroup[g.id] || [] }))
    .filter(s => s.cards.length);
}

export default function useProjects(enabled) {
  const [groups, setGroupsState] = useState(null);       // null = loading
  const [projects, setProjectsState] = useState(null);
  const [error, setError] = useState(null);              // { missing, message }
  const groupsRef = useRef(null);
  const projectsRef = useRef(null);
  const timers = useRef({});        // id → timeout (debounce teks)
  const pendingPatch = useRef({});  // id → patch yang menunggu debounce
  const created = useRef({});       // id → promise insert (update menunggu baris ada dulu)
  const queue = useRef(Promise.resolve());
  const inflight = useRef(0);       // jumlah request DB yang belum selesai

  // State + ref selalu sejalan, supaya aksi beruntun (klik cepat) membaca data terbaru
  const setGroups = useCallback(fn => setGroupsState(prev => { const next = typeof fn === 'function' ? fn(prev) : fn; groupsRef.current = next; return next; }), []);
  const setProjects = useCallback(fn => setProjectsState(prev => { const next = typeof fn === 'function' ? fn(prev) : fn; projectsRef.current = next; return next; }), []);

  const fail = useCallback(err => { if (err) setError({ missing: missingTable(err), message: err.message }); }, []);
  const enqueue = fn => {
    inflight.current++;
    queue.current = queue.current.then(fn).catch(e => fail(e)).finally(() => { inflight.current--; });
    return queue.current;
  };

  // Halaman ditutup / di-refresh saat perubahan belum terkirim → browser minta konfirmasi
  // dulu (tanpa ini, hapus/geser kartu lalu langsung refresh bisa hilang).
  useEffect(() => {
    const onLeave = e => {
      if (inflight.current > 0 || Object.keys(pendingPatch.current).length) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, []);

  const load = useCallback(async () => {
    const [{ data: g, error: ge }, { data: p, error: pe }] = await Promise.all([
      supabase.from('project_groups').select(COLS_G).order('sort_order').order('created_at'),
      supabase.from('projects').select(COLS_P).order('sort_order').order('created_at'),
    ]);
    const err = ge || pe;
    if (err) {
      setError({ missing: missingTable(err), message: err.message });
      setGroups([]); setProjects([]);
      return;
    }
    setError(null);
    setGroups(g || []);
    setProjects(p || []);
    // Grup kosong sisa operasi yang terputus → bersihkan diam-diam
    const used = new Set((p || []).map(x => x.group_id));
    const empty = (g || []).filter(x => !used.has(x.id)).map(x => x.id);
    if (empty.length) {
      setGroups(prev => prev.filter(x => !empty.includes(x.id)));
      enqueue(async () => { await supabase.from('project_groups').delete().in('id', empty); });
    }
  }, [setGroups, setProjects]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  /* Kirim patch ke DB. Menunggu insert baris selesai kalau project baru saja dibuat. */
  const send = useCallback(async (id, patch) => {
    inflight.current++;
    try {
      if (created.current[id]) await created.current[id];
      const { error: err } = await supabase.from('projects').update(patch).eq('id', id);
      fail(err);
    } finally {
      inflight.current--;
    }
  }, [fail]);

  // Keluar halaman: patch teks yang masih menunggu debounce dikirim, bukan dibuang
  useEffect(() => () => {
    Object.values(timers.current).forEach(clearTimeout);
    Object.entries(pendingPatch.current).forEach(([id, patch]) => send(id, patch));
    pendingPatch.current = {};
  }, [send]);

  /* ── Project ── */
  function updateProject(id, patch, { debounce = false } = {}) {
    setProjects(prev => (prev || []).map(p => (p.id === id ? { ...p, ...patch } : p)));
    if (!debounce) {
      // nilai terbaru menang: buang field yang sama dari patch debounce yang masih menunggu
      const pend = pendingPatch.current[id];
      if (pend) {
        Object.keys(patch).forEach(k => delete pend[k]);
        if (!Object.keys(pend).length) { clearTimeout(timers.current[id]); delete pendingPatch.current[id]; }
      }
      send(id, patch);
      return;
    }
    pendingPatch.current[id] = { ...(pendingPatch.current[id] || {}), ...patch };
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      const p = pendingPatch.current[id];
      delete pendingPatch.current[id];
      if (p && Object.keys(p).length) send(id, p);
    }, TEXT_DEBOUNCE_MS);
  }

  /* Project baru = grup baru di paling kanan. Id dibuat di klien supaya kartu langsung
     tampil; mengembalikan id project secara langsung (DB menyusul di antrean). */
  function createProject() {
    const gid = crypto.randomUUID(), pid = crypto.randomUUID();
    const now = new Date().toISOString();
    const order = (groupsRef.current || []).reduce((m, g) => Math.max(m, g.sort_order), -1) + 1;
    setGroups(prev => [...(prev || []), { id: gid, name: '', sort_order: order, created_at: now }]);
    setProjects(prev => [...(prev || []), {
      id: pid, group_id: gid, title: 'Untitled project', status: 'todo', due_date: null,
      notes: '', steps: [], sort_order: 0, created_at: now, updated_at: now,
    }]);
    created.current[pid] = enqueue(async () => {
      const { error: ge } = await supabase.from('project_groups').insert({ id: gid, name: '', sort_order: order });
      if (ge) throw ge;
      const { error: pe } = await supabase.from('projects').insert({ id: pid, group_id: gid, title: 'Untitled project', sort_order: 0 });
      if (pe) throw pe;
    }).finally(() => { delete created.current[pid]; });
    return pid;
  }

  function removeProject(id) {
    const p = (projectsRef.current || []).find(x => x.id === id);
    if (!p) return;
    clearTimeout(timers.current[id]);
    delete pendingPatch.current[id];
    const left = (projectsRef.current || []).filter(x => x.group_id === p.group_id && x.id !== id);
    setProjects(prev => (prev || []).filter(x => x.id !== id));
    if (!left.length) setGroups(prev => (prev || []).filter(g => g.id !== p.group_id));
    enqueue(async () => {
      const { error: e1 } = await supabase.from('projects').delete().eq('id', id);
      if (e1) throw e1;
      if (!left.length) {
        const { error: e2 } = await supabase.from('project_groups').delete().eq('id', p.group_id);
        if (e2) throw e2;
      }
    });
  }

  /* ── Langkah (sub-tugas) — JSON di kolom steps: { id, title, done, pic } ── */
  function patchSteps(id, fn, opts) {
    const cur = (projectsRef.current || []).find(p => p.id === id);
    if (cur) updateProject(id, { steps: fn(cur.steps || []) }, opts);
  }
  const addStep    = (id, title) => patchSteps(id, st => [...st, { id: crypto.randomUUID(), title: title.trim(), done: false, pic: PJ_DEFAULT_PIC }]);
  const toggleStep = (id, sid)   => patchSteps(id, st => st.map(s => (s.id === sid ? { ...s, done: !s.done } : s)));
  const updateStep = (id, sid, patch, opts) => patchSteps(id, st => st.map(s => (s.id === sid ? { ...s, ...patch } : s)), opts);
  const removeStep = (id, sid)   => patchSteps(id, st => st.filter(s => s.id !== sid));

  /* ── Grup ── */
  function renameGroup(gid, name) {
    setGroups(prev => (prev || []).map(g => (g.id === gid ? { ...g, name } : g)));
    enqueue(async () => {
      const { error: err } = await supabase.from('project_groups').update({ name }).eq('id', gid);
      if (err) throw err;
    });
  }

  /* Lebar kartu satu lajur (hasil geser pegangan kanan kartu); null = kembali ke bawaan.
     Kartu yang ditumpuk ikut lebar lajurnya, supaya kolom tetap rapi. */
  function setGroupWidth(gid, width) {
    setGroups(prev => (prev || []).map(g => (g.id === gid ? { ...g, width } : g)));
    enqueue(async () => {
      const { error: err } = await supabase.from('project_groups').update({ width }).eq('id', gid);
      if (err) throw err;
    });
  }

  /* Susunan papan setelah kartu digeser: stacks = [{ id, name, width, cards }] (final, tanpa
     lajur kosong). Lajur baru memakai id buatan klien. Ke DB berurutan: buat grup baru
     → pindahkan kartu → urutkan grup → hapus grup yang sudah kosong (restrict di DB
     menjamin grup berisi kartu tidak ikut terhapus). */
  function commitLayout(stacks) {
    const gs = groupsRef.current || [], ps = projectsRef.current || [];
    const gById = Object.fromEntries(gs.map(g => [g.id, g]));
    const pById = Object.fromEntries(ps.map(p => [p.id, p]));
    const now = new Date().toISOString();
    const newGroups = [], gUpd = [], pUpd = [];
    stacks.forEach((s, i) => {
      const g = gById[s.id];
      // kolom width hanya dikirim kalau ada isinya (aman walau kolomnya belum ditambahkan)
      if (!g) newGroups.push({ id: s.id, name: s.name || '', sort_order: i, ...(s.width ? { width: s.width } : {}) });
      else if (g.sort_order !== i) gUpd.push({ id: s.id, sort_order: i });
      s.cards.forEach((pid, j) => {
        const p = pById[pid];
        if (p && (p.group_id !== s.id || p.sort_order !== j)) pUpd.push({ id: pid, group_id: s.id, sort_order: j });
      });
    });
    const keep = new Set(stacks.map(s => s.id));
    const removed = gs.filter(g => !keep.has(g.id)).map(g => g.id);
    if (!newGroups.length && !gUpd.length && !pUpd.length && !removed.length) return;

    setGroups(stacks.map((s, i) => ({ ...(gById[s.id] || { id: s.id, name: s.name || '', width: s.width ?? null, created_at: now }), sort_order: i })));
    const pMap = Object.fromEntries(pUpd.map(u => [u.id, u]));
    setProjects(prev => (prev || []).map(p => (pMap[p.id] ? { ...p, group_id: pMap[p.id].group_id, sort_order: pMap[p.id].sort_order } : p)));

    enqueue(async () => {
      if (newGroups.length) {
        const { error: err } = await supabase.from('project_groups').insert(newGroups);
        if (err) throw err;
      }
      const r1 = await Promise.all(pUpd.map(u => supabase.from('projects').update({ group_id: u.group_id, sort_order: u.sort_order }).eq('id', u.id)));
      const bad1 = r1.find(r => r.error);
      if (bad1) throw bad1.error;
      const r2 = await Promise.all([
        ...gUpd.map(u => supabase.from('project_groups').update({ sort_order: u.sort_order }).eq('id', u.id)),
        ...(removed.length ? [supabase.from('project_groups').delete().in('id', removed)] : []),
      ]);
      const bad2 = r2.find(r => r.error);
      if (bad2) throw bad2.error;
    });
  }

  return {
    groups, projects, error, reload: load,
    createProject, updateProject, removeProject,
    addStep, toggleStep, updateStep, removeStep,
    renameGroup, setGroupWidth, commitLayout,
  };
}
