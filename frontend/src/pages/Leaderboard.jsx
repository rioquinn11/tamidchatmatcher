import { useEffect, useState, useRef } from 'react';
import { useNavigate, NavLink, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sidebarLinkClass, SIDEBAR_TABS } from '../sidebarNav';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Leaderboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setSidebarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen]);

  useEffect(() => {
    let cancelled = false;

    async function fetchLeaderboard() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/leaderboard/?limit=50`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();

        if (!cancelled) {
          if (!res.ok && data.error) {
            setError(data.error);
            setEntries([]);
          } else {
            setEntries(data.entries ?? []);
          }
        }
      } catch (err) {
        if (!cancelled) setError('Could not reach the server. Please try again later.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLeaderboard();
    return () => { cancelled = true; };
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative min-h-screen bg-white">
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      <aside
        ref={sidebarRef}
        className={`fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-[#E9EEF5] bg-white shadow-[4px_0_24px_rgba(15,38,72,0.06)] transition-transform duration-250 ease-[cubic-bezier(0.2,0.7,0.2,1)] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-14 items-center justify-between border-b border-[#E9EEF5] px-5">
          <span className="text-sm font-bold text-[#2E323A]">Menu</span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#858B96] transition-colors hover:bg-[#F2F4F8] hover:text-[#2E323A]"
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {SIDEBAR_TABS.map(tab => (
            <NavLink
              key={tab.id}
              to={tab.id === 'matches' ? '/matches' : `/matches?tab=${tab.id}`}
              className={sidebarLinkClass({ isActive: false })}
              onClick={() => setSidebarOpen(false)}
            >
              {tab.icon}
              {tab.label}
            </NavLink>
          ))}
          <NavLink
            to="/leaderboard"
            className={() =>
              sidebarLinkClass({ isActive: location.pathname === '/leaderboard' })
            }
            onClick={() => setSidebarOpen(false)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 21h8M12 17v4M6 3h12l-3 7h3l-7 11 2-7H7l3-7H6z" />
            </svg>
            Leaderboard
          </NavLink>
        </nav>

        <div className="border-t border-[#E9EEF5] px-3 py-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#B65A5A] transition-colors hover:bg-[#FFF3F3]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      <nav className="sticky top-0 z-30 flex h-14 items-center border-b border-[#E9EEF5] bg-white/90 px-5 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="mr-4 flex h-9 w-9 items-center justify-center rounded-lg text-[#656D79] transition-colors hover:bg-[#F2F4F8] hover:text-[#2E323A]"
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="flex items-center gap-2.5">
          <img src="/assets/logo.png" alt="" className="h-7 w-7" />
          <span className="text-base font-bold tracking-[-0.01em] text-[#2E323A]">Tamid Group</span>
        </div>
      </nav>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -bottom-10 -left-20 h-72 w-96 rounded-[58%_42%_65%_35%/45%_35%_65%_55%] bg-[#8ED3FF] opacity-70 blur-[1px]" />
        <div className="absolute right-[-140px] top-1/2 h-60 w-[520px] -translate-y-1/2 rounded-[60%_40%_50%_50%/45%_40%_60%_55%] bg-[#8ACFFF] opacity-70 blur-[1px]" />
      </div>

      <main className="relative z-10 px-6 py-10 sm:px-10 lg:px-16">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#2E323A]">Tamid Chat Leaderboard</h1>
          <p className="mt-1 text-sm text-[#858B96]">
            Ranked by completed Tamid chats (partner emails in your roster).
          </p>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-24">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#E8F6FF] border-t-[#74B8F3]" />
            <p className="text-sm text-[#858B96]">Loading leaderboard…</p>
          </div>
        )}

        {!loading && error && (
          <p className="rounded-xl border border-[#F5D4D4] bg-[#FFF8F8] px-4 py-3 text-sm text-[#B65A5A]">{error}</p>
        )}

        {!loading && !error && (
          <div className="overflow-hidden rounded-2xl border border-[#E8EDF3] bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E8EDF3] bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wide text-[#858B96]">
                  <th className="px-5 py-3.5">Rank</th>
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5 text-right">Completed</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-[#858B96]">
                      No leaderboard data yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((row, i) => (
                    <tr key={`${row.email || 'unknown'}-${i}`} className="border-b border-[#F0F3F7] last:border-0">
                      <td className="px-5 py-3.5 font-medium text-[#656D79]">{i + 1}</td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-[#2E323A]">{row.name}</span>
                        {row.email && (
                          <span className="mt-0.5 block text-xs text-[#A6ACB7]">{row.email}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-[#4C9BEA]">
                        {row.completed_count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
