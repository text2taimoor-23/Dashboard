// Shared types + hand-verified constants for the dashboard, used by both the live report
// (app/page.tsx) and any alternate-styling preview (e.g. app/blueprint/page.tsx). Kept in one
// place so the two never drift out of sync with each other.

export type PricePoint = {
  code: string;
  label: string;
  price: number;
  currency: string;
  unit: string;
};

export type ApiResponse = {
  prices?: PricePoint[];
  effectiveFrom?: string | null;
  fetchedAt?: string;
  source?: string;
  error?: string;
};

export type MariShareApiResponse = {
  symbol?: string;
  companyName?: string;
  price?: number;
  currency?: string;
  change?: number;
  changePercent?: number | null;
  direction?: "up" | "down" | "flat";
  previousClose?: number | null;
  marketCapPkrBn?: number | null;
  asOf?: string | null;
  fetchedAt?: string;
  source?: string;
  error?: string;
};

export type MariPriceFigure = {
  value: number;
  currency: string;
  unit: string;
};

export type MariApiResponse = {
  lastVerified?: {
    period: string;
    periodShort: string;
    reservoir: string;
    benchmark: MariPriceFigure;
    incremental: MariPriceFigure;
    reference: string;
  };
  nextPeriod?: { periodShort: string; notified: boolean } | null;
  latestOgraPeriodGroup?: string | null;
  latestMariNotification?: { period: string; pdfUrl: string } | null;
  pdfAvailable?: boolean;
  ograError?: string | null;
  fetchedAt?: string;
  source?: string;
  error?: string;
};

export type CommodityPrice = {
  code: string;
  price: number;
  currency: string;
  unit: string;
  changePercent24h: number | null;
  previousPrice24h: number | null;
  asOf: string;
};

export type CommodityApiResponse = {
  oil?: CommodityPrice;
  lng?: CommodityPrice;
  error?: string | null;
  fetchedAt?: string;
  source?: string;
};

export type OilBenchmark = {
  code: string;
  label: string;
  price?: number;
  change?: number | null;
  changePercent?: number | null;
  delay?: string | null;
};

export type GlobalOilBenchmarksResponse = {
  benchmarks?: OilBenchmark[];
  currency?: string;
  unit?: string;
  fetchedAt?: string;
  source?: string;
  error?: string;
};

export type TickerItem = {
  date: string;
  title: string;
  category: string;
  url: string;
};

export type PsxAnnouncementsResponse = {
  announcements?: TickerItem[];
  fetchedAt?: string;
  source?: string;
  error?: string;
};

export type HormuzStatusResponse = {
  status?: "open" | "closed";
  dayCount?: number | null;
  brentPrice?: number | null;
  brentChangePercent?: number | null;
  warRiskMultiplier?: number | null;
  asOf?: string | null;
  fetchedAt?: string;
  source?: string;
  error?: string;
};

export type PkrUsdResponse = {
  pkrPerUsd?: number;
  lastUpdatedUtc?: string | null;
  fetchedAt?: string;
  source?: string;
  error?: string;
};

export type PpisNewsResponse = {
  news?: TickerItem[];
  fetchedAt?: string;
  source?: string;
  error?: string;
};

export type PsxPeerQuote = {
  symbol: string;
  companyName: string;
  price: number;
  currency: string;
  change: number;
  changePercent: number | null;
  direction: "up" | "down" | "flat";
  source: string;
};

export type PsxPeerPricesResponse = {
  quotes?: PsxPeerQuote[];
  fetchedAt?: string;
  source?: string;
  error?: string | null;
};

export const POLL_INTERVAL_MS = 5 * 60_000;
export const MARI_POLL_INTERVAL_MS = 30 * 60_000;
export const MARI_SHARE_POLL_INTERVAL_MS = 5 * 60_000;
export const COMMODITY_POLL_INTERVAL_MS = 30 * 60_000;
export const OIL_BENCHMARKS_POLL_INTERVAL_MS = 30 * 60_000;
export const PSX_ANNOUNCEMENTS_POLL_INTERVAL_MS = 60 * 60_000;
export const HORMUZ_POLL_INTERVAL_MS = 60 * 60_000;
export const PPIS_NEWS_POLL_INTERVAL_MS = 60 * 60_000;
export const PKR_USD_POLL_INTERVAL_MS = 6 * 60 * 60_000;
export const PSX_PEER_PRICES_POLL_INTERVAL_MS = 5 * 60_000;

export const MARI_LOGO_URL =
  "https://www.marienergies.com.pk/wp-content/themes/digitz/dist/img/logos/mari-energies.png";

export type BdcUpdate = { date: string; text: string };

// The BDC team's own internal announcements/notices — NOT sourced from any API, since this is
// genuinely internal-only information nobody outside the department has. Update by hand
// whenever the team has something new to post. Keep entries short — this scrolls in a
// single-line marquee.
export const BDC_TEAM_UPDATES: BdcUpdate[] = [
  { date: "Aug 03, 2026", text: "BDC Townhall Meeting — Monday, 11:30 AM, Conference Room" },
  { date: "Aug 05, 2026", text: "OCM-TCM of Karak Block — 10:00 AM, Conference Room" },
  { date: "Aug 05, 2026", text: "Green Energy — Weekly Meeting Planative, 2:30 PM, HSE Meeting Room" },
  { date: "Aug 06, 2026", text: "Supplemental Agreement with Engro — deadline Friday" },
  { date: "—", text: "Welcome/orientation to newly hired Management Trainees" },
];

// Trade debts (receivables) broken down by counterparty, from the "Transactions and balances
// with related parties" note in Mari Energies' standalone quarterly reports. Refineries = Pak
// Arab Refinery + Pakistan Refinery; Others = Fauji Fertilizer + Foundation Power + Foundation
// Gas + Central Power Generation + non-related-party "due from others". Updated by hand each
// quarter.
export const RECEIVABLES_BY_QUARTER = [
  {
    quarter: "Q1 FY25-26",
    period: "Sep 30, 2025",
    sngpl: 69067.0,
    ssgcl: 9435.2,
    refineries: 430.8,
    others: 6964.5,
    total: 85897.6,
  },
  {
    quarter: "Q2 FY25-26",
    period: "Dec 31, 2025",
    sngpl: 71655.3,
    ssgcl: 9343.9,
    refineries: 595.2,
    others: 7171.2,
    total: 88765.6,
  },
  {
    quarter: "Q3 FY25-26",
    period: "Mar 31, 2026",
    sngpl: 73443.6,
    ssgcl: 10509.7,
    refineries: 422.3,
    others: 7676.2,
    total: 92051.8,
  },
];

// Pakistan petroleum import volumes, read directly from OCAC's own Import/Export report. Not
// scraped — updated by hand whenever a newer month's row is published and read.
export const OIL_IMPORTS_LAST_MONTH = {
  periodLabel: "Jun 2026",
  totalKt: 1464.6,
  crudeKt: 1032.9,
  source: "OCAC",
};

// Mari Energies' share of Pakistan's total weekly oil/gas production, from PPIS's Upstream
// Activities portal — login-gated, no public API, pulled by hand weekly.
export const MARI_PRODUCTION_SHARE = {
  periodLabel: "Jul 17-23, 2026",
  oil: {
    mariBbl: 12130.8,
    totalBbl: 500783.41,
    unit: "bbl",
    topProducer: { name: "OGDCL", value: 278580.0 },
  },
  gas: {
    mariMmcft: 6826.49,
    totalMmcft: 21392.27,
    unit: "MMCFT",
    topProducer: { name: "Mari Energies", value: 6826.49 },
  },
  source: "PPIS Upstream Activities · Weekly Oil/Gas Production reports",
};

// Mari Energies' reserves & resources position, from the FY2024-25 Integrated Annual Report.
export const MARI_RESERVES = {
  asOfDate: "Jun 30, 2025",
  reserves2pMmboe: { current: 775.0, prior: 704.4 },
  resources2cMmboe: { current: 177.1, prior: 111.5 },
  totalReservesAndResourcesMmboe: { current: 952, prior: 816 },
  reserveReplacementRatioPercent: 278,
  reservesToProductionYears: { current: 20, prior: 18 },
  source: "MariEnergies Integrated Annual Report 2025",
};

// Dividend per share (DPS) and total payout, from the same FY2024-25 Annual Report. Yield is
// computed live against the current PSX share price, not hardcoded.
export const MARI_DIVIDEND = {
  fiscalYearLabel: "FY 2024-25",
  dividendPerShareRs: 21.7,
  totalDividendRsBn: 26,
  source: "MariEnergies Integrated Annual Report 2025",
};

// Annual finding cost AND finding & development (F&D) cost, both USD per BOE — see app/page.tsx
// history for full sourcing detail. Neither includes production/operating (lifting) costs.
export const MARI_FINDING_COST = {
  fiscalYearLabel: "FY 2024-25",
  findingCostUsdPerBoe: { current: 0.8, prior: 0.9 },
  fdCostUsdPerBoe: { current: 6.46, priorFiveYearBaseline: 15.38 },
  source: "MariEnergies Integrated Annual Report 2025",
};

// Mari Energies' share of Pakistan's currently active drilling rigs, from PPIS's Upstream
// Activities > Drilling Status report — same login-gated, hand-updated pattern as
// MARI_PRODUCTION_SHARE.
export const MARI_DRILLING_ACTIVITY = {
  asOfDate: "Jul 23, 2026",
  mariWells: { exploratory: 1, appraisalDevelopment: 3, total: 4 },
  totalWellsNational: 21,
  topDriller: { name: "OGDCL", wells: 8 },
  source: "PPIS Upstream Activities · Drilling Status report",
};

// Mari Energies' operated vs. non-operated split across its exploration licenses and D&P
// leases, read directly from the embedded dataset behind marienergies.com.pk's own interactive
// Concession Map (its "concessionMapVars.locations" array — each entry tagged with a
// parent_category of "Exploration Licenses" or "D&P Leases" and a subcategory of Operated/Non
// Operated, further split Onshore/Offshore for exploration licenses). Counted directly from
// that dataset (87 locations total) rather than estimated, and cross-checked against the
// site's own separately-stated headline figures: 72 total exploration licenses (28 operated
// onshore + 18 operated offshore + 19 non-operated onshore + 7 non-operated offshore = 72 ✓)
// and 15 total D&P leases (8 operated + 7 non-operated = 15 ✓); 54 + 33 = 87 matches the page's
// own "Total No. of Assets: 87". No API for this — update by hand if the concession map changes
// (new licence awards/relinquishments).
export const MARI_OPERATORSHIP = {
  asOfDate: "Jul 30, 2026",
  totalAssets: 87,
  operated: { explorationOnshore: 28, explorationOffshore: 18, dpLeases: 8, total: 54 },
  nonOperated: { explorationOnshore: 19, explorationOffshore: 7, dpLeases: 7, total: 33 },
  source: "MariEnergies Concession Map (marienergies.com.pk/what-we-do/concession-map)",
};

// Field-level names for Mari's GAS-producing D&P Leases only (OGRA wellhead price notifications
// are a gas-specific mechanism under the Natural Gas (Wellhead Price) Regulations, 2009 — oil
// fields aren't OGRA-notified at all, so they're excluded here). Read from the same Concession
// Map dataset as MARI_OPERATORSHIP above (field names), cross-referenced against each field's
// own "Hydrocarbon Type" on marienergies.com.pk/what-we-do/field-details (Operated and Non
// Operated tabs) to filter out the two pure-oil operated fields: Bolan East ("Oil") and Ghauri
// ("Oil"). All 7 non-operated fields are gas or gas-and-condensate, so none were excluded there.
// Halini is "Oil and Gas" (kept, since it does produce gas).
export const MARI_OPERATED_GAS_FIELDS = [
  "Sujawal",
  "Kalabagh (Karak)",
  "Zarghun South",
  "Sujjal",
  "Halini (Kalabagh Field)",
  "Mari Field",
];

export const MARI_NON_OPERATED_GAS_FIELDS = [
  "Ratana",
  "Benari (Shahbandar)",
  "Fazl X-1 (Hala)",
  "Bashar X-1 (Hala)",
  "Adam X-1 (Hala)",
  "Togh and Togh Bala",
  "Adam West (Hala)",
];

// Per-field OGRA wellhead price notifications, verified 2026-08-02/03 by reading the actual
// gazette PDFs (each has a real text layer, unlike Mari Field's older scanned notices) —
// cross-checked against Mari's own concession-map field names rather than guessed.
// ogra.org.pk/well-head-gas-prices redirects to a stripped placeholder page for ordinary browser
// navigation, but a plain server-side fetch (curl / this app's own route) still returns the full
// notification listing, so the scraper genuinely works; see the note on OGRA_WELLHEAD_PAGE in
// app/api/mari-gas-price/route.ts. Deliberately just these 6 (per explicit 2026-08-03 request) —
// display order matters here and is NOT alphabetical, it's the order requested: Sujjal, Kalabagh
// (Karak), Zarghun South, Fazl X-1, Adam X-1, Togh and Togh Bala. `GasFieldWellheadPricesKpiTile`
// renders this array directly, in this order — don't re-sort it. Mari Field (PKR-denominated, a
// different mechanism, tracked separately via LAST_VERIFIED_MARI_PRICE) and the other 6 gas
// fields with no verifiable OGRA notification (Sujawal, Halini, Ratana, Benari, Bashar X-1, Adam
// West) were deliberately dropped from this KPI rather than shown as dashes.
//
// julDec2026 is null until OGRA actually publishes a Jul-Dec 2026 notification for that field —
// checked daily at 10 AM (see the scheduled task described in CLAUDE.md) against OGRA's live
// listing. When a field's notification appears, read the matching gazette PDF (same process as
// these 6 originals) and fill in julDec2026 by hand — don't guess a number from the pattern of
// Jan-Jun prices. Once ALL SIX fields have a julDec2026 value filled in, this whole list is fully
// notified for 2026 and the daily check should stop until Jan 2027, when OGRA is next expected to
// publish Jan-Jun 2027 notifications for these same fields.
export const MARI_FIELD_WELLHEAD_PRICES = [
  {
    fieldName: "Sujjal",
    janJun2026: { value: 5.3725, currency: "USD" as const, unit: "MMBTU" },
    julDec2026: null as { value: number; currency: "USD"; unit: string } | null,
    operator: "Mari Energies",
    buyer: "SSGCL",
    reference: "OGRA-Fin-28-9(84)/2015 dated Mar 25, 2026",
  },
  {
    fieldName: "Kalabagh (Karak)",
    janJun2026: { value: 5.9094, currency: "USD" as const, unit: "MMBTU" },
    julDec2026: null as { value: number; currency: "USD"; unit: string } | null,
    operator: "Mari Energies",
    buyer: "SNGPL",
    reference: "OGRA-Fin-28-9(153)/2017 dated Mar 30, 2026",
  },
  {
    fieldName: "Zarghun South",
    janJun2026: { value: 6.3547, currency: "USD" as const, unit: "MMBTU" },
    julDec2026: null as { value: number; currency: "USD"; unit: string } | null,
    operator: "Mari Energies",
    buyer: "SSGCL",
    reference: "OGRA-Fin-28-9(77)/2005 dated Mar 30, 2026",
  },
  {
    fieldName: "Fazl X-1 (Hala)",
    janJun2026: { value: 5.3724, currency: "USD" as const, unit: "MMBTU" },
    julDec2026: null as { value: number; currency: "USD"; unit: string } | null,
    operator: "Pakistan Petroleum Limited",
    buyer: "SSGCL",
    reference: "OGRA-10-9(230)/2020 dated Mar 30, 2026",
  },
  {
    fieldName: "Adam X-1 (Hala)",
    janJun2026: { value: 2.7259, currency: "USD" as const, unit: "MMBTU" },
    julDec2026: null as { value: number; currency: "USD"; unit: string } | null,
    operator: "Pakistan Petroleum Limited",
    buyer: "SSGCL",
    reference: "OGRA-Fin-28-9(55)/2010 dated Mar 30, 2026",
  },
  {
    fieldName: "Togh and Togh Bala",
    janJun2026: { value: 5.9094, currency: "USD" as const, unit: "MMBTU" },
    julDec2026: null as { value: number; currency: "USD"; unit: string } | null,
    operator: "OGDCL",
    buyer: "SNGPL",
    reference: "OGRA-Fin-28-9(247)/2020 dated Mar 17, 2026",
  },
];

// NOT a Claude/Mari prediction — a synthesis of publicly published third-party forecasts plus
// current news, framed as bear/base/bull scenario ranges rather than a single point forecast.
export const OIL_PRICE_OUTLOOK = {
  asOfDate: "Jul 24, 2026",
  horizonLabel: "Aug 2026 - Jan 2027",
  contextSummary:
    "Iran-US conflict over the Strait of Hormuz, active since Feb 28, 2026. A mid-June ceasefire (the Islamabad MOU, mediated in part by Pakistan) broke down on Jul 8. As of Jul 24: Hormuz declared \"completely closed\" by Iran's IRGC, Brent at $100.69 (highest since May 22), Hormuz transits ~10/day vs. ~120-140/day normally, and Houthi attacks have opened a second front in the Red Sea.",
  scenarios: [
    {
      case: "Bear",
      color: "#6fcf7a",
      probability: "~20-25%",
      brentRange: "USD 70-85/bbl",
      narrative:
        "A ceasefire is reached and actually holds this time; Hormuz reopens to near-normal traffic within 1-2 months; OPEC+ keeps adding supply (already +188kb/d from Aug); demand growth stays soft.",
      sources: "EIA Jul 2026 STEO ($81.91 avg 2026, $64.76 avg 2027) · JPMorgan (2027: $64)",
    },
    {
      case: "Base",
      color: "#4c6f92",
      probability: "~45-50%",
      brentRange: "USD 90-105/bbl",
      narrative:
        "Conflict continues at similar or somewhat lower intensity through Q3; the war-risk premium stays elevated; only a modest easing by Jan 2027. Timing of real de-escalation is genuinely uncertain — the June ceasefire already broke down once within weeks.",
      sources:
        "World Bank stressed-scenario range ($95-115) · H2 2026 consensus cited at $89-99.7 · Goldman Sachs 2026 Q4 base ($80, assumes partial Hormuz normalization)",
    },
    {
      case: "Bull (prices higher)",
      color: "#e4685d",
      probability: "~25-30%",
      brentRange: "USD 105-125/bbl",
      narrative:
        "War escalates further or drags on through the full window with no resolution; Hormuz stays effectively closed; further damage to regional energy infrastructure or the new Red Sea front worsens shipping risk. Goldman explicitly flags risk as \"skewed to the upside.\"",
      sources:
        "Goldman Sachs (2027: $100 if Hormuz stays disrupted) · tail risk cited up to $166 if the war drags on further",
    },
  ],
  disclaimer:
    "This is a summary of publicly published third-party forecasts and current news, not a Mari Energies or Claude prediction, model, or investment advice. Oil forecasting is inherently uncertain, especially amid an active regional conflict — treat these as illustrative scenario ranges, not point forecasts, and do not use this for trading or hedging decisions without independent professional advice.",
  trendPath: [
    { month: "Jul", bear: 100, base: 100, bull: 100 },
    { month: "Aug", bear: 96, base: 98, bull: 102 },
    { month: "Sep", bear: 90, base: 97, bull: 106 },
    { month: "Oct", bear: 85, base: 96, bull: 110 },
    { month: "Nov", bear: 81, base: 97, bull: 113 },
    { month: "Dec", bear: 78, base: 98, bull: 115 },
    { month: "Jan", bear: 77, base: 97, bull: 116 },
  ],
};

// Pakistan's IMF EFF + RSF program status, read from IMF press releases. No live feed exists for
// this — updated by hand whenever a newer review is completed.
export const IMF_PROGRAM = {
  effTotalUsdBn: 7.0,
  effMonths: 37,
  effApproved: "Sep 25, 2024",
  rsfTotalUsdBn: 1.4,
  rsfMonths: 28,
  rsfApproved: "May 9, 2025",
  latestReviewLabel: "3rd EFF review + 2nd RSF review",
  latestReviewDate: "May 8, 2026",
  effTrancheUsdBn: 1.1,
  rsfTrancheUsdBn: 0.22,
  totalDisbursedUsdBn: 4.8,
  totalFacilityUsdBn: 8.4,
  nextReviewTestDate: "Sep 15, 2026",
  nextReviewLabel: "4th EFF review + next RSF disbursement",
  nextReviewEffUsdBn: 1.1,
  nextReviewRsfUsdBn: 0.11,
  nextReviewLagNote:
    "Test date, not disbursement date — expect actual Board approval ~7-8 weeks later (~late Oct-Nov 2026), based on the 3rd review's lag",
  circularDebtRsTn: 1.924,
  circularDebtBanksRsBn: 873,
  circularDebtAsOf: "end-May 2026",
};
