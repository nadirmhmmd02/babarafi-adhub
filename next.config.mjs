/** @type {import('next').NextConfig} */
const nextConfig = {
  // To Do digabung ke halaman Projects (19 Okt 2026) — link/bookmark lama tetap jalan.
  // Maps Hub disembunyikan (28 Okt 2026) — /maps dialihkan ke Dashboard; pasangannya
  // MAPS_HIDDEN di app/components/Sidebar.js (menu). Munculkan lagi = ubah keduanya.
  async redirects() {
    return [
      { source: '/todo', destination: '/projects', permanent: false },
      { source: '/maps', destination: '/', permanent: false },
    ];
  },
};

export default nextConfig;
