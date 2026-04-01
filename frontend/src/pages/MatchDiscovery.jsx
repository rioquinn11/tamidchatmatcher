import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, NavLink, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sidebarLinkClass, SIDEBAR_TABS, tabFromSearchParam } from '../sidebarNav';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/** Preload this many ranked matches; only {@link MATCH_DISPLAY_COUNT} are shown at once. Refetch when the pool drops below {@link MATCH_DISPLAY_COUNT}. */
const MATCH_POOL_SIZE = 20;
const MATCH_DISPLAY_COUNT = 10;

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const PHOTO_PATTERNS = ['picture', 'photo', 'image', 'avatar', 'headshot'];

function findPhotoField(obj) {
  const entry = Object.entries(obj).find(([k, v]) =>
    PHOTO_PATTERNS.some(p => k.toLowerCase().includes(p)) &&
    typeof v === 'string' && v.startsWith('http')
  );
  return entry?.[1] || null;
}

function formatFieldLabel(key) {
  return key.replace(/[_?]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

function isUrl(val) {
  return typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'));
}

function formatPhone(val) {
  const digits = String(val).replace(/\D/g, '');
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  return String(val);
}

function isPhoneField(key) {
  const k = key.toLowerCase();
  return k.includes('phone') || k.includes('cell') || k.includes('mobile');
}

export default function MatchDiscovery() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = tabFromSearchParam(searchParams.get('tab'));
  const [target, setTarget] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [expandedQuery, setExpandedQuery] = useState('');
  const sessionRef = useRef(null);
  const emailRef = useRef('');

  const [notInterestedProfiles, setNotInterestedProfiles] = useState([]);
  const [completedProfiles, setCompletedProfiles] = useState([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [dismissingEmail, setDismissingEmail] = useState(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setSidebarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen]);

  const fetchNotInterestedProfiles = useCallback(async (email, session) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/user-state/not-interested/profiles?email=${encodeURIComponent(email)}`,
        { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} },
      );
      const data = await res.json();
      setNotInterestedProfiles(data.profiles || []);
    } catch {
      setNotInterestedProfiles([]);
    }
  }, []);

  const fetchCompletedProfiles = useCallback(async (email, session) => {
    setCompletedLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/user-state/completed/profiles?email=${encodeURIComponent(email)}`,
        { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} },
      );
      const data = await res.json();
      setCompletedProfiles(data.profiles || []);
    } catch {
      setCompletedProfiles([]);
    } finally {
      setCompletedLoading(false);
    }
  }, []);

  const refillMatchPool = useCallback(async (session, email) => {
    const res = await fetch(
      `${API_BASE}/api/matches/?email=${encodeURIComponent(email)}&limit=${MATCH_POOL_SIZE}`,
      { headers: { Authorization: `Bearer ${session.access_token}` } },
    );
    const data = await res.json();
    if (!data.error || data.matches?.length) {
      setTarget(data.target);
      setMatches(data.matches ?? []);
      setError('');
      return true;
    }
    return false;
  }, []);

  const refillSearchPool = useCallback(async (session, email, query) => {
    const res = await fetch(`${API_BASE}/api/matches/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ query, limit: MATCH_POOL_SIZE, email }),
    });
    const data = await res.json();
    if (!data.error) {
      setSearchResults(data.matches ?? []);
      setExpandedQuery(data.expanded ?? '');
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchMatches() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }
      sessionRef.current = session;

      const email = session.user.email.toLowerCase();
      emailRef.current = email;

      try {
        const res = await fetch(
          `${API_BASE}/api/matches/?email=${encodeURIComponent(email)}&limit=${MATCH_POOL_SIZE}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        const data = await res.json();

        if (!cancelled) {
          if (data.error && !data.matches?.length) {
            setError(data.error);
          } else {
            setTarget(data.target);
            setMatches(data.matches ?? []);
          }
        }
      } catch (err) {
        if (!cancelled) setError('Could not reach the server. Please try again later.');
      } finally {
        if (!cancelled) setLoading(false);
      }

      fetchNotInterestedProfiles(email, session);
      fetchCompletedProfiles(email, session);
    }

    fetchMatches();
    return () => { cancelled = true; };
  }, [navigate, fetchNotInterestedProfiles, fetchCompletedProfiles]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setSearchError('');
    setExpandedQuery('');

    const session = sessionRef.current;
    try {
      const res = await fetch(`${API_BASE}/api/matches/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          query: searchQuery.trim(),
          limit: MATCH_POOL_SIZE, email: emailRef.current,
          ...(session?.user?.email
            ? { email: session.user.email.toLowerCase() }
            : {}),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setSearchError(data.error);
        setSearchResults(null);
      } else {
        setSearchResults(data.matches ?? []);
        setExpandedQuery(data.expanded ?? '');
      }
    } catch (err) {
      setSearchError('Could not reach the server. Please try again later.');
      setSearchResults(null);
    } finally {
      setSearchLoading(false);
    }
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchResults(null);
    setSearchError('');
    setExpandedQuery('');
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  };

  async function handleDismiss(profile) {
    const targetEmail = profile.northeastern_email;
    if (!targetEmail || dismissingEmail) return;

    const session = sessionRef.current;
    const email = emailRef.current;
    const inSearch = searchResults !== null;
    const queryForSearch = searchQuery.trim();
    const tNorm = targetEmail.toLowerCase();
    const remove = m => (m.northeastern_email || '').toLowerCase() !== tNorm;

    setDismissingEmail(targetEmail);
    try {
      const postRes = await fetch(`${API_BASE}/api/user-state/not-interested`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: email, target_email: targetEmail }),
      });
      if (!postRes.ok) return;

      // Optimistic list updates (instant UI)
      let needsRefill = false;
      try {
        if (inSearch && queryForSearch && session) {
          const next = (searchResults || []).filter(remove);
          setSearchResults(next);
          needsRefill = next.length < MATCH_DISPLAY_COUNT;
        } else if (!inSearch && session) {
          const next = matches.filter(remove);
          setMatches(next);
          needsRefill = next.length < MATCH_DISPLAY_COUNT;
        } else if (inSearch) {
          const next = (searchResults || []).filter(remove);
          setSearchResults(prev => (prev ? prev.filter(remove) : prev));
          needsRefill = next.length < MATCH_DISPLAY_COUNT;
        }
      } catch {
        setMatches(prev => prev.filter(remove));
        setSearchResults(prev => (prev ? prev.filter(remove) : prev));
      }

      // Tab data: we already have this profile; avoid a slow full refetch on every dismiss
      setNotInterestedProfiles(prev => {
        if (prev.some(m => (m.northeastern_email || '').toLowerCase() === tNorm)) return prev;
        return [...prev, profile];
      });

      // Refill hits /api/matches (full combined scan) or search — run in background so the button is not blocked
      if (needsRefill && session) {
        void (async () => {
          try {
            if (inSearch && queryForSearch) {
              await refillSearchPool(session, email, queryForSearch);
            } else if (!inSearch) {
              await refillMatchPool(session, email);
            }
          } catch {
            /* pool stays at optimistic count until next navigation or refresh */
          }
        })();
      }
    } finally {
      setDismissingEmail(null);
    }
  }

  async function handleRestore(profile) {
    const targetEmail = profile.northeastern_email;
    if (!targetEmail) return;

    const session = sessionRef.current;
    const email = emailRef.current;

    try {
      const delRes = await fetch(`${API_BASE}/api/user-state/not-interested`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: email, target_email: targetEmail }),
      });
      if (!delRes.ok) return;

      setNotInterestedProfiles(prev =>
        prev.filter(m => (m.northeastern_email || '').toLowerCase() !== targetEmail.toLowerCase())
      );

      if (session) {
        try {
          await refillMatchPool(session, email);
        } catch {
          // keep existing matches
        }
        await fetchNotInterestedProfiles(email, session);
      }
    } catch {
      // silently fail
    }
  }

  const isSearchMode = searchResults !== null;
  const matchDisplayPool = isSearchMode ? (searchResults ?? []) : matches;
  const activeMatches = matchDisplayPool.slice(0, MATCH_DISPLAY_COUNT);
  const showMatchesView = activeTab === 'matches';

  return (
    <div className="relative min-h-screen bg-white">
      {/* Sidebar overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      {/* Sidebar drawer */}
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
              className={() => sidebarLinkClass({ isActive: activeTab === tab.id })}
              onClick={() => setSidebarOpen(false)}
            >
              {tab.icon}
              {tab.label}
            </NavLink>
          ))}
          <NavLink to="/leaderboard" className={sidebarLinkClass} onClick={() => setSidebarOpen(false)}>
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

      {/* Top navbar */}
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

      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -bottom-10 -left-20 h-72 w-96 rounded-[58%_42%_65%_35%/45%_35%_65%_55%] bg-[#8ED3FF] opacity-70 blur-[1px]" />
        <div className="absolute right-[-140px] top-1/2 h-60 w-[520px] -translate-y-1/2 rounded-[60%_40%_50%_50%/45%_40%_60%_55%] bg-[#8ACFFF] opacity-70 blur-[1px]" />
        <div className="absolute left-[15%] top-24 h-20 w-20 rounded-full border-4 border-[#CDEBFF] opacity-40" />
        <div className="absolute right-40 top-28 h-6 w-6 rounded-full bg-[#7BC4FF] opacity-80" />
      </div>

      {/* Main content */}
      <main className="relative z-10 px-6 py-10 sm:px-10 lg:px-16">

        {/* ── MATCHES TAB ── */}
        {showMatchesView && (
          <>
            {/* Search bar */}
            <form onSubmit={handleSearch} className="mb-8">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xl">
                  <svg
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A6ACB7]"
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by skills, industry, company, interests…"
                    className="w-full rounded-xl border border-[#E8EDF3] bg-white py-2.5 pl-10 pr-4 text-sm text-[#2E323A] shadow-sm placeholder:text-[#A6ACB7] focus:border-[#74B8F3] focus:outline-none focus:ring-2 focus:ring-[#74B8F3]/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searchLoading || !searchQuery.trim()}
                  className="flex items-center gap-2 rounded-xl bg-[#4C9BEA] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3A87D4] disabled:opacity-50"
                >
                  {searchLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                  )}
                  Search
                </button>
                {isSearchMode && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="rounded-xl border border-[#E8EDF3] bg-white px-4 py-2.5 text-sm font-medium text-[#656D79] transition-colors hover:bg-[#F2F4F8]"
                  >
                    Clear
                  </button>
                )}
              </div>
              {expandedQuery && (
                <p className="mt-2 text-xs text-[#A6ACB7]">
                  <span className="font-semibold">Interpreted as:</span> {expandedQuery}
                </p>
              )}
            </form>

            {/* Heading */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#2E323A]">
                {isSearchMode ? 'Search Results' : 'Your Top Matches'}
              </h1>
              {!isSearchMode && target && (
                <p className="mt-1 text-sm text-[#858B96]">
                  Showing the best chat partners for{' '}
                  <span className="font-semibold text-[#2E323A]">{target}</span>
                </p>
              )}
              {isSearchMode && (
                <p className="mt-1 text-sm text-[#858B96]">
                  Top matches for{' '}
                  <span className="font-semibold text-[#2E323A]">"{searchQuery}"</span>
                </p>
              )}
            </div>

            {loading && !isSearchMode && (
              <div className="flex flex-col items-center gap-3 py-24">
                <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#E8F6FF] border-t-[#74B8F3]" />
                <p className="text-sm text-[#858B96]">Finding your matches…</p>
              </div>
            )}

            {searchLoading && (
              <div className="flex flex-col items-center gap-3 py-16">
                <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#E8F6FF] border-t-[#74B8F3]" />
                <p className="text-sm text-[#858B96]">Searching members…</p>
              </div>
            )}

            {!loading && !isSearchMode && error && (
              <div className="mx-auto max-w-lg rounded-xl border border-[#E38181] bg-[#FFF3F3] px-6 py-4 text-center text-sm text-[#B65A5A]">
                {error}
              </div>
            )}

            {searchError && (
              <div className="mx-auto max-w-lg rounded-xl border border-[#E38181] bg-[#FFF3F3] px-6 py-4 text-center text-sm text-[#B65A5A]">
                {searchError}
              </div>
            )}

            {!loading && !searchLoading && !error && !searchError && activeMatches.length === 0 && (
              <p className="py-16 text-center text-sm text-[#858B96]">
                {isSearchMode ? 'No members matched your search.' : 'No matches found yet. Check back once more members have joined!'}
              </p>
            )}

            {!loading && !searchLoading && !error && !searchError && activeMatches.length > 0 && (
              <div className="flex flex-col gap-5">
                {activeMatches.map((m, i) => (
                  <ProfileCard
                    key={m.northeastern_email ?? m.name ?? i}
                    profile={m}
                    index={i}
                    isSearchMode={isSearchMode}
                    dismissButton={
                      <button
                        type="button"
                        onClick={() => handleDismiss(m)}
                        disabled={dismissingEmail === m.northeastern_email}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6B7280]/70 text-white backdrop-blur-sm transition-all hover:bg-[#4B5563] disabled:opacity-40"
                        aria-label="Not interested"
                        title="Not interested"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── NOT INTERESTED TAB ── */}
        {activeTab === 'not_interested' && (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#2E323A]">Not Interested</h1>
              <p className="mt-1 text-sm text-[#858B96]">
                Profiles you dismissed. Click "Still Interested" to bring them back.
              </p>
            </div>

            {notInterestedProfiles.length === 0 ? (
              <p className="py-16 text-center text-sm text-[#858B96]">
                No dismissed profiles. Profiles you mark as not interested will appear here.
              </p>
            ) : (
              <div className="flex flex-col gap-5">
                {notInterestedProfiles.map((m, i) => (
                  <ProfileCard
                    key={m.northeastern_email ?? m.name ?? i}
                    profile={m}
                    index={i}
                    isSearchMode={false}
                    actionButton={
                      <button
                        type="button"
                        onClick={() => handleRestore(m)}
                        className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#3d9a5f]/90 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#2d7a4a]"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                        Still Interested
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── PENDING TAB ── */}
        {activeTab === 'pending' && (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#2E323A]">Pending</h1>
              <p className="mt-1 text-sm text-[#858B96]">Profiles awaiting a response.</p>
            </div>
            <p className="py-16 text-center text-sm text-[#858B96]">
              No pending profiles yet.
            </p>
          </>
        )}

        {/* ── COMPLETED TAB ── */}
        {activeTab === 'completed' && (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#2E323A]">Completed</h1>
              <p className="mt-1 text-sm text-[#858B96]">
                People you've had a Tamid chat with.
              </p>
            </div>

            {completedLoading ? (
              <div className="flex flex-col items-center gap-3 py-24">
                <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#E8F6FF] border-t-[#74B8F3]" />
                <p className="text-sm text-[#858B96]">Loading completed chats…</p>
              </div>
            ) : completedProfiles.length === 0 ? (
              <p className="py-16 text-center text-sm text-[#858B96]">
                No completed Tamid chats yet. Once you chat with someone, they'll appear here.
              </p>
            ) : (
              <div className="flex flex-col gap-5">
                {completedProfiles.map((m, i) => (
                  <ProfileCard
                    key={m.northeastern_email ?? m.name ?? i}
                    profile={m}
                    index={i}
                    isSearchMode={false}
                  />
                ))}
              </div>
            )}
          </>
        )}

      </main>
    </div>
  );
}

function ProfileCard({ profile: m, index: i, isSearchMode, dismissButton, actionButton }) {
  const EXCLUDED_KEYS = new Set(['name', 'score', 'photo_url', 'instagram', 'linkedin', 'northeastern_email', 'company_name', 'coop_name', 'industry']);
  const fields = Object.entries(m).filter(
    ([k, v]) => v != null && v !== '' && !EXCLUDED_KEYS.has(k),
  );

  const hasWorkInfo = m.company_name || m.coop_name || m.industry;
  const workFields = hasWorkInfo
    ? [['company_name', m.company_name], ['coop_name', m.coop_name], ['industry', m.industry]].filter(([, v]) => v != null && v !== '')
    : [];

  const instagram = m.instagram || null;
  const linkedin = m.linkedin || null;
  const photo = findPhotoField(m);

  return (
    <article
      className="card-animate-in w-full overflow-hidden rounded-xl border border-[#E8EDF3] bg-white shadow-[0_12px_40px_rgba(15,38,72,0.08)] transition-all duration-200 hover:scale-[1.015] hover:border-[#9BCFFF] hover:shadow-[0_16px_48px_rgba(15,38,72,0.12)]"
      style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
    >
      <div className="flex flex-col sm:flex-row">
        {/* left: photo */}
        <div className="relative flex h-56 w-full shrink-0 items-center justify-center overflow-hidden bg-[#F0F8FF] sm:h-auto sm:min-h-[220px] sm:w-52">
          {photo ? (
            <img
              src={photo}
              alt={m.name ?? ''}
              className="h-full w-full object-cover"
              onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#C8D5E0]"
            style={{ display: photo ? 'none' : 'flex' }}
          >
            {m.name ? (
              <span className="text-3xl font-bold text-[#B0C8DD]">{getInitials(m.name)}</span>
            ) : (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
              </svg>
            )}
          </div>

          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            {instagram && (
              <a
                href={instagram.startsWith('http') ? instagram : `https://instagram.com/${instagram.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white transition-transform duration-150 hover:scale-110"
                title="Instagram"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
            )}
            {linkedin && (
              <a
                href={linkedin.startsWith('http') ? linkedin : `https://linkedin.com/in/${linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0A66C2] text-white transition-transform duration-150 hover:scale-110"
                title="LinkedIn"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* right: organized details */}
        <div className="flex min-w-0 flex-1 flex-col gap-5 p-6 sm:p-8">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-black">{m.name}</p>
              {isSearchMode && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-[#EAF5FF] px-2.5 py-0.5 text-xs font-semibold text-[#4C9BEA]">
                    Score: {m.score}
                  </span>
                </div>
              )}
            </div>
            {(dismissButton || actionButton) ? (
              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                {dismissButton}
                {actionButton}
              </div>
            ) : null}
          </div>
          {(fields.length > 0 || workFields.length > 0) && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
              {fields.map(([key, val]) => (
                <FieldCell key={key} rawKey={key} label={formatFieldLabel(key)} value={val} />
              ))}
              {workFields.map(([key, val]) => (
                <FieldCell key={key} rawKey={key} label={formatFieldLabel(key)} value={val} />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function FieldCell({ label, rawKey, value }) {
  if (typeof value === 'boolean') {
    return (
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A6ACB7]">{label}</p>
        <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${value ? 'text-[#3d9a5f]' : 'text-[#A6ACB7]'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${value ? 'bg-[#3d9a5f]' : 'bg-[#ccc]'}`} />
          {value ? 'Yes' : 'No'}
        </span>
      </div>
    );
  }

  if (isUrl(String(value))) {
    return (
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A6ACB7]">{label}</p>
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[#4C9BEA] transition-colors hover:text-[#67B5F6]"
        >
          View →
        </a>
      </div>
    );
  }

  const display = isPhoneField(rawKey) ? formatPhone(value) : String(value);

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A6ACB7]">{label}</p>
      <p className="text-sm font-medium text-[#2E323A]">{display}</p>
    </div>
  );
}
