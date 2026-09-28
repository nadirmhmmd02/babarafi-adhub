/* ─────────────────────────────────────────────────────────────
   MAPS HUB — registry konfigurasi (pola sama dgn leadsConfig.js).
   Nilai status HARUS sama persis dengan dropdown "Profile Bisnis"
   di Google Sheets. Nambah provinsi/status = edit di sini.
   ───────────────────────────────────────────────────────────── */

// Warna = token skin "Ridgeline" (didefinisikan di app/maps-ridgeline.css, .rgm), jadi
// ikut tema terang/gelap — dipakai juga di marker & popup Leaflet (ada di dalam .rgm).
// Arti: terdaftar = hijau "bagus" · belum = kuning tua "perlu kerja" · klaim = biru "info".
export const MAPS_STATUS = [
  { value: 'Sudah di Daftarkan', label: 'Registered',     color: 'var(--mp-reg)' },
  { value: 'Belum di Daftarkan', label: 'Not Registered', color: 'var(--mp-unreg)' },
  { value: 'Perlu Klaim Bisnis', label: 'Needs Claim',    color: 'var(--mp-claim)' },
];

export const STATUS_COLOR = Object.fromEntries(MAPS_STATUS.map(s => [s.value, s.color]));
export const STATUS_LABEL = Object.fromEntries(MAPS_STATUS.map(s => [s.value, s.label]));

// Outlet dengan koordinat rusak / status tak dikenal
export const REVIEW_COLOR = 'var(--mp-review)';
export const UNKNOWN_COLOR = 'var(--mp-unknown)';

export function statusColor(status, coordBroken) {
  if (coordBroken) return REVIEW_COLOR;
  return STATUS_COLOR[status] || UNKNOWN_COLOR;
}

// 38 provinsi Indonesia (untuk dropdown mapping Depo → Provinsi)
export const PROVINSI = [
  'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau',
  'Jambi', 'Bengkulu', 'Sumatera Selatan', 'Kepulauan Bangka Belitung', 'Lampung',
  'Banten', 'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur',
  'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
  'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
  'Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara',
  'Maluku', 'Maluku Utara',
  'Papua', 'Papua Barat', 'Papua Barat Daya', 'Papua Tengah', 'Papua Pegunungan', 'Papua Selatan',
];

export const UNMAPPED_PROVINSI = 'Belum dipetakan';

// Tile peta: OpenStreetMap standar (gratis, tanpa akun/API key, atribusi WAJIB).
// Sejak Sep 2026 CARTO basemaps membalas gambar "API KEY REQUIRED" → diganti OSM
// (keputusan Nadir 28 Sep 2026). Warna OSM aslinya ramai, jadi di halaman dibuat
// abu-abu netral lewat CSS filter pada pane tile (terang: grayscale; gelap: grayscale +
// invert) — lihat app/maps-ridgeline.css. URL sama di dua tema.
export const TILE = {
  light: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  dark:  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
};

// Pusat peta default: Indonesia
export const MAP_CENTER = [-2.5, 117.5];
export const MAP_ZOOM = 5;
