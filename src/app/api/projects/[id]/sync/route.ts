import { fetchGa4Records, Ga4ConfigError, ga4Configured } from "@/lib/connectors/ga4";
import { getProject, getProjectData, saveProjectData, updateProject } from "@/lib/server/storage";
import { deduplicateAudience, mergeRecords } from "@/lib/merge";
import { validateDatabase } from "@/lib/validation";

/** Reports whether credentials are present, so the UI can guide setup. */
export async function GET() {
  return Response.json({ configured: ga4Configured() });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const propertyId = String(body.propertyId ?? project.ga4PropertyId ?? "").trim();
  const startDate = String(body.startDate ?? "").trim();
  const endDate = String(body.endDate ?? "").trim();

  if (!propertyId) {
    return Response.json({ error: "A GA4 property ID is required." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return Response.json({ error: "A start and end date are required." }, { status: 400 });
  }

  try {
    const { records: fresh, notes } = await fetchGa4Records({
      propertyId,
      startDate,
      endDate,
      game: project.appName ?? project.name,
      currency: project.currency,
    });

    const existing = await getProjectData(id);
    // A re-sync of the same range replaces its own rows rather than stacking.
    const kept = existing.records.filter((r) => r.uploadId !== `ga4-${propertyId}` || !r.date || r.date < startDate || r.date > endDate);

    const deduped = deduplicateAudience([...kept, ...fresh]);
    const merged = mergeRecords(deduped.records);

    const syncNote = {
      id: `ga4-sync-${Date.now()}`,
      severity: "info" as const,
      category: "Firebase sync",
      description: `Pulled ${fresh.length} rows from GA4 property ${propertyId} for ${startDate} – ${endDate}.`,
      resolution: "Re-syncing the same range replaces these rows rather than adding to them.",
      sourceFile: "Firebase Analytics",
    };

    const issues = [
      ...existing.issues.filter((i) => i.category !== "Firebase sync"),
      syncNote,
      ...notes.map((note, index) => ({
        id: `ga4-note-${index}`,
        severity: "warning" as const,
        category: "Firebase sync",
        description: note,
        resolution: "",
        sourceFile: "Firebase Analytics",
      })),
      ...deduped.conflicts,
      ...merged.conflicts,
      ...validateDatabase(merged.records, []),
    ];

    const files = existing.files.some((f) => f.id === `ga4-${propertyId}`)
      ? existing.files
      : [
          ...existing.files,
          {
            id: `ga4-${propertyId}`,
            name: `Firebase Analytics (property ${propertyId})`,
            size: 0,
            source: "firebase" as const,
            reportKind: "long_format" as const,
            uploadedAt: new Date().toISOString(),
            recordCount: fresh.length,
          },
        ];

    const saved = await saveProjectData(id, {
      records: merged.records,
      files,
      issues,
      weeklySpend: existing.weeklySpend,
    });
    await updateProject(id, { ga4PropertyId: propertyId });

    return Response.json({ ...saved, pulled: fresh.length, notes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The sync failed.";
    return Response.json(
      { error: message, needsSetup: error instanceof Ga4ConfigError },
      { status: error instanceof Ga4ConfigError ? 400 : 502 }
    );
  }
}
