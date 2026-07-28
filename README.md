# KPIvantra

KPI analytics dashboard for mobile games — weekly reports, build (A/B) comparison, historical trends, monetization and data-quality checks. Built with Next.js, TypeScript, Tailwind CSS and Recharts. Developed by Aqua Games.

## Requirements

- Node.js 18.18 or newer (20+ recommended)
- npm (ships with Node)

## Run it

```bash
git clone <repo-url>
cd kpivantra
npm install
npm run dev
```

Open **http://localhost:3000**. The dashboard starts with generated sample figures so every page is explorable immediately.

## Production build

```bash
npm run build
npm start
```

## Importing your data

1. Go to **Data Import** and drag in your CSV exports (GameAnalytics, AdMob, or generic). Multiple files at once is fine — encoding, delimiter, header row and report type are detected automatically.
2. Set the one or two things a file can't tell us: the **game name** (when the file has no game column) and the **reporting period** (for dateless exports such as the AdMob weekly report).
3. Review the suggested column mapping, then **Import into database**.

No export handy? Click **"Load the bundled sample files"** on the Data Import page.

Everything is stored locally in your browser (localStorage) — there is no backend and no data leaves your machine. **Clear database** on the Data Import page resets it.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npx tsc --noEmit` | Type check |
| `npx eslint src` | Lint |
