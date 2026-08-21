"use client";

import { Company, Project, ProjectData, ProjectPlatform } from "./server/storage";
import { browserStore } from "./storage/browser";

export type { Company, Project, ProjectData, ProjectPlatform };

/**
 * Two deployment modes share one interface.
 *
 * Run locally and the workspace is written to the `data/` folder through the
 * API routes. Served as a static site (GitHub Pages) there is no server, so it
 * falls back to this browser's storage.
 */
export const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

/** Prefix for anything fetched from `public/`, which GitHub Pages serves under a sub-path. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

const serverApi = {
  listCompanies: () => request<Company[]>("/api/companies"),
  createCompany: (name: string) =>
    request<Company>("/api/companies", { method: "POST", body: JSON.stringify({ name }) }),
  deleteCompany: (id: string) => request<void>(`/api/companies/${id}`, { method: "DELETE" }),
  getCompany: (id: string) => request<Company>(`/api/companies/${id}`),

  listProjects: (companyId?: string) =>
    request<Project[]>(`/api/projects${companyId ? `?companyId=${companyId}` : ""}`),
  createProject: (input: {
    companyId: string;
    name: string;
    platform: ProjectPlatform;
    currency?: string;
  }) => request<Project>("/api/projects", { method: "POST", body: JSON.stringify(input) }),
  getProject: (id: string) => request<Project>(`/api/projects/${id}`),
  updateProject: (id: string, patch: Partial<Project>) =>
    request<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),

  getProjectData: (id: string) => request<ProjectData>(`/api/projects/${id}/data`),
  saveProjectData: (id: string, data: Omit<ProjectData, "projectId" | "updatedAt">) =>
    request<ProjectData>(`/api/projects/${id}/data`, { method: "PUT", body: JSON.stringify(data) }),
};

export const api = IS_STATIC ? browserStore : serverApi;
