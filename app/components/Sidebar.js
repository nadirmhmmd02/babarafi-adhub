'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Megaphone,
  CalendarDays,
  Sparkles,
  Users,
  LogOut,
  NotebookPen,
  MapPinned,
  Menu,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { dashboardFontVars } from './dashboardFonts';
import '../sidebar-ridgeline.css';

// Dipakai juga oleh MobileNav.js (drawer mobile) — satu sumber menu.
// Dua section: Ads Hub (fitur live) + Leads Hub (placeholder, v3.0).
export const NAV_SECTIONS = [
  {
    label: 'Ads Hub',
    items: [
      { href: '/',          label: 'Dashboard', icon: LayoutDashboard },
      { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
      { href: '/calendar',  label: 'Calendar',  icon: CalendarDays },
      { href: '/reports',   label: 'Analytics & Insights', icon: Sparkles },
    ],
  },
  {
    label: 'Leads Hub',
    items: [
      { href: '/leads',          label: 'Dashboard', icon: LayoutDashboard },
      { href: '/leads/list',     label: 'Leads List', icon: Users },
      { href: '/leads/insights', label: 'Analytics & Insights', icon: Sparkles },
    ],
  },
];

// Maps Hub (monitoring Google Maps 500+ outlet) — ADMIN-ONLY fase 1
// (lihat MAPS-HUB-PLAN.md; role lain menyusul kalau sistem sudah matang).
export const MAPS_SECTION = {
  label: 'Maps Hub',
  items: [
    { href: '/maps', label: 'Outlet Maps', icon: MapPinned },
  ],
};

// Menu per role: marketing hanya Leads Hub; user (viewer) — per 9 Sep 2026 — HANYA Ads Hub
// dan cuma Dashboard + Campaigns (whitelist USER_ALLOWED; Calendar, Analytics & Insights,
// dan seluruh Leads Hub disembunyikan sementara). Dipakai juga AppShell sebagai route guard;
// admin lihat semua + Maps Hub.
export const USER_ALLOWED = ['/', '/campaigns'];
export function navSectionsFor(role) {
  if (role === 'marketing') return NAV_SECTIONS.filter(s => s.label === 'Leads Hub');
  if (role === 'user') return NAV_SECTIONS
    .map(s => ({ ...s, items: s.items.filter(i => USER_ALLOWED.includes(i.href)) }))
    .filter(s => s.items.length > 0);
  if (role === 'admin') return [...NAV_SECTIONS, MAPS_SECTION];
  return NAV_SECTIONS;
}

/* ─────────────────────────────────────────────────────────────
   SIDEBAR — redesain "Ridgeline" (Sep 2026). Styling: app/sidebar-ridgeline.css
   REL IKON (menu · ikon per hub · logout) + PANEL MENU teks. Diciutkan (default saat
   web pertama dibuka) = hanya rel; hover/fokus ikon hub → flyout daftar halaman hub
   itu, jadi Campaigns/Calendar/dll tetap satu gerakan. Lebar panel bisa digeser.
   Di panel, tiap hub = GRUP yang bisa dilipat (tombol panah, 28 Sep 2026) —
   semua tertutup saat web pertama dibuka; grup berisi halaman aktif diberi
   titik Saffron selama tertutup. Status buka-tutup bertahan saat pindah
   halaman (Sidebar tidak remount), reset saat browser di-refresh.
   ───────────────────────────────────────────────────────────── */
const HUB_ICON   = { 'Ads Hub': Megaphone, 'Leads Hub': Users, 'Maps Hub': MapPinned };
const ROLE_LABEL = { admin: 'Admin', user: 'Viewer', marketing: 'Marketing' };

const RAIL_WIDTH    = 64;
const PANEL_MIN     = 184;
const PANEL_MAX     = 300;
const PANEL_DEFAULT = 212;

export default function Sidebar() {
  const pathname = usePathname();
  const { user, role, logout } = useAuth();
  // Default: tertutup (collapsed) saat web pertama dibuka
  const [collapsed, setCollapsed] = useState(true);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT);
  const [animate, setAnimate]     = useState(true);
  const [fly, setFly]             = useState(null); // { key, top } — flyout saat collapsed
  const [openGroups, setOpenGroups] = useState({}); // { [hubKey]: true } — kosong = semua tertutup
  const dragging  = useRef(false);
  const asideRef  = useRef(null);
  const flyTimer  = useRef(null);

  // Hub = section menu; Notes (admin) jadi "hub" sendiri di rel
  const hubs = navSectionsFor(role).map(s => ({
    key: s.label, label: s.label, icon: HUB_ICON[s.label] || LayoutDashboard, items: s.items,
  }));
  if (role === 'admin') {
    hubs.push({ key: 'Workspace', label: 'Workspace', icon: NotebookPen, items: [{ href: '/notes', label: 'Notes' }] });
  }

  function isActive(href) {
    // Exact match — '/leads' tidak boleh ikut aktif saat di '/leads/list'
    return pathname === href;
  }
  const activeHub = hubs.find(h => h.items.some(i => isActive(i.href)))?.key;

  function toggleGroup(key) {
    setOpenGroups(g => ({ ...g, [key]: !g[key] }));
  }

  function toggleCollapse() {
    setAnimate(true);
    setFly(null);
    setCollapsed(c => !c);
  }

  // ── Geser lebar panel (hanya saat terbuka) ──
  useEffect(() => {
    function onMove(e) {
      if (!dragging.current || !asideRef.current) return;
      const left = asideRef.current.getBoundingClientRect().left;
      let w = e.clientX - left - RAIL_WIDTH;
      if (w < PANEL_MIN) w = PANEL_MIN;
      if (w > PANEL_MAX) w = PANEL_MAX;
      setPanelWidth(w);
    }
    function onUp() {
      if (dragging.current) {
        dragging.current = false;
        setAnimate(true);
        document.body.style.userSelect = '';
      }
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  function startDrag(e) {
    if (collapsed) return;
    dragging.current = true;
    setAnimate(false);
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  // ── Flyout (collapsed) ──
  function openFly(hub, el) {
    if (!collapsed) return;
    clearTimeout(flyTimer.current);
    setFly({ key: hub.key, top: el.getBoundingClientRect().top });
  }
  function closeFlySoon() {
    clearTimeout(flyTimer.current);
    flyTimer.current = setTimeout(() => setFly(null), 140);
  }
  function keepFly() { clearTimeout(flyTimer.current); }
  useEffect(() => () => clearTimeout(flyTimer.current), []);
  useEffect(() => { setFly(null); }, [pathname]);

  const flyHub = collapsed && fly ? hubs.find(h => h.key === fly.key) : null;

  function renderItems(items, focusable = true) {
    return items.map(item => {
      const active = isActive(item.href);
      return (
        <Link key={item.href} href={item.href} className={`sb-item${active ? ' is-active' : ''}`}
          aria-current={active ? 'page' : undefined} tabIndex={focusable ? undefined : -1}>
          {item.label}
        </Link>
      );
    });
  }

  return (
    <aside
      ref={asideRef}
      className={`sb ${dashboardFontVars}${collapsed ? ' is-collapsed' : ''}`}
      style={{
        width: (RAIL_WIDTH + (collapsed ? 0 : panelWidth)) + 'px',
        transition: animate ? 'width .3s cubic-bezier(.22,1,.36,1)' : 'none',
      }}
    >
      {/* ══ REL IKON ══ */}
      <div className="sb-rail">
        <div className="sb-rail-top">
          <button type="button" className="sb-circle sb-menu" onClick={toggleCollapse}
            aria-expanded={!collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Menu size={18} />
          </button>
        </div>

        <nav className="sb-rail-nav" aria-label="Hubs">
          {hubs.map(h => {
            const Icon = h.icon;
            const on = h.key === activeHub;
            return (
              <Link key={h.key} href={h.items[0].href}
                className={`sb-circle sb-hub${on ? ' is-active' : ''}`}
                aria-label={h.key === 'Workspace' ? 'Notes' : h.label}
                aria-current={on ? 'true' : undefined}
                title={collapsed ? undefined : (h.key === 'Workspace' ? 'Notes' : h.label)}
                onMouseEnter={e => openFly(h, e.currentTarget)} onMouseLeave={closeFlySoon}
                onFocus={e => openFly(h, e.currentTarget)} onBlur={closeFlySoon}>
                <Icon size={18} />
              </Link>
            );
          })}
        </nav>

        <div className="sb-rail-foot">
          {user && (
            <button type="button" className="sb-circle sb-logout" onClick={logout} aria-label="Log out" title="Log out">
              <LogOut size={17} />
            </button>
          )}
        </div>
      </div>

      {/* ══ PANEL MENU ══ */}
      <div className="sb-panel" style={{ width: panelWidth + 'px' }} aria-hidden={collapsed} inert={collapsed}>
        {/* Nama brand saja — logo dihapus (permintaan Nadir 28 Sep 2026) */}
        <div className="sb-brand">
          <span className="sb-brand-name">Baba Rafi <span>Ad Hub</span></span>
        </div>

        <nav className="sb-nav" aria-label="Pages">
          {hubs.map(h => {
            const open = !!openGroups[h.key];
            const here = h.key === activeHub;
            const bodyId = 'sb-grp-' + h.key.toLowerCase().replace(/\s+/g, '-');
            return (
              <div key={h.key} className={`sb-grp${open ? ' is-open' : ''}${here ? ' is-here' : ''}`}>
                <button type="button" className="sb-grp-head" onClick={() => toggleGroup(h.key)}
                  aria-expanded={open} aria-controls={bodyId}>
                  <span className="sb-grp-name">{h.label}</span>
                  {here && !open && <span className="sb-grp-dot" aria-hidden="true" />}
                  <ChevronDown size={16} className="sb-grp-chev" aria-hidden="true" />
                </button>
                {/* Lipat via grid-template-rows 0fr↔1fr (pola grup Notes) — inert
                    saat tertutup supaya link tersembunyi tidak ikut kena Tab */}
                <div id={bodyId} className="sb-grp-body" inert={!open}>
                  <div className="sb-grp-inner">
                    <div className="sb-grp-list">{renderItems(h.items)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {user && (
          <div className="sb-user">
            <span className="sb-avatar" aria-hidden="true">{user.username?.[0] || '?'}</span>
            <div style={{ minWidth: 0 }}>
              <div className="sb-user-name">{user.username}</div>
              <div className="sb-user-role">{ROLE_LABEL[role] || role}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Pegangan geser lebar ── */}
      {!collapsed && <div className="sb-drag" onMouseDown={startDrag} aria-hidden="true" />}

      {/* ── Flyout halaman saat diciutkan ── */}
      {flyHub && (
        <div className="sb-fly" style={{ top: Math.max(8, fly.top - 10) + 'px' }}
          onMouseEnter={keepFly} onMouseLeave={closeFlySoon} onFocus={keepFly} onBlur={closeFlySoon}>
          <div className="sb-label">{flyHub.label}</div>
          {renderItems(flyHub.items)}
        </div>
      )}
    </aside>
  );
}
