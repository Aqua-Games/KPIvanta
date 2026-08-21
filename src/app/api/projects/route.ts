import { createProject, listProjects, ProjectPlatform } from "@/lib/server/storage";

const PLATFORMS: ProjectPlatform[] = ["Android", "iOS", "Android + iOS", "Other"];

export async function GET(request: Request) {
  const companyId = new URL(request.url).searchParams.get("companyId") ?? undefined;
  return Response.json(await listProjects(companyId ?? undefined));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const companyId = typeof body.companyId === "string" ? body.companyId : "";
  const platform = PLATFORMS.includes(body.platform) ? (body.platform as ProjectPlatform) : "Android";
  if (!name || !companyId) {
    return Response.json({ error: "A company and a project name are required." }, { status: 400 });
  }
  const weekStart = body.weekStart === "monday" ? "monday" : "sunday";
  return Response.json(
    await createProject({ companyId, name, platform, currency: body.currency, weekStart }),
    { status: 201 }
  );
}
