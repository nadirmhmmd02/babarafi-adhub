'use client';

/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ (hapus seluruh file ini + pemakaiannya di app/page.js)
   Panel kecil pojok kanan-bawah Dashboard untuk review redesain di lokal:
   saklar DATA DUMMY (semua panel terisi maksimal). Pilihan aksen sudah DIHAPUS —
   aksen final Saffron ditanam di sidebar-ridgeline.css (keputusan Nadir 28 Sep 2026).
   Posisi buka/tutup panel disimpan di localStorage supaya tetap saat refresh. */

import { useState, useEffect } from 'react';
import { FlaskConical, Minus } from 'lucide-react';

export default function PreviewPanel({ demo, onDemo }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try { setOpen(localStorage.getItem('wd-preview-open') !== '0'); } catch {}
  }, []);

  function setPanel(v) {
    setOpen(v);
    try { localStorage.setItem('wd-preview-open', v ? '1' : '0'); } catch {}
  }

  if (!open) return (
    <button type="button" onClick={() => setPanel(true)} className="rg-pill" style={{
      position: 'fixed', right: 18, bottom: 18, zIndex: 90, boxShadow: 'var(--rg-pop)',
    }}>
      <FlaskConical size={15} />Preview
      {demo && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E9A034' }} />}
    </button>
  );

  return (
    <div role="region" aria-label="Preview controls" style={{
      position: 'fixed', right: 18, bottom: 18, zIndex: 90, width: 272,
      background: 'var(--rg-shell)', border: '1px solid var(--rg-pill-line)', borderRadius: 18,
      boxShadow: 'var(--rg-pop)', padding: 4, animation: 'wdSlideUp .25s cubic-bezier(.22,1,.36,1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 12px' }}>
        <FlaskConical size={15} color="var(--rg-t2)" />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--rg-t1)' }}>Preview controls</span>
        <span style={{ fontSize: 11, color: 'var(--rg-t2)', marginLeft: 'auto' }}>local only</span>
        <button type="button" onClick={() => setPanel(false)} aria-label="Minimize preview controls" className="rg-iconbtn" style={{ width: 26, height: 26 }}>
          <Minus size={14} />
        </button>
      </div>

      <div style={{ background: 'var(--rg-well)', border: '1px solid var(--rg-well-line)', borderRadius: 14, padding: '4px 14px' }}>
        {/* Saklar data dummy */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', cursor: 'pointer' }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--rg-t1)' }}>Demo data</span>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--rg-t2)', marginTop: 2 }}>
              {demo ? 'Made-up numbers fill every panel' : 'Showing real Meta Ads data'}
            </span>
          </span>
          <input type="checkbox" checked={demo} onChange={e => onDemo(e.target.checked)}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
          <span aria-hidden="true" style={{
            width: 38, height: 22, borderRadius: 999, padding: 3, flexShrink: 0,
            background: demo ? 'var(--sb-acc)' : 'var(--rg-track)', transition: 'background-color .2s',
          }}>
            <span style={{
              display: 'block', width: 16, height: 16, borderRadius: '50%', background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,.3)',
              transform: demo ? 'translateX(16px)' : 'none', transition: 'transform .22s cubic-bezier(.22,1,.36,1)',
            }} />
          </span>
        </label>
      </div>

      <div style={{ padding: '8px 10px 6px', fontSize: 11.5, lineHeight: 1.45, color: 'var(--rg-t2)' }}>
        {demo ? 'Export is disabled while demo data is on. Compare still uses real data.' : 'Turn on demo data to see every panel filled.'}
      </div>
    </div>
  );
}
/* ═══ END PREVIEW-ONLY ═══ */
