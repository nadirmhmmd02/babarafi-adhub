'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   HOLD BUTTON — tombol "tahan untuk konfirmasi" (adaptasi "Hold Button" React Bits,
   kategori Micro, Sep 2026). Tekan & TAHAN selama holdTime → warna mengisi dari kiri
   dengan ujung bergelombang; dilepas sebelum penuh → surut lagi (batal). Penuh →
   onHold(). Dipakai popup Stop/Run campaign (Campaigns) — aksinya langsung ke Meta,
   jadi dibuat anti kepencet.

   - tone     : 'neg' (Stop, merah) | 'pos' (Run, hijau) — warna dari token --rg-*
   - busy     : selama true tombol tetap penuh + spinner + busyLabel. Kalau busy kembali
                false & tombol masih tampil (mis. Meta menolak) → otomatis balik ke awal.
   - Klik singkat → label sebentar jadi "Press and hold" + goyang kecil (petunjuk).
   - Keyboard: tahan Space/Enter; Esc membatalkan.
   Styling di app/ridgeline.css (.rg-hold).
   ───────────────────────────────────────────────────────────── */

const TAP_MS = 250;
const HIT_PAD = 10;
const LINEAR = t => t;
const EASE_OUT = t => 1 - Math.pow(1 - t, 3);

export default function HoldButton({
  children,
  busyLabel = 'Processing…',
  tone = 'neg',
  holdTime = 1200,
  releaseTime = 220,
  busy = false,
  disabled = false,
  onHold,
}) {
  const [phase, setPhase] = useState('idle');     // idle | holding | done
  const [input, setInput] = useState(null);       // pointer | key
  const [nudge, setNudge] = useState(false);
  const phaseRef = useRef('idle');
  const inputRef = useRef(null);
  const buttonRef = useRef(null);
  const gesture = useRef({ pointerId: null, start: 0, rect: null });
  const timers = useRef({ complete: 0, reset: 0, nudge: 0 });
  const sawBusy = useRef(false);
  const hintId = useId();

  const go = (next, kind = null) => {
    phaseRef.current = next;
    inputRef.current = kind;
    setPhase(next);
    setInput(kind);
  };

  // Progres isi 0→1 ditulis ke --hb-p tiap frame (CSS yang menggambar isi & gelombang)
  const motion = useRef({ raf: 0, p: 0, from: 0, to: 0, start: 0 });
  const drive = (to, duration, ease) => {
    const m = motion.current;
    cancelAnimationFrame(m.raf);
    m.from = m.p;
    m.to = to;
    m.start = performance.now();
    const step = now => {
      const t = duration > 0 ? Math.min(1, (now - m.start) / duration) : 1;
      m.p = m.from + (m.to - m.from) * ease(t);
      buttonRef.current?.style.setProperty('--hb-p', m.p.toFixed(4));
      if (t < 1) { m.raf = requestAnimationFrame(step); return; }
      m.raf = 0;
      if (m.to === 1) complete();
    };
    m.raf = requestAnimationFrame(step);
  };

  const reset = () => {
    clearTimeout(timers.current.reset);
    go('idle');
    drive(0, releaseTime, EASE_OUT);
  };

  const complete = () => {
    if (phaseRef.current !== 'holding') return;
    if (performance.now() - gesture.current.start < holdTime - 50) return;
    clearTimeout(timers.current.complete);
    go('done', inputRef.current);
    sawBusy.current = false;
    onHold?.();
    // Pengaman: kalau pemanggil ternyata tidak memproses apa-apa, jangan macet penuh
    timers.current.reset = setTimeout(() => {
      if (!sawBusy.current && phaseRef.current === 'done') reset();
    }, 900);
  };

  const begin = kind => {
    if (disabled || busy || phaseRef.current !== 'idle') return false;
    const button = buttonRef.current;
    if (!button) return false;
    gesture.current.start = performance.now();
    gesture.current.rect = button.getBoundingClientRect();
    go('holding', kind);
    drive(1, holdTime, LINEAR);
    timers.current.complete = setTimeout(complete, holdTime + 100);
    return true;
  };

  const showNudge = () => {
    clearTimeout(timers.current.nudge);
    setNudge(true);
    timers.current.nudge = setTimeout(() => setNudge(false), 1400);
  };

  const release = ({ drifted = false } = {}) => {
    if (phaseRef.current !== 'holding') return;
    clearTimeout(timers.current.complete);
    const held = performance.now() - gesture.current.start;
    go('idle');
    drive(0, releaseTime, EASE_OUT);
    if (!drifted && held < TAP_MS) showNudge();
  };
  const releaseRef = useRef(release);
  releaseRef.current = release;

  const handlePointerDown = e => {
    if (e.button !== 0 || !e.isPrimary || gesture.current.pointerId !== null) return;
    if (!begin('pointer')) return;
    gesture.current.pointerId = e.pointerId;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const endPointer = (e, options) => {
    if (e.pointerId !== gesture.current.pointerId) return;
    gesture.current.pointerId = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    release(options);
  };
  const handlePointerMove = e => {
    if (e.pointerId !== gesture.current.pointerId) return;
    const r = gesture.current.rect;
    if (!r) return;
    const out = e.clientX < r.left - HIT_PAD || e.clientX > r.right + HIT_PAD
      || e.clientY < r.top - HIT_PAD || e.clientY > r.bottom + HIT_PAD;
    if (out) endPointer(e, { drifted: true });
  };
  const handlePointerLeave = e => { if (e.pointerType !== 'touch') endPointer(e, { drifted: true }); };
  const handleKeyDown = e => {
    if (e.key === 'Escape') {
      if (inputRef.current === 'key') { e.stopPropagation(); release({ drifted: true }); }
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) begin('key');
    }
  };
  const handleKeyUp = e => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (inputRef.current === 'key') release();
    }
  };

  // Ukuran tombol → dipakai CSS untuk menggambar gelombang di ujung isi
  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button) return undefined;
    const measure = () => {
      button.style.setProperty('--hb-w', `${button.offsetWidth}px`);
      button.style.setProperty('--hb-h', `${button.offsetHeight}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(button);
    return () => ro.disconnect();
  }, []);

  // Pindah jendela / tab saat menahan → batal (jangan sampai "tertahan" sendiri)
  useEffect(() => {
    if (phase !== 'holding') return undefined;
    const cancel = () => releaseRef.current({ drifted: true });
    const onVisibility = () => { if (document.hidden) cancel(); };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [phase]);

  // Proses selesai tapi tombol masih tampil (gagal) → kembali ke awal, siap ditahan lagi
  useEffect(() => {
    if (busy) { sawBusy.current = true; return; }
    if (sawBusy.current && phaseRef.current === 'done') { sawBusy.current = false; reset(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  useEffect(() => {
    const t = timers.current;
    const m = motion.current;
    return () => {
      clearTimeout(t.complete); clearTimeout(t.reset); clearTimeout(t.nudge);
      cancelAnimationFrame(m.raf);
    };
  }, []);

  const labels = (
    <>
      <span className="rg-hold-idle" aria-hidden={phase === 'done' || nudge}>{children}</span>
      <span className="rg-hold-nudge" aria-hidden={phase === 'done' || !nudge}>Press and hold</span>
      <span className="rg-hold-done" aria-hidden={phase !== 'done'}>
        <RefreshCw size={13} className="rg-hold-spin" />
        {busyLabel}
      </span>
    </>
  );

  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      className={`rg-hold is-${tone === 'pos' ? 'pos' : 'neg'}`}
      data-phase={phase}
      data-input={input ?? undefined}
      data-nudge={nudge && phase !== 'done' ? '' : undefined}
      aria-describedby={hintId}
      style={{
        '--hb-hold': `${holdTime}ms`,
        '--hb-cycles': holdTime / 1100,
        '--hb-release': `${releaseTime}ms`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={e => endPointer(e)}
      onPointerCancel={e => endPointer(e, { drifted: true })}
      onLostPointerCapture={e => endPointer(e, { drifted: true })}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onContextMenu={e => e.preventDefault()}
    >
      <span className="rg-hold-pulse" aria-hidden="true" />
      <span className="rg-hold-label">{labels}</span>
      <span className="rg-hold-clip" aria-hidden="true">
        <span className="rg-hold-fill">
          <span className="rg-hold-label">{labels}</span>
        </span>
        <span className="rg-hold-crest">
          <span className="rg-hold-label">{labels}</span>
        </span>
      </span>
      <span id={hintId} className="rg-sr">
        Press and hold for {Math.round(holdTime / 100) / 10} seconds to confirm
      </span>
    </button>
  );
}
