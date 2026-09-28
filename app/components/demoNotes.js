'use client';

/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ (hapus seluruh file ini + pemakaiannya di
   app/notes/page.js & app/components/useTodos.js sebelum push produksi)
   ─────────────────────────────────────────────────────────────
   DATA DUMMY NOTES + TO DO — dipakai saat saklar "Demo data" (demoMode.js) nyala.
   Bentuknya = pengganti KECIL klien Supabase (`demoNotesDb.from(tabel)`) yang
   hanya mengerti rantai query yang dipakai halaman Notes & useTodos:
     select().order()…  ·  insert().select().single()  ·  update().eq()  ·  delete().eq()
   Semua data hidup di MEMORI modul ini: tambah/edit/hapus/geser urutan jalan
   seperti asli, bertahan saat pindah halaman, hilang saat refresh browser.
   Tabel Supabase `notes`, `todo_lists`, `todos` TIDAK PERNAH disentuh — catatan
   asli Nadir aman selama review & pengujian.
   ───────────────────────────────────────────────────────────── */

import { todayStr, addDays } from './useTodos';

const iso = (minsAgo) => new Date(Date.now() - minsAgo * 60000).toISOString();
let seq = 0;
const nid = (p) => `demo-${p}-${Date.now().toString(36)}-${++seq}`;
export const isDemoNotesId = (id) => typeof id === 'string' && id.startsWith('demo-');

const CHK = (done) => `<span class="wd-check" data-done="${done ? 1 : 0}" contenteditable="false">${done ? '☑' : '☐'}</span> `;
const HL = (color, text) => `<span style="background-color: ${color};">${text}</span>`;
const LINK = (url) => `<a href="${url}" class="wd-link" title="Ctrl+click to open link" rel="noopener">${url}</a>`;

function seedNotes() {
  return [
    {
      id: 'demo-note-1', pinned: true, sort_order: 0, updated_at: iso(3),
      title: 'Rencana konten Oktober',
      content: [
        '<h3>Fokus bulan ini</h3>',
        `<div>Promo franchise ${HL('#FDE68A', 'Paket Autopilot')} naik lagi — target 450 leads (bulan lalu 389).</div>`,
        '<ul><li>Reels testimoni mitra Depo Bandung Timur</li><li>Carousel hitung-hitungan balik modal</li><li>Story Q&amp;A "berapa lama BEP?"</li></ul>',
        '<h3>Checklist minggu ini</h3>',
        `<div>${CHK(true)}Brief ke tim desain (3 konsep)</div>`,
        `<div>${CHK(true)}Kirim draft caption ke Mas Hendra</div>`,
        `<div>${CHK(false)}Set campaign KONVERSI - Autopilot Okt</div>`,
        `<div>${CHK(false)}Cek CPL harian tiap jam 10 pagi</div>`,
        `<div>Referensi: ${LINK('https://www.facebook.com/ads/library')}</div>`,
      ].join(''),
    },
    {
      id: 'demo-note-2', pinned: true, sort_order: 1, updated_at: iso(60 * 5),
      title: 'Script follow-up leads',
      content: [
        '<div><b>Pembuka (hari 1):</b></div>',
        '<div>Halo Kak {nama}, terima kasih sudah isi form Kebab Turki Baba Rafi 🙏 Boleh saya bantu jelaskan paket franchise yang paling cocok?</div>',
        '<div><br></div>',
        '<div><b>Follow-up (hari 3):</b></div>',
        `<div>Kak {nama}, kemarin sempat lihat ${HL('#BBF7D0', 'simulasi BEP')}-nya? Kalau mau, saya kirim contoh outlet di kota Kakak.</div>`,
        '<div><br></div>',
        '<ol><li>Jangan kirim harga di chat pertama</li><li>Selalu tanya domisili</li><li>Catat hasil di Leads List (status + notes)</li></ol>',
      ].join(''),
    },
    {
      id: 'demo-note-3', pinned: false, sort_order: 2, updated_at: iso(60 * 26),
      title: 'Brief Rakornas Q3',
      content: [
        '<h3>Poin utama</h3>',
        '<ul><li>Spend Q3 turun 8% tapi leads naik 12%</li><li>CPL terbaik: campaign PROSPEK Reguler</li><li>WhatsApp jadi sumber leads terbesar</li></ul>',
        `<div>Deck final: ${LINK('https://docs.google.com/presentation/d/demo')}</div>`,
        `<div>${HL('#FBCFE8', 'Tanya dulu ke Pak Direktur')} soal budget awareness Q4.</div>`,
      ].join(''),
    },
    {
      id: 'demo-note-4', pinned: false, sort_order: 3, updated_at: iso(60 * 24 * 4),
      title: 'Ide A/B test creative',
      content: [
        '<div>Hook 3 detik pertama:</div>',
        '<ul><li>A — close-up kebab dipotong</li><li>B — antrean pembeli di outlet</li><li>C — angka omzet mitra</li></ul>',
        '<div>Budget per variasi Rp 150.000/hari, jalan 5 hari, pemenang = CTR &amp; CPL.</div>',
      ].join(''),
    },
    {
      id: 'demo-note-5', pinned: false, sort_order: 4, updated_at: iso(60 * 24 * 9),
      title: 'Outlet untuk Google Maps',
      content: [
        '<div>Belum terdaftar / perlu klaim:</div>',
        `<div>${CHK(false)}Depo Jakarta Timur — Kalimalang</div>`,
        `<div>${CHK(false)}Depo Surabaya — Rungkut</div>`,
        `<div>${CHK(true)}Depo Bekasi — Harapan Indah</div>`,
        `<div>Sheet: ${LINK('https://docs.google.com/spreadsheets/d/demo')}</div>`,
      ].join(''),
    },
    {
      id: 'demo-note-6', pinned: false, sort_order: 5, updated_at: iso(60 * 24 * 21),
      title: 'Catatan meeting agency',
      content: '<div>Mereka tawarkan paket konten 12 video/bulan. Minta contoh portofolio F&amp;B dulu sebelum lanjut.</div>',
    },
  ];
}

function seedLists() {
  return [
    { id: 'demo-list-1', name: 'Campaign ops', color: '#3B82F6', sort_order: 0, created_at: iso(60 * 24 * 30) },
    { id: 'demo-list-2', name: 'Leads follow-up', color: '#2FB673', sort_order: 1, created_at: iso(60 * 24 * 20) },
  ];
}

function seedTodos() {
  const today = todayStr();
  const step = (title, done) => ({ id: nid('step'), title, done });
  const t = (id, o) => ({
    id: `demo-task-${id}`, list_id: null, title: '', notes: '', done: false, done_at: null,
    starred: false, due_date: null, my_day_date: null, steps: [], sort_order: null,
    created_at: iso(60 * 24 * (id + 1)), updated_at: iso(60 * id), ...o,
  });
  return [
    t(1, { title: 'Naikkan budget campaign Autopilot', list_id: 'demo-list-1', my_day_date: today, starred: true, due_date: today, sort_order: 0,
      steps: [step('Cek CPL 3 hari terakhir', true), step('Hitung sisa budget bulan ini', false), step('Edit daily budget di Campaigns', false)],
      notes: 'Naik bertahap 20% supaya learning phase tidak reset.' }),
    t(2, { title: 'Balas 7 leads di Black Box', list_id: 'demo-list-2', my_day_date: today, due_date: addDays(-1), sort_order: 1 }),
    t(3, { title: 'Review creative A/B test', my_day_date: today, sort_order: 2 }),
    t(4, { title: 'Kirim laporan mingguan ke atasan', starred: true, due_date: addDays(1), sort_order: 3 }),
    t(5, { title: 'Jadwalkan campaign Oktober di Calendar', list_id: 'demo-list-1', due_date: addDays(7), sort_order: 4 }),
    t(6, { title: 'Follow-up lead Hendra (Bandung)', list_id: 'demo-list-2', due_date: addDays(2), sort_order: 5 }),
    t(7, { title: 'Update data outlet Maps', sort_order: 6 }),
    t(8, { title: 'Brief tim desain — carousel BEP', list_id: 'demo-list-1', done: true, done_at: iso(60 * 3), sort_order: 7 }),
    t(9, { title: 'Export laporan September', done: true, done_at: iso(60 * 20), my_day_date: today, sort_order: 8 }),
    t(10, { title: 'Rapikan kategori leads', list_id: 'demo-list-2', done: true, done_at: iso(60 * 50), sort_order: 9 }),
  ];
}

const store = { notes: null, todo_lists: null, todos: null };
function table(name) {
  if (!store.notes) { store.notes = seedNotes(); store.todo_lists = seedLists(); store.todos = seedTodos(); }
  return store[name];
}

const wait = (ms) => new Promise(res => setTimeout(res, ms));
const clone = (x) => JSON.parse(JSON.stringify(x));

/* Urutan balikan = urutan yang diminta query asli (halaman mengurutkan ulang catatan sendiri) */
function sorted(name, rows) {
  const r = [...rows];
  if (name === 'todos') {
    r.sort((a, b) => {
      const ao = a.sort_order, bo = b.sort_order;
      if (ao == null && bo != null) return -1;
      if (ao != null && bo == null) return 1;
      if (ao != null && bo != null && ao !== bo) return ao - bo;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  } else if (name === 'todo_lists') {
    r.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  } else {
    r.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }
  return r;
}

function run(name, st) {
  const rows = table(name);
  const match = (row) => st.filters.every(([col, val]) => row[col] === val);
  if (st.op === 'insert') {
    const now = new Date().toISOString();
    const base = name === 'notes'
      ? { pinned: false, sort_order: null, content: '', updated_at: now }
      : name === 'todos'
        ? { list_id: null, notes: '', done: false, done_at: null, starred: false, due_date: null, my_day_date: null, steps: [], sort_order: null, created_at: now, updated_at: now }
        : { color: null, sort_order: rows.length, created_at: now };
    const row = { ...base, ...clone(st.row), id: nid(name === 'notes' ? 'note' : name === 'todos' ? 'task' : 'list') };
    rows.unshift(row);
    return { data: clone(row), error: null };
  }
  if (st.op === 'update') {
    rows.forEach((row, i) => {
      if (!match(row)) return;
      const next = { ...row, ...clone(st.patch) };
      // sama dengan trigger asli: geser urutan saja tidak mengubah updated_at
      const onlyOrder = Object.keys(st.patch).every(k => k === 'sort_order');
      if (name !== 'todo_lists' && !onlyOrder) next.updated_at = new Date().toISOString();
      rows[i] = next;
    });
    return { data: null, error: null };
  }
  if (st.op === 'delete') {
    const keep = rows.filter(row => !match(row));
    const gone = rows.filter(match).map(r => r.id);
    rows.splice(0, rows.length, ...keep);
    // on delete cascade: daftar dihapus → tugas di dalamnya ikut hilang
    if (name === 'todo_lists') {
      const todos = table('todos');
      todos.splice(0, todos.length, ...todos.filter(t => !gone.includes(t.list_id)));
    }
    return { data: null, error: null };
  }
  const data = clone(sorted(name, rows.filter(match)));
  return { data: st.single ? data[0] || null : data, error: null };
}

function builder(name) {
  const st = { op: 'select', patch: null, row: null, filters: [], single: false };
  const b = {
    select() { return b; },
    order() { return b; },
    insert(row) { st.op = 'insert'; st.row = row; return b; },
    update(patch) { st.op = 'update'; st.patch = patch; return b; },
    delete() { st.op = 'delete'; return b; },
    eq(col, val) { st.filters.push([col, val]); return b; },
    single() { st.single = true; return b; },
    then(resolve, reject) {
      // jeda kecil: skeleton & status "Saving…" tetap terlihat seperti data asli
      return wait(st.op === 'select' ? 320 : 90).then(() => run(name, st)).then(resolve, reject);
    },
  };
  return b;
}

export const demoNotesDb = { from: builder };
/* ═══ END PREVIEW-ONLY ═══ */
