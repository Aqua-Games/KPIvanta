"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Company, Project } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { formatDate } from "@/lib/format";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.listCompanies(), api.listProjects()])
      .then(([c, p]) => {
        setCompanies(c);
        setProjects(p);
      })
      .catch((e) => setError(e.message));
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const company = await api.createCompany(name);
      setCompanies((list) => [...(list ?? []), company]);
      setName("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the company.");
    } finally {
      setBusy(false);
    }
  };

  if (error && companies === null) {
    return <ErrorState title="Could not load your workspace" description={error} />;
  }
  if (companies === null) return <LoadingState label="Loading companies…" />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="pt-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Companies</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick a company to open its projects, or add a new one. Everything is stored on this
          machine under the project&apos;s <code className="text-xs">data/</code> folder.
        </p>
      </div>

      <Card title="Add a company">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label htmlFor="company-name" className="block text-xs font-medium text-slate-600">
              Company name
            </label>
            <input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Aqua Games"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={add}
            disabled={busy || !name.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add company
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      </Card>

      {companies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h3 className="text-sm font-semibold text-slate-900">No companies yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Add your first company above to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {companies.map((company) => {
            const count = projects.filter((p) => p.companyId === company.id).length;
            return (
              <Link
                key={company.id}
                href={`/companies/${company.id}`}
                className="panel group flex flex-col p-4 transition-shadow hover:shadow-md"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-base font-semibold text-slate-900 group-hover:text-blue-700">
                    {company.name}
                  </span>
                  <span aria-hidden="true" className="text-slate-300 group-hover:text-blue-600">
                    →
                  </span>
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  {count} project{count === 1 ? "" : "s"} · added{" "}
                  {formatDate(company.createdAt.slice(0, 10))}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
