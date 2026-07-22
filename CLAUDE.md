@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

A dashboard that displays:
1. Live PSO (Pakistan State Oil) retail fuel prices — Petrol and HSD (High Speed Diesel) — for Pakistan.
2. OGRA wellhead gas price notifications for Mari Energies Limited (Mari D&P Lease area) — benchmark/normal volume price (Rs./MMBTU) and incremental volume price (US$/MMBTU).
3. Mari Energies (MARI) share price, and its standalone trade receivables broken down by counterparty (SNGPL/SSGCL/refineries/others) per quarter, from its quarterly financial reports.
4. Pakistan's monthly oil import volumes (total petroleum + crude-only), from OCAC's primary Import/Export report.
5. Live Dubai Crude oil price and JKM LNG spot price (via OilPriceAPI) — the two benchmarks closest to what Pakistan actually pays for imported crude and spot LNG cargoes.

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

Requires a `.env.local` (gitignored, not committed) with:
```
OILPRICEAPI_KEY=<your free key from https://www.oilpriceapi.com/>
```
Without it, `/api/commodity-prices` returns a 500 and the Dubai Crude / JKM LNG tiles just won't render — everything else on the dashboard still works.

## Architecture

- `app/api/oil-prices/route.ts` — server route that fetches the PSO fuel-prices page HTML and regex-parses the Petrol (`PREMIER EURO 5`) and HSD (`HI-CETANE DIESEL EURO 5`) rows out of the price table, plus the "Effective From" date. Returns normalized JSON.
- `app/api/mari-gas-price/route.ts` — server route that fetches OGRA's well-head-gas-prices listing HTML and regex-parses the latest Mari notification's period label and PDF link, then checks whether that PDF currently returns 200 (OGRA's server frequently 500s on newer uploads). The actual benchmark/incremental figures come from `LAST_VERIFIED_MARI_PRICE`, a hardcoded constant in that file — update it (including `period`/`periodShort`) by hand whenever a newer notification is actually read (e.g. via Claude reading the PDF directly, since it's a scanned image with no text layer — `pdftotext` returns empty on these). The dashboard's "Mari Field Prices (…)" heading pulls its bracketed period from `periodShort`, so it updates automatically the next time this constant is verified and updated.
- `app/api/commodity-prices/route.ts` — server route that calls OilPriceAPI (`api.oilpriceapi.com/v1/prices/latest`, `Authorization: Token <OILPRICEAPI_KEY>`) for `DUBAI_CRUDE_USD` and `JKM_LNG_USD` in parallel via `Promise.allSettled`, so one commodity failing doesn't blank out the other. Returns normalized `{ oil, lng, error, fetchedAt, source }`.
- `app/page.tsx` — client dashboard: polls `/api/oil-prices` every 5 min (PSO cards + price history chart via Recharts), `/api/mari-gas-price` every 30 min (Mari gas price cards + OGRA status panel), `/api/mari-share-price` every 5 min, and `/api/commodity-prices` every 30 min (Dubai Crude / JKM LNG tiles). `RECEIVABLES_BY_QUARTER` and `OIL_IMPORTS_LAST_MONTH` are hardcoded constants (same manual-verification pattern as `LAST_VERIFIED_MARI_PRICE`) — update by hand when a newer quarterly report or OCAC monthly row is read.

## Notes

- PSO prices are OGRA-notified and only change roughly twice a month (1st/16th), so the chart will look flat between changes — that's expected, not a bug.
- The scraper is regex-based against PSO's current HTML structure (`<td>PREMIER EURO 5</td><td>Rs.316.15/Ltr</td>` style rows). If PSO redesigns their site, `extractPrice`/`extractEffectiveDate` in `app/api/oil-prices/route.ts` will need updating.
- OGRA issues Mari wellhead price notifications twice a year (Jan-Jun / Jul-Dec) as scanned PDF gazette notices addressed to Mari Energies Limited, split into a benchmark/normal price (Rs./MMBTU) and an incremental price (US$/MMBTU). As of 2026-07-22 the verified figures are the Jan-Jun 2026 notification (OGRA-Fin-28-9(85)/2015, dated Mar 30 2026): benchmark PKR 490.3733/MMBTU, incremental USD 5.3724/MMBTU, for Mari HRL & Mari Deep (Goru-B). OGRA's site had no "July to December 2026" section yet at that date. Don't guess these figures from press coverage — older articles cite a different Tier-1/Tier-2 fertiliser-feed-gas pricing mechanism that isn't the same number.
- `RECEIVABLES_BY_QUARTER` (Q1-Q3 FY2025-26 so far) comes from the "Transactions and balances with related parties" note in Mari's standalone quarterly reports (marienergies.com.pk/investors-relations/financial-reports) — same PDF-read-by-hand pattern as the Mari gas price. Refineries = Pak Arab Refinery + Pakistan Refinery; Others = Fauji Fertilizer + Foundation Power + Foundation Gas + Central Power Generation + non-related-party "due from others".
- `OIL_IMPORTS_LAST_MONTH` comes from OCAC's own Import/Export report (ocac.org.pk/oil-industry-statistics, currently a PDF like `Import-Export-2025-26-Jul-May.pdf` — filename shifts as months are added, no fixed URL), which is the only primary source with real per-month tonnage (news articles only report cumulative fiscal-year-to-date figures). It lags ~1 month behind the calendar. Pakistan's LNG import volume has no equivalent structured source — just scattered news mentions of individual cargo counts — so it's intentionally left off the dashboard for now.
- Deliberately not built: "oil/LNG currently in transit to Pakistan." No free public API exists for this — it's what Kpler/Vortexa charge for. Free tools (TankerMap, MarineTraffic, VesselFinder) are interactive-map-only with no public API, so there's no reliable way to turn this into a daily-updating number without scraping something fragile/against ToS.
- `OILPRICEAPI_KEY` (in `.env.local`, gitignored) authenticates to OilPriceAPI with an `Authorization: Token <key>` header (not `Bearer`). Commodity codes used: `DUBAI_CRUDE_USD` (Gulf benchmark — more relevant to Pakistan's actual crude sourcing than Brent/WTI) and `JKM_LNG_USD` (Platts Japan-Korea-Marker, the global spot LNG benchmark).
- The UI theme (colors in `app/globals.css` as `--mari-navy`/`--mari-green`/`--mari-blue`/`--mari-gray-*`, header/footer/badge/card styling in `app/page.tsx`) was reskinned to match marienergies.com.pk's branding (dark navy header, brand green/blue accents, pill-shaped buttons). The header logo hotlinks `https://www.marienergies.com.pk/wp-content/themes/digitz/dist/img/logos/mari-energies.png` directly from their site rather than a local copy.
- No hosting decided yet; running locally via `npm run dev` for now.
- The project lives inside a OneDrive-synced folder, which Next.js flags as a "slow filesystem" (dev server benchmarks ~600ms vs. typical <100ms on a local disk). It still works, but if dev server performance becomes annoying, consider excluding `node_modules` and `.next` from OneDrive sync, or moving the project to a local (non-synced) folder.
- Node.js was installed system-wide via `winget install OpenJS.NodeJS.LTS`. If a fresh shell can't find `node`/`npm`, it's a PATH-refresh issue — open a new terminal window.
