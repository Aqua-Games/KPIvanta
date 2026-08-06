"use client";

import { Company, Project, ProjectData, ProjectPlatform } from "./server/storage";

export type { Company, Project, ProjectData, ProjectPlatform };

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

export const api = {
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
