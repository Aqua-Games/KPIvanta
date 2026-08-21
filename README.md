# KPIvantra

KPI dashboard for mobile games. Track DAU, playtime, retention (D1–D7), spend, revenue and ROAS per project, and compare any two weeks or any two builds. Data comes from CSV exports or straight from Firebase Analytics. Built with Next.js, TypeScript, Tailwind CSS and Recharts. Developed by Aqua Games.

## Requirements

- Node.js 18.18 or newer (20+ recommended)
- npm (ships with Node)

## Run it

```bash
git clone https://github.com/Aqua-Games/KPIvanta.git
cd KPIvanta
npm install
npm run dev
```

Open **http://localhost:3000**.

## How it works

1. **Add a company** on the home screen.
2. **Create a project** — one project is one game. Set its name, platform and currency.
3. **Get data in**, either way (or both — they merge):
   - **Upload CSV sheets**: GameAnalytics, AdMob, or any generic export. Encoding, delimiter, header row and report layout are detected automatically. A file with no date column inherits the dates from the other sheets.
   - **Sync from Firebase Analytics** — see below.
4. **Read the report**, in three tabs:
   - **Overview** — six boxes (DAU, Playtime, D1, Spend, Revenue, ROAS) plus trends, retention curve and country comparison
   - **Weekly Comparison** — any two weeks side by side
   - **Build Comparison** — any two builds side by side

Uploads are cumulative: each new week is added to the project's history, so week-over-week comparison has something to compare. Identical files are skipped rather than double counted.

No export handy? Click **"Load the bundled sample files"**.

## Where data is stored

Everything is written to a `data/` folder in the project root as plain JSON:

```
data/
  companies.json
  projects/<id>.json     # name, platform, currency
  reports/<id>.json       # records, sheets, issues, weekly spend
```

It is gitignored, so nothing leaves your machine. To reset, delete the folder. All filesystem access is isolated in `src/lib/server/storage.ts`, so swapping to Firestore later means reimplementing that one file.

## Connecting Firebase Analytics (GA4)

Firebase Analytics *is* a GA4 property, so the free **Google Analytics Data API** covers it. No BigQuery export, no Blaze plan and **no billing account** are needed.

### One-time setup (about five minutes)

**1. Enable the API.** Open [Google Cloud Console](https://console.cloud.google.com/), select the project behind your Firebase app, then go to **APIs & Services → Library**, search for **Google Analytics Data API** and click **Enable**.

**2. Create a service account.** Go to **APIs & Services → Credentials → Create Credentials → Service account**. Give it any name (for example `kpivantra-reader`), skip the optional role and permission steps, and create it. No project-level role is required — access is granted inside GA4 in the next step.

**3. Download its key.** Open the new service account → **Keys → Add key → Create new key → JSON**. A `.json` file downloads. Keep it private: it grants read access to your analytics.

**4. Grant it access in GA4.** Open [Google Analytics](https://analytics.google.com/) → **Admin → Property Access Management → +** → **Add users**. Paste the service account's email (it looks like `kpivantra-reader@your-project.iam.gserviceaccount.com`, and is in the JSON file as `client_email`), give it the **Viewer** role, and untick "Notify new users by email". Save.

**5. Add the key to the app.** Create a file called `.env.local` in the project root:

```bash
GA4_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"…","private_key":"…","client_email":"…"}
```

Paste the **entire contents** of the downloaded JSON file on that one line, with no surrounding quotes. Alternatively point at the file instead:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
```

`.env.local` is gitignored — never commit the key. See `.env.local.example` for a template.

**6. Restart the dev server** so the new variable is picked up.

### Finding your property ID

In Google Analytics: **Admin → Property Settings**. It is a plain number such as `343318` — not the "G-XXXXXXX" measurement ID, and not the Firebase project name.

### Syncing

Open a project, click **Upload sheets**, and the **Firebase Analytics** panel appears at the top. Enter the property ID, pick a date range, click **Sync**. The panel shows a green "Credentials found" badge once step 5 is done; until then it shows the setup steps inline.

Re-syncing the same date range **replaces** those rows rather than adding to them, so it is safe to run repeatedly.

### What comes across

| From GA4 | Becomes |
|---|---|
| `activeUsers` | DAU |
| `userEngagementDuration` ÷ users | Playtime per user |
| Cohort report (`cohortActiveUsers` / `cohortTotalUsers`) | D1–D7 retention, weighted by cohort size |
| `newUsers`, `sessions` | New users, sessions per user |
| `purchaseRevenue` | IAP revenue |
| `totalAdRevenue`, ad impressions, ad clicks | Ad revenue, ARPDAU Ads, IMPDAU, eCPM |
| `appVersion` dimension | Build — so Build Comparison works with no CSV at all |
| `country` dimension | Country comparison |

### Things worth knowing

- **Spend never comes from Firebase.** Enter it per week in the Spend box on the Overview tab, or upload a Google Ads / Meta export with a `Cost` or `Spend` column. ROAS, profit and CPI stay **N/A** until spend exists — they are never shown as zero.
- **Crash-free rate and ANR are not in GA4** either; those live in Crashlytics.
- **Ad metrics need AdMob linked** to the GA4 property. If it isn't, the sync still imports everything else and leaves a note saying so.
- **Very small numbers may come back blank.** GA4 withholds rows with few users for privacy, so a quiet day in a small market can be missing. It is shown as N/A, never as zero.
- **Free tier quotas** apply (roughly 200,000 tokens per property per day). A daily pull uses a small fraction.

### Why not BigQuery?

The Firebase → BigQuery export needs the **Blaze plan**, which requires a card on file, and queries are billed per byte scanned. BigQuery is only worth it for custom events, level funnels or exact figures in very small markets. For the KPIs in this dashboard the free Data API gives the same numbers — including cohort-weighted retention.

## Continuous integration

Every push and pull request runs `.github/workflows/ci.yml`, which lints, type
checks and builds on a clean `npm ci` install. A second job builds again with
`google-auth-library` deleted, proving the optional Firebase connector cannot
break a checkout that has not installed it.

Nothing needs configuring — GitHub picks the workflow up automatically. Add the
badge to see status at a glance:

```markdown
![CI](https://github.com/Aqua-Games/KPIvanta/actions/workflows/ci.yml/badge.svg)
```

## Production build

```bash
npm run build
npm start
```

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npx tsc --noEmit` | Type check |
| `npx eslint src` | Lint |
