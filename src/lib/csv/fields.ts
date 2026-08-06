import { CanonicalFieldDefinition } from "../types";

export const CANONICAL_FIELDS: CanonicalFieldDefinition[] = [
  // Dimensions
  { id: "date", label: "Date", category: "dimension", dataType: "date", description: "Calendar day the row describes" },
  { id: "game", label: "Game", category: "dimension", dataType: "string", description: "Game or app title" },
  { id: "build", label: "Build / App version", category: "dimension", dataType: "string", description: "Build version such as 2.0" },
  { id: "platform", label: "Platform", category: "dimension", dataType: "string", description: "iOS, Android or another store platform" },
  { id: "country", label: "Country", category: "dimension", dataType: "string", description: "Country or region code" },
  { id: "currency", label: "Currency", category: "dimension", dataType: "string", description: "Currency of the monetary columns" },

  // Engagement
  { id: "dau", label: "DAU", category: "engagement", dataType: "number", description: "Daily active users" },
  { id: "activeUsers", label: "Active users", category: "engagement", dataType: "number", description: "Active users over the reporting period" },
  { id: "newUsers", label: "New users", category: "engagement", dataType: "number", description: "First-time users" },
  { id: "sessions", label: "Sessions", category: "engagement", dataType: "number", description: "Total sessions" },
  { id: "playtimeSecondsPerUser", label: "Playtime per user (seconds)", category: "engagement", dataType: "number", description: "Average seconds played per user" },
  { id: "playtimeSecondsTotal", label: "Total playtime (seconds)", category: "engagement", dataType: "number", description: "Total seconds played" },

  // Retention
  { id: "retentionD1", label: "D1 retention", category: "retention", dataType: "rate", description: "Day-1 retention rate", isRate: true },
  { id: "retentionD2", label: "D2 retention", category: "retention", dataType: "rate", description: "Day-2 retention rate", isRate: true },
  { id: "retentionD3", label: "D3 retention", category: "retention", dataType: "rate", description: "Day-3 retention rate", isRate: true },
  { id: "retentionD4", label: "D4 retention", category: "retention", dataType: "rate", description: "Day-4 retention rate", isRate: true },
  { id: "retentionD5", label: "D5 retention", category: "retention", dataType: "rate", description: "Day-5 retention rate", isRate: true },
  { id: "retentionD6", label: "D6 retention", category: "retention", dataType: "rate", description: "Day-6 retention rate", isRate: true },
  { id: "retentionD7", label: "D7 retention", category: "retention", dataType: "rate", description: "Day-7 retention rate", isRate: true },
  { id: "retentionD30", label: "D30 retention", category: "retention", dataType: "rate", description: "Day-30 retention rate", isRate: true },
  { id: "cohortSize", label: "Cohort size", category: "retention", dataType: "number", description: "Users eligible for the retention cohort — used to weight the average" },

  // Acquisition
  { id: "spend", label: "Spend", category: "monetization", dataType: "currency", description: "User-acquisition cost" },

  // Monetization
  { id: "adRevenue", label: "Ad revenue", category: "monetization", dataType: "currency", description: "Advertising earnings" },
  { id: "iapRevenue", label: "IAP revenue", category: "monetization", dataType: "currency", description: "In-app purchase revenue" },
  { id: "adImpressions", label: "Ad impressions", category: "monetization", dataType: "number", description: "Ads shown" },
  { id: "adRequests", label: "Ad requests", category: "monetization", dataType: "number", description: "Ad requests sent" },
  { id: "matchedRequests", label: "Matched requests", category: "monetization", dataType: "number", description: "Requests matched with a fill" },
  { id: "adClicks", label: "Ad clicks", category: "monetization", dataType: "number", description: "Clicks on ads" },
  { id: "adViewers", label: "Ad viewers", category: "monetization", dataType: "number", description: "Users who saw at least one ad" },
  { id: "dav", label: "DAV", category: "monetization", dataType: "number", description: "Daily ad viewers" },

  // Stability
  { id: "crashes", label: "Crashes", category: "stability", dataType: "number", description: "Crash events" },
  { id: "crashedUsers", label: "Crashed users", category: "stability", dataType: "number", description: "Users who experienced a crash" },
  { id: "anrs", label: "ANRs", category: "stability", dataType: "number", description: "Application-not-responding events" },
  { id: "crashRate", label: "Crash rate", category: "stability", dataType: "rate", description: "Crash rate reported directly by the source", isRate: true },
  { id: "anrRate", label: "ANR rate", category: "stability", dataType: "rate", description: "ANR rate reported directly by the source", isRate: true },

  // Progression
  { id: "levelStarts", label: "Level starts", category: "progression", dataType: "number", description: "Users who started the level" },
  { id: "levelCompletions", label: "Level completions", category: "progression", dataType: "number", description: "Users who completed the level" },
];

export const FIELD_BY_ID: Record<string, CanonicalFieldDefinition> = Object.fromEntries(
  CANONICAL_FIELDS.map((f) => [f.id, f])
);

export const IGNORE_FIELD = "__ignore";

/** Lowercased, punctuation-stripped header used for all matching. */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[_\-/().]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Exact header text (normalized) mapped to a canonical field. */
export const EXACT_HEADERS: Record<string, string> = {
  date: "date",
  day: "date",
  "report date": "date",
  app: "game",
  game: "game",
  "app name": "game",
  "game name": "game",
  application: "game",
  build: "build",
  version: "build",
  "app version": "build",
  "build version": "build",
  platform: "platform",
  os: "platform",
  "operating system": "platform",
  country: "country",
  "country code": "country",
  region: "country",
  currency: "currency",
  "currency code": "currency",

  dau: "dau",
  "daily active users": "dau",
  "active users": "activeUsers",
  "active users au": "activeUsers",
  au: "activeUsers",
  "new users": "newUsers",
  installs: "newUsers",
  sessions: "sessions",
  "session count": "sessions",
  "playtime per user": "playtimeSecondsPerUser",
  "playtime per user seconds": "playtimeSecondsPerUser",
  "session length": "playtimeSecondsPerUser",
  "avg session length": "playtimeSecondsPerUser",
  playtime: "playtimeSecondsTotal",
  "total playtime": "playtimeSecondsTotal",

  "cohort size": "cohortSize",
  // A bare "Retention" column (GameAnalytics explore exports split by country)
  // reports day-1 retention.
  retention: "retentionD1",
  "d1 retention": "retentionD1",
  "retention d1": "retentionD1",
  "retention d7": "retentionD7",
  "d3 retention": "retentionD3",
  "d7 retention": "retentionD7",
  "d30 retention": "retentionD30",

  spend: "spend",
  cost: "spend",
  "ad spend": "spend",
  "amount spent": "spend",
  "amount spent usd": "spend",
  "ua spend": "spend",
  "marketing spend": "spend",
  "total spend": "spend",

  "estimated earnings": "adRevenue",
  "estimated earnings gbp": "adRevenue",
  "estimated earnings usd": "adRevenue",
  "ad revenue": "adRevenue",
  earnings: "adRevenue",
  revenue: "adRevenue",
  "iap revenue": "iapRevenue",
  "in app purchase revenue": "iapRevenue",
  "purchase revenue": "iapRevenue",
  impressions: "adImpressions",
  "ad impressions": "adImpressions",
  requests: "adRequests",
  "ad requests": "adRequests",
  "matched requests": "matchedRequests",
  clicks: "adClicks",
  "ad clicks": "adClicks",
  "ad viewers av": "adViewers",
  "ad viewers": "adViewers",
  av: "adViewers",
  dav: "dav",

  crashes: "crashes",
  "crash count": "crashes",
  "crashed users": "crashedUsers",
  anrs: "anrs",
  "anr count": "anrs",
  "crash rate": "crashRate",
  "anr rate": "anrRate",

  "level starts": "levelStarts",
  "users started": "levelStarts",
  "level completions": "levelCompletions",
  "users completing level": "levelCompletions",
};

/**
 * Columns that are derived elsewhere in the app. Importing them would let a
 * source-reported ratio silently override an aggregate-correct calculation.
 */
export const DERIVED_HEADERS = new Set([
  "match rate",
  "show rate",
  "ctr",
  "observed ecpm",
  "observed ecpm gbp",
  "observed ecpm usd",
  "ads arpv",
  "ads arpv gbp",
  "ads arpu",
  "ads arpu gbp",
  "ad viewer rate",
  "daily ad viewer rate",
  "imps av",
  "imps au",
  "ads arpdav",
  "ads arpdav gbp",
  "ads arpdau",
  "ads arpdau gbp",
  "impdav",
  "impdau",
  "ad load latency",
  "bid requests",
  "bids in auction",
  "bids in auction %",
  "win rate",
  "winning bids",
  "arpdau",
  "arpu",
  "ecpm",
]);

/** Partial-match fallbacks, checked in order after exact matching fails. */
export const FUZZY_RULES: { pattern: RegExp; field: string }[] = [
  { pattern: /^dau\b/, field: "dau" },
  { pattern: /playtime per user/, field: "playtimeSecondsPerUser" },
  { pattern: /^playtime/, field: "playtimeSecondsTotal" },
  { pattern: /^retention (\d+)$/, field: "retention" },
  { pattern: /\bspend\b/, field: "spend" },
  { pattern: /\bcost\b/, field: "spend" },
  { pattern: /estimated earnings/, field: "adRevenue" },
  { pattern: /\bearnings\b/, field: "adRevenue" },
  { pattern: /\bimpressions\b/, field: "adImpressions" },
  { pattern: /matched requests/, field: "matchedRequests" },
  { pattern: /\brequests\b/, field: "adRequests" },
  { pattern: /\bclicks\b/, field: "adClicks" },
  { pattern: /active users/, field: "activeUsers" },
  { pattern: /new users/, field: "newUsers" },
  { pattern: /\bsessions?\b/, field: "sessions" },
  { pattern: /\bcrash(es)? rate\b/, field: "crashRate" },
  { pattern: /\bcrash(es)?\b/, field: "crashes" },
  { pattern: /\banr rate\b/, field: "anrRate" },
  { pattern: /\banrs?\b/, field: "anrs" },
  { pattern: /\bcountry\b/, field: "country" },
  { pattern: /\bdate\b/, field: "date" },
];
