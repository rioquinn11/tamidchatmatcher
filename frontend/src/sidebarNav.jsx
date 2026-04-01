export function sidebarLinkClass({ isActive }) {
  return [
    'flex w-full items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
    isActive
      ? 'bg-[#F0F8FF] font-semibold text-[#4C9BEA]'
      : 'font-medium text-[#656D79] hover:bg-[#F2F4F8]',
  ].join(' ');
}

const VALID_TABS = new Set(['matches', 'not_interested', 'pending', 'completed']);

/** Resolve `?tab=` from `/matches` for sidebar + main panel. */
export function tabFromSearchParam(value) {
  if (value && VALID_TABS.has(value)) return value;
  return 'matches';
}

export const SIDEBAR_TABS = [
  {
    id: 'matches',
    label: 'Matches',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'not_interested',
    label: 'Not Interested',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="m4.93 4.93 14.14 14.14" />
      </svg>
    ),
  },
  {
    id: 'pending',
    label: 'Pending',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: 'completed',
    label: 'Completed',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
];
