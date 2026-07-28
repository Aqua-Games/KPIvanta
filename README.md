# KPIvantra

Upload your game analytics CSV exports, get an instant KPI report for one app — DAU, retention (D1–D7), playtime, revenue, ARPDAU, IMPDAU, eCPM and build comparison. Built with Next.js, TypeScript, Tailwind CSS and Recharts. Developed by Aqua Games.

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

Open **http://localhost:3000**.

## How it works

1. Drag in your CSV exports (GameAnalytics, AdMob, or generic). Encoding, delimiter, header row and report type are detected automatically.
2. If a file has no date column (like the AdMob weekly export), set the week it covers. If no file names the app, type the app name once.
3. Click **Generate report**.

Nothing is saved anywhere — the report lives in the browser tab and is gone when you close it. **New report** starts over.

No export handy? Click **"Load the bundled sample files"** on the upload screen.

## Production build

```bash
npm run build
npm start
```
