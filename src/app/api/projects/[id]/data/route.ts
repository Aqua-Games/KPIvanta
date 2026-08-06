import { getProjectData, saveProjectData } from "@/lib/server/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return Response.json(await getProjectData(id));
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.records)) {
    return Response.json({ error: "records array is required" }, { status: 400 });
  }
  const saved = await saveProjectData(id, {
    records: body.records,
    files: Array.isArray(body.files) ? body.files : [],
    issues: Array.isArray(body.issues) ? body.issues : [],
    weeklySpend: body.weeklySpend && typeof body.weeklySpend === "object" ? body.weeklySpend : {},
  });
  return Response.json(saved);
}
