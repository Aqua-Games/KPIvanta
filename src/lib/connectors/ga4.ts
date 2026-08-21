import { KpiRecord } from "../types";
import { isoWeekKey } from "../week";

/**
 * Firebase Analytics / GA4 connector.
 *
 * Firebase Analytics and GA4 are the same property, so the free Analytics Data
 * API is the whole integration — no BigQuery export and no billing account.
 * Everything here produces the same `KpiRecord` shape the CSV parser produces,
 * so a live pull and an uploaded sheet merge through exactly the same path.
 */

const API = "https://analyticsdata.googleapis.com/v1beta";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

export class Ga4ConfigError extends Error {}

/**
 * Only the two calls this connector makes are typed, so the optional dependency
 * is not referenced at compile time and a checkout without it still builds.
 */
interface AuthClient {
  getClient(): Promise<{ getAccessToken(): Promise<{ token?: string | null }> }>;
}
type AuthConstructor = new (options: {
  credentials?: Record<string, unknown>;
  scopes: string[];
}) => AuthClient;

/**
 * Resolved through a variable so the bundler cannot follow it. The package is
 * optional: without it the sync reports that setup is needed, and the rest of
 * the app builds and runs untouched.
 */
async function loadGoogleAuth(): Promise<AuthConstructor> {
  const specifier = "google-auth-library";
  try {
    const library = (await import(/* webpackIgnore: true */ specifier)) as {
      GoogleAuth: AuthConstructor;
    };
    return library.GoogleAuth;
  } catch {
    throw new Ga4ConfigError(
      "The google-auth-library package is not installed. Run `npm install` in this checkout to enable the Firebase Analytics sync."
    );
  }
}

/**
 * Credentials come from the environment, never from the browser:
 * `GA4_SERVICE_ACCOUNT_JSON` (the key file's contents) or
 * `GOOGLE_APPLICATION_CREDENTIALS` (a path to it).
 */
async function authClient(): Promise<AuthClient> {
  const GoogleAuthClass = await loadGoogleAuth();
  const inline = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (inline) {
    let credentials;
    try {
      credentials = JSON.parse(inline);
    } catch {
      throw new Ga4ConfigError("GA4_SERVICE_ACCOUNT_JSON is not valid JSON.");
    }
    return new GoogleAuthClass({ credentials, scopes: [SCOPE] });
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new GoogleAuthClass({ scopes: [SCOPE] });
  }
  throw new Ga4ConfigError(
    "No Google credentials found. Set GA4_SERVICE_ACCOUNT_JSON (the service-account key contents) or GOOGLE_APPLICATION_CREDENTIALS (a path to the key file) in .env.local."
  );
}

interface ReportRow {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
}

interface ReportResponse {
  rows?: ReportRow[];
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string }[];
  error?: { message?: string };
}

async function runReport(propertyId: string, body: unknown): Promise<ReportResponse> {
  const auth = await authClient();
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const id = propertyId.replace(/^properties\//, "");

  const response = await fetch(`${API}/properties/${id}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await response.json()) as ReportResponse;
  if (!response.ok) {
    throw new Error(json.error?.message ?? `GA4 request failed (${response.status})`);
  }
  return json;
}

const number = (value: string | undefined): number | undefined => {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** GA4 returns dates as yyyyMMdd. */
const isoDate = (value: string): string =>
  /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;

/* ------------------------------------------------------------------ */
/* Core report: engagement and revenue by date, build and country      */
/* ------------------------------------------------------------------ */

const CORE_METRICS = [
  "activeUsers",
  "newUsers",
  "sessions",
  "userEngagementDuration",
  "purchaseRevenue",
];

/** Requested separately: a property without AdMob linked rejects these outright. */
const AD_METRICS = ["totalAdRevenue", "publisherAdImpressions", "publisherAdClicks"];

async function coreReport(
  propertyId: string,
  startDate: string,
  endDate: string,
  metrics: string[]
): Promise<ReportResponse> {
  return runReport(propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }, { name: "appVersion" }, { name: "country" }],
    metrics: metrics.map((name) => ({ name })),
    limit: 100000,
  });
}

function rowsToMap(response: ReportResponse, metrics: string[]) {
  const map = new Map<string, Record<string, number | undefined>>();
  for (const row of response.rows ?? []) {
    const [date, appVersion, country] = (row.dimensionValues ?? []).map((d) => d.value ?? "");
    const key = `${date}|${appVersion}|${country}`;
    const values: Record<string, number | undefined> = {};
    metrics.forEach((metric, index) => {
      values[metric] = number(row.metricValues?.[index]?.value);
    });
    map.set(key, { ...(map.get(key) ?? {}), ...values });
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Cohort report: retention with real cohort sizes                     */
/* ------------------------------------------------------------------ */

/** GA4 caps how many cohorts one request may carry. */
const MAX_COHORTS = 12;

function datesBetween(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const cursor = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/**
 * One cohort per acquisition day. `cohortTotalUsers` is the denominator, so the
 * retention this produces is user-weighted rather than an average of daily rates.
 */
async function retentionRecords(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<Map<string, Record<string, number>>> {
  const byDate = new Map<string, Record<string, number>>();
  const days = datesBetween(startDate, endDate);

  for (let offset = 0; offset < days.length; offset += MAX_COHORTS) {
    const batch = days.slice(offset, offset + MAX_COHORTS);
    const response = await runReport(propertyId, {
      dimensions: [{ name: "cohort" }, { name: "cohortNthDay" }],
      metrics: [{ name: "cohortActiveUsers" }, { name: "cohortTotalUsers" }],
      cohortSpec: {
        cohorts: batch.map((date, index) => ({
          name: `cohort_${index}`,
          dimension: "firstSessionDate",
          dateRange: { startDate: date, endDate: date },
        })),
        cohortsRange: { granularity: "DAILY", startOffset: 0, endOffset: 7 },
      },
      limit: 100000,
    });

    for (const row of response.rows ?? []) {
      const [cohortName, nthDayRaw] = (row.dimensionValues ?? []).map((d) => d.value ?? "");
      const active = number(row.metricValues?.[0]?.value);
      const total = number(row.metricValues?.[1]?.value);
      const day = Number(nthDayRaw);
      if (!Number.isFinite(day) || day < 1 || day > 7) continue;
      if (active === undefined || total === undefined || total === 0) continue;

      const index = Number(cohortName.replace("cohort_", ""));
      const date = batch[index];
      if (!date) continue;

      const entry = byDate.get(date) ?? {};
      entry[`retentionD${day}`] = (active / total) * 100;
      entry.cohortSize = total;
      byDate.set(date, entry);
    }
  }

  return byDate;
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

export interface Ga4SyncResult {
  records: KpiRecord[];
  notes: string[];
}

export async function fetchGa4Records({
  propertyId,
  startDate,
  endDate,
  game,
  currency = "USD",
  includeRetention = true,
}: {
  propertyId: string;
  startDate: string;
  endDate: string;
  game?: string;
  currency?: string;
  includeRetention?: boolean;
}): Promise<Ga4SyncResult> {
  const notes: string[] = [];

  const core = await coreReport(propertyId, startDate, endDate, CORE_METRICS);
  const values = rowsToMap(core, CORE_METRICS);

  // Ad metrics exist only when AdMob is linked to the property; a property
  // without that link rejects the request rather than returning empty columns.
  let adMetrics: string[] = [];
  try {
    const ads = await coreReport(propertyId, startDate, endDate, AD_METRICS);
    adMetrics = AD_METRICS;
    for (const [key, metrics] of rowsToMap(ads, AD_METRICS)) {
      values.set(key, { ...(values.get(key) ?? {}), ...metrics });
    }
  } catch {
    notes.push(
      "Ad revenue is not available from this property — link AdMob to it in Firebase, or keep uploading the AdMob export."
    );
  }

  let retention = new Map<string, Record<string, number>>();
  if (includeRetention) {
    try {
      retention = await retentionRecords(propertyId, startDate, endDate);
    } catch (error) {
      notes.push(
        `Retention could not be read: ${error instanceof Error ? error.message : "unknown error"}. Engagement and revenue were still imported.`
      );
    }
  }

  const records: KpiRecord[] = [];
  for (const [key, metrics] of values) {
    const [rawDate, appVersion, country] = key.split("|");
    const date = isoDate(rawDate);
    const engagementSeconds = metrics.userEngagementDuration;
    const activeUsers = metrics.activeUsers;

    records.push({
      id: `ga4-${key}`,
      uploadId: `ga4-${propertyId}`,
      source: "firebase",
      date,
      week: isoWeekKey(date),
      game,
      build: appVersion && appVersion !== "(not set)" ? appVersion : undefined,
      country: country && country !== "(not set)" ? country : undefined,
      currency,
      dau: activeUsers,
      newUsers: metrics.newUsers,
      sessions: metrics.sessions,
      // GA4 reports total engagement seconds; the dashboard wants per user.
      playtimeSecondsPerUser:
        engagementSeconds !== undefined && activeUsers !== undefined && activeUsers > 0
          ? engagementSeconds / activeUsers
          : undefined,
      iapRevenue: metrics.purchaseRevenue,
      adRevenue: adMetrics.length > 0 ? metrics.totalAdRevenue : undefined,
      adImpressions: adMetrics.length > 0 ? metrics.publisherAdImpressions : undefined,
      adClicks: adMetrics.length > 0 ? metrics.publisherAdClicks : undefined,
    });
  }

  // Retention is per acquisition day, not per build/country, so it lands on a
  // separate record that the merge step joins onto the same day.
  for (const [date, metrics] of retention) {
    records.push({
      id: `ga4-retention-${date}`,
      uploadId: `ga4-${propertyId}`,
      source: "firebase",
      date,
      week: isoWeekKey(date),
      game,
      currency,
      ...metrics,
    });
  }

  if (records.length === 0) {
    notes.push(
      "GA4 returned no rows for this range. Very small user counts are withheld for privacy, so a quiet week can come back empty."
    );
  }

  return { records, notes };
}

export function ga4Configured(): boolean {
  return Boolean(process.env.GA4_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}
