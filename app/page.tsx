"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  BDC_TEAM_UPDATES,
  IMF_PROGRAM,
  MARI_DIVIDEND,
  MARI_DRILLING_ACTIVITY,
  MARI_FIELD_WELLHEAD_PRICES,
  MARI_FINDING_COST,
  MARI_OPERATORSHIP,
  MARI_PRODUCTION_SHARE,
  MARI_RESERVES,
  OIL_IMPORTS_LAST_MONTH,
  OIL_PRICE_OUTLOOK,
  PsxPeerPricesResponse,
  PSX_PEER_PRICES_POLL_INTERVAL_MS,
  RECEIVABLES_BY_QUARTER,
} from "./dashboard-data";

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
  "rounded-md border border-mari-gray-light border-t-[3px] border-t-mari-navy bg-mari-gray-bg p-3 shadow-sm transition-shadow duration-150 hover:shadow-md";

function fmtMn(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

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
      <div className="min-h-8 text-left text-xs font-extrabold uppercase tracking-wider text-mari-navy">
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
            <Cell fill="#26496e" />
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
      <div className="min-h-8 text-left text-xs font-extrabold uppercase tracking-wider text-mari-navy">
        Mari Production Share
        <span className="ml-1 font-normal normal-case text-foreground/40">&middot; wk of {data.periodLabel}</span>
      </div>
      <div className="mt-2 flex items-start justify-center gap-4">
        <ProductionShareStat
          percent={oilPercent}
          color="#1e9de8"
          label="Oil"
          unit={data.oil.unit}
          topProducer={data.oil.topProducer}
          totalValue={data.oil.totalBbl}
          mariValue={data.oil.mariBbl}
        />
        <ProductionShareStat
          percent={gasPercent}
          color="#00783c"
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
      <div className="min-h-8 text-left text-xs font-extrabold uppercase tracking-wider text-mari-navy">
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
  const fdTrend = trendArrow(data.fdCostUsdPerBoe.current, data.fdCostUsdPerBoe.priorFiveYearBaseline, false);
  const findingTrend = trendArrow(data.findingCostUsdPerBoe.current, data.findingCostUsdPerBoe.prior, false);

  return (
    <div className={KPI_CARD_CLASS}>
      <div className="min-h-8 text-left text-xs font-extrabold uppercase tracking-wider text-mari-navy">
        Finding &amp; Development Cost
        <span className="ml-1 font-normal normal-case text-foreground/40">&middot; {data.fiscalYearLabel}</span>
      </div>
      <div className="mt-2 flex items-end gap-1">
        <span className="text-2xl font-semibold text-mari-navy">{data.fdCostUsdPerBoe.current.toFixed(2)}</span>
        <span className="mb-0.5 text-sm font-normal text-foreground/50">USD/BOE</span>
        <span className={`mb-0.5 ml-1 text-xs font-medium ${fdTrend.color}`}>
          {fdTrend.arrow} vs {data.fdCostUsdPerBoe.priorFiveYearBaseline.toFixed(2)} (2020)
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-mari-gray-light/60 pt-2 text-xs">
        <span className="text-foreground/60">Finding Cost (exploration only)</span>
        <span className={`font-medium ${findingTrend.color}`}>
          {data.findingCostUsdPerBoe.current.toFixed(1)} {findingTrend.arrow} vs{" "}
          {data.findingCostUsdPerBoe.prior.toFixed(1)} prior yr
        </span>
      </div>
      <div className="mt-2 text-[10px] leading-snug text-foreground/50">
        F&amp;D = exploration + development capital spend per BOE of reserves added (5-yr rolling
        average). Still capex-only — not an all-in operating cost per BOE, which would also need
        production/lifting opex (not broken out at a per-BOE level in Mari&apos;s own disclosures).
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
      <div className="min-h-8 text-left text-xs font-extrabold uppercase tracking-wider text-mari-navy">
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

function OperatorshipKpiTile({ data }: { data: typeof MARI_OPERATORSHIP }) {
  const operatedPercent = (data.operated.total / data.totalAssets) * 100;
  const operatedExploration = data.operated.explorationOnshore + data.operated.explorationOffshore;
  const nonOperatedExploration = data.nonOperated.explorationOnshore + data.nonOperated.explorationOffshore;

  return (
    <div className={KPI_CARD_CLASS}>
      <div className="min-h-8 text-left text-xs font-extrabold uppercase tracking-wider text-mari-navy">
        Operatorship
        <span className="ml-1 font-normal normal-case text-foreground/40">&middot; blocks &amp; leases</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <DonutRing percent={operatedPercent} color="#c97c4b" size={64} />
        <div className="text-xs leading-tight">
          <div className="font-semibold text-mari-navy">{data.operated.total} Operated</div>
          <div className="text-foreground/60">{data.nonOperated.total} Non-Operated</div>
          <div className="mt-0.5 text-foreground/40">of {data.totalAssets} total assets</div>
        </div>
      </div>
      <div className="mt-2 space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-foreground/60">Exploration Licenses</span>
          <span className="font-medium text-mari-navy">
            {operatedExploration} op. / {nonOperatedExploration} non-op.
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-foreground/60">D&amp;P Leases</span>
          <span className="font-medium text-mari-navy">
            {data.operated.dpLeases} op. / {data.nonOperated.dpLeases} non-op.
          </span>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-foreground/40">
        Source: {data.source} &middot; as of {data.asOfDate}, updated by hand
      </div>
    </div>
  );
}

// Per-field wellhead gas price table, restricted to exactly the 6 fields in MARI_FIELD_WELLHEAD_
// PRICES, in that array's order (per an explicit 2026-08-03 request — don't add other fields back
// or re-sort). Jul-Dec 2026 shows the real notified price (not just a "Notified" badge) once OGRA
// publishes it and the PDF has been read; until then it blinks "Pending". See the comment on
// MARI_FIELD_WELLHEAD_PRICES for the daily-check/Jan-2027 cadence.
function GasFieldWellheadPricesKpiTile() {
  return (
    <div className={KPI_CARD_CLASS}>
      <div className="min-h-8 text-left text-xs font-extrabold uppercase tracking-wider text-mari-navy">
        Gas Field Wellhead Prices
        <span className="ml-1 font-normal normal-case text-foreground/40">&middot; USD/MMBTU</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-foreground/40">
        <span>Field</span>
        <span className="flex gap-3">
          <span className="w-14 text-right">Jan-Jun</span>
          <span className="w-16 text-right">Jul-Dec</span>
        </span>
      </div>
      <div className="mt-1 space-y-1 text-[11px]">
        {MARI_FIELD_WELLHEAD_PRICES.map((field) => {
          const isOperated = field.operator === "Mari Energies";
          return (
            <div key={field.fieldName} className="flex items-center justify-between gap-2">
              <span className={isOperated ? "font-semibold text-mari-navy" : "font-semibold text-mari-blue"}>
                {field.fieldName}
              </span>
              <span className="flex flex-shrink-0 items-center gap-3">
                <span className={isOperated ? "w-14 text-right font-medium text-mari-navy" : "w-14 text-right font-medium text-mari-blue"}>
                  ${field.janJun2026.value.toFixed(2)}
                </span>
                <span className="w-16 text-right">
                  {field.julDec2026 ? (
                    <span className="font-medium text-status-good">${field.julDec2026.value.toFixed(2)}</span>
                  ) : (
                    <span className="inline-block animate-blink font-medium text-status-warning">Pending</span>
                  )}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[10px] leading-snug text-foreground/40">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-mari-navy" /> Operated
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-mari-blue" /> Non-operated
        </span>
      </div>
      <div className="mt-1 text-[10px] leading-snug text-foreground/40">
        OGRA wellhead notifications &middot; checked daily at 10 AM for Jul-Dec 2026 prices.
      </div>
    </div>
  );
}

function ImfProgramTile() {
  const latestTranche = IMF_PROGRAM.effTrancheUsdBn + IMF_PROGRAM.rsfTrancheUsdBn;
  const nextTranche = IMF_PROGRAM.nextReviewEffUsdBn + IMF_PROGRAM.nextReviewRsfUsdBn;
  const disbursedPercent = (IMF_PROGRAM.totalDisbursedUsdBn / IMF_PROGRAM.totalFacilityUsdBn) * 100;

  return (
    <div className={KPI_CARD_CLASS}>
      <div className="min-h-8 text-left text-xs font-extrabold uppercase tracking-wider text-mari-navy">
        Pakistan IMF Program
        <span className="ml-1 font-normal normal-case text-foreground/40">&middot; EFF + RSF</span>
      </div>
      <div className="mt-2 space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-foreground/60">Facility</span>
          <span className="font-medium text-mari-navy">USD {IMF_PROGRAM.totalFacilityUsdBn.toFixed(1)}bn</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-foreground/60">Latest Tranche</span>
          <span className="text-right">
            <span className="font-medium text-mari-navy">USD {latestTranche.toFixed(2)}bn</span>
            <div className="text-[10px] text-foreground/40">{IMF_PROGRAM.latestReviewDate}</div>
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-foreground/60">Next Tranche</span>
          <span className="text-right">
            <span className="font-medium text-mari-navy">&#8776;USD {nextTranche.toFixed(2)}bn</span>
            <div className="text-[10px] text-foreground/40">test {IMF_PROGRAM.nextReviewTestDate}</div>
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-foreground/60">Circular Debt</span>
          <span className="text-right">
            <span className="font-medium text-status-critical">Rs {IMF_PROGRAM.circularDebtRsTn.toFixed(2)}tn</span>
            <div className="text-[10px] text-foreground/40">{IMF_PROGRAM.circularDebtAsOf}</div>
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-mari-gray-light/60 pt-2 text-sm">
        <span className="font-semibold text-foreground/70">Total Disbursed</span>
        <span className="font-semibold text-mari-green">
          USD {IMF_PROGRAM.totalDisbursedUsdBn.toFixed(1)}bn
          <span className="ml-1 text-xs font-normal text-foreground/50">({disbursedPercent.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="mt-2 text-[10px] text-foreground/40">
        Source: IMF Staff Report &middot; updated per review, not a live feed
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
      <div className="min-h-8 text-left text-xs font-extrabold uppercase tracking-wider text-mari-navy">
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

// One unified scrolling ticker for every "live price" figure on the dashboard — PSX quotes
// (Mari/OGDCL/PPL/Pakistan Oilfields, via /api/psx-peer-prices — PSX's own numbers, not a
// third-party feed), Petrol & HSD, USD/PKR, and the six global oil benchmarks. Replaces the
// former TradingView ticker-tape widget and a separate PSX-only ticker — those Petrol/HSD, USD/
// PKR, and Global Oil Benchmarks figures used to live in their own KPI tiles, which were removed
// once their data moved here, per explicit request.
function LiveTicker({
  psxPeerPrices,
  petrol,
  hsd,
  pkrUsd,
  oilBenchmarks,
}: {
  psxPeerPrices: PsxPeerPricesResponse | null;
  petrol?: PricePoint;
  hsd?: PricePoint;
  pkrUsd: PkrUsdResponse | null;
  oilBenchmarks: GlobalOilBenchmarksResponse | null;
}) {
  type Chip = { label: string; value: string; changeText?: string; changeColor?: string };
  const chips: Chip[] = [];

  (psxPeerPrices?.quotes ?? []).forEach((q) => {
    const isUp = q.direction === "up";
    const isDown = q.direction === "down";
    chips.push({
      label: q.companyName,
      value: q.price.toFixed(2),
      changeText: `${isUp ? "▲" : isDown ? "▼" : "—"} ${Math.abs(q.change).toFixed(2)}${
        typeof q.changePercent === "number" ? ` (${Math.abs(q.changePercent).toFixed(2)}%)` : ""
      }`,
      changeColor: isUp ? "text-status-good" : isDown ? "text-status-critical" : "text-foreground/50",
    });
  });

  if (petrol) chips.push({ label: "Petrol", value: `${petrol.currency} ${petrol.price.toFixed(2)}/${petrol.unit}` });
  if (hsd) chips.push({ label: "HSD", value: `${hsd.currency} ${hsd.price.toFixed(2)}/${hsd.unit}` });
  if (typeof pkrUsd?.pkrPerUsd === "number") {
    chips.push({ label: "USD/PKR", value: pkrUsd.pkrPerUsd.toFixed(2) });
  }

  (oilBenchmarks?.benchmarks ?? []).forEach((b) => {
    if (typeof b.price !== "number") return;
    const isUp = (b.changePercent ?? 0) > 0;
    const isDown = (b.changePercent ?? 0) < 0;
    chips.push({
      label: b.label,
      value: b.price.toFixed(2),
      changeText:
        typeof b.changePercent === "number"
          ? `${isUp ? "▲" : isDown ? "▼" : "—"} ${Math.abs(b.changePercent).toFixed(2)}%`
          : undefined,
      changeColor: isUp ? "text-status-good" : isDown ? "text-status-critical" : "text-foreground/50",
    });
  });

  if (chips.length === 0) {
    return (
      <div className="rounded-md border border-mari-gray-light bg-mari-gray-bg px-3 py-2 text-xs text-foreground/40">
        Loading live prices…
      </div>
    );
  }

  const doubled = [...chips, ...chips];

  return (
    <div className="flex items-stretch overflow-hidden rounded-md border border-mari-gray-light bg-mari-gray-bg">
      <div className="flex-shrink-0 self-center px-3 text-[10px] font-extrabold uppercase tracking-wide text-mari-blue">
        LIVE
      </div>
      <div className="flex-1 overflow-hidden">
        <div
          className="animate-marquee-horizontal inline-flex w-max items-center gap-8 whitespace-nowrap py-2 pl-[100%] text-sm hover:[animation-play-state:paused]"
          style={{ animationDuration: "110s" }}
        >
          {doubled.map((c, i) => (
            <span key={i} className="flex items-baseline gap-1.5">
              <span className="font-semibold text-foreground/70">{c.label}</span>
              <span className="font-semibold text-mari-navy">{c.value}</span>
              {c.changeText && <span className={`text-xs font-medium ${c.changeColor}`}>{c.changeText}</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// A single-line horizontal marquee for the BDC team's own internal announcements (see
// BDC_TEAM_UPDATES in app/dashboard-data.ts) — separate from the vertical PSX/PPIS news tickers
// above, since this is hand-authored department content, not scraped from any source.
function BdcUpdateBar({ updates }: { updates: { date: string; text: string }[] }) {
  if (updates.length === 0) return null;
  const doubled = [...updates, ...updates];

  return (
    <div className="mt-4 flex items-stretch overflow-hidden border-t-[3px] border-mari-navy bg-mari-gray-bg">
      <div className="flex-shrink-0 bg-mari-green px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-background">
        BDC Notice Board
      </div>
      <div className="flex-1 overflow-hidden">
        <div
          className="animate-marquee-horizontal inline-flex w-max items-center gap-14 whitespace-nowrap py-2 pl-[100%] text-sm text-foreground hover:[animation-play-state:paused]"
          style={{ animationDuration: "90s" }}
        >
          {doubled.map((u, i) => (
            <span key={i}>
              &#9670; {u.date !== "—" && <span className="text-foreground/50">{u.date} &mdash; </span>}
              {u.text}
            </span>
          ))}
        </div>
      </div>
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
    warning: "bg-status-warning/15 text-status-warning",
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
    <span className="inline-flex animate-pulse items-center gap-1.5 rounded-sm bg-status-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-status-warning">
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
      <div className="min-h-8 text-left text-xs font-extrabold uppercase tracking-wider text-mari-navy">
        Mari Field Gas Price
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
      <div className="min-h-8 text-left text-xs font-extrabold uppercase tracking-wider text-mari-navy">
        MariEnergies Receivables
        <span className="ml-1 font-normal normal-case text-foreground/40">
          &middot; {quarter} &middot; {period} &middot; PKR mn
        </span>
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
        <span className="font-semibold text-mari-green">
          {fmtMn(total)}
          <span className="ml-1 text-[10px] font-normal text-foreground/40">PKR mn</span>
        </span>
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
      <div className="rounded-sm border border-status-warning/40 bg-status-warning/10 p-2.5 text-xs text-foreground">
        <strong className="font-semibold">Not a prediction.</strong> {OIL_PRICE_OUTLOOK.disclaimer}
      </div>
      <p className="mt-3 text-xs text-foreground/70">{OIL_PRICE_OUTLOOK.contextSummary}</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {OIL_PRICE_OUTLOOK.scenarios.map((s) => (
          <div key={s.case} className="rounded-sm border border-mari-gray-light border-t-2 bg-mari-gray-bg p-3" style={{ borderTopColor: s.color }}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/70">
                <span className="h-1.5 w-1.5 animate-blink rounded-full" style={{ backgroundColor: s.color }} />
                {s.case}
              </span>
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
      <div className="min-h-8 text-left text-xs font-extrabold uppercase tracking-wider text-mari-navy">
        Oil Price Outlook
        <span className="ml-1 font-normal normal-case text-foreground/40">&middot; Brent scenario</span>
      </div>
      <div className="mt-1 h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={OIL_PRICE_OUTLOOK.trendPath} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#4c6f92" }} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={{ fontSize: 9, fill: "#4c6f92" }} axisLine={false} tickLine={false} domain={[60, 130]} width={26} />
            <Tooltip
              formatter={(value, name) => [`$${value}`, name]}
              contentStyle={{
                fontSize: 10,
                borderRadius: 2,
                background: "#153e62",
                borderColor: "#26496e",
                color: "#eaf2fa",
              }}
              itemStyle={{ color: "#eaf2fa" }}
              labelStyle={{ color: "#8facc6" }}
            />
            <Line type="monotone" dataKey="bull" name="Bull" stroke="#e4685d" strokeWidth={1.5} strokeDasharray="3 2" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="base" name="Base" stroke="#4c6f92" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="bear" name="Bear" stroke="#6fcf7a" strokeWidth={1.5} strokeDasharray="3 2" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex items-center justify-center gap-2 text-[9px] text-foreground/60">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-blink rounded-full bg-status-critical" />
          Bull $105-125
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-blink rounded-full bg-mari-blue" />
          Base $90-105
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-blink rounded-full bg-status-good" />
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
    <div className={`flex flex-col rounded-sm border border-mari-gray-light bg-mari-gray-bg p-4 ${className ?? ""}`}>
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
      <div className="min-h-8 text-left text-xs font-extrabold uppercase tracking-wider text-mari-navy">{label}</div>
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
  const [psxPeerPrices, setPsxPeerPrices] = useState<PsxPeerPricesResponse | null>(null);
  const [psxPeerPricesError, setPsxPeerPricesError] = useState<string | null>(null);
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

  useEffect(() => {
    let cancelled = false;

    async function fetchPsxPeerPrices() {
      try {
        const res = await fetch("/api/psx-peer-prices", { cache: "no-store" });
        const data: PsxPeerPricesResponse = await res.json();

        if (cancelled) return;

        if (!res.ok || (!data.quotes && data.error)) {
          setPsxPeerPricesError(data.error ?? "Failed to fetch PSX peer prices");
          return;
        }

        setPsxPeerPricesError(data.error ?? null);
        setPsxPeerPrices(data);
      } catch {
        if (!cancelled) setPsxPeerPricesError("Network error while fetching PSX peer prices");
      }
    }

    fetchPsxPeerPrices();
    const interval = setInterval(fetchPsxPeerPrices, PSX_PEER_PRICES_POLL_INTERVAL_MS);
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
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b-[3px] border-mari-navy bg-gradient-to-r from-background to-mari-gray-bg shadow-md">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MARI_LOGO_URL} alt="Mari Energies" className="h-7 w-auto" />
            <div className="h-5 w-px bg-white/25" />
            <span className="text-xs font-extrabold uppercase tracking-widest text-white">
              BDC Dashboard
            </span>
          </div>
          {/* View controls — show/hide for everything below the KPI strip. Moved here from
              beneath the Overview heading so that row is free for just the ticker tape. */}
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="rounded-sm border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            {showDetails ? "Hide full report ▲" : "Show full report ▼"}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="inline-block border-b-2 border-mari-green pb-0.5 text-lg font-extrabold tracking-tight text-mari-navy">
              Overview
            </h1>
            <p className="mt-1 text-xs text-foreground/70">{today}</p>
          </div>
          <div className="flex items-center gap-2">
            <HormuzStatusBadge data={hormuzStatus} error={hormuzStatusError} />
            <LiveBadge isLive={overallLive} />
          </div>
        </div>

        <div className="mt-3">
          <LiveTicker psxPeerPrices={psxPeerPrices} petrol={petrol} hsd={hsd} pkrUsd={pkrUsd} oilBenchmarks={oilBenchmarks} />
        </div>

        {/* KPI strip, row 1 — per the user's explicit 2026-07-27 ordering request (Mari Share
            Price, Price Notification / Mari Field Gas Price, Production Share, Drilling Activity),
            with Receivables then swapped out for PSX Announcements per a follow-up request the
            same day — Receivables moved to row 2's former PSX Announcements slot instead. */}
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
                  <div className="mt-1 space-y-0.5 border-t border-mari-gray-light/60 pt-1">
                    <div>Div. Yield: {((MARI_DIVIDEND.dividendPerShareRs / mariShare.price) * 100).toFixed(2)}%</div>
                    <div className="text-foreground/40">
                      DPS: Rs {MARI_DIVIDEND.dividendPerShareRs.toFixed(2)}
                    </div>
                    <div className="text-foreground/40">
                      Total: Rs {MARI_DIVIDEND.totalDividendRsBn}bn ({MARI_DIVIDEND.fiscalYearLabel})
                    </div>
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
          <DrillingActivityKpiTile data={MARI_DRILLING_ACTIVITY} />
          <NewsTickerTile
            heading="PSX Announcements"
            subheading="Mari Updates"
            items={psxAnnouncements?.announcements}
            error={psxAnnouncementsError}
            sourceNote="Source: PSX Data Portal (dps.psx.com.pk) · refreshed hourly, spans the 9:30am & 3:30pm market updates"
          />
        </div>

        {/* KPI strip, row 2 — Global Oil Benchmarks and Petrol & HSD (+ PKR/USD) were removed
            from here once their data moved into the top LiveTicker, per explicit request. Per a
            2026-08-03 request, Gas Field Wellhead Prices (previously its own row 4) and
            Operatorship (previously row 3) were moved into slots 2 and 3 here, pushing
            Receivables and PPIS Sector News right into slots 4 and 5. */}
        <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-5">
          <OilOutlookTrendTile />
          <GasFieldWellheadPricesKpiTile />
          <OperatorshipKpiTile data={MARI_OPERATORSHIP} />
          <QuarterReceivablesTile {...RECEIVABLES_BY_QUARTER[RECEIVABLES_BY_QUARTER.length - 1]} />
          <NewsTickerTile
            heading="E&P Updates"
            subheading="PPIS Sector News"
            items={ppisNews?.news}
            error={ppisNewsError}
            sourceNote="Source: PPIS Media Hub (ppisonline.com) · refreshed hourly, spans the 9am daily update"
          />
        </div>

        {/* KPI strip, row 3 — the remaining tiles not named in the user's explicit ordering:
            Mari's annual-snapshot financial-depth figures and the laggier external/macro context,
            all past/periodic rather than live. Operatorship moved out to row 2 (see above) on
            2026-08-03. LNG import volume still pending (see note above OIL_IMPORTS_LAST_MONTH). */}
        <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-5">
          <ReservesKpiTile data={MARI_RESERVES} />
          <FindingCostKpiTile data={MARI_FINDING_COST} />
          <OilImportsTile {...OIL_IMPORTS_LAST_MONTH} />
          <ImfProgramTile />
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
                color="#1e9de8"
              />
              <ProductionShareDonut
                label="Gas"
                mariValue={MARI_PRODUCTION_SHARE.gas.mariMmcft}
                totalValue={MARI_PRODUCTION_SHARE.gas.totalMmcft}
                unit={MARI_PRODUCTION_SHARE.gas.unit}
                color="#00783c"
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

      <BdcUpdateBar updates={BDC_TEAM_UPDATES} />

      <footer className="border-t-[3px] border-mari-navy bg-mari-gray-bg">
        <div className="mx-auto max-w-[1800px] px-4 py-2 text-xs font-medium text-foreground/70">
          &copy; {new Date().getUTCFullYear()} MariEnergies BDC Department Internal Dashboard
        </div>
      </footer>
    </div>
  );
}
