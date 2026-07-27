"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useData } from "@/store/useData";
import { countBySeverity } from "@/lib/validation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/weekly", label: "Weekly Report" },
  { href: "/builds", label: "Build Comparison" },
  { href: "/historical", label: "Historical" },
  { href: "/monetization", label: "Monetization" },
  { href: "/import", label: "Data Import" },
  { href: "/data-quality", label: "Data Quality" },
];

export function Nav() {
  const pathname = usePathname();
  const { issues, hydrated } = useData();
  const counts = countBySeverity(issues);

  return (
    <nav aria-label="Primary" className="border-b border-slate-200 bg-white">
      <ul className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 sm:px-6">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          const showBadge = hydrated && link.href === "/data-quality" && counts.error > 0;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                )}
              >
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
