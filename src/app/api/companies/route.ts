import { createCompany, listCompanies } from "@/lib/server/storage";

export async function GET() {
  return Response.json(await listCompanies());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return Response.json({ error: "A company name is required." }, { status: 400 });
  return Response.json(await createCompany(name), { status: 201 });
}
