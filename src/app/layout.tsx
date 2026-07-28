import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KPIvantra",
  description: "Upload your game analytics CSVs and get an instant KPI report",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-50">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-blue-600 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to main content
        </a>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-3 sm:px-6">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-sm"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M4 19V11M10 19V5M16 19v-8M21 19H3" />
              </svg>
            </span>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-slate-900">KPIvantra</h1>
              <p className="text-xs text-slate-500">
                Upload your analytics CSVs, get an instant KPI report
              </p>
            </div>
          </div>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-slate-500 sm:px-6">
            <span className="font-medium text-slate-600">KPIvantra</span>
            <span>
              Developed by <span className="font-medium text-slate-700">Aqua Games</span>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
