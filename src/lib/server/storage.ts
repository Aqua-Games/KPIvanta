import { promises as fs } from "fs";
import path from "path";
import { KpiRecord, UploadedFile, ValidationIssue } from "../types";

/**
 * File-backed persistence. Everything lives under `data/` in the project root
 * as plain JSON, so the whole workspace can be inspected, copied or wiped by
 * hand. Swapping this module for Firebase later means reimplementing these
 * functions — nothing above this layer touches the filesystem.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const COMPANIES_FILE = path.join(DATA_DIR, "companies.json");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const REPORTS_DIR = path.join(DATA_DIR, "reports");

export interface Company {
  id: string;
  name: string;
  createdAt: string;
}

export type ProjectPlatform = "Android" | "iOS" | "Android + iOS" | "Other";

export interface Project {
  id: string;
  companyId: string;
  name: string;
  platform: ProjectPlatform;
  /** Which app name inside the uploaded files this project tracks. */
  appName?: string;
  /** GA4 / Firebase Analytics property this project pulls from. */
  ga4PropertyId?: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

/** Everything a project's report is built from. Replaced wholesale on save. */
export interface ProjectData {
  projectId: string;
  records: KpiRecord[];
  files: Pick<UploadedFile, "id" | "name" | "size" | "source" | "reportKind" | "uploadedAt" | "recordCount">[];
  issues: ValidationIssue[];
  /** Manually entered spend per ISO week, e.g. { "2026-W30": 1250 }. */
  weeklySpend: Record<string, number>;
  updatedAt: string;
}

async function ensureDirs() {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** Write via a temp file then rename, so a crash cannot truncate the store. */
async function writeJson(file: string, value: unknown) {
  await ensureDirs();
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(temp, file);
}

/** Path segments come from URLs, so reject anything that is not a plain id. */
function assertSafeId(id: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error("Invalid id");
}

/* ------------------------------------------------------------------ */
/* Companies                                                           */
/* ------------------------------------------------------------------ */

export async function listCompanies(): Promise<Company[]> {
  return readJson<Company[]>(COMPANIES_FILE, []);
}

export async function createCompany(name: string): Promise<Company> {
  const companies = await listCompanies();
  const company: Company = {
    id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
  await writeJson(COMPANIES_FILE, [...companies, company]);
  return company;
}

export async function getCompany(id: string): Promise<Company | undefined> {
  return (await listCompanies()).find((c) => c.id === id);
}

export async function deleteCompany(id: string) {
  assertSafeId(id);
  const companies = await listCompanies();
  await writeJson(
    COMPANIES_FILE,
    companies.filter((c) => c.id !== id)
  );
  for (const project of await listProjects(id)) {
    await deleteProject(project.id);
  }
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export async function listProjects(companyId?: string): Promise<Project[]> {
  await ensureDirs();
  const names = await fs.readdir(PROJECTS_DIR).catch(() => [] as string[]);
  const projects: Project[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const project = await readJson<Project | null>(path.join(PROJECTS_DIR, name), null);
    if (project && (!companyId || project.companyId === companyId)) projects.push(project);
  }
  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string): Promise<Project | undefined> {
  assertSafeId(id);
  return (await readJson<Project | null>(path.join(PROJECTS_DIR, `${id}.json`), null)) ?? undefined;
}

export async function createProject(input: {
  companyId: string;
  name: string;
  platform: ProjectPlatform;
  currency?: string;
}): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    companyId: input.companyId,
    name: input.name.trim(),
    platform: input.platform,
    currency: input.currency ?? "GBP",
    createdAt: now,
    updatedAt: now,
  };
  await writeJson(path.join(PROJECTS_DIR, `${project.id}.json`), project);
  return project;
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<Project | undefined> {
  const existing = await getProject(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch, id: existing.id, updatedAt: new Date().toISOString() };
  await writeJson(path.join(PROJECTS_DIR, `${id}.json`), updated);
  return updated;
}

export async function deleteProject(id: string) {
  assertSafeId(id);
  await fs.rm(path.join(PROJECTS_DIR, `${id}.json`), { force: true });
  await fs.rm(path.join(REPORTS_DIR, `${id}.json`), { force: true });
}

/* ------------------------------------------------------------------ */
/* Project data                                                        */
/* ------------------------------------------------------------------ */

export async function getProjectData(projectId: string): Promise<ProjectData> {
  assertSafeId(projectId);
  return readJson<ProjectData>(path.join(REPORTS_DIR, `${projectId}.json`), {
    projectId,
    records: [],
    files: [],
    issues: [],
    weeklySpend: {},
    updatedAt: new Date(0).toISOString(),
  });
}

export async function saveProjectData(
  projectId: string,
  data: Omit<ProjectData, "projectId" | "updatedAt">
): Promise<ProjectData> {
  assertSafeId(projectId);
  const saved: ProjectData = { ...data, projectId, updatedAt: new Date().toISOString() };
  await writeJson(path.join(REPORTS_DIR, `${projectId}.json`), saved);
  await updateProject(projectId, {});
  return saved;
}
