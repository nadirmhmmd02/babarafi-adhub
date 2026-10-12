'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import '../projects-ridgeline.css';
import { Plus, Trash2, FolderKanban, CircleAlert, RotateCw } from 'lucide-react';
import { useAuth, homeFor } from '../components/AuthContext';
import useIsMobile from '../components/useIsMobile';
import ThemeToggle from '../components/ThemeToggle';
import { dashboardFontVars } from '../components/dashboardFonts';
import { RgDialog } from '../components/rgKit';
import useProjects, { buildStacks, PJ_CARD_W, PJ_CARD_W_MIN, PJ_CARD_W_MAX } from '../components/useProjects';
import ProjectCard from '../components/ProjectCard';
import ProjectDetail from '../components/ProjectDetail';
import { isOverdue } from '../components/useTodos';

/* ─────────────────────────────────────────────────────────────
   PROJECTS — papan project pribadi admin (/projects; sub menu Workspace).
   Dibangun 12 Okt 2026 dari mockup "A · Lanes" yang dipilih Nadir.
   - Kartu berjejer ke KANAN; project baru selalu paling kanan (kiri = lama).
   - Tekan & geser KEPALA kartu: ke sisi kiri/kanan kartu lain = lajur baru /
     pindah urutan; ke atas/bawah kartu lain = ditumpuk jadi satu kolom.
     Lajur berisi 2+ kartu dapat judul grup yang bisa diganti nama.
   - Tekan & geser AREA KOSONG papan = geser papan kanan-kiri (+ luncuran).
   - Semua kartu mulai TERBUKA (daftar langkah tampil; keputusan Nadir 12 Okt 2026),
     klik kepala = tutup/buka. Kartu yang ditutup tidak diingat (refresh = terbuka lagi).
   HP: satu kolom ke bawah, tanpa geser kartu / geser papan.
   Data: useProjects (project_groups + projects, RLS per pemilik).
   Styling: app/projects-ridgeline.css (.rgp-).
   ───────────────────────────────────────────────────────────── */

const DRAG_START_PX = 5;    // kursor harus bergeser sejauh ini sebelum kartu terangkat
const PAN_START_PX = 3;
const EDGE_PX = 56;         // dekat tepi papan saat menyeret kartu → papan ikut bergeser
const FLIP_MS = 360;
const DROP_MS = 230;        // = transisi .rgp-clone.is-drop di CSS

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function sameLayout(a, b) {
  if (a.length !== b.length) return false;
  return a.every((s, i) => s.id === b[i].id && s.cards.length === b[i].cards.length && s.cards.every((c, j) => c === b[i].cards[j]));
}

/* Pindahkan kartu `id` ke target hasil hitTarget. Lajur asal yang jadi kosong tetap
   disimpan selama menyeret (src) supaya lajur lain tidak bergeser di bawah kursor;
   lajur kosong tetangga dipakai ulang daripada membuat lajur baru. */
function applyMove(stacks, id, t, src) {
  const fromStack = stacks.find(s => s.cards.includes(id));
  const from = fromStack?.id;
  let next = stacks.map(s => ({ ...s, cards: s.cards.filter(c => c !== id) }));
  const reusable = i => next[i] && !next[i].cards.length && (next[i].id === src || next[i].id === from);
  const place = i => {
    const r = reusable(i - 1) ? i - 1 : reusable(i) ? i : -1;
    if (r > -1) next[r].cards.push(id);
    // lajur baru membawa lebar lajur asal kartunya (kartu yang sudah dilebarkan tetap lebar)
    else next.splice(i, 0, { id: crypto.randomUUID(), name: '', width: fromStack?.width ?? null, cards: [id] });
  };
  if (t.t === 'end') place(next.length);
  else if (t.t === 'before' || t.t === 'after') {
    const i = next.findIndex(s => s.id === t.sid);
    if (i < 0) return null;
    place(t.t === 'before' ? i : i + 1);
  } else {
    const s = next.find(x => x.id === t.sid);
    if (!s) return null;
    if (t.pos === 'top') s.cards.unshift(id);
    else if (t.pos === 'bottom') s.cards.push(id);
    else {
      const j = s.cards.indexOf(t.ref);
      if (j < 0) return null;
      s.cards.splice(t.pos === 'above' ? j : j + 1, 0, id);
    }
  }
  next = next.filter(s => s.cards.length || s.id === src);
  return sameLayout(next, stacks) ? null : next;
}

/* Lebar teks satu baris (tanpa terpotong / turun baris) — diukur dengan canvas memakai
   font elemennya, jadi tidak perlu mengubah tampilan untuk mengukur. */
let measureCtx = null;
function textW(el, text) {
  if (!el) return 0;
  measureCtx ||= document.createElement('canvas').getContext('2d');
  const cs = getComputedStyle(el);
  measureCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return measureCtx.measureText(text ?? el.textContent).width;
}

/* Lebar kartu agar SEMUA teks di lajur terbaca utuh (ala autofit kolom Excel): judul &
   baris status-tenggat tidak terpotong, tiap langkah muat satu baris, judul grup utuh.
   Rumus per elemen yang melebar (flex:1): lebar kartu − lebar elemen sekarang + lebar
   teks aslinya. Dijepit PJ_CARD_W_MIN..MAX (langkah yang sangat panjang tetap turun baris). */
function fitWidth(lane) {
  let need = 0;
  lane.querySelectorAll('[data-pid]').forEach(card => {
    const cw = card.getBoundingClientRect().width;
    const main = card.querySelector('.rgp-main');
    const title = card.querySelector('.rgp-title, .rgp-title-input');
    const titleNat = title ? textW(title, title.value ?? title.textContent) + 10 : 0;
    const pill = card.querySelector('.rgp-head .rgp-st');
    const due = card.querySelector('.rgp-due');
    const metaNat = (pill ? pill.getBoundingClientRect().width : 0) + 8 + (due ? textW(due) + 2 : 0);
    if (main) need = Math.max(need, cw - main.getBoundingClientRect().width + Math.max(titleNat, metaNat));
    card.querySelectorAll('.rgp-step-t').forEach(t => {
      need = Math.max(need, cw - t.getBoundingClientRect().width + textW(t) + 2);
    });
  });
  const name = lane.querySelector('.rgp-lane-name');
  if (name) need = Math.max(need, textW(name) + 12 + 8 + (lane.querySelector('.rgp-lane-n')?.getBoundingClientRect().width || 0) + 6);
  return Math.min(PJ_CARD_W_MAX, Math.max(PJ_CARD_W_MIN, Math.ceil(need)));
}

/* Elemen di bawah kursor → tujuan kartu yang diseret */
function hitTarget(board, me, hit, x, y) {
  if (!hit || !board.contains(hit)) return null;
  if (me && me.contains(hit)) return null;
  const over = hit.closest('[data-pid]');
  const lane = hit.closest('.rgp-lane');
  if (over && lane) {
    const sid = lane.dataset.sid, r = over.getBoundingClientRect();
    const rx = (x - r.left) / r.width, ry = (y - r.top) / r.height;
    if (rx < 0.2) return { t: 'before', sid };
    if (rx > 0.8) return { t: 'after', sid };
    return { t: 'into', sid, ref: over.dataset.pid, pos: ry < 0.5 ? 'above' : 'below' };
  }
  if (lane) return { t: 'into', sid: lane.dataset.sid, pos: hit.closest('.rgp-lane-head') ? 'top' : 'bottom' };
  let best = null, bd = Infinity;
  board.querySelectorAll('.rgp-lane').forEach(l => {
    const r = l.getBoundingClientRect();
    const d = Math.hypot(x - Math.max(r.left, Math.min(x, r.right)), y - Math.max(r.top, Math.min(y, r.bottom)));
    if (d < bd) { bd = d; best = l; }
  });
  if (!best) return { t: 'end' };
  const br = best.getBoundingClientRect(), sid = best.dataset.sid;
  if (y > br.bottom && y - br.bottom < 90 && x >= br.left && x <= br.right) return { t: 'into', sid, pos: 'bottom' };
  return x < br.left + br.width / 2 ? { t: 'before', sid } : { t: 'after', sid };
}

export default function ProjectsPage() {
  const { role, ready } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const pj = useProjects(role === 'admin');

  const [closedIds, setClosedIds] = useState(() => new Set()); // default: semua terbuka
  const [pickId, setPickId] = useState(null);                // kartu yang pilihan statusnya mekar
  const [editTitleId, setEditTitleId] = useState(null);
  const [editGroupId, setEditGroupId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [dragStacks, setDragStacks] = useState(null);        // susunan sementara selama menyeret
  const [dragId, setDragId] = useState(null);                // kartu yang jadi placeholder
  const [newId, setNewId] = useState(null);
  const [canPan, setCanPan] = useState(false);

  const rootRef = useRef(null);
  const boardRef = useRef(null);
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const panRaf = useRef(0);
  const flipRef = useRef(null);
  const dropRef = useRef(null);
  const stacksRef = useRef(null);
  const resizeRef = useRef(null);   // { sid, lane, x0, w0, w } — pegangan lebar kartu sedang digeser
  const pjRef = useRef(pj);
  pjRef.current = pj;

  // Papan pribadi — hanya admin
  useEffect(() => {
    if (ready && role && role !== 'admin') router.replace(homeFor(role));
  }, [ready, role, router]);

  const baseStacks = useMemo(() => buildStacks(pj.groups, pj.projects), [pj.groups, pj.projects]);
  const stacks = dragStacks || baseStacks;
  stacksRef.current = stacks;
  const byId = useMemo(() => Object.fromEntries((pj.projects || []).map(p => [p.id, p])), [pj.projects]);

  /* ── FLIP: posisi kartu sebelum perubahan → sesudah render, kartu meluncur dari
     posisi lama (properti `translate`, terpisah dari `transform`) ── */
  const snapFlip = useCallback((skip) => {
    const board = boardRef.current;
    if (!board || reduceMotion()) return;
    const rects = {};
    board.querySelectorAll('[data-pid]').forEach(el => { rects[el.dataset.pid] = el.getBoundingClientRect(); });
    flipRef.current = { rects, skip };
  }, []);

  useLayoutEffect(() => {
    const board = boardRef.current;
    const f = flipRef.current;
    if (f && board) {
      flipRef.current = null;
      const moved = [];
      board.querySelectorAll('[data-pid]').forEach(el => {
        const id = el.dataset.pid, from = f.rects[id];
        if (!from || id === f.skip) return;
        const r = el.getBoundingClientRect();
        const dx = from.left - r.left, dy = from.top - r.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.style.transition = 'none';
        el.style.translate = `${dx}px ${dy}px`;
        moved.push(el);
      });
      if (moved.length) {
        void board.offsetWidth;
        requestAnimationFrame(() => moved.forEach(el => {
          el.style.transition = `translate ${FLIP_MS}ms cubic-bezier(.22,1,.36,1)`;
          el.style.translate = '0px 0px';
          clearTimeout(el._flipT);
          el._flipT = setTimeout(() => { el.style.transition = ''; el.style.translate = ''; }, FLIP_MS + 60);
        }));
      }
    }
    // Kartu dilepas: bayangan kartu terbang ke tempat akhirnya, lalu placeholder dilepas
    const drop = dropRef.current;
    if (drop && board) {
      dropRef.current = null;
      const el = board.querySelector(`[data-pid="${drop.id}"]`);
      const cl = drop.clone;
      if (el) {
        const r = el.getBoundingClientRect();
        cl.classList.remove('is-lift');
        cl.classList.add('is-drop');
        cl.style.left = `${r.left}px`;
        cl.style.top = `${r.top}px`;
      }
      setTimeout(() => { cl.remove(); setDragId(null); }, reduceMotion() ? 0 : DROP_MS);
    }
  });

  /* ── Papan bisa digeser kalau isinya lebih lebar dari layar ── */
  const measurePan = useCallback(() => {
    const b = boardRef.current;
    setCanPan(!!b && !isMobile && b.scrollWidth > b.clientWidth + 1);
  }, [isMobile]);
  useEffect(() => { measurePan(); }, [measurePan, stacks, closedIds]);
  useEffect(() => {
    const b = boardRef.current;
    if (!b) return undefined;
    const ro = new ResizeObserver(measurePan);
    ro.observe(b);
    return () => ro.disconnect();
  }, [measurePan, role]);

  /* ── Aksi kartu (stabil, supaya ProjectCard yang di-memo tidak render ulang semua) ── */
  const toggleOpen = useCallback(id => setClosedIds(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  }), []);
  const headClick = useCallback((target, id) => {
    if (target.closest('[data-pj="title"]')) { setEditTitleId(id); return; }
    if (target.closest('[data-pj="status"]')) { setPickId(cur => (cur === id ? null : id)); return; }
    if (target.closest('[data-pj="avs"]')) return;
    toggleOpen(id);
  }, [toggleOpen]);
  const commitTitle = useCallback((id, v) => {
    setEditTitleId(null);
    if (v == null) return;
    const title = v.trim() || 'Untitled project';
    const cur = pjRef.current.projects?.find(p => p.id === id);
    if (cur && cur.title !== title) pjRef.current.updateProject(id, { title });
  }, []);
  const setStatus = useCallback((id, status) => { pjRef.current.updateProject(id, { status }); setPickId(null); }, []);
  const toggleStep = useCallback((id, sid) => pjRef.current.toggleStep(id, sid), []);
  const addStep = useCallback((id, title) => pjRef.current.addStep(id, title), []);
  const openDetail = useCallback(id => setDetailId(id), []);

  function addProject() {
    snapFlip();
    const id = pj.createProject();
    setNewId(id);
    setEditTitleId(id);
    setTimeout(() => setNewId(cur => (cur === id ? null : cur)), 600);
    requestAnimationFrame(() => {
      const b = boardRef.current;
      if (!b) return;
      const behavior = reduceMotion() ? 'auto' : 'smooth';
      if (isMobile) b.scrollTo({ top: b.scrollHeight, behavior }); else b.scrollTo({ left: b.scrollWidth, behavior });
    });
  }

  function removeNow() {
    const p = confirmDel;
    if (!p) return;
    snapFlip();
    pj.removeProject(p.id);
    setClosedIds(prev => { const n = new Set(prev); n.delete(p.id); return n; });
    setConfirmDel(null);
  }

  /* ── Geser kartu & geser papan (desktop) ── */
  function onBoardPointerDown(e) {
    if (isMobile || e.button !== 0) return;
    cancelAnimationFrame(panRaf.current);
    const t = e.target, board = boardRef.current;
    if (t.closest('input, textarea')) return;
    if (!t.closest('[data-pid], .rgp-lane-name, button')) {
      if (board.scrollWidth > board.clientWidth + 1) {
        e.preventDefault();
        panRef.current = { x: e.clientX, sl: board.scrollLeft, moved: false, lastX: e.clientX, lastT: performance.now(), v: 0 };
      }
      return;
    }
    const head = t.closest('.rgp-head');
    const card = head?.closest('[data-pid]');
    if (!card) return;
    e.preventDefault();   // jangan sampai teks terblok saat menyeret
    const ae = document.activeElement;
    if (ae && ae !== document.body && !card.contains(ae)) ae.blur?.();
    dragRef.current = { id: card.dataset.pid, x0: e.clientX, y0: e.clientY, started: false, target: t };
  }

  function startDrag(d) {
    const board = boardRef.current, root = rootRef.current;
    const card = board?.querySelector(`[data-pid="${d.id}"]`);
    if (!card || !root) { dragRef.current = null; return; }
    const r = card.getBoundingClientRect();
    Object.assign(d, {
      started: true, h: r.height, offX: d.x0 - r.left, offY: d.y0 - r.top, key: '',
      src: card.closest('.rgp-lane')?.dataset.sid,
    });
    const cl = card.cloneNode(true);
    cl.removeAttribute('data-pid');
    cl.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    cl.classList.add('rgp-clone');
    cl.classList.remove('is-new', 'is-picking');
    cl.setAttribute('aria-hidden', 'true');
    cl.style.width = `${r.width}px`;
    cl.style.left = `${r.left}px`;
    cl.style.top = `${r.top}px`;
    cl.style.translate = '';
    cl.style.transition = '';
    root.appendChild(cl);
    d.clone = cl;
    requestAnimationFrame(() => cl.classList.add('is-lift'));
    document.documentElement.classList.add('rgp-dragging');
    const copy = stacksRef.current.map(s => ({ ...s, cards: [...s.cards] }));
    stacksRef.current = copy;
    setDragStacks(copy);
    setDragId(d.id);
    setPickId(null);
  }

  function moveDrag(d, e) {
    const x = e.clientX, y = e.clientY, board = boardRef.current;
    d.clone.style.left = `${x - d.offX}px`;
    d.clone.style.top = `${y - d.offY}px`;
    const br = board.getBoundingClientRect();
    if (x > br.right - EDGE_PX) board.scrollLeft += 14;
    else if (x < br.left + EDGE_PX) board.scrollLeft -= 14;
    const me = board.querySelector(`[data-pid="${d.id}"]`);
    const t = hitTarget(board, me, document.elementFromPoint(x, y), x, y);
    if (!t) return;
    const key = JSON.stringify(t);
    if (key === d.key) return;
    d.key = key;
    const next = applyMove(stacksRef.current, d.id, t, d.src);
    if (!next) return;
    snapFlip();
    stacksRef.current = next;
    setDragStacks(next);
  }

  function finishDrag(d, cancel) {
    document.documentElement.classList.remove('rgp-dragging');
    snapFlip(d.id);
    dropRef.current = { clone: d.clone, id: d.id };
    if (!cancel) pj.commitLayout(stacksRef.current.filter(s => s.cards.length));
    setDragStacks(null);
  }

  /* ── Lebar kartu: geser pegangan di sisi kanan kartu (desktop). Selama digeser lebar
     ditulis langsung ke CSS var lajur (tanpa render ulang), disimpan saat dilepas.
     Klik dua kali pegangan = lebar menyesuaikan teks (autofit ala Excel). ── */
  function startResize(e, sid) {
    if (isMobile || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();   // jangan sampai ikut menggeser papan
    const lane = e.currentTarget.closest('.rgp-lane');
    const st = stacksRef.current?.find(s => s.id === sid);
    if (!lane || !st) return;
    const w0 = st.width || PJ_CARD_W;
    resizeRef.current = { sid, lane, x0: e.clientX, w0, w: w0 };
    lane.classList.add('is-resizing');
    document.documentElement.classList.add('rgp-resizing');
  }
  function moveResize(e) {
    const rz = resizeRef.current;
    const w = Math.round(Math.min(PJ_CARD_W_MAX, Math.max(PJ_CARD_W_MIN, rz.w0 + e.clientX - rz.x0)));
    if (w === rz.w) return;
    rz.w = w;
    rz.lane.style.setProperty('--rgp-w', `${w}px`);
  }
  function endResize() {
    const rz = resizeRef.current;
    resizeRef.current = null;
    rz.lane.classList.remove('is-resizing');
    document.documentElement.classList.remove('rgp-resizing');
    if (rz.w !== rz.w0) pj.setGroupWidth(rz.sid, rz.w === PJ_CARD_W ? null : rz.w);
  }
  function autoFit(e, sid) {
    const lane = e.currentTarget.closest('.rgp-lane');
    const st = stacksRef.current?.find(s => s.id === sid);
    if (!lane || !st) return;
    const w = fitWidth(lane);
    if (w === (st.width || PJ_CARD_W)) return;
    // lebar langsung berubah (seperti Excel); kartu di sebelah kanannya meluncur ke posisi
    // barunya lewat FLIP (transform), bukan animasi width yang memicu layout tiap frame
    snapFlip();
    pj.setGroupWidth(sid, w === PJ_CARD_W ? null : w);
  }

  function endPan() {
    const p = panRef.current;
    panRef.current = null;
    document.documentElement.classList.remove('rgp-panning');
    if (!p.moved || reduceMotion() || performance.now() - p.lastT > 70) return;
    let v = -p.v * 16;                       // luncuran: kecepatan terakhir, melambat pelan
    const board = boardRef.current;
    const glide = () => {
      if (!board || Math.abs(v) < 0.4) return;
      board.scrollLeft += v;
      v *= 0.93;
      panRaf.current = requestAnimationFrame(glide);
    };
    glide();
  }

  const H = useRef({});
  H.current.move = e => {
    if (resizeRef.current) { moveResize(e); return; }
    const pan = panRef.current;
    if (pan) {
      const dx = e.clientX - pan.x;
      if (!pan.moved) {
        if (Math.abs(dx) < PAN_START_PX) return;
        pan.moved = true;
        document.documentElement.classList.add('rgp-panning');
      }
      boardRef.current.scrollLeft = pan.sl - dx;
      const now = performance.now(), dt = now - pan.lastT;
      if (dt > 0) pan.v = 0.8 * ((e.clientX - pan.lastX) / dt) + 0.2 * pan.v;
      pan.lastX = e.clientX;
      pan.lastT = now;
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < DRAG_START_PX) return;
      startDrag(d);
      if (!dragRef.current) return;
    }
    moveDrag(d, e);
  };
  H.current.up = () => {
    if (resizeRef.current) { endResize(); return; }
    if (panRef.current) { endPan(); return; }
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    if (d.started) finishDrag(d, false);
    else headClick(d.target, d.id);
  };
  H.current.cancel = () => {
    if (resizeRef.current) endResize();
    if (panRef.current) { panRef.current = null; document.documentElement.classList.remove('rgp-panning'); }
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.started) finishDrag(d, true);
  };
  H.current.key = e => {
    if (e.key !== 'Escape') return;
    const d = dragRef.current;
    if (!d?.started) return;
    dragRef.current = null;
    finishDrag(d, true);
  };
  useEffect(() => {
    const mv = e => H.current.move(e), up = e => H.current.up(e), cc = () => H.current.cancel(), kd = e => H.current.key(e);
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cc);
    window.addEventListener('keydown', kd);
    return () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cc);
      window.removeEventListener('keydown', kd);
      cancelAnimationFrame(panRaf.current);
      document.documentElement.classList.remove('rgp-dragging', 'rgp-panning', 'rgp-resizing');
    };
  }, []);

  if (!role || role !== 'admin') return null;

  const all = pj.projects || [];
  const nProg = all.filter(p => p.status === 'progress').length;
  const nLate = all.filter(p => p.status !== 'done' && isOverdue(p.due_date)).length;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const missing = !!pj.error?.missing;
  const detailProject = detailId ? byId[detailId] : null;

  const ctxLine = pj.projects === null && !pj.error
    ? <span>Loading projects…</span>
    : (<>
        {!isMobile && (<>
          <span className="rg-live" aria-hidden="true" />
          <span>Workspace</span>
          <span className="rg-ctx-sep" aria-hidden="true" />
        </>)}
        <span>{plural(all.length, 'project')}</span>
        {nProg > 0 && (<><span className="rg-ctx-sep" aria-hidden="true" /><span>{nProg} in progress</span></>)}
        {nLate > 0 && (<><span className="rg-ctx-sep" aria-hidden="true" /><span>{nLate} overdue</span></>)}
        {!isMobile && (<><span className="rg-ctx-sep" aria-hidden="true" /><span>Synced across your devices</span></>)}
      </>);

  return (
    <div ref={rootRef} className={`rg rg-page rgp ${dashboardFontVars}${isMobile ? ' is-mobile' : ''}`}>

      {/* ══ TOP BAR — judul + konteks (kiri) · New project + tema (kanan) ══ */}
      <header className="rg-top">
        <div className="rg-top-title">
          <h1 className="rg-h1">Projects</h1>
          <div className="rg-ctx">{ctxLine}</div>
        </div>
        {/* Satu-satunya tombol tambah project (keputusan Nadir 12 Okt 2026 — tanpa kartu
            "+ New project" di ujung papan). Di HP tombol ini tetap tampil; tema ada di menu HP. */}
        <div className="rg-tools">
          <button type="button" className="rg-pill is-primary" onClick={addProject} disabled={!stacks || missing}>
            <Plus size={15} />New project
          </button>
          {!isMobile && <ThemeToggle className="rg-pill rg-round" />}
        </div>
      </header>

      {pj.error && (
        <div className="rgp-alert">
          {missing ? (
            <div className="rg-error is-warn">
              <span className="rg-error-ico"><CircleAlert size={18} /></span>
              <div>
                <div className="rg-error-title">Projects isn’t set up yet</div>
                <div className="rg-error-msg">Run <strong>supabase-projects-setup.sql</strong> once in the Supabase SQL Editor, then refresh this page.</div>
              </div>
            </div>
          ) : (
            <div className="rg-error">
              <span className="rg-error-ico"><CircleAlert size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="rg-error-title">Your last change wasn’t saved</div>
                <div className="rg-error-msg">{pj.error.message}</div>
              </div>
              <button type="button" className="rg-btn" onClick={() => pj.reload()}><RotateCw size={14} />Reload</button>
            </div>
          )}
        </div>
      )}

      {/* ══ PAPAN ══ */}
      <div ref={boardRef} className={`rgp-board rg-rise${canPan ? ' can-pan' : ''}`} onPointerDown={onBoardPointerDown}>
        {stacks === null && !pj.error && [0, 1, 2].map(i => (
          <div key={i} className="rgp-lane" aria-hidden="true">
            <div className="rgp-card rgp-skel"><div className="rgp-well">
              <span className="rg-skel" style={{ width: 30, height: 30, borderRadius: '50%' }} />
              <span style={{ flex: 1, display: 'grid', gap: 7 }}>
                <span className="rg-skel" style={{ height: 11, width: `${[72, 58, 66][i]}%` }} />
                <span className="rg-skel" style={{ height: 9, width: '44%' }} />
              </span>
            </div></div>
          </div>
        ))}

        {stacks && stacks.length === 0 && !missing && (
          <div className="rgp-lane">
            <div className="rg-card rgp-empty"><div className="rg-well rgp-empty-in">
              <span className="rgp-empty-ico"><FolderKanban size={20} /></span>
              <strong>Start your first project</strong>
              <span>Each card holds one project: its steps, status, due date and PIC. Add one with New project at the top right.</span>
            </div></div>
          </div>
        )}

        {stacks && stacks.map(st => {
          const n = st.cards.length;
          return (
            <div key={st.id} className={`rgp-lane${n > 1 ? ' is-stack' : ''}${!n ? ' is-empty' : ''}`} data-sid={st.id}
              style={{
                '--rgp-w': `${st.width || PJ_CARD_W}px`,
                ...(!n ? { '--rgp-h': `${dragRef.current?.h || 60}px` } : {}),
              }}>
              {!isMobile && n > 0 && (
                <div className="rgp-resize" onPointerDown={e => startResize(e, st.id)} onDoubleClick={e => autoFit(e, st.id)}
                  title="Drag to resize · double-click to fit the text" aria-hidden="true" />
              )}
              {n > 1 && (
                <div className="rgp-lane-head">
                  {editGroupId === st.id ? (
                    <input className="rgp-lane-input" defaultValue={st.name} autoFocus placeholder="Name this group"
                      aria-label="Group name" onFocus={e => e.target.select()}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                        else if (e.key === 'Escape') { e.currentTarget.dataset.cancel = '1'; e.currentTarget.blur(); }
                      }}
                      onBlur={e => {
                        setEditGroupId(null);
                        if (e.currentTarget.dataset.cancel) return;
                        const v = e.currentTarget.value.trim();
                        if (v !== st.name) pj.renameGroup(st.id, v);
                      }} />
                  ) : (
                    <button type="button" className="rgp-lane-name" title="Rename group" onClick={() => setEditGroupId(st.id)}>
                      {st.name || <i>Name this group</i>}
                    </button>
                  )}
                  <span className="rgp-lane-n rg-mono">{n}</span>
                </div>
              )}
              {st.cards.map(pid => {
                const p = byId[pid];
                if (!p) return null;
                return (
                  <ProjectCard key={pid} p={p}
                    open={!closedIds.has(pid)} picking={pickId === pid} editingTitle={editTitleId === pid}
                    placeholder={dragId === pid} isNew={newId === pid} isMobile={isMobile}
                    onHeadClick={headClick} onToggleOpen={toggleOpen} onTitleCommit={commitTitle}
                    onStatus={setStatus} onToggleStep={toggleStep} onAddStep={addStep} onOpen={openDetail} />
                );
              })}
            </div>
          );
        })}

      </div>

      {/* ══ DETAIL PROJECT (Open →) ══ */}
      {detailProject && (
        <ProjectDetail key={detailProject.id} project={detailProject} pj={pj}
          onClose={() => setDetailId(null)}
          onRequestDelete={p => { setDetailId(null); setConfirmDel(p); }} />
      )}

      {/* ══ KONFIRMASI HAPUS — tombol Delete sengaja tidak di-autofocus ══ */}
      {confirmDel && (
        <RgDialog
          icon={Trash2}
          tone="neg"
          title="Delete this project?"
          sub={confirmDel.title || 'Untitled project'}
          onClose={() => setConfirmDel(null)}
          width={400}
          foot={<>
            <button type="button" className="rg-btn rg-btn-ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
            <button type="button" className="rg-btn rg-btn-danger" onClick={removeNow}>Delete</button>
          </>}
        >
          Its steps and notes will be removed from every device. This can’t be undone.
        </RgDialog>
      )}
    </div>
  );
}
