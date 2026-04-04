import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const RESEND_COOLDOWN_SECONDS = 10;

export default function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (!email) {
      navigate('/login', { replace: true });
    }
  }, [email, navigate]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setCooldownSeconds((prev) => prev - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError('');
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: 'email',
      });
      if (verifyError) throw verifyError;
      navigate('/matches', { replace: true });
    } catch (err) {
      setError(err?.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldownSeconds > 0) return;

    setResending(true);
    setError('');
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (otpError) throw otpError;
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const errMessage = err?.message || 'Could not resend code. Please try again.';
      if (errMessage.toLowerCase().includes('rate limit')) {
        setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
        setError('Rate limit reached. Please wait before trying again.');
      } else {
        setError(errMessage);
      }
    } finally {
      setResending(false);
    }
  };

  if (!email) return null;

  const canSubmit = code.trim().length > 0;

  return (
    <main className="relative min-h-screen overflow-hidden bg-white px-6 py-10 sm:px-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -bottom-10 -left-20 h-72 w-96 rounded-[58%_42%_65%_35%/45%_35%_65%_55%] bg-[#8ED3FF] opacity-70 blur-[1px]" />
        <div className="absolute right-[-140px] top-1/2 h-60 w-[520px] -translate-y-1/2 rounded-[60%_40%_50%_50%/45%_40%_60%_55%] bg-[#8ACFFF] opacity-70 blur-[1px]" />
        <div className="absolute left-1/4 top-14 h-20 w-20 rounded-full border-4 border-[#CDEBFF] opacity-40" />
        <img src="/assets/logo.png" alt="" className="absolute left-10 top-32 h-14 w-14 rotate-12 opacity-40" />
        <div className="absolute right-40 top-16 h-6 w-6 rounded-full bg-[#7BC4FF] opacity-80" />
        <img src="/assets/logo.png" alt="" className="absolute bottom-14 right-56 h-12 w-12 rotate-45 opacity-45" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1200px] items-center justify-center">
        <section className="w-full max-w-[440px] rounded-xl border border-[#F2F4F8] bg-white px-8 pb-10 pt-10 shadow-[0_12px_40px_rgba(15,38,72,0.08)] sm:px-11">
          <header className="mb-6 text-center">
            <p className="text-[11px] font-semibold tracking-[0.15em] text-[#C0C5CE]">TAMID Group</p>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-[#2E323A]">
              Check your email
            </h1>
            <p className="mt-2 text-sm text-[#858B96]">
              We sent a verification code to <span className="font-medium text-[#2E323A]">{email}</span>
            </p>
          </header>

          <form onSubmit={handleVerify} className="space-y-4" noValidate>
            <div className="space-y-2">
              <label htmlFor="otp" className="block text-sm font-semibold text-[#656D79]">
                Enter one-time password
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                required
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ''));
                  setError('');
                }}
                placeholder="00000000"
                className="h-11 w-full rounded-[2px] border border-[#E8EDF3] bg-white px-3 text-center text-lg font-semibold tracking-[0.3em] text-[#2E323A] outline-none transition-colors placeholder:text-[#B0B6C0] placeholder:tracking-[0.3em] hover:border-[#DCE5EF] focus:border-[#9BCFFF] focus:ring-[3px] focus:ring-[#9BCFFF]/25"
              />
            </div>

            {error && (
              <div className="rounded-md border border-[#E38181] bg-[#FFF3F3] px-3 py-2 text-sm text-[#B65A5A]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="mt-2 h-[46px] w-full rounded-full bg-gradient-to-r from-[#8DCAFF] to-[#74B8F3] px-5 text-base font-bold uppercase tracking-[0.08em] text-white transition duration-150 ease-out hover:brightness-105 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading ? 'Verifying...' : 'Log In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#8A909B]">
            Didn&apos;t receive a code?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || cooldownSeconds > 0}
              className="font-medium text-[#74B8F3] underline underline-offset-2 transition-colors hover:text-[#5A9FE0] disabled:cursor-not-allowed disabled:text-[#B0B6C0] disabled:no-underline"
            >
              {resending
                ? 'Sending...'
                : cooldownSeconds > 0
                  ? `Resend in ${cooldownSeconds}s`
                  : 'Resend'}
            </button>
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-3 block w-full text-center text-sm font-medium text-[#74B8F3] transition-colors hover:text-[#5A9FE0]"
          >
            Go back
          </button>
        </section>
      </div>
    </main>
  );
}
