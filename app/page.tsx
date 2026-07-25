"use client";

import { useEffect, useState } from "react";

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
  latestOgraPeriodGroup?: string | null;
  latestMariNotification?: { period: string; pdfUrl: string } | null;
  pdfAvailable?: boolean;
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

function ImfProgramTile() {
  const latestTranche = IMF_PROGRAM.effTrancheUsdBn + IMF_PROGRAM.rsfTrancheUsdBn;
  const nextTranche = IMF_PROGRAM.nextReviewEffUsdBn + IMF_PROGRAM.nextReviewRsfUsdBn;
  const disbursedPercent = (IMF_PROGRAM.totalDisbursedUsdBn / IMF_PROGRAM.totalFacilityUsdBn) * 100;

  return (
    <div className={KPI_CARD_CLASS}>
      <div className="text-xs font-medium uppercase tracking-wider text-foreground/60">
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
        <span className="ml-1 font-normal normal-case text-foreground/50">&middot; Day {data.dayCount}</span>
      )}
    </a>
  );
}

function FuelComboTile({ petrol, hsd }: { petrol?: PricePoint; hsd?: PricePoint }) {
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
    </div>
  );
}

function GasComboTile({
  benchmark,
  incremental,
  periodShort,
}: {
  benchmark?: MariPriceFigure;
  incremental?: MariPriceFigure;
  periodShort?: string;
}) {
  if (!benchmark && !incremental) return null;

  return (
    <div className={KPI_CARD_CLASS}>
      <div className="text-xs font-medium uppercase tracking-wider text-foreground/60">
        Gas Benchmark &amp; Incremental
        {periodShort && (
          <span className="ml-1 font-normal normal-case text-foreground/40">({periodShort})</span>
        )}
      </div>
      <div className="mt-2 flex items-end gap-4">
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
  caption?: string;
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

        setMariError(null);
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
            Fuel &amp; Gas Price Dashboard
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

        {/* KPI strip, row 1 — core price/financial stats at a glance */}
        <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-5">
          <FuelComboTile petrol={petrol} hsd={hsd} />
          <GasComboTile
            benchmark={lastVerifiedGas?.benchmark}
            incremental={lastVerifiedGas?.incremental}
            periodShort={lastVerifiedGas?.periodShort}
          />
          {typeof mariShare?.price === "number" && (
            <StatTile
              label="MARI Share (PSX)"
              value={`${mariShare.currency ?? "PKR"} ${mariShare.price.toFixed(2)}`}
              delta={mariShare.change}
              deltaPercent={mariShare.changePercent}
              direction={mariShare.direction}
              caption={
                typeof mariShare.marketCapPkrBn === "number"
                  ? `Market Cap: PKR ${mariShare.marketCapPkrBn.toFixed(1)}bn`
                  : undefined
              }
            />
          )}
          <QuarterReceivablesTile {...RECEIVABLES_BY_QUARTER[RECEIVABLES_BY_QUARTER.length - 1]} />
          <OilImportsTile {...OIL_IMPORTS_LAST_MONTH} />
        </div>

        {/* KPI strip, row 2 — market context + news, LNG import volume still pending (see note
            above OIL_IMPORTS_LAST_MONTH). Global Oil Benchmarks spans 2 columns since it carries
            the most content (6 rows) — keeps every tile in both rows the same column width. */}
        <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <GlobalOilBenchmarksTile benchmarks={oilBenchmarks?.benchmarks} error={oilBenchmarksError} />
          </div>
          <ImfProgramTile />
          <NewsTickerTile
            heading="PSX Announcements"
            subheading="Mari Updates"
            items={psxAnnouncements?.announcements}
            error={psxAnnouncementsError}
            sourceNote="Source: PSX Data Portal (dps.psx.com.pk) · refreshed hourly, spans the 9:30am & 3:30pm market updates"
          />
          <NewsTickerTile
            heading="PPIS Sector News"
            subheading="E&P Sector Updates"
            items={ppisNews?.news}
            error={ppisNewsError}
            sourceNote="Source: PPIS Media Hub (ppisonline.com) · refreshed hourly, spans the 9am daily update"
          />
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
