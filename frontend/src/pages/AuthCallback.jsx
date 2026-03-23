import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Auth callback error:', error.message);
        navigate('/login');
        return;
      }
      if (session) {
        localStorage.setItem('token', session.access_token);
        navigate('/dashboard');
      } else {
        navigate('/login');
      }
    });
  }, [navigate]);

  return (
    <div style={styles.page}>
      <div style={styles.spinner} />
      <p style={styles.text}>Signing you in…</p>
    </div>
  );
}
const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
    gap: '16px',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid #334155',
    borderTop: '3px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  text: {
    color: '#94a3b8',
    fontSize: '15px',
  },
};

