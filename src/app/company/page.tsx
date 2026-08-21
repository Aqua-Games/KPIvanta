"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, Company, Project, ProjectPlatform } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { formatDate } from "@/lib/format";

const PLATFORMS: ProjectPlatform[] = ["Android", "iOS", "Android + iOS", "Other"];
const CURRENCIES = ["GBP", "USD", "EUR"];

export default function CompanyPageRoute() {
  // useSearchParams needs a Suspense boundary when the page is prerendered.
  return (
    <Suspense fallback={<LoadingState label="Loading projects…" />}>
      <CompanyPage />
    </Suspense>
  );
}

function CompanyPage() {
  const companyId = useSearchParams().get("id") ?? "";
  const router = useRouter();

  const [company, setCompany] = useState<Company | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<ProjectPlatform>("Android");
  const [currency, setCurrency] = useState("GBP");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.getCompany(companyId), api.listProjects(companyId)])
      .then(([c, p]) => {
        setCompany(c);
        setProjects(p);
      })
      .catch((e) => setError(e.message));
  }, [companyId]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const project = await api.createProject({ companyId, name, platform, currency });
      router.push(`/project?id=${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the project.");
      setBusy(false);
    }
  };

  if (error && !company) return <ErrorState title="Could not load this company" description={error} />;
  if (!company || projects === null) return <LoadingState label="Loading projects…" />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="pt-4">
        <Link href="/" className="text-xs font-medium text-blue-700 hover:underline">
          ← All companies
        </Link>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{company.name}</h2>
        <p className="mt-1 text-sm text-slate-500">
          A project is one game. Create one, then upload its weekly KPI sheets.
        </p>
      </div>

      <Card title="Create a project">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="project-name" className="block text-xs font-medium text-slate-600">
              Project name
            </label>
            <input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Arrows: Brain Puzzle Escape"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="project-platform" className="block text-xs font-medium text-slate-600">
              Platform
            </label>
            <select
              id="project-platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as ProjectPlatform)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="project-currency" className="block text-xs font-medium text-slate-600">
              Currency
            </label>
            <select
              id="project-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={create}
            disabled={busy || !name.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Create
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      </Card>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h3 className="text-sm font-semibold text-slate-900">No projects yet</h3>
          <p className="mt-1 text-sm text-slate-500">Create the first project above.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/project?id=${project.id}`}
              className="panel group flex flex-col p-4 transition-shadow hover:shadow-md"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold text-slate-900 group-hover:text-blue-700">
                  {project.name}
                </span>
                <span aria-hidden="true" className="text-slate-300 group-hover:text-blue-600">
                  →
                </span>
              </span>
              <span className="mt-1 text-xs text-slate-500">
                {project.platform} · {project.currency} · updated{" "}
                {formatDate(project.updatedAt.slice(0, 10))}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
