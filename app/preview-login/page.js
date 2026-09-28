'use client';

/* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ (hapus SELURUH folder app/preview-login sebelum push)
   Pratinjau halaman login saat SUDAH login — halaman /login asli langsung me-redirect
   pengguna yang sudah masuk, jadi redesainnya tidak bisa dilihat tanpa logout.
   Tampilan sama persis dengan /login (komponen LoginScreen yang sama); tombol
   Sign in dimatikan (preview). Bar kiri-atas: kembali ke app + ganti tema. */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import LoginScreen from '../components/LoginScreen';
import ThemeToggle from '../components/ThemeToggle';
import { DEMO_ALLOWED } from '../components/demoMode';

export default function PreviewLoginPage() {
  if (!DEMO_ALLOWED) return null;
  return (
    <LoginScreen
      preview
      previewBar={(
        <div className="rgin-preview">
          <Link href="/" className="rg-pill"><ArrowLeft size={15} />Back to app</Link>
          <span className="rg-chip">Login preview · sign-in turned off</span>
          <ThemeToggle className="rg-pill rg-round" />
        </div>
      )}
    />
  );
}
/* ═══ END PREVIEW-ONLY ═══ */
