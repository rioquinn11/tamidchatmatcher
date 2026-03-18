import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../api/users';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
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

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo / Brand */}
        <div style={styles.brand}>
          <div style={styles.logoMark}>T</div>
          <h1 style={styles.brandName}>TAMID Chat Matcher</h1>
        </div>

        <p style={styles.subtitle}>Sign in to your account</p>

        <form onSubmit={handleSubmit} style={styles.form} noValidate>
          <div style={styles.field}>
            <label htmlFor="email" style={styles.label}>
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
              style={styles.input}
              onFocus={(e) => Object.assign(e.target.style, styles.inputFocus)}
              onBlur={(e) => Object.assign(e.target.style, styles.input)}
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="password" style={styles.label}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              style={styles.input}
              onFocus={(e) => Object.assign(e.target.style, styles.inputFocus)}
              onBlur={(e) => Object.assign(e.target.style, styles.input)}
            />
          </div>

          {error && (
            <div style={styles.errorBox}>
              <span style={styles.errorIcon}>!</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !form.email || !form.password}
            style={{
              ...styles.button,
              ...(loading || !form.email || !form.password
                ? styles.buttonDisabled
                : {}),
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={styles.footer}>
          Don&apos;t have an account?{' '}
          <a href="mailto:admin@tamid.com" style={styles.link}>
            Contact your chapter admin
          </a>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
    padding: '24px',
  },
  card: {
    background: '#1e293b',
    borderRadius: '16px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
    border: '1px solid #334155',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  logoMark: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '20px',
    color: '#fff',
    flexShrink: 0,
  },
  brandName: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: '14px',
    marginBottom: '32px',
    marginTop: '4px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#cbd5e1',
    letterSpacing: '0.01em',
  },
  input: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '15px',
    color: '#f1f5f9',
    outline: 'none',
    transition: 'border-color 0.15s',
    width: '100%',
  },
  inputFocus: {
    background: '#0f172a',
    border: '1px solid #6366f1',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '15px',
    color: '#f1f5f9',
    outline: 'none',
    width: '100%',
    boxShadow: '0 0 0 3px rgba(99,102,241,0.15)',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#fca5a5',
  },
  errorIcon: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: 'rgba(239,68,68,0.25)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '11px',
    flexShrink: 0,
  },
  button: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '4px',
    transition: 'opacity 0.15s',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  footer: {
    marginTop: '24px',
    textAlign: 'center',
    fontSize: '13px',
    color: '#64748b',
  },
  link: {
    color: '#818cf8',
    textDecoration: 'none',
  },
};
