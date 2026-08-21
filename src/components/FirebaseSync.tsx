"use client";

import { useEffect, useState } from "react";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { addDays } from "@/lib/week";
import { IS_STATIC } from "@/lib/api";

/**
 * Pulls DAU, playtime, retention and revenue straight from Firebase Analytics
 * (GA4) instead of a CSV. Credentials live on the server only — this panel
 * never sees the service-account key.
 */
export function FirebaseSync({
  projectId,
  initialPropertyId,
  onSynced,
}: {
  projectId: string;
  initialPropertyId?: string;
  onSynced: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  // A static build has no API routes to ask, so it is known up front.
  const [probed, setProbed] = useState<boolean | null>(null);
  const configured = IS_STATIC ? false : probed;
  const [propertyId, setPropertyId] = useState(initialPropertyId ?? "");
  const [startDate, setStartDate] = useState(addDays(today, -27));
  const [endDate, setEndDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (IS_STATIC) return;
    let cancelled = false;
    fetch(`/api/projects/${projectId}/sync`)
      .then((r) => r.json())
      .then((d) => !cancelled && setProbed(Boolean(d.configured)))
      .catch(() => !cancelled && setProbed(false));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const sync = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, startDate, endDate }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The sync failed.");
      setResult(
        `Pulled ${data.pulled} rows.${data.notes?.length ? ` ${data.notes.join(" ")}` : ""}`
      );
      onSynced();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The sync failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Firebase Analytics"
      question="Pull KPIs straight from GA4 instead of uploading sheets"
      tooltip="Firebase Analytics and GA4 are the same property, so the free Analytics Data API covers it — no BigQuery export and no billing account. Retention comes from GA4's cohort report, which reports the cohort size, so it is weighted per user rather than per day."
      actions={
        configured === null ? null : configured ? (
          <Badge tone="positive">Credentials found</Badge>
        ) : (
          <Badge tone="warning">Setup needed</Badge>
        )
      }
    >
      {configured === false && (
        <div className="mb-3 rounded-md bg-amber-50 px-3 py-3 text-xs text-amber-900 ring-1 ring-inset ring-amber-600/20">
          <p className="font-semibold">One-time setup (free, no billing account)</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4">
            <li>
              In Google Cloud, enable the <strong>Google Analytics Data API</strong> for the project
              behind your Firebase app.
            </li>
            <li>Create a service account and download its JSON key.</li>
            <li>
              In GA4 → Admin → Property Access Management, add the service-account email as a{" "}
              <strong>Viewer</strong>.
            </li>
            <li>
              Put the key in <code>.env.local</code> as{" "}
              <code>GA4_SERVICE_ACCOUNT_JSON=&#123;…&#125;</code> (the whole file on one line), then
              restart the dev server.
            </li>
            <li>
              Find the property ID in GA4 → Admin → Property Settings. It is a number such as{" "}
              <code>343318</code>.
            </li>
          </ol>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="ga4-property" className="block text-xs font-medium text-slate-600">
            GA4 property ID
          </label>
          <input
            id="ga4-property"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            placeholder="343318"
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="ga4-start" className="block text-xs font-medium text-slate-600">
            From
          </label>
          <input
            id="ga4-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="ga4-end" className="block text-xs font-medium text-slate-600">
            To
          </label>
          <input
            id="ga4-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={sync}
          disabled={busy || !propertyId.trim() || configured === false}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Syncing…" : "Sync"}
        </button>
      </div>

      {result && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900 ring-1 ring-inset ring-emerald-600/20">
          {result}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 ring-1 ring-inset ring-red-600/20">
          {error}
        </p>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Re-syncing the same dates replaces those rows rather than adding to them. Spend never comes
        from Firebase — keep entering it per week, or upload a Google Ads export.
      </p>
    </Card>
  );
}
