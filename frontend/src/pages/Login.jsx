import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const MAGIC_LINK_COOLDOWN_SECONDS = 60;

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard', { replace: true });
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setCooldownSeconds((prev) => prev - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
    setMessage('');
  };

  const isNortheasternEmail = (email) => email.endsWith('@northeastern.edu');

  const handleMagicLink = async (e) => {
    e.preventDefault();
    if (cooldownSeconds > 0) {
      setError(`Please wait ${cooldownSeconds}s before requesting another link.`);
      return;
    }
    const email = form.email.trim().toLowerCase();
    if (!isNortheasternEmail(email)) {
      setError('Please use your @northeastern.edu email.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: true,
        },
      });
      if (otpError) throw otpError;
      setMessage('Check your Northeastern email for a magic link to sign in.');
      setCooldownSeconds(MAGIC_LINK_COOLDOWN_SECONDS);
    } catch (err) {
      const errMessage = err?.message || 'Could not send magic link. Please try again.';
      if (errMessage.toLowerCase().includes('rate limit')) {
        setCooldownSeconds(MAGIC_LINK_COOLDOWN_SECONDS);
        setError(`Email rate limit reached. Please wait ${MAGIC_LINK_COOLDOWN_SECONDS}s before trying again.`);
      } else {
        setError(errMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = form.email.trim().length > 0;

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
              Sign in with your Northeastern email to access your matches and conversations.
            </p>
          </header>

          {/* --- forms --- */}
          <form
            onSubmit={handleMagicLink}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-[#656D79]">
                Northeastern email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="you@northeastern.edu"
                className="h-11 w-full rounded-[2px] border border-[#E8EDF3] bg-white px-3 text-sm text-[#2E323A] outline-none transition-colors placeholder:text-[#B0B6C0] hover:border-[#DCE5EF] focus:border-[#9BCFFF] focus:ring-[3px] focus:ring-[#9BCFFF]/25"
              />
            </div>

            {error && (
              <div className="rounded-md border border-[#E38181] bg-[#FFF3F3] px-3 py-2 text-sm text-[#B65A5A]">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-md border border-[#9BCFFF] bg-[#F4FAFF] px-3 py-2 text-sm text-[#2E5F8F]">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !canSubmit || cooldownSeconds > 0}
              className="mt-2 h-[46px] w-full rounded-full bg-gradient-to-r from-[#8DCAFF] to-[#74B8F3] px-5 text-base font-bold uppercase tracking-[0.08em] text-white transition duration-150 ease-out hover:brightness-105 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading
                ? 'Sending link...'
                : cooldownSeconds > 0
                  ? `Resend in ${cooldownSeconds}s`
                  : 'Send Magic Link'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-[#8A909B]">
            We only support `@northeastern.edu` email sign-in.
          </p>
        </section>
      </div>
    </main>
  );
}
