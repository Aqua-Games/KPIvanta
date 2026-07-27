"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/acquisition", label: "Acquisition" },
  { href: "/monetization", label: "Monetization" },
  { href: "/versions", label: "Version Analysis" },
  { href: "/data-quality", label: "Data Quality" },
  { href: "/import", label: "Data Import" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="border-b border-slate-200 bg-white">
      <ul className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 sm:px-6">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "inline-block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
