import { KpiRecord } from "./types";
import { isoWeekKey } from "./week";

/**
 * Demo dataset. Deliberately mirrors the shape of the real exports: GameAnalytics
 * supplies retention/DAU/playtime per build, AdMob supplies ad performance per
 * game in GBP. Fields that those sources do not report (IAP revenue for most
 * builds, ANR counts) are left unavailable rather than invented as zero.
 */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LAST_DAY = "2026-07-26";
const DAY_COUNT = 56; // eight complete weeks

function isoDay(offsetFromEnd: number): string {
  const d = new Date(LAST_DAY + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - offsetFromEnd);
  return d.toISOString().slice(0, 10);
}

interface DemoGame {
  name: string;
  baseDau: number;
  ecpm: number;
  hasIap: boolean;
  countries: string[];
}

const GAMES: DemoGame[] = [
  { name: "Arrows: Brain Puzzle Escape", baseDau: 980, ecpm: 152, hasIap: true, countries: ["GB", "US", "DE"] },
  { name: "Arrow Epic: Tap Puzzle Escape", baseDau: 490, ecpm: 41, hasIap: false, countries: ["GB", "US"] },
  { name: "Jigzun Card Jigsaw Solitaire", baseDau: 1270, ecpm: 1.4, hasIap: true, countries: ["US", "GB"] },
];

interface DemoBuild {
  version: string;
  /** Day offset (counted back from the last day) when this build started rolling out. */
  releasedDaysAgo: number;
  retentionD1: number;
  retentionD3: number;
  retentionD7: number;
  playtimeSeconds: number;
  sessionsPerUser: number;
  crashRate: number;
  anrRate: number;
  levelCompletion: number;
}

const BUILDS: DemoBuild[] = [
  { version: "1.8", releasedDaysAgo: 999, retentionD1: 27.4, retentionD3: 17.9, retentionD7: 11.2, playtimeSeconds: 430, sessionsPerUser: 2.4, crashRate: 1.42, anrRate: 0.51, levelCompletion: 58 },
  { version: "1.9", releasedDaysAgo: 42, retentionD1: 29.8, retentionD3: 19.4, retentionD7: 12.6, playtimeSeconds: 498, sessionsPerUser: 2.7, crashRate: 1.05, anrRate: 0.38, levelCompletion: 63 },
  { version: "2.0", releasedDaysAgo: 14, retentionD1: 33.6, retentionD3: 21.7, retentionD7: 14.9, playtimeSeconds: 612, sessionsPerUser: 3.1, crashRate: 0.62, anrRate: 0.22, levelCompletion: 71 },
];

/** Adoption ramps over two weeks; older builds drain as the new one takes over. */
function buildShare(build: DemoBuild, dayOffset: number): number {
  const daysSinceRelease = build.releasedDaysAgo === 999 ? 999 : build.releasedDaysAgo - dayOffset;
  if (daysSinceRelease < 0) return 0;
  if (build.releasedDaysAgo === 999) {
    const newer = BUILDS.filter((b) => b.releasedDaysAgo !== 999);
    const taken = newer.reduce((sum, b) => sum + buildShare(b, dayOffset), 0);
    return Math.max(0.02, 1 - taken);
  }
  const ramp = Math.min(1, daysSinceRelease / 14);
  const successors = BUILDS.filter(
    (b) => b.releasedDaysAgo !== 999 && b.releasedDaysAgo < build.releasedDaysAgo
  );
  const takenBySuccessors = successors.reduce((sum, b) => sum + buildShare(b, dayOffset), 0);
  return Math.max(0, ramp * 0.95 - takenBySuccessors);
}

export function generateDemoRecords(): KpiRecord[] {
  const records: KpiRecord[] = [];
  const rand = mulberry32(20260727);
  let seq = 0;
  const nextId = () => `demo-${++seq}`;

  GAMES.forEach((game, gameIndex) => {
    for (let offset = DAY_COUNT - 1; offset >= 0; offset--) {
      const date = isoDay(offset);
      const week = isoWeekKey(date);
      const dayOfWeek = new Date(date + "T00:00:00Z").getUTCDay();
      const weekendLift = dayOfWeek === 0 || dayOfWeek === 6 ? 1.12 : 1;
      const growth = 1 + (DAY_COUNT - offset) * 0.004;
      const noise = 0.92 + rand() * 0.16;
      const gameDau = game.baseDau * weekendLift * growth * noise;

      game.countries.forEach((country, countryIndex) => {
        const countryShare = countryIndex === 0 ? 0.55 : countryIndex === 1 ? 0.3 : 0.15;

        BUILDS.forEach((build) => {
          const share = buildShare(build, offset);
          if (share <= 0.01) return;

          const dau = Math.round(gameDau * countryShare * share);
          if (dau < 1) return;

          const jitter = () => 0.94 + rand() * 0.12;
          const newUsers = Math.round(dau * (0.16 + rand() * 0.05));
          const sessions = Math.round(dau * build.sessionsPerUser * jitter());
          const playtimePerUser = build.playtimeSeconds * jitter();

          // GameAnalytics-style engagement and retention record.
          records.push({
            id: nextId(),
            uploadId: "demo-gameanalytics",
            isDemo: true,
            source: "gameanalytics",
            date,
            week,
            game: game.name,
            build: build.version,
            country,
            platform: gameIndex === 1 ? "iOS" : "Android",
            dau,
            newUsers,
            cohortSize: newUsers,
            sessions,
            playtimeSecondsPerUser: playtimePerUser,
            // Retention needs a matured cohort: the newest days have no D7 yet.
            retentionD1: offset >= 1 ? build.retentionD1 * jitter() : undefined,
            retentionD3: offset >= 3 ? build.retentionD3 * jitter() : undefined,
            retentionD7: offset >= 7 ? build.retentionD7 * jitter() : undefined,
            levelStarts: Math.round(dau * 3.4),
            levelCompletions: Math.round(dau * 3.4 * (build.levelCompletion / 100) * jitter()),
            crashes: Math.round(sessions * (build.crashRate / 100) * jitter()),
            anrs: Math.round(sessions * (build.anrRate / 100) * jitter()),
            currency: "GBP",
          });

          // AdMob-style ad performance for the same day, game and build.
          const impressionsPerUser = 4.2 + rand() * 1.6;
          const adImpressions = Math.round(dau * impressionsPerUser);
          const matchedRequests = Math.round(adImpressions / (0.28 + rand() * 0.2));
          const adRequests = Math.round(matchedRequests / (0.3 + rand() * 0.45));
          records.push({
            id: nextId(),
            uploadId: "demo-admob",
            isDemo: true,
            source: "admob",
            date,
            week,
            game: game.name,
            build: build.version,
            country,
            platform: gameIndex === 1 ? "iOS" : "Android",
            currency: "GBP",
            adRevenue: (adImpressions / 1000) * game.ecpm * jitter(),
            adImpressions,
            matchedRequests,
            adRequests,
            adClicks: Math.round(adImpressions * (0.09 + rand() * 0.3)),
            adViewers: Math.round(dau * (0.72 + rand() * 0.2)),
            activeUsers: dau,
            dav: Math.round(dau * (0.7 + rand() * 0.2)),
            // Only some titles sell IAP; the rest genuinely have no IAP data.
            iapRevenue: game.hasIap ? dau * (0.006 + rand() * 0.004) : undefined,
          });
        });
      });
    }
  });

  return records;
}
