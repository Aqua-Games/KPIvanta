import { deleteCompany, getCompany } from "@/lib/server/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(company);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteCompany(id);
  return new Response(null, { status: 204 });
}
