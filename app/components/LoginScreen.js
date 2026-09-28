'use client';

import '../login-ridgeline.css';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Check, CircleAlert, Info, LoaderCircle, ShieldCheck, ArrowUp } from 'lucide-react';
import Logo from './Logo';
import { useAuth, homeFor } from './AuthContext';
import { dashboardFontVars } from './dashboardFonts';

/* ─────────────────────────────────────────────────────────────
   LOGIN SCREEN — tampilan halaman /login (redesain "Ridgeline", 28 Sep 2026).
   Dipisah dari app/login/page.js supaya bisa dipratinjau saat sudah login
   (PREVIEW-ONLY: app/preview-login/page.js merender <LoginScreen preview />).
   Logika masuk SAMA dengan versi lama: login(email, password, remember) →
   redirect ke homeFor(role); "Remember me" = sesi localStorage vs sessionStorage.
   Tema ikut data-theme <html> (skrip no-flash di layout.js) — tidak dikunci terang.
   Styling: app/login-ridgeline.css (.rgin-) di atas skin .rg.
   ───────────────────────────────────────────────────────────── */

export default function LoginScreen({ preview = false, previewBar = null }) {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow]         = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const [busy, setBusy]         = useState(false);
  const [caps, setCaps]         = useState(false);   // Caps Lock menyala saat mengetik password

  async function submit(e) {
    e.preventDefault();
    setError(''); setInfo('');
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    /* ═══ PREVIEW-ONLY — JANGAN DI-PUSH ═══ */
    if (preview) { setInfo('Preview only — signing in is turned off on this page.'); return; }
    /* ═══ END PREVIEW-ONLY ═══ */
    setBusy(true);
    const res = await login(email, password, remember);
    if (res.ok) {
      router.replace(homeFor(res.role));
    } else {
      setError(res.error || 'Sign-in failed — please try again.');
      setBusy(false);
    }
  }

  const capsCheck = (e) => { if (e.getModifierState) setCaps(e.getModifierState('CapsLock')); };

  return (
    <div className={`rg rgin ${dashboardFontVars}`}>
      {previewBar}
      <section className="rg-card rgin-card rg-rise" aria-label="Sign in">
        {/* Kepala: logo mark (Saffron) + nama produk */}
        <div className="rgin-brand">
          <span className="rgin-mark"><Logo size={19} color="currentColor" /></span>
          <span className="rgin-name">Baba Rafi <span>Ad Hub</span></span>
        </div>

        <div className="rg-well rgin-well">
          <h1 className="rgin-title">Sign in</h1>
          <p className="rgin-sub">Use your Ad Hub account to open the dashboard.</p>

          <form className="rgin-form" onSubmit={submit} noValidate>
            {error && (
              <div className="rgin-note is-err" role="alert"><CircleAlert size={15} /><span>{error}</span></div>
            )}
            {info && !error && (
              <div className="rgin-note is-info" role="status"><Info size={15} /><span>{info}</span></div>
            )}

            <div className="rg-field">
              <label className="rg-label" htmlFor="rgin-email">Email</label>
              <div className={`rgin-input${error ? ' is-err' : ''}`}>
                <Mail size={16} />
                <input id="rgin-email" type="text" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
                  placeholder="Enter your email" value={email} autoFocus
                  aria-invalid={!!error || undefined}
                  onChange={e => setEmail(e.target.value)} />
              </div>
            </div>

            <div className="rg-field">
              <label className="rg-label" htmlFor="rgin-pass">Password</label>
              <div className={`rgin-input${error ? ' is-err' : ''}`}>
                <Lock size={16} />
                <input id="rgin-pass" type={show ? 'text' : 'password'} autoComplete="current-password"
                  placeholder="Enter your password" value={password}
                  aria-invalid={!!error || undefined}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={capsCheck} onKeyUp={capsCheck} onBlur={() => setCaps(false)} />
                <button type="button" className="rgin-eye" onClick={() => setShow(s => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'} title={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {caps && <div className="rgin-caps" role="status"><ArrowUp size={13} />Caps Lock is on</div>}
            </div>

            <div className="rgin-row">
              <label className="rgin-check">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                <span className="rgin-box" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
                Remember me
              </label>
              <button type="button" className="rgin-link"
                onClick={() => { setError(''); setInfo('Passwords are reset by the Ad Hub admin — ask them for a new one.'); }}>
                Forgot password?
              </button>
            </div>

            <button type="submit" className={`rg-btn rg-btn-primary rgin-submit${busy ? ' is-busy' : ''}`} disabled={busy}>
              {busy ? <><LoaderCircle size={16} className="rgin-spin" />Signing in…</> : 'Sign in'}
            </button>
          </form>
        </div>

        <div className="rgin-foot">
          <span><ShieldCheck size={14} />Internal team access</span>
          <span>© 2026 Baba Rafi</span>
        </div>
      </section>
    </div>
  );
}
