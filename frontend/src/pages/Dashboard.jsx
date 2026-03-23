import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const GRID_ITEMS = [
  { label: 'My Matches' },
  { label: 'Profile' },
  { label: 'Schedule' },
  { label: 'Leaderboard' },
  { label: 'Members' },
  { label: 'Messages' },
  { label: 'Settings' },
  { label: 'History' },
  { label: 'Notifications' },
  { label: 'Availability' },
  { label: 'Interests' },
  { label: 'Analytics' },
  { label: 'Connections' },
  { label: 'Events' },
  { label: 'Help' },
];

export default function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        console.error('Sign out error:', error.message);
      }
    } catch (err) {
      console.error('Unexpected sign out error:', err);
    }
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
    window.location.replace('/login');
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.logoMark}>T</div>
          <span style={styles.brandName}>TAMID Chat Matcher</span>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn}>
          Sign out
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.grid}>
          {GRID_ITEMS.map((item) => (
            <div key={item.label} style={styles.card}>
              <span style={styles.cardLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 32px',
    borderBottom: '1px solid #1e293b',
    background: 'rgba(15,23,42,0.8)',
    backdropFilter: 'blur(8px)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoMark: {
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '17px',
    color: '#fff',
  },
  brandName: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#f1f5f9',
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '6px 14px',
    color: '#94a3b8',
    fontSize: '13px',
    cursor: 'pointer',
  },
  content: {
    padding: '40px 32px',
    maxWidth: '1100px',
    margin: '0 auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gridTemplateRows: 'repeat(5, 160px)',
    gap: '20px',
  },
  card: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  cardLabel: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#94a3b8',
  },
};

