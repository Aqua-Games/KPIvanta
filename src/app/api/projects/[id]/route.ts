import { deleteProject, getProject, updateProject } from "@/lib/server/storage";
import { WEEK_STARTS } from "@/lib/week";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(project);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.weekStart !== undefined && !WEEK_STARTS.includes(body.weekStart)) {
    return Response.json({ error: "Unknown week start day." }, { status: 400 });
  }
  const project = await updateProject(id, body);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(project);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteProject(id);
  return new Response(null, { status: 204 });
}
