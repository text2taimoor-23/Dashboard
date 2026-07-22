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

const POLL_INTERVAL_MS = 5 * 60_000;
const MARI_POLL_INTERVAL_MS = 30 * 60_000;
const MARI_SHARE_POLL_INTERVAL_MS = 5 * 60_000;
const MARI_LOGO_URL =
  "https://www.marienergies.com.pk/wp-content/themes/digitz/dist/img/logos/mari-energies.png";

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

function LiveBadge({ isLive }: { isLive: boolean }) {
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-mari-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-mari-green">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mari-green opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-mari-green" />
        </span>
        Live
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-mari-gray-light/40 px-3 py-1 text-xs font-bold uppercase tracking-wide text-foreground/60">
      <span className="h-2 w-2 rounded-full bg-foreground/40" />
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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${styles[status]}`}>
      <span className={`h-2 w-2 rounded-full ${dot[status]}`} />
      {label}
    </span>
  );
}

function FuelComboTile({ petrol, hsd }: { petrol?: PricePoint; hsd?: PricePoint }) {
  if (!petrol && !hsd) return null;
  const unit = petrol?.unit ?? hsd?.unit;
  const currency = petrol?.currency ?? hsd?.currency;

  return (
    <div className="rounded-lg border border-mari-gray-light/60 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
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
            <div className="text-2xl font-semibold text-mari-green">{petrol.price.toFixed(2)}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/50">Petrol</div>
          </div>
        )}
        {petrol && hsd && <div className="h-8 w-px self-stretch bg-mari-gray-light/60" />}
        {hsd && (
          <div>
            <div className="text-2xl font-semibold text-mari-blue">{hsd.price.toFixed(2)}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/50">HSD</div>
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
    <div className="rounded-lg border border-mari-gray-light/60 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
        Gas Benchmark &amp; Incremental
        {periodShort && (
          <span className="ml-1 font-normal normal-case text-foreground/40">({periodShort})</span>
        )}
      </div>
      <div className="mt-2 flex items-end gap-4">
        {benchmark && (
          <div>
            <div className="text-2xl font-semibold text-mari-green">
              {benchmark.value.toFixed(2)}
              <span className="ml-1 text-sm font-normal text-foreground/50">{benchmark.currency}</span>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/50">
              Benchmark &middot; /{benchmark.unit}
            </div>
          </div>
        )}
        {benchmark && incremental && <div className="h-8 w-px self-stretch bg-mari-gray-light/60" />}
        {incremental && (
          <div>
            <div className="text-2xl font-semibold text-mari-blue">
              {incremental.value.toFixed(4)}
              <span className="ml-1 text-sm font-normal text-foreground/50">{incremental.currency}</span>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/50">
              Incremental &middot; /{incremental.unit}
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
    <div className="rounded-lg border border-mari-gray-light/60 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
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
    <div className={`flex flex-col rounded-lg border border-mari-gray-light/60 bg-white p-6 shadow-sm ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight text-mari-navy">{title}</h2>
        {badge}
      </div>
      {meta && <div className="mt-1 text-xs text-foreground/50">{meta}</div>}
      <div className="mt-4 flex-1">{children}</div>
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
    <div className="rounded-lg border border-mari-gray-light/60 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-foreground/60">{label}</div>
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
  const [today, setToday] = useState<string | null>(null);

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

  const petrol = prices.find((p) => p.code === "PETROL");
  const hsd = prices.find((p) => p.code === "HSD");
  const lastVerifiedGas = mari?.lastVerified;
  const overallLive = !error && !mariShareError && prices.length > 0 && typeof mariShare?.price === "number";

  return (
    <div className="flex min-h-screen flex-col bg-mari-gray-bg">
      <header className="bg-mari-navy">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARI_LOGO_URL} alt="Mari Energies" className="h-9 w-auto" />
          <div className="h-6 w-px bg-white/20" />
          <span className="text-sm font-bold uppercase tracking-wide text-white/90">
            Fuel &amp; Gas Price Dashboard
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-mari-navy">Overview</h1>
            <p className="mt-1 text-sm text-foreground/70">{today}</p>
          </div>
          <LiveBadge isLive={overallLive} />
        </div>

        {/* KPI strip */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            />
          )}
        </div>

        {/* Trade receivables by counterparty */}
        <div className="mt-6">
          <Panel
            title="Mari Trade Receivables by Counterparty"
            meta="From quarterly financial reports (FY2025-26)"
          >
            <ReceivablesByQuarter />
          </Panel>
        </div>

        {/* Detail panels */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                  <div className="mt-1 text-3xl font-semibold text-mari-green">
                    {lastVerifiedGas.benchmark.currency} {lastVerifiedGas.benchmark.value.toFixed(4)}
                    <span className="ml-1 text-base font-normal text-foreground/60">/{lastVerifiedGas.benchmark.unit}</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground/70">Incremental Volumes</div>
                  <div className="mt-1 text-3xl font-semibold text-mari-blue">
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
        </div>
      </main>

      <footer className="mt-10 bg-mari-gray-light/40">
        <div className="mx-auto max-w-7xl px-6 py-4 text-xs text-foreground/70">
          &copy; {new Date().getUTCFullYear()} Mari Energies Limited &mdash; internal fuel &amp; gas price monitoring
        </div>
      </footer>
    </div>
  );
}
