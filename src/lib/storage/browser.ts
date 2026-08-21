"use client";

import { Company, Project, ProjectData, ProjectPlatform } from "../server/storage";

/**
 * Browser-backed workspace, used when the app is served as a static site
 * (GitHub Pages) and there is no server to write files. Same shapes and same
 * calls as the API client, so nothing above this layer knows the difference.
 *
 * The trade-off is honest and worth stating in the UI: data lives in this
 * browser only. It is not shared between people or devices.
 */

const KEY = "kpivantra";

interface Store {
  companies: Company[];
  projects: Project[];
  data: Record<string, ProjectData>;
}

function read(): Store {
  if (typeof window === "undefined") return { companies: [], projects: [], data: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { companies: [], projects: [], data: {} };
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      companies: parsed.companies ?? [],
      projects: parsed.projects ?? [],
      data: parsed.data ?? {},
    };
  } catch {
    return { companies: [], projects: [], data: {} };
  }
}

function write(store: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch (error) {
    // Quota is the realistic failure here, and silently losing an import would
    // be worse than saying so.
    throw new Error(
      error instanceof Error && error.name === "QuotaExceededError"
        ? "This browser's storage is full. Remove a project, or export the data and clear it."
        : "Could not save to this browser's storage."
    );
  }
}

const id = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const browserStore = {
  async listCompanies(): Promise<Company[]> {
    return read().companies;
  },

  async createCompany(name: string): Promise<Company> {
    const store = read();
    const company: Company = {
      id: id("c"),
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    store.companies.push(company);
    write(store);
    return company;
  },

  async getCompany(companyId: string): Promise<Company> {
    const company = read().companies.find((c) => c.id === companyId);
    if (!company) throw new Error("Company not found");
    return company;
  },

  async deleteCompany(companyId: string): Promise<void> {
    const store = read();
    store.companies = store.companies.filter((c) => c.id !== companyId);
    for (const project of store.projects.filter((p) => p.companyId === companyId)) {
      delete store.data[project.id];
    }
    store.projects = store.projects.filter((p) => p.companyId !== companyId);
    write(store);
  },

  async listProjects(companyId?: string): Promise<Project[]> {
    const projects = read().projects;
    return (companyId ? projects.filter((p) => p.companyId === companyId) : projects).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  },

  async createProject(input: {
    companyId: string;
    name: string;
    platform: ProjectPlatform;
    currency?: string;
  }): Promise<Project> {
    const store = read();
    const now = new Date().toISOString();
    const project: Project = {
      id: id("p"),
      companyId: input.companyId,
      name: input.name.trim(),
      platform: input.platform,
      currency: input.currency ?? "GBP",
      createdAt: now,
      updatedAt: now,
    };
    store.projects.push(project);
    write(store);
    return project;
  },

  async getProject(projectId: string): Promise<Project> {
    const project = read().projects.find((p) => p.id === projectId);
    if (!project) throw new Error("Project not found");
    return project;
  },

  async updateProject(projectId: string, patch: Partial<Project>): Promise<Project> {
    const store = read();
    const index = store.projects.findIndex((p) => p.id === projectId);
    if (index === -1) throw new Error("Project not found");
    store.projects[index] = {
      ...store.projects[index],
      ...patch,
      id: projectId,
      updatedAt: new Date().toISOString(),
    };
    write(store);
    return store.projects[index];
  },

  async deleteProject(projectId: string): Promise<void> {
    const store = read();
    store.projects = store.projects.filter((p) => p.id !== projectId);
    delete store.data[projectId];
    write(store);
  },

  async getProjectData(projectId: string): Promise<ProjectData> {
    return (
      read().data[projectId] ?? {
        projectId,
        records: [],
        files: [],
        issues: [],
        weeklySpend: {},
        updatedAt: new Date(0).toISOString(),
      }
    );
  },

  async saveProjectData(
    projectId: string,
    data: Omit<ProjectData, "projectId" | "updatedAt">
  ): Promise<ProjectData> {
    const store = read();
    const saved: ProjectData = { ...data, projectId, updatedAt: new Date().toISOString() };
    store.data[projectId] = saved;
    const index = store.projects.findIndex((p) => p.id === projectId);
    if (index !== -1) store.projects[index].updatedAt = saved.updatedAt;
    write(store);
    return saved;
  },
};
