import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const HIDDEN_FIELDS_EXACT = new Set(['embedding', 'id', 'created_at', 'updated_at', 'name', 'score', 'email']);
const HIDDEN_FIELDS_PATTERNS = ['co-op', 'co_op', 'coop', 'instagram', 'linkedin', 'picture', 'photo', 'image', 'avatar', 'headshot'];

function isHiddenField(key) {
  if (HIDDEN_FIELDS_EXACT.has(key)) return true;
  const lower = key.toLowerCase();
  return HIDDEN_FIELDS_PATTERNS.some(p => lower.includes(p));
}
const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const MEDAL_LABELS = ['1st', '2nd', '3rd'];

function formatFieldLabel(key) {
  return key.replace(/[_?]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

function isUrl(val) {
  return typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'));
}

function findField(obj, pattern) {
  const entry = Object.entries(obj).find(([k]) => k.toLowerCase().includes(pattern));
  return entry?.[1] || null;
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
  const [target, setTarget] = useState(null);
  const [matches, setMatches] = useState([]);
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

    async function fetchMatches() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      const email = session.user.email.toLowerCase();

      try {
        const res = await fetch(
          `${API_BASE}/api/matches/?email=${encodeURIComponent(email)}`,
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
    }

    fetchMatches();
    return () => { cancelled = true; };
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative min-h-screen bg-white">
      {/* ── Sidebar overlay ── */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      {/* ── Sidebar drawer ── */}
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

        <nav className="flex-1 px-3 py-4">
          <a href="/matches" className="flex items-center gap-3 rounded-lg bg-[#F0F8FF] px-3 py-2.5 text-sm font-semibold text-[#4C9BEA]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Matches
          </a>
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

      {/* ── Top navbar ── */}
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

      {/* ── Decorative background ── */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -bottom-10 -left-20 h-72 w-96 rounded-[58%_42%_65%_35%/45%_35%_65%_55%] bg-[#8ED3FF] opacity-70 blur-[1px]" />
        <div className="absolute right-[-140px] top-1/2 h-60 w-[520px] -translate-y-1/2 rounded-[60%_40%_50%_50%/45%_40%_60%_55%] bg-[#8ACFFF] opacity-70 blur-[1px]" />
        <div className="absolute left-[15%] top-24 h-20 w-20 rounded-full border-4 border-[#CDEBFF] opacity-40" />
        <div className="absolute right-40 top-28 h-6 w-6 rounded-full bg-[#7BC4FF] opacity-80" />
      </div>

      {/* ── Main content ── */}
      <main className="relative z-10 px-6 py-10 sm:px-10 lg:px-16">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#2E323A]">
            Your Top Matches
          </h1>
          {target && (
            <p className="mt-1 text-sm text-[#858B96]">
              Showing the best chat partners for{' '}
              <span className="font-semibold text-[#2E323A]">{target}</span>
            </p>
          )}
        </div>

        {/* loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-24">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#E8F6FF] border-t-[#74B8F3]" />
            <p className="text-sm text-[#858B96]">Finding your matches…</p>
          </div>
        )}

        {/* error */}
        {!loading && error && (
          <div className="mx-auto max-w-lg rounded-xl border border-[#E38181] bg-[#FFF3F3] px-6 py-4 text-center text-sm text-[#B65A5A]">
            {error}
          </div>
        )}

        {/* empty */}
        {!loading && !error && matches.length === 0 && (
          <p className="py-16 text-center text-sm text-[#858B96]">
            No matches found yet. Check back once more members have joined!
          </p>
        )}

        {/* match rows */}
        {!loading && !error && matches.length > 0 && (
          <div className="flex flex-col gap-5">
            {matches.map((m, i) => {
              const fields = Object.entries(m).filter(
                ([k, v]) => !isHiddenField(k) && v != null && v !== '',
              );

              const personal = [];
              const membership = [];
              const other = [];

              for (const [key, val] of fields) {
                const lower = key.toLowerCase();
                if (['birthday', 'phone', 'cell', 'mobile', 'email', 'major', 'minor', 'year', 'class'].some(p => lower.includes(p))) {
                  personal.push([key, val]);
                } else if (['active', 'graduated', 'alumni', 'joined', 'role', 'chapter'].some(p => lower.includes(p))) {
                  membership.push([key, val]);
                } else {
                  other.push([key, val]);
                }
              }

              const instagram = findField(m, 'instagram');
              const linkedin = findField(m, 'linkedin');

              return (
                <article
                  key={m.name}
                  className="card-animate-in w-full overflow-hidden rounded-xl border border-[#E8EDF3] bg-white shadow-[0_12px_40px_rgba(15,38,72,0.08)] transition-all duration-200 hover:scale-[1.015] hover:border-[#9BCFFF] hover:shadow-[0_16px_48px_rgba(15,38,72,0.12)]"
                  style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* left: photo placeholder with name + socials overlaid */}
                    <div className="relative flex h-56 w-full shrink-0 items-center justify-center bg-[#F0F8FF] sm:h-auto sm:min-h-[220px] sm:w-52">
                      <div className="flex flex-col items-center gap-2 text-[#C8D5E0]">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
                        </svg>
                      </div>

                      {/* name + social icons overlay */}
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 px-4 pb-4">
                        <p className="text-base font-bold leading-tight text-[#2E323A]">{m.name}</p>
                        <div className="flex items-center gap-1.5">
                          {instagram && (
                            <a
                              href={instagram.startsWith('http') ? instagram : `https://instagram.com/${instagram.replace(/^@/, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white transition-transform duration-150 hover:scale-110"
                              title="Instagram"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                              </svg>
                            </a>
                          )}
                          {linkedin && (
                            <a
                              href={linkedin.startsWith('http') ? linkedin : `https://linkedin.com/in/${linkedin}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0A66C2] text-white transition-transform duration-150 hover:scale-110"
                              title="LinkedIn"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* right: organized details */}
                    <div className="flex min-w-0 flex-1 flex-col gap-5 p-6 sm:p-8">
                      {personal.length > 0 && (
                        <FieldGroup title="Personal">
                          {personal.map(([key, val]) => (
                            <FieldCell key={key} rawKey={key} label={formatFieldLabel(key)} value={val} />
                          ))}
                        </FieldGroup>
                      )}
                      {membership.length > 0 && (
                        <FieldGroup title="Membership">
                          {membership.map(([key, val]) => (
                            <FieldCell key={key} rawKey={key} label={formatFieldLabel(key)} value={val} />
                          ))}
                        </FieldGroup>
                      )}
                      {other.length > 0 && (
                        <FieldGroup title="About">
                          {other.map(([key, val]) => (
                            <FieldCell key={key} rawKey={key} label={formatFieldLabel(key)} value={val} />
                          ))}
                        </FieldGroup>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
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

function FieldGroup({ title, children }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#BDE3FF]">{title}</p>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {children}
      </div>
    </div>
  );
}
