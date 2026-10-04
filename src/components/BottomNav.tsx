import type { ReactNode } from "react";

const icons: Record<string, ReactNode> = {
  home: <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  members: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2.1.7 3.5 2.6 3.5 5.6" />
    </>
  ),
  attendance: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M8 12.5l3 3 5-6" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  instruments: (
    <>
      <ellipse cx="12" cy="8" rx="8" ry="3" />
      <path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8" />
    </>
  ),
};

const menus = [
  ["home", "Home"],
  ["members", "Anggota"],
  ["attendance", "Absensi"],
  ["instruments", "Alat"],
  ["settings", "Pengaturan"],
] as const;

export default function BottomNav({
  page,
  setPage,
}: {
  page: string;
  setPage: (x: string) => void;
}) {
  return (
    <nav className="nav" aria-label="Navigasi utama">
      <div className="nav-inner">
        {menus.map(([key, label]) => (
          <button
            key={key}
            className={"nav-item" + (page === key ? " active" : "")}
            aria-current={page === key ? "page" : undefined}
            onClick={() => setPage(key)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {icons[key]}
            </svg>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
