@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

A dashboard that displays:
1. Live PSO (Pakistan State Oil) retail fuel prices — Petrol and HSD (High Speed Diesel) — for Pakistan.
2. OGRA wellhead gas price notifications for Mari Energies Limited (Mari D&P Lease area) — benchmark/normal volume price (Rs./MMBTU) and incremental volume price (US$/MMBTU).

## Tech Stack

- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS
- PSO data source: scraped server-side from https://psopk.com/en/fuels/fuel-prices (no API key needed, no public JSON API exists — prices are embedded in the page's server-rendered HTML)
- Mari/OGRA data source: scraped server-side from https://www.ogra.org.pk/well-head-gas-prices (HTML list of notification periods + PDF links). The actual PDFs are scanned gazette documents with no text layer, so prices are NOT OCR'd automatically — see Architecture below.
- Running locally for now; hosting to be decided later

## Setup

```
npm install
npm run dev
```

Then open http://localhost:3000

## Architecture

- `app/api/oil-prices/route.ts` — server route that fetches the PSO fuel-prices page HTML and regex-parses the Petrol (`PREMIER EURO 5`) and HSD (`HI-CETANE DIESEL EURO 5`) rows out of the price table, plus the "Effective From" date. Returns normalized JSON.
- `app/api/mari-gas-price/route.ts` — server route that fetches OGRA's well-head-gas-prices listing HTML and regex-parses the latest Mari notification's period label and PDF link, then checks whether that PDF currently returns 200 (OGRA's server frequently 500s on newer uploads). The actual benchmark/incremental figures come from `LAST_VERIFIED_MARI_PRICE`, a hardcoded constant in that file — update it by hand whenever a newer notification is actually read (e.g. via Claude reading the PDF directly, since it's a scanned image with no text layer — `pdftotext` returns empty on these).
- `app/page.tsx` — client dashboard: polls `/api/oil-prices` every 5 min (PSO cards + price history chart via Recharts) and `/api/mari-gas-price` every 30 min (Mari gas price cards + a status panel showing whether OGRA has published a newer period or fixed a broken PDF link).

## Notes

- PSO prices are OGRA-notified and only change roughly twice a month (1st/16th), so the chart will look flat between changes — that's expected, not a bug.
- The scraper is regex-based against PSO's current HTML structure (`<td>PREMIER EURO 5</td><td>Rs.316.15/Ltr</td>` style rows). If PSO redesigns their site, `extractPrice`/`extractEffectiveDate` in `app/api/oil-prices/route.ts` will need updating.
- OGRA issues Mari wellhead price notifications twice a year (Jan-Jun / Jul-Dec) as scanned PDF gazette notices addressed to Mari Energies Limited, split into a benchmark/normal price (Rs./MMBTU) and an incremental price (US$/MMBTU) — see the Jan-Jun 2025 notification (OGRA-Fin-28-9(85)/2015) for the reference format. As of 2026-07-21, OGRA's site had no "July to December 2026" section yet, and even the "January to June 2026" Mari PDF (their notification #13664) was returning a 500 error on their own server. Don't guess these figures from press coverage — older articles cite a different Tier-1/Tier-2 fertiliser-feed-gas pricing mechanism that isn't the same number.
- The UI theme (colors in `app/globals.css` as `--mari-navy`/`--mari-green`/`--mari-blue`/`--mari-gray-*`, header/footer/badge/card styling in `app/page.tsx`) was reskinned to match marienergies.com.pk's branding (dark navy header, brand green/blue accents, pill-shaped buttons). The header logo hotlinks `https://www.marienergies.com.pk/wp-content/themes/digitz/dist/img/logos/mari-energies.png` directly from their site rather than a local copy.
- No hosting decided yet; running locally via `npm run dev` for now.
- The project lives inside a OneDrive-synced folder, which Next.js flags as a "slow filesystem" (dev server benchmarks ~600ms vs. typical <100ms on a local disk). It still works, but if dev server performance becomes annoying, consider excluding `node_modules` and `.next` from OneDrive sync, or moving the project to a local (non-synced) folder.
- Node.js was installed system-wide via `winget install OpenJS.NodeJS.LTS`. If a fresh shell can't find `node`/`npm`, it's a PATH-refresh issue — open a new terminal window.
