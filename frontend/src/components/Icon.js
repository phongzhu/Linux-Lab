const paths = {
  terminal: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3m6 0h4"/></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10h18"/></>,
  file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6m-6 3h6"/></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 1 4 16.5z"/><path d="M4 16.5A2.5 2.5 0 0 1 6.5 14H20M8 7h8M8 10h6"/></>,
  bolt: <path d="m13 2-3 8h7l-6 12 2-9H6z"/>,
  flame: <path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-2-1-3-3-3-5-3 3-5 6-5 9a8 8 0 0 0 8 7Z"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  reset: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
  bookOpen: <><path d="M12 7v14m0-14C9 4 4 4 3 5v13c3-1 6-1 9 2m0-13c3-3 8-3 9-2v13c-3-1-6-1-9 2"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
  printer: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6zM18 12h.01"/></>,
};

export default function Icon({ name, size = 20 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
