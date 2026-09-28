'use client';

/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ (hapus seluruh file ini + pemakaiannya di
   app/maps/page.js sebelum push produksi)
   ─────────────────────────────────────────────────────────────
   DATA DUMMY OUTLET MAPS — dipakai saat saklar "Demo data" (demoMode.js) nyala.
   Meniru balasan /api/maps (GET + POST sync / mark_done / set_provinsi / geocode)
   supaya SEMUA keadaan halaman terlihat saat review: alert Relokasi / Info berubah /
   Hilang, Data Quality (duplikat, koordinat rusak, depo kosong, baris dilewati),
   depo belum dipetakan (badge di tombol Wilayah) dan outlet tanpa nama kota
   (banner Geocode). ±480 outlet tersebar di 25 depo — pola mirip data asli.
   Semua aksi hanya mengubah MEMORI (hilang saat refresh); tabel maps_* Supabase
   & Google Sheets tidak disentuh.
   ───────────────────────────────────────────────────────────── */

const wait = (ms) => new Promise(res => setTimeout(res, ms));

/* Acak deterministik (mulberry32) — dummy sama tiap refresh */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// depo · pusat · sebaran (derajat) · provinsi · kota-kota · bobot jumlah outlet
const DEPOS = [
  ['DKI Jakarta',     -6.200, 106.845, 0.10, 'DKI Jakarta',        ['Jakarta Selatan', 'Jakarta Timur', 'Jakarta Barat', 'Jakarta Utara', 'Jakarta Pusat'], 46],
  ['Bekasi',          -6.260, 107.000, 0.08, 'Jawa Barat',         ['Kota Bekasi', 'Kabupaten Bekasi'], 30],
  ['Bogor',           -6.580, 106.800, 0.10, 'Jawa Barat',         ['Kota Bogor', 'Kabupaten Bogor'], 26],
  ['Depok',           -6.400, 106.820, 0.05, 'Jawa Barat',         ['Kota Depok'], 18],
  ['Kota Tangerang',  -6.190, 106.630, 0.07, 'Banten',             ['Kota Tangerang', 'Tangerang Selatan'], 28],
  ['Bandung Timur',   -6.930, 107.700, 0.07, 'Jawa Barat',         ['Kota Bandung', 'Kabupaten Bandung'], 24],
  ['Bandung Barat',   -6.880, 107.540, 0.06, 'Jawa Barat',         ['Kota Cimahi', 'Kabupaten Bandung Barat'], 14],
  ['Cirebon',         -6.720, 108.550, 0.07, 'Jawa Barat',         ['Kota Cirebon', 'Kabupaten Cirebon'], 12],
  ['Semarang',        -6.990, 110.420, 0.08, 'Jawa Tengah',        ['Kota Semarang', 'Kabupaten Semarang'], 22],
  ['Solo',            -7.570, 110.820, 0.07, 'Jawa Tengah',        ['Kota Surakarta', 'Kabupaten Sukoharjo'], 16],
  ['Yogyakarta',      -7.800, 110.370, 0.07, 'DI Yogyakarta',      ['Kota Yogyakarta', 'Kabupaten Sleman', 'Kabupaten Bantul'], 18],
  ['Surabaya',        -7.270, 112.740, 0.08, 'Jawa Timur',         ['Kota Surabaya'], 40],
  ['Sidoarjo',        -7.450, 112.710, 0.06, 'Jawa Timur',         ['Kabupaten Sidoarjo'], 22],
  ['Gresik',          -7.160, 112.650, 0.05, 'Jawa Timur',         ['Kabupaten Gresik'], 10],
  ['Malang',          -7.970, 112.630, 0.08, 'Jawa Timur',         ['Kota Malang', 'Kabupaten Malang', 'Kota Batu'], 20],
  ['Kediri',          -7.820, 112.010, 0.07, 'Jawa Timur',         ['Kota Kediri', 'Kabupaten Kediri'], 10],
  ['Jember',          -8.170, 113.700, 0.08, 'Jawa Timur',         ['Kabupaten Jember'], 9],
  ['Denpasar',        -8.650, 115.220, 0.07, 'Bali',               ['Kota Denpasar', 'Kabupaten Badung'], 14],
  ['Mataram',         -8.580, 116.100, 0.05, 'Nusa Tenggara Barat', ['Kota Mataram'], 6],
  ['Medan',            3.590,  98.670, 0.08, 'Sumatera Utara',     ['Kota Medan', 'Kabupaten Deli Serdang'], 14],
  ['Palembang',       -2.980, 104.750, 0.07, 'Sumatera Selatan',   ['Kota Palembang'], 10],
  ['Lampung',         -5.420, 105.260, 0.06, 'Lampung',            ['Kota Bandar Lampung'], 9],
  ['Pekanbaru',        0.510, 101.450, 0.06, 'Riau',               ['Kota Pekanbaru'], 8],
  ['Balikpapan',      -1.240, 116.850, 0.05, 'Kalimantan Timur',   ['Kota Balikpapan', 'Kota Samarinda'], 8],
  ['Makassar',        -5.140, 119.420, 0.06, 'Sulawesi Selatan',   ['Kota Makassar'], 9],
];
// Depo yang BELUM dipetakan ke provinsi (memancing badge oranye di tombol Wilayah)
const UNMAPPED = ['Gresik', 'Mataram'];

const PLACES = ['SPBU', 'Alfamart', 'Indomaret', 'Alfamidi', 'Ruko', 'Pasar', 'Kampus', 'RS', 'Stasiun', 'Terminal'];
const STREETS = [
  'Ahmad Yani', 'Sudirman', 'Diponegoro', 'Gajah Mada', 'Hayam Wuruk', 'Pemuda', 'Veteran', 'Merdeka', 'Pahlawan',
  'Kartini', 'Imam Bonjol', 'Gatot Subroto', 'Raya Bogor', 'Margonda', 'Kalimalang', 'Rungkut', 'Wonokromo', 'Kenjeran',
  'Dinoyo', 'Soekarno Hatta', 'Setiabudi', 'Antapani', 'Kopo', 'Buah Batu', 'Cibubur', 'Pondok Gede', 'Harapan Indah',
  'Pesanggrahan', 'Kebon Jeruk', 'Cempaka Putih', 'Sunter', 'Ciledug', 'Karawaci', 'BSD', 'Bintaro', 'Semeru', 'Wahidin',
  'Mastrip', 'Kaliurang', 'Magelang', 'Solo Baru', 'Slamet Riyadi', 'Pandanaran', 'Majapahit', 'Teuku Umar', 'Gatsu',
  'Pettarani', 'Perintis', 'Sisingamangaraja', 'Adam Malik', 'Demang Lebar Daun', 'Kedaton', 'Arifin Achmad', 'MT Haryono',
];
const NOTES = ['Clear', 'Clear', 'Clear', '', '', 'Nomor HP beda dengan listing', 'Foto outlet belum update', 'Jam buka di Maps salah'];
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();

function build() {
  const r = rng(20260928);
  const outlets = [];
  const used = new Set();
  let no = 1;
  for (const [depo, lat, lng, spread, , cities, n] of DEPOS) {
    for (let i = 0; i < n; i++) {
      let nama;
      for (let k = 0; k < 20; k++) {
        const p = PLACES[Math.floor(r() * PLACES.length)];
        const s = STREETS[Math.floor(r() * STREETS.length)];
        nama = `${p} ${s}${r() < 0.25 ? ' ' + (2 + Math.floor(r() * 4)) : ''}${r() < 0.35 ? ' ' + depo.replace(/^Kota /, '') : ''}`;
        if (!used.has(nama)) break;
      }
      used.add(nama);
      const la = +(lat + (r() - 0.5) * 2 * spread).toFixed(6);
      const ln = +(lng + (r() - 0.5) * 2 * spread).toFixed(6);
      const roll = r();
      const status = roll < 0.925 ? 'Sudah di Daftarkan' : roll < 0.985 ? 'Belum di Daftarkan' : 'Perlu Klaim Bisnis';
      const kota = cities[Math.floor(r() * cities.length)];
      outlets.push({
        id: `demo-o-${no}`, row_no: String(no), nama, depo,
        alamat: `Jl. ${STREETS[Math.floor(r() * STREETS.length)]} No. ${1 + Math.floor(r() * 180)}, ${kota}`,
        ordinat_raw: `${la},${ln}`, lat: la, lng: ln, coord_error: null,
        nomor_hp: `0812${String(10000000 + Math.floor(r() * 89999999))}`, nama_lama: null,
        nama_gmaps: `Kebab Turki Baba Rafi ${nama.replace(/^(SPBU|Alfamart|Indomaret|Alfamidi|Ruko|Pasar|Kampus|RS|Stasiun|Terminal) /, '')}`,
        status, link_gmaps: `https://maps.google.com/?q=${la},${ln}`,
        catatan: status === 'Sudah di Daftarkan' ? NOTES[Math.floor(r() * NOTES.length)] : 'Belum ada listing',
        // ±4% belum punya nama kota → banner Geocode muncul
        kota: r() < 0.04 ? null : kota,
        missing_since: null, first_seen_at: ago(60 * 24 * 40), last_seen_at: ago(120), updated_at: ago(120),
      });
      no++;
    }
  }
  // Koordinat rusak (Needs Review) — varian nyata dari data asli
  const broken = [['SPBU Sumobito', 'Sidoarjo', '', 'Koordinat kosong'], ['Gempol Rest Area', 'Sidoarjo', 'non online', 'Format tidak dikenali'], ['Indomaret Pandu Raya 2', 'Bogor', '6PQX+5W Bogor', 'Plus Code belum didukung']];
  for (const [nama, depo, raw, err] of broken) {
    outlets.push({
      id: `demo-o-${no}`, row_no: String(no++), nama, depo, alamat: `Jl. Raya ${nama.split(' ').pop()}`, ordinat_raw: raw,
      lat: null, lng: null, coord_error: err, nomor_hp: null, nama_lama: null, nama_gmaps: null,
      status: 'Sudah di Daftarkan', link_gmaps: null, catatan: '', kota: null, missing_since: null,
      first_seen_at: ago(60 * 24 * 40), last_seen_at: ago(120), updated_at: ago(120),
    });
  }
  // Depo kosong (Data Quality)
  outlets[37].depo = null;
  // Hilang dari sheet (baris redup + badge MISSING, tidak tampil di peta)
  outlets[12].missing_since = ago(60 * 26);
  outlets[140].missing_since = ago(60 * 50);
  // Relokasi: nama lama tercatat
  outlets[60].nama_lama = 'Alfamart Veteran Surabaya';
  outlets[205].nama_lama = 'SPBU Pemuda Semarang';
  outlets[318].nama_lama = 'Ruko Kalimalang 2';
  outlets.sort((a, b) => a.nama.localeCompare(b.nama));

  const alerts = [
    { type: 'relokasi', o: outlets.find(x => x.nama_lama === 'Alfamart Veteran Surabaya'), detail: { dari: 'Alfamart Veteran Surabaya' }, min: 95 },
    { type: 'relokasi', o: outlets.find(x => x.nama_lama === 'SPBU Pemuda Semarang'), detail: { dari: 'SPBU Pemuda Semarang' }, min: 60 * 26 },
    { type: 'relokasi', o: outlets.find(x => x.nama_lama === 'Ruko Kalimalang 2'), detail: { dari: 'Ruko Kalimalang 2' }, min: 60 * 72 },
    { type: 'perubahan_info', o: outlets[20], detail: { changed: [{ field: 'alamat' }] }, min: 95 },
    { type: 'perubahan_info', o: outlets[88], detail: { changed: [{ field: 'ordinat_raw' }, { field: 'alamat' }] }, min: 95 },
    { type: 'perubahan_info', o: outlets[251], detail: { changed: [{ field: 'nama_gmaps' }] }, min: 60 * 30 },
    { type: 'perubahan_info', o: outlets[402], detail: { changed: [{ field: 'alamat' }] }, min: 60 * 96 },
    ...outlets.filter(x => x.missing_since).map(o => ({ type: 'hilang', o, detail: null, min: 60 * 26 })),
  ].filter(a => a.o).map((a, i) => ({
    id: `demo-a-${i + 1}`, outlet_nama: a.o.nama, type: a.type, detail: a.detail,
    status: 'open', created_at: ago(a.min), resolved_at: null,
  }));

  const depoProvinsi = DEPOS.filter(d => !UNMAPPED.includes(d[0])).map(d => ({ depo: d[0], provinsi: d[4] }));
  const lastSync = {
    id: 'demo-log-1', run_at: ago(120),
    summary: {
      total: outlets.length, baru: 0, relokasi: 3, berubah: 4, hilang: 2,
      duplikat: ['SPBU Semeru', 'Alfamidi Margacinta'], dilewati: 1, needs_review: 3,
    },
  };
  return { outlets, alerts, depoProvinsi, lastSync };
}

let store = null;
const db = () => (store ||= build());
const clone = (x) => JSON.parse(JSON.stringify(x));

/* Pengganti authFetch('/api/maps', …).json() — body null = GET */
export async function demoMapsCall(body) {
  const s = db();
  if (!body) { await wait(450); return clone(s); }
  switch (body.action) {
    case 'sync': {
      await wait(1400);   // "menarik" sheet
      s.lastSync = { ...s.lastSync, run_at: new Date().toISOString() };
      return { ok: true, summary: clone(s.lastSync.summary) };
    }
    case 'mark_done': {
      await wait(120);
      s.alerts = s.alerts.filter(a => a.id !== body.alert_id);
      return { ok: true };
    }
    case 'set_provinsi': {
      await wait(120);
      s.depoProvinsi = [...s.depoProvinsi.filter(m => m.depo !== body.depo), { depo: body.depo, provinsi: body.provinsi }];
      return { ok: true };
    }
    case 'geocode': {
      await wait(900);   // server asli ±40 detik per putaran — dipercepat untuk review
      const pending = s.outlets.filter(o => o.lat != null && o.kota == null);
      const batch = pending.slice(0, 6);
      for (const o of batch) {
        const d = DEPOS.find(x => x[0] === o.depo);
        o.kota = d ? d[5][0] : '-';
      }
      return { processed: batch.length, remaining: pending.length - batch.length, blocked: false };
    }
    default:
      return { error: 'Unknown action (demo)' };
  }
}
/* ═══ END PREVIEW-ONLY ═══ */
