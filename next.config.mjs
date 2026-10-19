/** @type {import('next').NextConfig} */
const nextConfig = {
  // To Do digabung ke halaman Projects (19 Okt 2026) — link/bookmark lama tetap jalan
  async redirects() {
    return [{ source: '/todo', destination: '/projects', permanent: false }];
  },
};

export default nextConfig;
