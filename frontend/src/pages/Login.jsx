import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../api/users';
import { supabase } from '../lib/supabase';

const TAB_SIGN_IN = 'signin';
const TAB_SIGN_UP = 'signup';

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(TAB_SIGN_IN);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSignIn = tab === TAB_SIGN_IN;

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const switchTab = (next) => {
    setTab(next);
    setError('');
  };

  const handleGoogleSSO = async () => {
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await loginUser(form.email, form.password);
      localStorage.setItem('token', data.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setError('');
      setTab(TAB_SIGN_IN);
      setForm((prev) => ({ ...prev, name: '', confirm: '' }));
      alert('Check your email to confirm your account, then sign in.');
    } catch (err) {
      setError(err.message || 'Could not create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmitSignIn = form.email && form.password;
  const canSubmitSignUp = form.name && form.email && form.password && form.confirm;

  return (
    <main className="relative min-h-screen overflow-hidden bg-white px-6 py-10 sm:px-10">
      {/* --- decorative background --- */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -bottom-10 -left-20 h-72 w-96 rounded-[58%_42%_65%_35%/45%_35%_65%_55%] bg-[#8ED3FF] opacity-70 blur-[1px]" />
        <div className="absolute right-[-140px] top-1/2 h-60 w-[520px] -translate-y-1/2 rounded-[60%_40%_50%_50%/45%_40%_60%_55%] bg-[#8ACFFF] opacity-70 blur-[1px]" />
        <div className="absolute left-1/4 top-14 h-20 w-20 rounded-full border-4 border-[#CDEBFF] opacity-40" />
        <img src="/assets/logo.png" alt="" className="absolute left-10 top-32 h-14 w-14 rotate-12 opacity-40" />
        <div className="absolute right-40 top-16 h-6 w-6 rounded-full bg-[#7BC4FF] opacity-80" />
        <img src="/assets/logo.png" alt="" className="absolute bottom-14 right-56 h-12 w-12 rotate-45 opacity-45" />
      </div>

      {/* --- card --- */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1200px] items-center justify-center">
        <section className="w-full max-w-[440px] rounded-xl border border-[#F2F4F8] bg-white px-8 pb-10 pt-10 shadow-[0_12px_40px_rgba(15,38,72,0.08)] sm:px-11">
          {/* brand */}
          <header className="mb-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#C0C5CE]">Tamid Group</p>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-[#2E323A]">
              Welcome to Tamid Chat Matcher
            </h1>
            <p className="mt-2 text-sm text-[#858B96]">
              {isSignIn
                ? 'Sign in to access your matches and conversations.'
                : 'Create an account to get started.'}
            </p>
          </header>

          {/* --- tab switcher --- */}
          <div className="mx-auto mb-7 flex h-12 max-w-[320px] items-center rounded-full bg-[#F3F4F6] p-1">
            <button
              type="button"
              onClick={() => switchTab(TAB_SIGN_IN)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition-all ${
                isSignIn
                  ? 'bg-white text-[#2E323A] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                  : 'bg-transparent text-[#A6ACB7]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchTab(TAB_SIGN_UP)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition-all ${
                !isSignIn
                  ? 'bg-white text-[#2E323A] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                  : 'bg-transparent text-[#A6ACB7]'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* --- forms --- */}
          <form
            onSubmit={isSignIn ? handleSignIn : handleSignUp}
            className="space-y-4"
            noValidate
          >
            {!isSignIn && (
              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-semibold text-[#656D79]">
                  Full name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Jane Doe"
                  className="h-11 w-full rounded-[2px] border border-[#E8EDF3] bg-white px-3 text-sm text-[#2E323A] outline-none transition-colors placeholder:text-[#B0B6C0] hover:border-[#DCE5EF] focus:border-[#9BCFFF] focus:ring-[3px] focus:ring-[#9BCFFF]/25"
                />
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-[#656D79]">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="h-11 w-full rounded-[2px] border border-[#E8EDF3] bg-white px-3 text-sm text-[#2E323A] outline-none transition-colors placeholder:text-[#B0B6C0] hover:border-[#DCE5EF] focus:border-[#9BCFFF] focus:ring-[3px] focus:ring-[#9BCFFF]/25"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-[#656D79]">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignIn ? 'current-password' : 'new-password'}
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder={isSignIn ? 'Enter your password' : 'Create a password'}
                  className="h-11 w-full rounded-[2px] border border-[#E8EDF3] bg-white px-3 pr-11 text-sm text-[#2E323A] outline-none transition-colors placeholder:text-[#B0B6C0] hover:border-[#DCE5EF] focus:border-[#9BCFFF] focus:ring-[3px] focus:ring-[#9BCFFF]/25"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#C4CAD4] transition-colors hover:text-[#8C95A4] focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
                      <path d="M3 3l18 18" />
                      <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                      <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c6 0 9.74 7 9.74 7a18.56 18.56 0 0 1-4.24 5.19" />
                      <path d="M6.61 6.61A18.7 18.7 0 0 0 2.26 12S6 19 12 19a11 11 0 0 0 5.14-1.33" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
                      <path d="M2.26 12S6 5 12 5s9.74 7 9.74 7S18 19 12 19 2.26 12 2.26 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              {isSignIn && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-sm font-medium text-[#8A909B] transition-colors hover:text-[#4C9BEA] focus:underline focus:outline-none"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            {!isSignIn && (
              <div className="space-y-2">
                <label htmlFor="confirm" className="block text-sm font-semibold text-[#656D79]">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={form.confirm}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  className="h-11 w-full rounded-[2px] border border-[#E8EDF3] bg-white px-3 text-sm text-[#2E323A] outline-none transition-colors placeholder:text-[#B0B6C0] hover:border-[#DCE5EF] focus:border-[#9BCFFF] focus:ring-[3px] focus:ring-[#9BCFFF]/25"
                />
              </div>
            )}

            {error && (
              <div className="rounded-md border border-[#E38181] bg-[#FFF3F3] px-3 py-2 text-sm text-[#B65A5A]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (isSignIn ? !canSubmitSignIn : !canSubmitSignUp)}
              className="mt-2 h-[46px] w-full rounded-full bg-gradient-to-r from-[#8DCAFF] to-[#74B8F3] px-5 text-base font-bold uppercase tracking-[0.08em] text-white transition duration-150 ease-out hover:brightness-105 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading
                ? (isSignIn ? 'Signing in...' : 'Creating account...')
                : (isSignIn ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          {/* divider + Google */}
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#E8EDF3]" />
            <span className="text-xs font-medium uppercase tracking-[0.1em] text-[#A6ACB7]">or continue with</span>
            <span className="h-px flex-1 bg-[#E8EDF3]" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSSO}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-[#E8EDF3] bg-white px-4 text-sm font-semibold text-[#656D79] transition-colors hover:border-[#9BCFFF] hover:bg-[#F8FCFF] focus:border-[#9BCFFF] focus:ring-[3px] focus:ring-[#9BCFFF]/25 focus:outline-none"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
            </svg>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-sm text-[#8A909B]">
            {isSignIn ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => switchTab(isSignIn ? TAB_SIGN_UP : TAB_SIGN_IN)}
              className="font-medium text-[#4C9BEA] transition-opacity hover:opacity-80"
            >
              {isSignIn ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}
