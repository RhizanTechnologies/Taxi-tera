import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/index';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { show } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const redirect = sessionStorage.getItem('tt-redirect-after-login') ?? '/';

  const sendMagicLink = async () => {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${redirect}` },
    });
    setLoading(false);
    if (error) { show(error.message, 'danger'); return; }
    setSent(true);
  };

  const handlePasswordAuth = async () => {
    if (!email || !password) {
      show('Please enter both email and password', 'danger');
      return;
    }
    setLoading(true);
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      setLoading(false);
      if (error) {
        show(error.message, 'danger');
        return;
      }
      if (data.session) {
        show('Account created successfully!', 'success');
        navigate(redirect);
      } else {
        show('Check your email to confirm your account, or sign in if confirmed.', 'default');
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      if (error) {
        show(error.message, 'danger');
        return;
      }
      if (data.session) {
        show('Signed in successfully!', 'success');
        navigate(redirect);
      }
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${redirect}` },
      });
      if (error) {
        if (error.message.includes('not enabled') || error.message.includes('validation_failed')) {
          show('Google login is not enabled in your Supabase project yet. Enable it under Authentication → Providers → Google, or use Email login below.', 'default');
        } else {
          show(error.message, 'danger');
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in error';
      show(message, 'danger');
    }
  };

  return (
    <div className="login-page">
      <div className="login-logo">🚐</div>
      <div>
        <h1 className="login-title">{t('appName')}</h1>
        <p className="login-sub">{t('tagline')}</p>
      </div>

      {sent ? (
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📧</div>
          <h2 style={{ marginBottom: 8 }}>Check your email</h2>
          <p className="text-sm text-muted">
            We sent a sign-in link to <strong>{email}</strong>. Tap it to continue.
          </p>
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setSent(false)}>
            Use a different email
          </button>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            id="google-signin"
            className="btn btn-secondary btn-full"
            onClick={signInWithGoogle}
            style={{ gap: 10, justifyContent: 'center' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
            Continue with Google
          </button>

          <div className="login-divider">or email</div>

          <div className="field">
            <label className="field-label" htmlFor="email-input">Email address</label>
            <input
              id="email-input"
              className="input"
              type="email"
              inputMode="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (useMagicLink) sendMagicLink();
                  else handlePasswordAuth();
                }
              }}
            />
          </div>

          {!useMagicLink && (
            <div className="field">
              <label className="field-label" htmlFor="password-input">Password</label>
              <input
                id="password-input"
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handlePasswordAuth()}
              />
            </div>
          )}

          {useMagicLink ? (
            <button
              id="magic-link-btn"
              className="btn btn-primary btn-full"
              onClick={sendMagicLink}
              disabled={loading || !email}
            >
              {loading ? 'Sending…' : 'Send sign-in link'}
            </button>
          ) : (
            <button
              id="password-auth-btn"
              className="btn btn-primary btn-full"
              onClick={handlePasswordAuth}
              disabled={loading || !email || !password}
            >
              {loading ? 'Please wait…' : (isSignUp ? 'Create account' : 'Sign in')}
            </button>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: 4 }}>
            {!useMagicLink ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '4px 0', fontSize: '0.85rem' }}
                  onClick={() => setIsSignUp(!isSignUp)}
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Need an account? Sign up"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '4px 0', fontSize: '0.85rem' }}
                  onClick={() => setUseMagicLink(true)}
                >
                  Use magic link
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '4px 0', fontSize: '0.85rem', margin: '0 auto' }}
                onClick={() => setUseMagicLink(false)}
              >
                Use password instead
              </button>
            )}
          </div>

          <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ marginTop: 8 }}>
            Browse without account
          </button>
        </div>
      )}
    </div>
  );
}
