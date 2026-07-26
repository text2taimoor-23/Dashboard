"use client";

import { useEffect, useState } from "react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PricePoint = {
  code: string;
  label: string;
  price: number;
  currency: string;
  unit: string;
};

type ApiResponse = {
  prices?: PricePoint[];
  effectiveFrom?: string | null;
  fetchedAt?: string;
  source?: string;
  error?: string;
};

type MariShareApiResponse = {
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

type MariPriceFigure = {
  value: number;
  currency: string;
  unit: string;
};

type MariApiResponse = {
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

type CommodityPrice = {
  code: string;
  price: number;
  currency: string;
  unit: string;
  changePercent24h: number | null;
  previousPrice24h: number | null;
  asOf: string;
};

type CommodityApiResponse = {
  oil?: CommodityPrice;
  lng?: CommodityPrice;
  error?: string | null;
  fetchedAt?: string;
  source?: string;
};

type OilBenchmark = {
  code: string;
  label: string;
  price?: number;
  change?: number | null;
  changePercent?: number | null;
  delay?: string | null;
};

type GlobalOilBenchmarksResponse = {
  benchmarks?: OilBenchmark[];
  currency?: string;
  unit?: string;
  fetchedAt?: string;
  source?: string;
  error?: string;
};

type PsxAnnouncementsResponse = {
  announcements?: TickerItem[];
  fetchedAt?: string;
  source?: string;
  error?: string;
};

type HormuzStatusResponse = {
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

type PkrUsdResponse = {
  pkrPerUsd?: number;
  lastUpdatedUtc?: string | null;
  fetchedAt?: string;
  source?: string;
  error?: string;
};

type TickerItem = {
  date: string;
  title: string;
  category: string;
  url: string;
};

type PpisNewsResponse = {
  news?: TickerItem[];
  fetchedAt?: string;
  source?: string;
  error?: string;
};

const POLL_INTERVAL_MS = 5 * 60_000;
const MARI_POLL_INTERVAL_MS = 30 * 60_000;
const MARI_SHARE_POLL_INTERVAL_MS = 5 * 60_000;
const COMMODITY_POLL_INTERVAL_MS = 30 * 60_000;
const OIL_BENCHMARKS_POLL_INTERVAL_MS = 30 * 60_000;
// PSX news doesn't have a live feed either — hourly polling naturally covers the
// requested 9:30am/3:30pm market-open/close refresh points without needing clock-triggered logic.
const PSX_ANNOUNCEMENTS_POLL_INTERVAL_MS = 60 * 60_000;
const HORMUZ_POLL_INTERVAL_MS = 60 * 60_000;
// Same rationale as PSX above — hourly polling naturally covers the requested 9am daily refresh.
const PPIS_NEWS_POLL_INTERVAL_MS = 60 * 60_000;
// The exchange rate API itself only refreshes ~once/24h; this just needs to be no slower than that.
const PKR_USD_POLL_INTERVAL_MS = 6 * 60 * 60_000;
const MARI_LOGO_URL =
  "https://www.marienergies.com.pk/wp-content/themes/digitz/dist/img/logos/mari-energies.png";

// Power BI "Card" visual look for every KPI tile, refined for a quieter, more elegant finish:
// flat white fill, a thin hairline border, a restrained 2px navy top accent instead of a loud
// colored card, almost no corner radius, no shadow/elevation.
const KPI_CARD_CLASS =
  "rounded-sm border border-mari-gray-light border-t-2 border-t-mari-navy bg-white p-3";

// Trade debts (receivables) broken down by counterparty, from the "Transactions and balances
// with related parties" note in Mari Energies' standalone quarterly reports (marienergies.com.pk/
// investors-relations/financial-reports). Refineries = Pak Arab Refinery + Pakistan Refinery;
// Others = Fauji Fertilizer + Foundation Power + Foundation Gas + Central Power Generation +
// non-related-party "due from others". Not scraped — updated by hand each quarter.
const RECEIVABLES_BY_QUARTER = [
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

function fmtMn(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Pakistan petroleum import volumes, read directly from OCAC's own Import/Export report
// (ocac.org.pk/oil-industry-statistics) — the only primary source with real monthly tonnage,
// though it lags by roughly a month and has no fixed/predictable URL. Not scraped — updated by
// hand whenever a newer month's row is published and read. LNG import volume and both oil/LNG
// live prices are not yet wired up (LNG volume has no structured source; prices need an
// OilPriceAPI key).
const OIL_IMPORTS_LAST_MONTH = {
  periodLabel: "May 2026",
  totalKt: 1198.1,
  crudeKt: 774.6,
  source: "OCAC",
};

function fmtKt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function OilImportsTile({
  periodLabel,
  totalKt,
  crudeKt,
  source,
}: {
  periodLabel: string;
  totalKt: number;
  crudeKt: number;
  source: string;
}) {
  return (
    <div className={KPI_CARD_CLASS}>
      <div className="text-xs font-medium uppercase tracking-wider text-foreground/60">
        Pakistan Oil Imports
        <span className="ml-1 font-normal normal-case text-foreground/40">&middot; {periodLabel}</span>
      </div>
      <div className="mt-2 flex items-end gap-4">
        <div>
          <div className="text-2xl font-semibold text-mari-navy">
            {fmtKt(totalKt)}
            <span className="ml-1 text-sm font-normal text-foreground/50">kt</span>
          </div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/50">
            Total Petroleum
          </div>
        </div>
        <div className="h-8 w-px self-stretch bg-mari-gray-light/60" />
        <div>
          <div className="text-2xl font-semibold text-mari-navy">
            {fmtKt(crudeKt)}
            <span className="ml-1 text-sm font-normal text-foreground/50">kt</span>
          </div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/50">Crude Oil</div>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-foreground/40">
        Source: {source} &middot; latest month with published data (~1 month lag)
      </div>
    </div>
  );
}

// Mari Energies' share of Pakistan's total weekly oil/gas production, from PPIS's Upstream
// Activities portal (ppisonline.com/upstream-activities — login-gated, no public API). Not
// pollable like the rest of this dashboard: PPIS requires an authenticated session, so this is
// pulled by hand each week (Claude logs in with the user present, reads the two "Weekly
// Production" PDFs, and updates this constant) rather than fetched by a server route.
// Oil: sums both "Mari Energies" rows in the report (Northern region — Halini/Dharian/Shewa/
// Spinwarm/Kalabagh — and Southern region — Sujjal/Shams/Bolan East) against the report's Grand
// Total. Gas: the single "Mari Energies" sub-total (Mari/Halini/Sujjal/Shewa/Shams/Spinwarm/
// Kalabagh) against the Grand Total.
// topProducer is each field's combined company total (summing a company's rows across both the
// report's Northern and Southern region sections where it appears in both, e.g. OGDCL). For gas,
// Mari Energies itself is the top producer nationally this week — ahead of OGDCL (6,894.58 MMCFT).
const MARI_PRODUCTION_SHARE = {
  periodLabel: "Jul 9-16, 2026",
  oil: {
    mariBbl: 13778.875,
    totalBbl: 570754.2,
    unit: "bbl",
    topProducer: { name: "OGDCL", value: 315339.0 },
  },
  gas: {
    mariMmcft: 7656.371,
    totalMmcft: 24039.02,
    unit: "MMCFT",
    topProducer: { name: "Mari Energies", value: 7656.371 },
  },
  source: "PPIS Upstream Activities · Weekly Oil/Gas Production reports",
};

// Mari Energies' reserves & resources position, from the FY2024-25 Integrated Annual Report
// ("Reserves & Resources" chapter and the Directors' Report's "Operational KPIs" table). No API
// for this — updated by hand once a year when the new Annual Report is published. 2P = Proved +
// Probable reserves (SPE PRMS definitions); 2C = Contingent Resources. RRR (Reserve Replacement
// Ratio) = reserves added / production that year (110.3 MMBOE added vs 39.7 MMBOE produced =
// 278%). R/P = Reserves-to-Production ratio, i.e. years of production left at the current rate
// if no more reserves were ever added.
const MARI_RESERVES = {
  asOfDate: "Jun 30, 2025",
  reserves2pMmboe: { current: 775.0, prior: 704.4 },
  resources2cMmboe: { current: 177.1, prior: 111.5 },
  totalReservesAndResourcesMmboe: { current: 952, prior: 816 },
  reserveReplacementRatioPercent: 278,
  reservesToProductionYears: { current: 20, prior: 18 },
  source: "MariEnergies Integrated Annual Report 2025",
};

// Dividend per share (DPS) and total payout, from the same FY2024-25 Annual Report — the "Rs
// 21.70" final dividend footnote, cross-checked against Total dividend (Rs 26bn) / shares
// outstanding (~1.2006bn, from the PSX Equity Profile scrape) = ~21.66/share, consistent within
// rounding. Yield is computed live against the current PSX share price (mariShare.price), not
// hardcoded, since the price itself already updates every 5 min elsewhere on this dashboard.
const MARI_DIVIDEND = {
  fiscalYearLabel: "FY 2024-25",
  dividendPerShareRs: 21.70,
  totalDividendRsBn: 26,
  source: "MariEnergies Integrated Annual Report 2025",
};

// Annual finding cost (USD per BOE of reserves added through exploration), from the Directors'
// Report's "Operational KPIs" table. This is a narrower, exploration-efficiency metric — NOT the
// same as an all-in operating cost per BOE (which would also need opex and would require fresh
// peer research to be comparable to OGDCL/PPL/POL) — labeled precisely as "finding cost" for that
// reason rather than a generic "cost per BOE".
const MARI_FINDING_COST = {
  fiscalYearLabel: "FY 2024-25",
  findingCostUsdPerBoe: { current: 0.8, prior: 0.9 },
  source: "MariEnergies Integrated Annual Report 2025",
};

// Mari Energies' share of Pakistan's currently active drilling rigs, from PPIS's Upstream
// Activities > Drilling Status report (same login-gated, hand-updated pattern as
// MARI_PRODUCTION_SHARE — no public API for this). Split into exploratory vs. appraisal/
// development wells since that distinction matters to management (exploratory = new discovery
// potential, appraisal/development = near-term production growth). topDriller is the company
// with the most active rigs nationally by well count, across both categories combined.
const MARI_DRILLING_ACTIVITY = {
  asOfDate: "Jul 16, 2026",
  mariWells: { exploratory: 1, appraisalDevelopment: 3, total: 4 },
  totalWellsNational: 21,
  topDriller: { name: "OGDCL", wells: 9 },
  source: "PPIS Upstream Activities · Drilling Status report",
};

function DonutRing({ percent, color, size }: { percent: number; color: string; size: number }) {
  const data = [
    { name: "Mari Energies", value: percent },
    { name: "Rest of sector", value: 100 - percent },
  ];

  return (
    <div className="relative" style={{ height: size, width: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="70%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill={color} />
            <Cell fill="#d3d3d3" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-mari-navy">
        <span className={size >= 120 ? "text-2xl font-semibold" : "text-xs font-semibold"}>
          {percent.toFixed(percent < 10 ? 2 : 1)}%
        </span>
      </div>
    </div>
  );
}

function ProductionShareDonut({
  label,
  mariValue,
  totalValue,
  unit,
  color,
}: {
  label: string;
  mariValue: number;
  totalValue: number;
  unit: string;
  color: string;
}) {
  const mariPercent = (mariValue / totalValue) * 100;

  return (
    <div className="flex flex-col items-center">
      <DonutRing percent={mariPercent} color={color} size={160} />
      <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-foreground/50">{label}</span>
      <div className="mt-1 text-center text-xs text-foreground/60">
        Mari: {mariValue.toLocaleString("en-US", { maximumFractionDigits: 0 })} {unit} of{" "}
        {totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })} {unit}
      </div>
    </div>
  );
}

function fmtWhole(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function ProductionShareStat({
  percent,
  color,
  label,
  unit,
  topProducer,
  totalValue,
  mariValue,
}: {
  percent: number;
  color: string;
  label: string;
  unit: string;
  topProducer: { name: string; value: number };
  totalValue: number;
  mariValue: number;
}) {
  const isMariTop = topProducer.name === "Mari Energies";
  const topPercent = (topProducer.value / totalValue) * 100;
  const balance = totalValue - mariValue;

  return (
    <div className="flex flex-col items-center">
      <DonutRing percent={percent} color={color} size={64} />
      <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-foreground/50">{label}</span>
      <div className="mt-1 text-center text-[10px] leading-tight text-foreground/60">
        <div className="font-medium text-mari-navy">
          {percent.toFixed(2)}% &middot; {fmtWhole(mariValue)} {unit}
        </div>
        <div>Total: {fmtWhole(totalValue)} {unit}</div>
        <div>{isMariTop ? "Mari is #1" : `Top: ${topProducer.name} ${topPercent.toFixed(1)}%`}</div>
        <div>Bal: {fmtWhole(balance)} {unit}</div>
      </div>
    </div>
  );
}

function ProductionShareKpiTile({
  data,
}: {
  data: typeof MARI_PRODUCTION_SHARE;
}) {
  const oilPercent = (data.oil.mariBbl / data.oil.totalBbl) * 100;
  const gasPercent = (data.gas.mariMmcft / data.gas.totalMmcft) * 100;

  return (
    <div className={KPI_CARD_CLASS}>
      <div className="text-xs font-medium uppercase tracking-wider text-foreground/60">
        Mari Production Share
        <span className="ml-1 font-normal normal-case text-foreground/40">&middot; wk of {data.periodLabel}</span>
      </div>
      <div className="mt-2 flex items-start justify-center gap-4">
        <ProductionShareStat
          percent={oilPercent}
          color="#14963a"
          label="Oil"
          unit={data.oil.unit}
          topProducer={data.oil.topProducer}
          totalValue={data.oil.totalBbl}
          mariValue={data.oil.mariBbl}
        />
        <ProductionShareStat
          percent={gasPercent}
          color="#1ea0eb"
          label="Gas"
          unit={data.gas.unit}
          topProducer={data.gas.topProducer}
          totalValue={data.gas.totalMmcft}
          mariValue={data.gas.mariMmcft}
        />
      </div>
      <div className="mt-2 text-[10px] text-foreground/40">
        Source: PPIS Upstream Activities &middot; login-gated, updated by hand
      </div>
    </div>
  );
}

function trendArrow(current: number, prior: number, higherIsBetter: boolean) {
  if (current === prior) return { arrow: "—", color: "text-foreground/50" };
  const up = current > prior;
  const good = up === higherIsBetter;
  return { arrow: up ? "▲" : "▼", color: good ? "text-status-good" : "text-status-critical" };
}

function ReservesKpiTile({ data }: { data: typeof MARI_RESERVES }) {
  const reservesTrend = trendArrow(data.reserves2pMmboe.current, data.reserves2pMmboe.prior, true);
  const rpTrend = trendArrow(data.reservesToProductionYears.current, data.reservesToProductionYears.prior, true);

  return (
    <div className={KPI_CARD_CLASS}>
      <div className="text-xs font-medium uppercase tracking-wider text-foreground/60">
        Reserves &amp; Resources
        <span className="ml-1 font-normal normal-case text-foreground/40">&middot; 2P, MMBOE</span>
      </div>
      <div className="mt-2 flex items-end gap-1">
        <span className="text-2xl font-semibold text-mari-navy">{data.reserves2pMmboe.current.toFixed(1)}</span>
        <span className={`mb-0.5 text-xs font-medium ${reservesTrend.color}`}>
          {reservesTrend.arrow} {Math.abs(data.reserves2pMmboe.current - data.reserves2pMmboe.prior).toFixed(1)}
        </span>
      </div>
      <div className="mt-2 space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-foreground/60">Reserve Replacement Ratio</span>
          <span className="font-medium text-status-good">{data.reserveReplacementRatioPercent}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-foreground/60">R/P (years left at current rate)</span>
          <span className={`font-medium ${rpTrend.color}`}>
            {data.reservesToProductionYears.current} {rpTrend.arrow}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-foreground/60">Total 2P + 2C</span>
          <span className="font-medium text-mari-navy">{data.totalReservesAndResourcesMmboe.current} MMBOE</span>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-foreground/40">
        Source: {data.source} &middot; as of {data.asOfDate}, updated annually
      </div>
    </div>
  );
}

function FindingCostKpiTile({ data }: { data: typeof MARI_FINDING_COST }) {
  const trend = trendArrow(data.findingCostUsdPerBoe.current, data.findingCostUsdPerBoe.prior, false);

  return (
    <div className={KPI_CARD_CLASS}>
      <div className="text-xs font-medium uppercase tracking-wider text-foreground/60">
        Finding Cost
        <span className="ml-1 font-normal normal-case text-foreground/40">&middot; {data.fiscalYearLabel}</span>
      </div>
      <div className="mt-2 flex items-end gap-1">
        <span className="text-2xl font-semibold text-mari-navy">
          {data.findingCostUsdPerBoe.current.toFixed(1)}
        </span>
        <span className="mb-0.5 text-sm font-normal text-foreground/50">USD/BOE</span>
        <span className={`mb-0.5 ml-1 text-xs font-medium ${trend.color}`}>
          {trend.arrow} vs {data.findingCostUsdPerBoe.prior.toFixed(1)} prior
        </span>
      </div>
      <div className="mt-2 text-[10px] leading-snug text-foreground/50">
        Exploration cost per barrel of new reserves added — not an all-in operating cost per BOE
        (that would need opex + fresh peer data).
      </div>
      <div className="mt-2 text-[10px] text-foreground/40">Source: {data.source} &middot; updated annually</div>
    </div>
  );
}

function DrillingActivityKpiTile({ data }: { data: typeof MARI_DRILLING_ACTIVITY }) {
  const mariPercent = (data.mariWells.total / data.totalWellsNational) * 100;
  const topDrillerPercent = (data.topDriller.wells / data.totalWellsNational) * 100;
  const isMariTop = data.topDriller.name === "Mari Energies";

  return (
    <div className={KPI_CARD_CLASS}>
      <div className="text-xs font-medium uppercase tracking-wider text-foreground/60">
        Drilling Activity
        <span className="ml-1 font-normal normal-case text-foreground/40">&middot; active wells</span>
      </div>
      <div className="mt-2 flex items-end gap-1">
        <span className="text-2xl font-semibold text-mari-navy">{data.mariWells.total}</span>
        <span className="mb-0.5 text-sm font-normal text-foreground/50">
          of {data.totalWellsNational} ({mariPercent.toFixed(1)}%)
        </span>
      </div>
      <div className="mt-2 space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-foreground/60">Exploratory</span>
          <span className="font-medium text-mari-navy">{data.mariWells.exploratory}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-foreground/60">Appraisal / Development</span>
          <span className="font-medium text-mari-navy">{data.mariWells.appraisalDevelopment}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-foreground/60">Top Driller</span>
          <span className="font-medium text-mari-navy">
            {isMariTop ? "Mari is #1" : `${data.topDriller.name} (${topDrillerPercent.toFixed(0)}%)`}
          </span>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-foreground/40">
        Source: {data.source} &middot; as of {data.asOfDate}, updated by hand
      </div>
    </div>
  );
}

// NOT a Claude/Mari prediction — a synthesis of publicly published third-party forecasts (EIA
// STEO, World Bank, Goldman Sachs, JPMorgan) plus current news, framed as bear/base/bull scenario
// ranges rather than a single point forecast, since oil-price forecasting is inherently uncertain
// and doubly so amid the active Iran-Hormuz conflict (started Feb 28, 2026; a mid-June ceasefire
// broke down Jul 8; as of Jul 24, 2026 Iran's IRGC has declared the Strait "completely closed",
// Brent settled $100.69 on Jul 23, Hormuz transits are ~10/day vs a 120-140/day pre-war norm, and
// Houthi attacks have opened a second front in the Red Sea). Update by hand periodically by
// re-reading current news and forecaster updates — there is no API for this.
const OIL_PRICE_OUTLOOK = {
  asOfDate: "Jul 24, 2026",
  horizonLabel: "Aug 2026 - Jan 2027",
  contextSummary:
    "Iran-US conflict over the Strait of Hormuz, active since Feb 28, 2026. A mid-June ceasefire (the Islamabad MOU, mediated in part by Pakistan) broke down on Jul 8. As of Jul 24: Hormuz declared \"completely closed\" by Iran's IRGC, Brent at $100.69 (highest since May 22), Hormuz transits ~10/day vs. ~120-140/day normally, and Houthi attacks have opened a second front in the Red Sea.",
  scenarios: [
    {
      case: "Bear",
      color: "#0ca30c",
      probability: "~20-25%",
      brentRange: "USD 70-85/bbl",
      narrative:
        "A ceasefire is reached and actually holds this time; Hormuz reopens to near-normal traffic within 1-2 months; OPEC+ keeps adding supply (already +188kb/d from Aug); demand growth stays soft.",
      sources: "EIA Jul 2026 STEO ($81.91 avg 2026, $64.76 avg 2027) · JPMorgan (2027: $64)",
    },
    {
      case: "Base",
      color: "#1ea0eb",
      probability: "~45-50%",
      brentRange: "USD 90-105/bbl",
      narrative:
        "Conflict continues at similar or somewhat lower intensity through Q3; the war-risk premium stays elevated; only a modest easing by Jan 2027. Timing of real de-escalation is genuinely uncertain — the June ceasefire already broke down once within weeks.",
      sources: "World Bank stressed-scenario range ($95-115) · H2 2026 consensus cited at $89-99.7 · Goldman Sachs 2026 Q4 base ($80, assumes partial Hormuz normalization)",
    },
    {
      case: "Bull (prices higher)",
      color: "#d03b3b",
      probability: "~25-30%",
      brentRange: "USD 105-125/bbl",
      narrative:
        "War escalates further or drags on through the full window with no resolution; Hormuz stays effectively closed; further damage to regional energy infrastructure or the new Red Sea front worsens shipping risk. Goldman explicitly flags risk as \"skewed to the upside.\"",
      sources: "Goldman Sachs (2027: $100 if Hormuz stays disrupted) · tail risk cited up to $166 if the war drags on further",
    },
  ],
  disclaimer:
    "This is a summary of publicly published third-party forecasts and current news, not a Mari Energies or Claude prediction, model, or investment advice. Oil forecasting is inherently uncertain, especially amid an active regional conflict — treat these as illustrative scenario ranges, not point forecasts, and do not use this for trading or hedging decisions without independent professional advice.",
  // Illustrative smoothed paths from today's actual Brent price (~$100, matching the Global Oil
  // Benchmarks tile and the Hormuz badge) to each scenario's stated 6-month range midpoint — NOT
  // month-by-month figures from any single source (none of the cited forecasters publish a full
  // monthly path for all three cases). Purely for visualizing the scenario spread over time.
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

// Pakistan's IMF EFF + RSF program status, read from IMF press releases (imf.org/en/countries/pak).
// No live feed exists for this — IMF issues a press release every few months per review, so this is
// updated by hand whenever a newer review is completed, same pattern as the Mari gas price. The
// power-sector circular debt figure is the national-level version of the same payment-delay problem
// behind Mari's own gas-sector receivables (see RECEIVABLES_BY_QUARTER).
const IMF_PROGRAM = {
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
  // From the IMF Staff Report's "Table 8a/8b: Schedule of Reviews and Purchases" — these are
  // *test dates* tied to performance-criteria data, not disbursement dates. The 3rd review's test
  // date was Mar 15, 2026 but Board approval/actual disbursement didn't land until May 8, 2026 —
  // a ~7-8 week lag. Applying that same lag, expect the actual 4th-review announcement around
  // late Oct-Nov 2026, not exactly on the test date below.
  nextReviewTestDate: "Sep 15, 2026",
  nextReviewLabel: "4th EFF review + next RSF disbursement",
  nextReviewEffUsdBn: 1.1,
  nextReviewRsfUsdBn: 0.11,
  nextReviewLagNote: "Test date, not disbursement date — expect actual Board approval ~7-8 weeks later (~late Oct-Nov 2026), based on the 3rd review's lag",
  circularDebtRsTn: 1.924,
  circularDebtBanksRsBn: 873,
  circularDebtAsOf: "end-May 2026",
};

function GlobalOilBenchmarksTile({ benchmarks, error }: { benchmarks?: OilBenchmark[]; error: string | null }) {
  return (
    <div className={KPI_CARD_CLASS}>
      <div className="text-xs font-medium uppercase tracking-wider text-foreground/60">
        Global Oil Benchmarks
        <span className="ml-1 font-normal normal-case text-foreground/40">&middot; USD/barrel</span>
      </div>
      {error && !benchmarks && <div className="mt-2 text-xs text-status-critical">{error}</div>}
      {benchmarks && (
        <div className="mt-2 space-y-1.5 text-sm">
          {benchmarks.map((b) => {
            const isUp = (b.changePercent ?? 0) > 0;
            const isDown = (b.changePercent ?? 0) < 0;
            const changeColor = isUp ? "text-status-good" : isDown ? "text-status-critical" : "text-foreground/50";
            return (
              <div key={b.code} className="flex items-center justify-between">
                <span className="text-foreground/60">{b.label}</span>
                {typeof b.price === "number" ? (
                  <span className="flex items-baseline gap-2">
                    <span className="w-14 text-right font-medium tabular-nums text-mari-navy">
                      {b.price.toFixed(2)}
                    </span>
                    <span className={`w-16 text-right text-xs font-medium tabular-nums ${changeColor}`}>
                      {typeof b.changePercent === "number"
                        ? `${isUp ? "▲" : isDown ? "▼" : "—"} ${Math.abs(b.changePercent).toFixed(2)}%`
                        : ""}
                    </span>
                  </span>
                ) : (
                  <span className="text-foreground/40">—</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-2 text-[10px] text-foreground/40">
        Source: oilprice.com &middot; Arab Light is the daily market estimate, not the monthly Aramco OSP
      </div>
    </div>
  );
}

function NewsTickerTile({
  heading,
  subheading,
  items,
  error,
  sourceNote,
}: {
  heading: string;
  subheading: string;
  items?: TickerItem[];
  error: string | null;
  sourceNote: string;
}) {
  return (
    <div className={KPI_CARD_CLASS}>
      <div className="text-xs font-medium uppercase tracking-wider text-foreground/60">
        {heading}
        <span className="ml-1 font-normal normal-case text-foreground/40">&middot; {subheading}</span>
      </div>
      {error && !items && <div className="mt-2 text-xs text-status-critical">{error}</div>}
      {items && items.length > 0 && (
        <div
          className="mt-3 h-28 overflow-hidden"
          style={{
            maskImage: "linear-gradient(to bottom, transparent, black 12px, black calc(100% - 12px), transparent)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent, black 12px, black calc(100% - 12px), transparent)",
          }}
        >
          <div className="animate-marquee-vertical flex flex-col gap-3 hover:[animation-play-state:paused]">
            {[...items, ...items].map((a, i) => (
              <a
                key={`${a.url}-${i}`}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col gap-0.5 text-sm hover:underline"
              >
                <span className="flex items-center gap-2 text-xs text-foreground/50">
                  {a.date}
                  <span className="rounded-full bg-mari-gray-light/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/50">
                    {a.category}
                  </span>
                </span>
                <span className="text-foreground/80">{a.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}
      <div className="mt-2 text-[10px] text-foreground/40">{sourceNote}</div>
    </div>
  );
}

function LiveBadge({ isLive }: { isLive: boolean }) {
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm bg-mari-green/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mari-green">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mari-green opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mari-green" />
        </span>
        Live
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm bg-mari-gray-light/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground/60">
      <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" />
      Offline
    </span>
  );
}

function StatusPill({ status, label }: { status: "good" | "warning" | "critical" | "neutral"; label: string }) {
  const styles: Record<typeof status, string> = {
    good: "bg-status-good/10 text-status-good",
    warning: "bg-status-warning/15 text-amber-700",
    critical: "bg-status-critical/10 text-status-critical",
    neutral: "bg-mari-gray-light/40 text-foreground/60",
  };
  const dot: Record<typeof status, string> = {
    good: "bg-status-good",
    warning: "bg-status-warning",
    critical: "bg-status-critical",
    neutral: "bg-foreground/40",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status]}`} />
      {label}
    </span>
  );
}

function PendingBadge() {
  return (
    <span className="inline-flex animate-pulse items-center gap-1.5 rounded-sm bg-status-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-status-warning" />
      Pending
    </span>
  );
}

function HormuzStatusBadge({ data, error }: { data: HormuzStatusResponse | null; error: string | null }) {
  if (!data?.status) return null;
  const isClosed = data.status === "closed";
  const tooltipParts: string[] = [];
  if (typeof data.brentPrice === "number") {
    tooltipParts.push(
      `Brent $${data.brentPrice.toFixed(2)}${
        typeof data.brentChangePercent === "number"
          ? ` (${data.brentChangePercent > 0 ? "+" : ""}${data.brentChangePercent.toFixed(1)}%)`
          : ""
      }`
    );
  }
  if (typeof data.warRiskMultiplier === "number") {
    tooltipParts.push(`War-risk ${data.warRiskMultiplier.toFixed(1)}x normal`);
  }
  if (data.asOf) tooltipParts.push(`Updated ${data.asOf}`);
  // The source's "Day N" counts from the original Feb 28, 2026 closure declaration, not
  // consecutive days closed — the Strait actually reopened for ~3 weeks (the Islamabad MOU
  // ceasefire, ~Jun 17-Jul 8) before closing again. Made explicit here since "Day N" alone reads
  // as an unbroken streak.
  if (typeof data.dayCount === "number") {
    tooltipParts.push(
      "Day count runs from the original Feb 28, 2026 closure declaration, not a continuous streak — a ceasefire (the Islamabad MOU) reopened the Strait for ~3 weeks (~Jun 17-Jul 8, 2026) before it closed again"
    );
  }
  if (error) tooltipParts.push(error);

  return (
    <a
      href={data.source ?? "https://straits.live"}
      target="_blank"
      rel="noreferrer"
      title={tooltipParts.join(" · ")}
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        isClosed ? "bg-status-critical/10 text-status-critical" : "bg-status-good/10 text-status-good"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isClosed ? "bg-status-critical" : "bg-status-good"}`} />
      Hormuz: {data.status}
      {typeof data.dayCount === "number" && (
        <span className="ml-1 font-normal normal-case text-foreground/50">&middot; Day {data.dayCount}*</span>
      )}
    </a>
  );
}

function FuelComboTile({
  petrol,
  hsd,
  pkrPerUsd,
}: {
  petrol?: PricePoint;
  hsd?: PricePoint;
  pkrPerUsd?: number;
}) {
  if (!petrol && !hsd) return null;
  const unit = petrol?.unit ?? hsd?.unit;
  const currency = petrol?.currency ?? hsd?.currency;

  return (
    <div className={KPI_CARD_CLASS}>
      <div className="text-xs font-medium uppercase tracking-wider text-foreground/60">
        Petrol &amp; HSD
        {currency && unit && (
          <span className="ml-1 font-normal normal-case text-foreground/40">
            &middot; {currency}/{unit}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end gap-4">
        {petrol && (
          <div>
            <div className="text-2xl font-semibold text-mari-navy">{petrol.price.toFixed(2)}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/50">Petrol</div>
          </div>
        )}
        {petrol && hsd && <div className="h-8 w-px self-stretch bg-mari-gray-light/60" />}
        {hsd && (
          <div>
            <div className="text-2xl font-semibold text-mari-navy">{hsd.price.toFixed(2)}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/50">HSD</div>
          </div>
        )}
      </div>
      {typeof pkrPerUsd === "number" && (
        <div className="mt-2 flex items-center justify-between border-t border-mari-gray-light/60 pt-2 text-xs">
          <span className="text-foreground/60">PKR/USD</span>
          <span className="font-medium text-mari-navy">{pkrPerUsd.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

function GasComboTile({
  benchmark,
  incremental,
  periodShort,
  nextPeriodShort,
  nextPeriodNotified,
  nextPeriodPdfUrl,
}: {
  benchmark?: MariPriceFigure;
  incremental?: MariPriceFigure;
  periodShort?: string;
  nextPeriodShort?: string;
  nextPeriodNotified?: boolean;
  nextPeriodPdfUrl?: string | null;
}) {
  if (!benchmark && !incremental) return null;

  return (
    <div className={KPI_CARD_CLASS}>
      <div className="text-xs font-medium uppercase tracking-wider text-foreground/60">
        Gas Benchmark &amp; Incremental
      </div>

      {/* Box 1 — upcoming half-year period, checked against OGRA's live listing until notified */}
      <div className="mt-2 rounded-sm bg-mari-gray-light/20 px-2 py-1.5">
        <div className="text-[9px] font-medium uppercase tracking-wider text-foreground/40">Upcoming Period</div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/60">
            {nextPeriodShort ?? "Next Period"}
          </span>
          {nextPeriodNotified ? (
            nextPeriodPdfUrl ? (
              <a href={nextPeriodPdfUrl} target="_blank" rel="noreferrer" className="inline-flex">
                <StatusPill status="good" label="Notified" />
              </a>
            ) : (
              <StatusPill status="good" label="Notified" />
            )
          ) : (
            <PendingBadge />
          )}
        </div>
      </div>

      {/* Box 2 — last verified (currently notified) half-year period */}
      <div className="mt-2">
        <div className="text-[9px] font-medium uppercase tracking-wider text-foreground/40">
          Notified Period{periodShort && ` (${periodShort})`}
        </div>
        <div className="mt-0.5 flex items-end gap-4">
          {benchmark && (
            <div>
              <div className="text-2xl font-semibold text-mari-navy">{benchmark.value.toFixed(2)}</div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/50">
                Benchmark &middot; {benchmark.currency}/{benchmark.unit}
              </div>
            </div>
          )}
          {benchmark && incremental && <div className="h-8 w-px self-stretch bg-mari-gray-light/60" />}
          {incremental && (
            <div>
              <div className="text-2xl font-semibold text-mari-navy">{incremental.value.toFixed(4)}</div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/50">
                Incremental &middot; {incremental.currency}/{incremental.unit}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuarterReceivablesTile({
  quarter,
  period,
  sngpl,
  ssgcl,
  refineries,
  others,
  total,
}: {
  quarter: string;
  period: string;
  sngpl: number;
  ssgcl: number;
  refineries: number;
  others: number;
  total: number;
}) {
  return (
    <div className={KPI_CARD_CLASS}>
      <div className="text-xs font-medium uppercase tracking-wider text-foreground/60">
        {quarter}
        <span className="ml-1 font-normal normal-case text-foreground/40">&middot; {period}</span>
      </div>
      <div className="mt-2 space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-foreground/60">SNGPL</span>
          <span className="font-medium text-mari-navy">{fmtMn(sngpl)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-foreground/60">SSGCL</span>
          <span className="font-medium text-mari-navy">{fmtMn(ssgcl)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-foreground/60">Refineries</span>
          <span className="font-medium text-mari-navy">{fmtMn(refineries)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-foreground/60">Others</span>
          <span className="font-medium text-mari-navy">{fmtMn(others)}</span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-mari-gray-light/60 pt-2 text-sm">
        <span className="font-semibold text-foreground/70">Total</span>
        <span className="font-semibold text-mari-green">{fmtMn(total)}</span>
      </div>
    </div>
  );
}

function ReceivablesByQuarter() {
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {RECEIVABLES_BY_QUARTER.map((q) => (
          <QuarterReceivablesTile key={q.quarter} {...q} />
        ))}
      </div>
      <p className="mt-3 text-xs text-foreground/50">
        Standalone trade debts (Rs. mn) by counterparty, from the related-party balances note in each quarterly
        report. SNGPL &amp; SSGCL make up ~90% of the balance — this is sector-wide circular debt, not a
        collections problem specific to Mari.
      </p>
    </div>
  );
}

function OilPriceOutlook() {
  return (
    <div>
      <div className="rounded-sm border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
        <strong className="font-semibold">Not a prediction.</strong> {OIL_PRICE_OUTLOOK.disclaimer}
      </div>
      <p className="mt-3 text-xs text-foreground/70">{OIL_PRICE_OUTLOOK.contextSummary}</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {OIL_PRICE_OUTLOOK.scenarios.map((s) => (
          <div key={s.case} className="rounded-sm border border-mari-gray-light border-t-2 bg-white p-3" style={{ borderTopColor: s.color }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">{s.case}</span>
              <span className="text-[10px] text-foreground/40">{s.probability}</span>
            </div>
            <div className="mt-1 text-lg font-semibold text-mari-navy">{s.brentRange}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">Brent</div>
            <p className="mt-2 text-xs leading-snug text-foreground/70">{s.narrative}</p>
            <p className="mt-2 text-[10px] leading-snug text-foreground/40">{s.sources}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OilOutlookTrendTile() {
  return (
    <div className={KPI_CARD_CLASS}>
      <div className="text-xs font-medium uppercase tracking-wider text-foreground/60">
        Oil Price Outlook
        <span className="ml-1 font-normal normal-case text-foreground/40">&middot; Brent scenario</span>
      </div>
      <div className="mt-1 h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={OIL_PRICE_OUTLOOK.trendPath} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#58595b" }} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={{ fontSize: 9, fill: "#58595b" }} axisLine={false} tickLine={false} domain={[60, 130]} width={26} />
            <Tooltip
              formatter={(value, name) => [`$${value}`, name]}
              contentStyle={{ fontSize: 10, borderRadius: 2, borderColor: "#d3d3d3" }}
            />
            <Line type="monotone" dataKey="bull" name="Bull" stroke="#d03b3b" strokeWidth={1.5} strokeDasharray="3 2" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="base" name="Base" stroke="#1ea0eb" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="bear" name="Bear" stroke="#0ca30c" strokeWidth={1.5} strokeDasharray="3 2" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex items-center justify-center gap-2 text-[9px] text-foreground/60">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-status-critical" />
          Bull $105-125
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-mari-blue" />
          Base $90-105
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-status-good" />
          Bear $70-85
        </span>
      </div>
      <div className="mt-1 text-[10px] text-foreground/40">
        Scenario range, not a prediction &middot; {OIL_PRICE_OUTLOOK.horizonLabel}
      </div>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
      {message}
    </div>
  );
}

function Panel({
  title,
  badge,
  meta,
  children,
  className,
}: {
  title: string;
  badge?: React.ReactNode;
  meta?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col rounded-sm border border-mari-gray-light bg-white p-4 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-mari-navy">{title}</h2>
        {badge}
      </div>
      {meta && <div className="mt-1 text-xs text-foreground/50">{meta}</div>}
      <div className="mt-3 flex-1">{children}</div>
    </div>
  );
}

function StatTile({
  label,
  value,
  unit,
  delta,
  deltaPercent,
  direction,
  caption,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  deltaPercent?: number | null;
  direction?: "up" | "down" | "flat";
  caption?: React.ReactNode;
}) {
  const isUp = direction === "up";
  const isDown = direction === "down";
  const deltaColor = isUp ? "text-status-good" : isDown ? "text-status-critical" : "text-foreground/50";
  const arrow = isUp ? "▲" : isDown ? "▼" : "—";

  return (
    <div className={KPI_CARD_CLASS}>
      <div className="text-xs font-medium uppercase tracking-wider text-foreground/60">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-mari-navy">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-foreground/50">{unit}</span>}
      </div>
      {typeof delta === "number" && (
        <div className={`mt-1 flex items-center gap-1 text-sm font-medium ${deltaColor}`}>
          <span aria-hidden>{arrow}</span>
          <span>
            {delta > 0 ? "+" : ""}
            {delta.toFixed(2)}
            {typeof deltaPercent === "number" && (
              <>
                {" "}
                ({deltaPercent > 0 ? "+" : ""}
                {deltaPercent.toFixed(2)}%)
              </>
            )}
          </span>
        </div>
      )}
      {caption && <div className="mt-1 text-xs text-foreground/50">{caption}</div>}
    </div>
  );
}

export default function Home() {
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(null);
  const [mari, setMari] = useState<MariApiResponse | null>(null);
  const [mariError, setMariError] = useState<string | null>(null);
  const [mariShare, setMariShare] = useState<MariShareApiResponse | null>(null);
  const [mariShareError, setMariShareError] = useState<string | null>(null);
  const [commodities, setCommodities] = useState<CommodityApiResponse | null>(null);
  const [commodityError, setCommodityError] = useState<string | null>(null);
  const [oilBenchmarks, setOilBenchmarks] = useState<GlobalOilBenchmarksResponse | null>(null);
  const [oilBenchmarksError, setOilBenchmarksError] = useState<string | null>(null);
  const [psxAnnouncements, setPsxAnnouncements] = useState<PsxAnnouncementsResponse | null>(null);
  const [psxAnnouncementsError, setPsxAnnouncementsError] = useState<string | null>(null);
  const [hormuzStatus, setHormuzStatus] = useState<HormuzStatusResponse | null>(null);
  const [hormuzStatusError, setHormuzStatusError] = useState<string | null>(null);
  const [ppisNews, setPpisNews] = useState<PpisNewsResponse | null>(null);
  const [ppisNewsError, setPpisNewsError] = useState<string | null>(null);
  const [pkrUsd, setPkrUsd] = useState<PkrUsdResponse | null>(null);
  const [pkrUsdError, setPkrUsdError] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchPrices() {
      try {
        const res = await fetch("/api/oil-prices", { cache: "no-store" });
        const data: ApiResponse = await res.json();

        if (cancelled) return;

        if (!res.ok || data.error) {
          setError(data.error ?? "Failed to fetch fuel prices");
          return;
        }

        setError(null);
        setPrices(data.prices ?? []);
        setEffectiveFrom(data.effectiveFrom ?? null);
      } catch {
        if (!cancelled) setError("Network error while fetching fuel prices");
      }
    }

    fetchPrices();
    const interval = setInterval(fetchPrices, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchMari() {
      try {
        const res = await fetch("/api/mari-gas-price", { cache: "no-store" });
        const data: MariApiResponse = await res.json();

        if (cancelled) return;

        if (!res.ok || data.error) {
          setMariError(data.error ?? "Failed to check OGRA notifications");
          return;
        }

        // A failed OGRA reachability check only degrades the OGRA Notification Status panel —
        // the manually-verified gas price KPI (data.lastVerified) is unaffected and always set.
        setMariError(data.ograError ?? null);
        setMari(data);
      } catch {
        if (!cancelled) setMariError("Network error while checking OGRA notifications");
      }
    }

    fetchMari();
    const interval = setInterval(fetchMari, MARI_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchMariShare() {
      try {
        const res = await fetch("/api/mari-share-price", { cache: "no-store" });
        const data: MariShareApiResponse = await res.json();

        if (cancelled) return;

        if (!res.ok || data.error) {
          setMariShareError(data.error ?? "Failed to fetch MARI share price");
          return;
        }

        setMariShareError(null);
        setMariShare(data);
      } catch {
        if (!cancelled) setMariShareError("Network error while fetching MARI share price");
      }
    }

    fetchMariShare();
    const interval = setInterval(fetchMariShare, MARI_SHARE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchCommodities() {
      try {
        const res = await fetch("/api/commodity-prices", { cache: "no-store" });
        const data: CommodityApiResponse = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setCommodityError(data.error ?? "Failed to fetch oil/LNG prices");
          return;
        }

        setCommodityError(data.error ?? null);
        setCommodities(data);
      } catch {
        if (!cancelled) setCommodityError("Network error while fetching oil/LNG prices");
      }
    }

    fetchCommodities();
    const interval = setInterval(fetchCommodities, COMMODITY_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchOilBenchmarks() {
      try {
        const res = await fetch("/api/global-oil-benchmarks", { cache: "no-store" });
        const data: GlobalOilBenchmarksResponse = await res.json();

        if (cancelled) return;

        if (!res.ok || data.error) {
          setOilBenchmarksError(data.error ?? "Failed to fetch global oil benchmarks");
          return;
        }

        setOilBenchmarksError(null);
        setOilBenchmarks(data);
      } catch {
        if (!cancelled) setOilBenchmarksError("Network error while fetching global oil benchmarks");
      }
    }

    fetchOilBenchmarks();
    const interval = setInterval(fetchOilBenchmarks, OIL_BENCHMARKS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchPsxAnnouncements() {
      try {
        const res = await fetch("/api/psx-announcements", { cache: "no-store" });
        const data: PsxAnnouncementsResponse = await res.json();

        if (cancelled) return;

        if (!res.ok || data.error) {
          setPsxAnnouncementsError(data.error ?? "Failed to fetch PSX announcements");
          return;
        }

        setPsxAnnouncementsError(null);
        setPsxAnnouncements(data);
      } catch {
        if (!cancelled) setPsxAnnouncementsError("Network error while fetching PSX announcements");
      }
    }

    fetchPsxAnnouncements();
    const interval = setInterval(fetchPsxAnnouncements, PSX_ANNOUNCEMENTS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchHormuzStatus() {
      try {
        const res = await fetch("/api/hormuz-status", { cache: "no-store" });
        const data: HormuzStatusResponse = await res.json();

        if (cancelled) return;

        if (!res.ok || data.error) {
          setHormuzStatusError(data.error ?? "Failed to fetch Strait of Hormuz status");
          return;
        }

        setHormuzStatusError(null);
        setHormuzStatus(data);
      } catch {
        if (!cancelled) setHormuzStatusError("Network error while fetching Strait of Hormuz status");
      }
    }

    fetchHormuzStatus();
    const interval = setInterval(fetchHormuzStatus, HORMUZ_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchPpisNews() {
      try {
        const res = await fetch("/api/ppis-news", { cache: "no-store" });
        const data: PpisNewsResponse = await res.json();

        if (cancelled) return;

        if (!res.ok || data.error) {
          setPpisNewsError(data.error ?? "Failed to fetch PPIS news");
          return;
        }

        setPpisNewsError(null);
        setPpisNews(data);
      } catch {
        if (!cancelled) setPpisNewsError("Network error while fetching PPIS news");
      }
    }

    fetchPpisNews();
    const interval = setInterval(fetchPpisNews, PPIS_NEWS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchPkrUsd() {
      try {
        const res = await fetch("/api/pkr-usd-rate", { cache: "no-store" });
        const data: PkrUsdResponse = await res.json();

        if (cancelled) return;

        if (!res.ok || data.error) {
          setPkrUsdError(data.error ?? "Failed to fetch PKR/USD exchange rate");
          return;
        }

        setPkrUsdError(null);
        setPkrUsd(data);
      } catch {
        if (!cancelled) setPkrUsdError("Network error while fetching PKR/USD exchange rate");
      }
    }

    fetchPkrUsd();
    const interval = setInterval(fetchPkrUsd, PKR_USD_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const petrol = prices.find((p) => p.code === "PETROL");
  const hsd = prices.find((p) => p.code === "HSD");
  const lastVerifiedGas = mari?.lastVerified;
  const overallLive = !error && !mariShareError && prices.length > 0 && typeof mariShare?.price === "number";

  return (
    <div className="flex min-h-screen flex-col bg-mari-gray-bg">
      <header className="border-b-2 border-mari-green bg-mari-navy">
        <div className="mx-auto flex max-w-[1800px] items-center gap-4 px-4 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARI_LOGO_URL} alt="Mari Energies" className="h-6 w-auto" />
          <div className="h-4 w-px bg-white/20" />
          <span className="text-xs font-bold uppercase tracking-wide text-white/90">
            BDC Dashboard
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-mari-navy">Overview</h1>
            <p className="text-xs text-foreground/70">{today}</p>
          </div>
          <div className="flex items-center gap-2">
            <HormuzStatusBadge data={hormuzStatus} error={hormuzStatusError} />
            <LiveBadge isLive={overallLive} />
          </div>
        </div>

        {/* View controls — show/hide for everything below the KPI strip */}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="rounded-sm border border-mari-gray-light bg-white px-3 py-1 text-xs font-medium uppercase tracking-wider text-foreground/60 transition-colors hover:text-mari-navy"
          >
            {showDetails ? "Hide full report ▲" : "Show full report ▼"}
          </button>
        </div>

        {/* KPI strip, row 1 — Mari's own performance first (what management cares about most):
            share price, wellhead gas price, production vs national share, receivables, company
            news — in that order. */}
        <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-5">
          {typeof mariShare?.price === "number" && (
            <StatTile
              label="MARI Share (PSX)"
              value={`${mariShare.currency ?? "PKR"} ${mariShare.price.toFixed(2)}`}
              delta={mariShare.change}
              deltaPercent={mariShare.changePercent}
              direction={mariShare.direction}
              caption={
                <>
                  {typeof mariShare.marketCapPkrBn === "number" && (
                    <div>Market Cap: PKR {mariShare.marketCapPkrBn.toFixed(1)}bn</div>
                  )}
                  <div className="mt-1 border-t border-mari-gray-light/60 pt-1">
                    Div. Yield: {((MARI_DIVIDEND.dividendPerShareRs / mariShare.price) * 100).toFixed(2)}%
                    <span className="text-foreground/40">
                      {" "}
                      &middot; DPS Rs {MARI_DIVIDEND.dividendPerShareRs.toFixed(2)} &middot; Total Rs{" "}
                      {MARI_DIVIDEND.totalDividendRsBn}bn ({MARI_DIVIDEND.fiscalYearLabel})
                    </span>
                  </div>
                </>
              }
            />
          )}
          <GasComboTile
            benchmark={lastVerifiedGas?.benchmark}
            incremental={lastVerifiedGas?.incremental}
            periodShort={lastVerifiedGas?.periodShort}
            nextPeriodShort={mari?.nextPeriod?.periodShort}
            nextPeriodNotified={mari?.nextPeriod?.notified}
            nextPeriodPdfUrl={mari?.nextPeriod?.notified ? mari?.latestMariNotification?.pdfUrl : null}
          />
          <ProductionShareKpiTile data={MARI_PRODUCTION_SHARE} />
          <QuarterReceivablesTile {...RECEIVABLES_BY_QUARTER[RECEIVABLES_BY_QUARTER.length - 1]} />
          <NewsTickerTile
            heading="PSX Announcements"
            subheading="Mari Updates"
            items={psxAnnouncements?.announcements}
            error={psxAnnouncementsError}
            sourceNote="Source: PSX Data Portal (dps.psx.com.pk) · refreshed hourly, spans the 9:30am & 3:30pm market updates"
          />
        </div>

        {/* KPI strip, row 2 — external market & sector context: forward outlook, global
            benchmarks, national imports, retail fuel, sector news. LNG import volume still
            pending (see note above OIL_IMPORTS_LAST_MONTH). */}
        <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-5">
          <OilOutlookTrendTile />
          <GlobalOilBenchmarksTile benchmarks={oilBenchmarks?.benchmarks} error={oilBenchmarksError} />
          <OilImportsTile {...OIL_IMPORTS_LAST_MONTH} />
          <FuelComboTile petrol={petrol} hsd={hsd} pkrPerUsd={pkrUsd?.pkrPerUsd} />
          <NewsTickerTile
            heading="PPIS Sector News"
            subheading="E&P Sector Updates"
            items={ppisNews?.news}
            error={ppisNewsError}
            sourceNote="Source: PPIS Media Hub (ppisonline.com) · refreshed hourly, spans the 9am daily update"
          />
        </div>

        {/* KPI strip, row 3 — financial/operational depth: reserves position, current drilling
            activity, and finding cost (all Mari-specific; reserves/finding cost from the annual
            Integrated Annual Report, drilling activity from PPIS's login-gated Drilling Status
            report). Dividend yield is merged into the MARI Share tile's caption, and PKR/USD into
            the Petrol & HSD tile's footer, rather than standalone tiles here. */}
        <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-5">
          <ReservesKpiTile data={MARI_RESERVES} />
          <DrillingActivityKpiTile data={MARI_DRILLING_ACTIVITY} />
          <FindingCostKpiTile data={MARI_FINDING_COST} />
        </div>

        {showDetails && (
        <>
        {/* Trade receivables by counterparty */}
        <div className="mt-2">
          <Panel
            title="Mari Trade Receivables by Counterparty"
            meta="From quarterly financial reports (FY2025-26)"
          >
            <ReceivablesByQuarter />
          </Panel>
        </div>

        {/* Detail panels */}
        <div className="mt-2 grid grid-cols-1 gap-1 lg:grid-cols-2">
          <Panel
            title="PSO Retail Fuel Prices"
            badge={<LiveBadge isLive={!error && prices.length > 0} />}
            meta={effectiveFrom ? `Effective from ${effectiveFrom}` : undefined}
          >
            {error && <ErrorNote message={error} />}
            {prices.length > 0 && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {prices.map((p) => (
                  <div key={p.code}>
                    <div className="text-sm font-medium text-foreground/70">{p.label}</div>
                    <div className="mt-1 text-3xl font-semibold text-mari-navy">
                      {p.currency} {p.price.toFixed(2)}
                      <span className="ml-1 text-base font-normal text-foreground/60">/{p.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Mari Energies (MARI) Share Price"
            meta={mariShare?.asOf ? `As of ${mariShare.asOf} · PSX` : "Pakistan Stock Exchange (PSX)"}
          >
            {mariShareError && <ErrorNote message={mariShareError} />}
            {typeof mariShare?.price === "number" && (
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <div className="text-sm font-medium text-foreground/70">Last Traded Price</div>
                  <div className="mt-1 text-3xl font-semibold text-mari-navy">
                    {mariShare.currency ?? "PKR"} {mariShare.price.toFixed(2)}
                  </div>
                </div>
                <div
                  className={`flex items-center gap-2 text-lg font-semibold ${
                    mariShare.direction === "up"
                      ? "text-status-good"
                      : mariShare.direction === "down"
                        ? "text-status-critical"
                        : "text-foreground/60"
                  }`}
                >
                  <span aria-hidden>{mariShare.direction === "up" ? "▲" : mariShare.direction === "down" ? "▼" : "—"}</span>
                  <span>
                    {typeof mariShare.change === "number" && (
                      <>
                        {mariShare.change > 0 ? "+" : ""}
                        {mariShare.change.toFixed(2)}
                      </>
                    )}
                    {typeof mariShare.changePercent === "number" && (
                      <>
                        {" "}
                        ({mariShare.changePercent > 0 ? "+" : ""}
                        {mariShare.changePercent.toFixed(2)}%)
                      </>
                    )}
                  </span>
                </div>
                {typeof mariShare.previousClose === "number" && (
                  <div>
                    <div className="text-sm font-medium text-foreground/70">Previous Close (LDCP)</div>
                    <div className="mt-1 text-lg font-semibold text-foreground/80">
                      {mariShare.currency ?? "PKR"} {mariShare.previousClose.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>

          <Panel
            title={`Mari Field Prices${lastVerifiedGas ? ` (${lastVerifiedGas.periodShort})` : ""}`}
            meta={lastVerifiedGas ? lastVerifiedGas.reservoir : undefined}
          >
            {mariError && <ErrorNote message={mariError} />}
            {lastVerifiedGas && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-foreground/70">Benchmark / Normal Volumes</div>
                  <div className="mt-1 text-3xl font-semibold text-mari-navy">
                    {lastVerifiedGas.benchmark.currency} {lastVerifiedGas.benchmark.value.toFixed(4)}
                    <span className="ml-1 text-base font-normal text-foreground/60">/{lastVerifiedGas.benchmark.unit}</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground/70">Incremental Volumes</div>
                  <div className="mt-1 text-3xl font-semibold text-mari-navy">
                    {lastVerifiedGas.incremental.currency} {lastVerifiedGas.incremental.value.toFixed(4)}
                    <span className="ml-1 text-base font-normal text-foreground/60">/{lastVerifiedGas.incremental.unit}</span>
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="OGRA Notification Status" meta="Checked against the live OGRA listing">
            {mari && (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground/70">Latest published period group</span>
                  <span className="font-medium text-mari-navy">{mari.latestOgraPeriodGroup ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground/70">Latest Mari notification</span>
                  <span className="font-medium text-mari-navy">{mari.latestMariNotification?.period ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground/70">Notification PDF</span>
                  {mari.latestMariNotification ? (
                    mari.pdfAvailable ? (
                      <a
                        href={mari.latestMariNotification.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex"
                      >
                        <StatusPill status="good" label="Reachable" />
                      </a>
                    ) : (
                      <StatusPill status="critical" label="Unreachable (500)" />
                    )
                  ) : (
                    <StatusPill status="neutral" label="None found" />
                  )}
                </div>
                <p className="pt-1 text-xs text-foreground/50">
                  Benchmark/incremental figures above are only updated once a newly published PDF is manually
                  verified — OGRA&apos;s scanned notices have no text layer, so they aren&apos;t OCR&apos;d automatically.
                </p>
              </div>
            )}
          </Panel>

          <Panel
            title="Mari Share of National Production"
            meta={`Week of ${MARI_PRODUCTION_SHARE.periodLabel} · ${MARI_PRODUCTION_SHARE.source}`}
          >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <ProductionShareDonut
                label="Oil"
                mariValue={MARI_PRODUCTION_SHARE.oil.mariBbl}
                totalValue={MARI_PRODUCTION_SHARE.oil.totalBbl}
                unit={MARI_PRODUCTION_SHARE.oil.unit}
                color="#14963a"
              />
              <ProductionShareDonut
                label="Gas"
                mariValue={MARI_PRODUCTION_SHARE.gas.mariMmcft}
                totalValue={MARI_PRODUCTION_SHARE.gas.totalMmcft}
                unit={MARI_PRODUCTION_SHARE.gas.unit}
                color="#1ea0eb"
              />
            </div>
            <p className="mt-3 text-xs text-foreground/50">
              Login-gated source — pulled by hand when logged into PPIS's Upstream Activities portal, not polled
              automatically like the rest of this dashboard.
            </p>
          </Panel>

          <Panel title="Pakistan IMF Program Status" meta="EFF + RSF · updated per IMF review, not a live feed">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground/70">EFF (Extended Fund Facility)</span>
                <span className="font-medium text-mari-navy">
                  USD {IMF_PROGRAM.effTotalUsdBn.toFixed(1)}bn &middot; {IMF_PROGRAM.effMonths}-month &middot;
                  approved {IMF_PROGRAM.effApproved}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground/70">RSF (Resilience &amp; Sustainability Facility)</span>
                <span className="font-medium text-mari-navy">
                  USD {IMF_PROGRAM.rsfTotalUsdBn.toFixed(1)}bn &middot; {IMF_PROGRAM.rsfMonths}-month &middot;
                  approved {IMF_PROGRAM.rsfApproved}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground/70">Latest review completed</span>
                <span className="font-medium text-mari-navy">
                  {IMF_PROGRAM.latestReviewLabel} &middot; {IMF_PROGRAM.latestReviewDate}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground/70">Disbursed this tranche</span>
                <span className="font-medium text-mari-navy">
                  USD {IMF_PROGRAM.effTrancheUsdBn.toFixed(1)}bn (EFF) + USD{" "}
                  {(IMF_PROGRAM.rsfTrancheUsdBn * 1000).toFixed(0)}mn (RSF)
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground/70">Total disbursed to date</span>
                <span className="font-medium text-mari-navy">
                  USD {IMF_PROGRAM.totalDisbursedUsdBn.toFixed(1)}bn of {IMF_PROGRAM.totalFacilityUsdBn.toFixed(1)}bn
                  (~{((IMF_PROGRAM.totalDisbursedUsdBn / IMF_PROGRAM.totalFacilityUsdBn) * 100).toFixed(0)}%)
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground/70">Next review (test date)</span>
                <span className="font-medium text-mari-navy">
                  {IMF_PROGRAM.nextReviewLabel} &middot; {IMF_PROGRAM.nextReviewTestDate}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground/70">Expected next tranche</span>
                <span className="font-medium text-mari-navy">
                  &#8776;USD {IMF_PROGRAM.nextReviewEffUsdBn.toFixed(1)}bn (EFF) + &#8776;USD{" "}
                  {(IMF_PROGRAM.nextReviewRsfUsdBn * 1000).toFixed(0)}mn (RSF)
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground/70">Flagged risk (power-sector circular debt)</span>
                <span className="font-medium text-status-critical">
                  Rs {IMF_PROGRAM.circularDebtRsTn.toFixed(3)}tn ({IMF_PROGRAM.circularDebtAsOf}) — target missed
                </span>
              </div>
              <p className="pt-1 text-xs text-foreground/50">{IMF_PROGRAM.nextReviewLagNote}.</p>
              <p className="text-xs text-foreground/50">
                The circular-debt figure above is the national power-sector version of the same
                government/utility payment-delay problem behind Mari&apos;s own gas-sector receivables from
                SNGPL/SSGCL shown further up this page — different segment, same root cause.
              </p>
            </div>
          </Panel>

          <Panel
            title="6-Month Oil Price Outlook"
            meta={`${OIL_PRICE_OUTLOOK.horizonLabel} · as of ${OIL_PRICE_OUTLOOK.asOfDate} · aggregated from public forecasts, not a live feed`}
            className="lg:col-span-2"
          >
            <OilPriceOutlook />
          </Panel>
        </div>
        </>
        )}
      </main>

      <footer className="mt-4 bg-mari-gray-light/40">
        <div className="mx-auto max-w-[1800px] px-4 py-2 text-xs text-foreground/70">
          &copy; {new Date().getUTCFullYear()} Mari Energies Limited &mdash; internal fuel &amp; gas price monitoring
        </div>
      </footer>
    </div>
  );
}
