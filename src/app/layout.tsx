import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Nav } from "@/components/layout/Nav";
import { FilterBar } from "@/components/layout/FilterBar";

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
  description:
    "KPI reporting, build comparison and historical trends for mobile games",
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
        <Header />
        <Nav />
        <FilterBar />
        <main id="main-content" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-slate-500 sm:px-6">
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
