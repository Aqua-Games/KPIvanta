"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useData } from "@/store/useData";
import { countBySeverity } from "@/lib/validation";

const LINKS: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: "/", label: "Home", icon: <IconHome /> },
  { href: "/weekly", label: "Weekly Report", icon: <IconCalendar /> },
  { href: "/builds", label: "Build Comparison", icon: <IconCompare /> },
  { href: "/historical", label: "Historical Comparison", icon: <IconClock /> },
  { href: "/monetization", label: "Monetization", icon: <IconCoin /> },
  { href: "/import", label: "Data Import", icon: <IconUpload /> },
  { href: "/data-quality", label: "Data Quality", icon: <IconShield /> },
];

export function Nav() {
  const pathname = usePathname();
  const { issues, hydrated } = useData();
  const counts = countBySeverity(issues);

  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur no-print"
    >
      <ul className="mx-auto flex max-w-[1600px] gap-0.5 overflow-x-auto px-4 sm:px-6">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          const showBadge = hydrated && link.href === "/data-quality" && counts.error > 0;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
                  active
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                )}
              >
                <span
                  aria-hidden="true"
                  className={clsx("transition-colors", active ? "text-blue-600" : "text-slate-400")}
                >
                  {link.icon}
                </span>
                {link.label}
                {showBadge && (
                  <span className="rounded-full bg-red-100 px-1.5 text-[11px] font-semibold text-red-700">
                    {counts.error}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* 14px stroke icons, inherit currentColor. */
function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function IconHome() {
  return (
    <IconBase>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </IconBase>
  );
}
function IconCalendar() {
  return (
    <IconBase>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </IconBase>
  );
}
function IconCompare() {
  return (
    <IconBase>
      <path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" />
      <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
      <path d="M12 1v22" />
    </IconBase>
  );
}
function IconClock() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </IconBase>
  );
}
function IconCoin() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.2a3 3 0 0 0-2.5-1.2c-1.7 0-3 1-3 2.2s1.3 1.8 3 2c1.7.2 3 .8 3 2s-1.3 2.2-3 2.2a3 3 0 0 1-2.5-1.2M12 6v2m0 8v2" />
    </IconBase>
  );
}
function IconUpload() {
  return (
    <IconBase>
      <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </IconBase>
  );
}
function IconShield() {
  return (
    <IconBase>
      <path d="M12 3 4.5 6v5c0 4.5 3 8.2 7.5 10 4.5-1.8 7.5-5.5 7.5-10V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </IconBase>
  );
}
