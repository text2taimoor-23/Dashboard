"use client";

import { useEffect, useRef, useState } from "react";
import { Barlow_Condensed, Public_Sans, Space_Mono } from "next/font/google";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./blueprint.css";
import { useDashboardData } from "../useDashboardData";
import {
  IMF_PROGRAM,
  MARI_DIVIDEND,
  MARI_DRILLING_ACTIVITY,
  MARI_FINDING_COST,
  MARI_LOGO_URL,
  MARI_PRODUCTION_SHARE,
  MARI_RESERVES,
  OIL_IMPORTS_LAST_MONTH,
  OIL_PRICE_OUTLOOK,
  RECEIVABLES_BY_QUARTER,
} from "../dashboard-data";

const barlow = Barlow_Condensed({ weight: ["500", "600", "700"], subsets: ["latin"], variable: "--font-display" });
const spaceMono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-mono" });
const publicSans = Public_Sans({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-body" });

function fmt2(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtMn(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function fmtWhole(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// TradingView's ticker-tape widget requires a real <script> element with an inline JSON config
// as its body — Next.js can't express that declaratively, so it's injected via a ref on mount.
function TickerTape() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.async = true;
    script.text = JSON.stringify({
      symbols: [
        { proName: "TVC:UKOIL", title: "Brent Crude" },
        { proName: "TVC:USOIL", title: "WTI Crude" },
        { proName: "NYMEX:NG1!", title: "Henry Hub Gas" },
        { proName: "FX_IDC:USDPKR", title: "USD/PKR" },
        { proName: "PSX:MARI", title: "Mari Energies" },
        { proName: "PSX:OGDC", title: "OGDCL" },
        { proName: "PSX:PPL", title: "PPL" },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: "adaptive",
      colorTheme: "dark",
      locale: "en",
    });
    container.appendChild(widgetDiv);
    container.appendChild(script);
  }, []);

  return (
    <div className="bp-ticker-wrap">
      <div ref={containerRef} className="tradingview-widget-container" />
    </div>
  );
}

function PipelineDivider() {
  return (
    <div className="bp-pipeline-divider">
      <svg viewBox="0 0 1000 40" preserveAspectRatio="none">
        <line className="bp-pipe-line" x1="0" y1="20" x2="1000" y2="20" />
        <circle className="bp-flange" cx="120" cy="20" r="7" />
        <circle className="bp-flange" cx="320" cy="20" r="7" />
        <circle className="bp-flange" cx="680" cy="20" r="7" />
        <circle className="bp-flange" cx="880" cy="20" r="7" />
        <circle className="bp-valve-body" cx="500" cy="20" r="11" />
        <circle className="bp-valve-body" cx="500" cy="20" r="4" />
        <line className="bp-valve-spoke" x1="500" y1="5" x2="500" y2="35" />
        <line className="bp-valve-spoke" x1="485" y1="20" x2="515" y2="20" />
      </svg>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="bp-section-label">{children}</div>;
}

function Panel({
  eyebrow,
  sub,
  sheet,
  dwg,
  status,
  revDate,
  children,
}: {
  eyebrow: string;
  sub?: string;
  sheet: string;
  dwg: string;
  status: string;
  revDate: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bp-panel bp-regmark">
      <div className="bp-panel-head">
        <span className="bp-panel-eyebrow">
          {eyebrow}
          {sub && <small>{sub}</small>}
        </span>
        <span className="bp-sheet-num">{sheet}</span>
      </div>
      <div style={{ flex: 1 }}>{children}</div>
      <div className="bp-title-block">
        <div>
          <b>DWG</b>
          {dwg}
        </div>
        <div>
          <b>REV</b>
          {revDate}
        </div>
        <div>
          <b>STATUS</b>
          {status}
        </div>
      </div>
    </section>
  );
}

function Row({ k, v, total }: { k: string; v: React.ReactNode; total?: boolean }) {
  return (
    <div className={`bp-row${total ? " total" : ""}`}>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

function BpDonut({ percent, color, size }: { percent: number; color: string; size: number }) {
  const data = [
    { name: "Mari", value: percent },
    { name: "Rest", value: 100 - percent },
  ];
  return (
    <div style={{ position: "relative", height: size, width: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="68%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill={color} />
            <Cell fill="#2a4a68" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          fontSize: size >= 100 ? "1.1rem" : "0.68rem",
          color: "var(--paper)",
        }}
      >
        {percent.toFixed(percent < 10 ? 2 : 1)}%
      </div>
    </div>
  );
}

export default function BlueprintPreview() {
  const d = useDashboardData();
  const now = useClock();

  const dividendYield =
    typeof d.mariShare?.price === "number" ? (MARI_DIVIDEND.dividendPerShareRs / d.mariShare.price) * 100 : null;
  const q = RECEIVABLES_BY_QUARTER[RECEIVABLES_BY_QUARTER.length - 1];
  const oilPercent = (MARI_PRODUCTION_SHARE.oil.mariBbl / MARI_PRODUCTION_SHARE.oil.totalBbl) * 100;
  const gasPercent = (MARI_PRODUCTION_SHARE.gas.mariMmcft / MARI_PRODUCTION_SHARE.gas.totalMmcft) * 100;
  const mariWellsPercent = (MARI_DRILLING_ACTIVITY.mariWells.total / MARI_DRILLING_ACTIVITY.totalWellsNational) * 100;
  const latestTranche = IMF_PROGRAM.effTrancheUsdBn + IMF_PROGRAM.rsfTrancheUsdBn;
  const disbursedPercent = (IMF_PROGRAM.totalDisbursedUsdBn / IMF_PROGRAM.totalFacilityUsdBn) * 100;
  const revDate = d.today ?? "—";

  const notices = [...(d.psxAnnouncements?.announcements ?? []), ...(d.ppisNews?.news ?? [])];

  return (
    <div className={`bp-root ${barlow.variable} ${spaceMono.variable} ${publicSans.variable}`}>
      <div className="bp-draft-banner">
        DRAFT PREVIEW — not the live dashboard · for review before publishing
      </div>
      <div className="bp-dashboard">
        <header className="bp-topbar">
          <div className="bp-brand-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MARI_LOGO_URL} alt="Mari Energies" style={{ height: 34, width: "auto" }} />
            <div className="bp-brand-sub">BD&amp;C DEPT — DWG. BDC-BOARD-01 — SCALE N.T.S.</div>
          </div>
          <div className="bp-time-block">
            <div className="bp-clock">{now ? now.toLocaleTimeString("en-GB") : "--:--:--"}</div>
            <div className="bp-date-row">
              {now
                ? now.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
                : "Loading date…"}
            </div>
            <div className={`bp-live-tag${d.hormuzStatus?.status === "closed" ? " is-critical" : ""}`}>
              <span className="bp-live-dot" />
              {d.overallLive ? "Feed live" : "Feed reconnecting"}
            </div>
          </div>
        </header>

        <TickerTape />

        <div className="bp-stat-row">
          <div className="bp-stat-card bp-regmark">
            <div className="bp-stat-label">
              MARI Share (PSX) <span className="bp-tag-live">LIVE</span>
            </div>
            <div className="bp-stat-value">
              {typeof d.mariShare?.price === "number" ? `PKR ${fmt2(d.mariShare.price)}` : "—"}
            </div>
            <div className="bp-stat-sub">
              {typeof d.mariShare?.change === "number"
                ? `${d.mariShare.direction === "up" ? "▲" : d.mariShare.direction === "down" ? "▼" : "—"} ${d.mariShare.change.toFixed(
                    2
                  )} (${(d.mariShare.changePercent ?? 0).toFixed(2)}%)`
                : "Loading…"}
            </div>
          </div>
          <div className="bp-stat-card bp-regmark">
            <div className="bp-stat-label">
              USD / PKR <span className="bp-tag-live">LIVE</span>
            </div>
            <div className="bp-stat-value">{typeof d.pkrUsd?.pkrPerUsd === "number" ? fmt2(d.pkrUsd.pkrPerUsd) : "—"}</div>
            <div className="bp-stat-sub">Indicative market rate · not for transactions</div>
          </div>
          <div className="bp-stat-card bp-regmark">
            <div className="bp-stat-label">
              Mari Field Gas Price <span className="bp-tag-live">LIVE</span>
            </div>
            <div className="bp-stat-value">
              {typeof d.lastVerifiedGas?.benchmark?.value === "number" ? fmt2(d.lastVerifiedGas.benchmark.value) : "—"}
            </div>
            <div className="bp-stat-sub">
              PKR/MMBTU benchmark · {d.lastVerifiedGas?.periodShort ?? "—"}
            </div>
          </div>
          <div className="bp-stat-card bp-regmark">
            <div className="bp-stat-label">
              Strait of Hormuz <span className="bp-tag-sample">RISK</span>
            </div>
            <div className="bp-stat-value" style={{ color: d.hormuzStatus?.status === "closed" ? "var(--bad)" : "var(--good)" }}>
              {d.hormuzStatus?.status ? d.hormuzStatus.status.toUpperCase() : "—"}
            </div>
            <div className="bp-stat-sub">
              {typeof d.hormuzStatus?.dayCount === "number" ? `Day ${d.hormuzStatus.dayCount}* since closure declared` : "Loading…"}
            </div>
          </div>
        </div>

        <main style={{ flex: 1 }}>
          <SectionLabel>Financial Performance &amp; Corporate</SectionLabel>
          <div className="bp-grid-panels">
            <Panel eyebrow="MARI Share (PSX)" sheet="FIN 1/5" dwg="BDC-FIN-01" status={d.overallLive ? "Live" : "Reconnecting"} revDate={revDate}>
              <div className="bp-hero">
                <span className="bp-hero-number">
                  {typeof d.mariShare?.price === "number" ? fmt2(d.mariShare.price) : "—"}
                </span>
                <span className="bp-hero-unit">PKR</span>
                {typeof d.mariShare?.change === "number" && (
                  <div className={`bp-hero-delta ${d.mariShare.direction === "up" ? "good" : d.mariShare.direction === "down" ? "bad" : ""}`}>
                    {d.mariShare.direction === "up" ? "▲" : d.mariShare.direction === "down" ? "▼" : "—"} {d.mariShare.change.toFixed(2)} (
                    {(d.mariShare.changePercent ?? 0).toFixed(2)}%)
                  </div>
                )}
              </div>
              {typeof d.mariShare?.marketCapPkrBn === "number" && <Row k="Market Cap" v={`PKR ${d.mariShare.marketCapPkrBn.toFixed(1)}bn`} />}
              {dividendYield !== null && <Row k="Div. Yield" v={`${dividendYield.toFixed(2)}%`} />}
              <Row k="DPS" v={`Rs ${MARI_DIVIDEND.dividendPerShareRs.toFixed(2)}`} />
              <Row k="Total Dividend" v={`Rs ${MARI_DIVIDEND.totalDividendRsBn}bn`} total />
              <div className="bp-panel-note">Source: PSX real-time quote &middot; {MARI_DIVIDEND.fiscalYearLabel}</div>
            </Panel>

            <Panel eyebrow="Receivables" sub="MariEnergies" sheet="FIN 2/5" dwg="BDC-FIN-02" status="Hand-verified" revDate={revDate}>
              <Row k="SNGPL" v={fmtMn(q.sngpl)} />
              <Row k="SSGCL" v={fmtMn(q.ssgcl)} />
              <Row k="Refineries" v={fmtMn(q.refineries)} />
              <Row k="Others" v={fmtMn(q.others)} />
              <Row k="Total (PKR mn)" v={fmtMn(q.total)} total />
              <div className="bp-panel-note">{q.quarter} &middot; {q.period}</div>
            </Panel>

            <Panel eyebrow="Reserves & Resources" sub="2P, MMBOE" sheet="FIN 3/5" dwg="BDC-FIN-03" status="Annual" revDate={revDate}>
              <div className="bp-hero">
                <span className="bp-hero-number accent">{MARI_RESERVES.reserves2pMmboe.current.toFixed(1)}</span>
                <span className="bp-hero-unit">MMBOE</span>
                <div className="bp-hero-delta good">
                  ▲ {(MARI_RESERVES.reserves2pMmboe.current - MARI_RESERVES.reserves2pMmboe.prior).toFixed(1)} vs prior
                </div>
              </div>
              <Row k="Reserve Replacement Ratio" v={`${MARI_RESERVES.reserveReplacementRatioPercent}%`} />
              <Row k="R/P (years)" v={`${MARI_RESERVES.reservesToProductionYears.current}`} />
              <Row k="Total 2P + 2C" v={`${MARI_RESERVES.totalReservesAndResourcesMmboe.current} MMBOE`} total />
              <div className="bp-panel-note">As of {MARI_RESERVES.asOfDate}, updated annually</div>
            </Panel>

            <Panel eyebrow="Finding & Development Cost" sub={MARI_FINDING_COST.fiscalYearLabel} sheet="FIN 4/5" dwg="BDC-FIN-04" status="Annual" revDate={revDate}>
              <div className="bp-hero">
                <span className="bp-hero-number accent">{MARI_FINDING_COST.fdCostUsdPerBoe.current.toFixed(2)}</span>
                <span className="bp-hero-unit">USD/BOE</span>
                <div className="bp-hero-delta good">▼ vs {MARI_FINDING_COST.fdCostUsdPerBoe.priorFiveYearBaseline.toFixed(2)} (2020)</div>
              </div>
              <Row k="Finding Cost (exploration only)" v={MARI_FINDING_COST.findingCostUsdPerBoe.current.toFixed(1)} />
              <div className="bp-panel-note">
                F&amp;D = exploration + development capex per BOE added (5-yr rolling avg) — not an all-in operating cost.
              </div>
            </Panel>

            <Panel eyebrow="PSX Announcements" sub="Mari Updates" sheet="FIN 5/5" dwg="BDC-FIN-05" status="Hourly poll" revDate={revDate}>
              {(d.psxAnnouncements?.announcements ?? []).slice(0, 4).map((a, i) => (
                <Row key={i} k={a.date} v={<span style={{ fontFamily: "var(--font-body)" }}>{a.title.slice(0, 34)}{a.title.length > 34 ? "…" : ""}</span>} />
              ))}
              {!d.psxAnnouncements && <div className="bp-panel-note">Loading…</div>}
              <div className="bp-panel-note">Source: PSX Data Portal</div>
            </Panel>
          </div>

          <PipelineDivider />
          <SectionLabel>Operational Performance</SectionLabel>
          <div className="bp-grid-panels">
            <Panel eyebrow="Mari Field Gas Price" sheet="OPS 1/4" dwg="BDC-OPS-01" status="Semi-annual" revDate={revDate}>
              <div style={{ marginBottom: "0.6rem" }}>
                <span className="bp-pill soon">{d.mari?.nextPeriod?.notified ? "NOTIFIED" : "PENDING"}</span>
                <span style={{ marginLeft: "0.5rem", fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--muted)" }}>
                  {d.mari?.nextPeriod?.periodShort ?? "Next period"}
                </span>
              </div>
              <div className="bp-hero">
                <span className="bp-hero-number">
                  {typeof d.lastVerifiedGas?.benchmark?.value === "number" ? d.lastVerifiedGas.benchmark.value.toFixed(2) : "—"}
                </span>
                <span className="bp-hero-unit">PKR/MMBTU benchmark</span>
              </div>
              <Row
                k="Incremental"
                v={typeof d.lastVerifiedGas?.incremental?.value === "number" ? `${d.lastVerifiedGas.incremental.value.toFixed(4)} USD/MMBTU` : "—"}
              />
              <div className="bp-panel-note">Notified period: {d.lastVerifiedGas?.periodShort ?? "—"}</div>
            </Panel>

            <Panel eyebrow="Mari Production Share" sub={`wk of ${MARI_PRODUCTION_SHARE.periodLabel}`} sheet="OPS 2/4" dwg="BDC-OPS-02" status="Hand-verified weekly" revDate={revDate}>
              <div className="bp-donut-row">
                <div style={{ textAlign: "center" }}>
                  <BpDonut percent={oilPercent} color="var(--copper)" size={92} />
                  <div className="bp-panel-note">OIL</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <BpDonut percent={gasPercent} color="var(--safety)" size={92} />
                  <div className="bp-panel-note">GAS</div>
                </div>
              </div>
              <Row k="Oil top producer" v="OGDCL 55.2%" />
              <Row k="Gas top producer" v="Mari is #1" />
              <div className="bp-panel-note">Source: PPIS Upstream Activities · login-gated</div>
            </Panel>

            <Panel eyebrow="Drilling Activity" sub="active wells" sheet="OPS 3/4" dwg="BDC-OPS-03" status="Hand-verified" revDate={revDate}>
              <div className="bp-hero">
                <span className="bp-hero-number accent">{MARI_DRILLING_ACTIVITY.mariWells.total}</span>
                <span className="bp-hero-unit">
                  of {MARI_DRILLING_ACTIVITY.totalWellsNational} ({mariWellsPercent.toFixed(1)}%)
                </span>
              </div>
              <Row k="Exploratory" v={MARI_DRILLING_ACTIVITY.mariWells.exploratory} />
              <Row k="Appraisal / Development" v={MARI_DRILLING_ACTIVITY.mariWells.appraisalDevelopment} />
              <Row k="Top Driller" v={`${MARI_DRILLING_ACTIVITY.topDriller.name}`} />
              <div className="bp-panel-note">As of {MARI_DRILLING_ACTIVITY.asOfDate}</div>
            </Panel>

            <Panel eyebrow="E&P Updates" sub="PPIS Sector News" sheet="OPS 4/4" dwg="BDC-OPS-04" status="Hourly poll" revDate={revDate}>
              {(d.ppisNews?.news ?? []).slice(0, 4).map((a, i) => (
                <Row key={i} k={a.date} v={<span style={{ fontFamily: "var(--font-body)" }}>{a.title.slice(0, 34)}{a.title.length > 34 ? "…" : ""}</span>} />
              ))}
              {!d.ppisNews && <div className="bp-panel-note">Loading…</div>}
              <div className="bp-panel-note">Source: PPIS Media Hub</div>
            </Panel>
          </div>

          <PipelineDivider />
          <SectionLabel>External Market &amp; Macro Context</SectionLabel>
          <div className="bp-grid-panels">
            <Panel eyebrow="Global Oil Benchmarks" sub="USD/barrel" sheet="MKT 1/5" dwg="BDC-MKT-01" status="Live" revDate={revDate}>
              {(d.oilBenchmarks?.benchmarks ?? []).map((b) => (
                <Row
                  key={b.code}
                  k={b.label}
                  v={
                    typeof b.price === "number" ? (
                      <span>
                        {b.price.toFixed(2)}{" "}
                        <span style={{ color: (b.changePercent ?? 0) >= 0 ? "var(--good)" : "var(--bad)" }}>
                          {(b.changePercent ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(b.changePercent ?? 0).toFixed(2)}%
                        </span>
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
              ))}
              {!d.oilBenchmarks && <div className="bp-panel-note">Loading…</div>}
            </Panel>

            <Panel eyebrow="Petrol & HSD" sub="PKR/Ltr" sheet="MKT 2/5" dwg="BDC-MKT-02" status="Live" revDate={revDate}>
              <div className="bp-donut-row" style={{ gap: "1.6rem" }}>
                <div style={{ textAlign: "center" }}>
                  <div className="bp-hero-number">{d.petrol ? d.petrol.price.toFixed(2) : "—"}</div>
                  <div className="bp-panel-note">PETROL</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div className="bp-hero-number">{d.hsd ? d.hsd.price.toFixed(2) : "—"}</div>
                  <div className="bp-panel-note">HSD</div>
                </div>
              </div>
              <Row k="PKR/USD" v={typeof d.pkrUsd?.pkrPerUsd === "number" ? fmt2(d.pkrUsd.pkrPerUsd) : "—"} />
            </Panel>

            <Panel eyebrow="Oil Price Outlook" sub="Brent scenario, not a prediction" sheet="MKT 3/5" dwg="BDC-MKT-03" status="Periodic" revDate={revDate}>
              <div style={{ height: 110, marginTop: "-0.4rem" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={OIL_PRICE_OUTLOOK.trendPath} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#8facc6" }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis tick={{ fontSize: 9, fill: "#8facc6" }} axisLine={false} tickLine={false} domain={[60, 130]} width={26} />
                    <Tooltip
                      formatter={(value, name) => [`$${value}`, name]}
                      contentStyle={{ fontSize: 10, borderRadius: 2, background: "#123a5c", border: "1px solid rgba(234,242,250,0.16)", color: "#eaf2fa" }}
                    />
                    <Line type="monotone" dataKey="bull" name="Bull" stroke="#e4685d" strokeWidth={1.5} strokeDasharray="3 2" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="base" name="Base" stroke="#e4b73c" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="bear" name="Bear" stroke="#6fcf7a" strokeWidth={1.5} strokeDasharray="3 2" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bp-panel-note">{OIL_PRICE_OUTLOOK.horizonLabel} &middot; illustrative scenario ranges, not a forecast</div>
            </Panel>

            <Panel eyebrow="Pakistan Oil Imports" sub={OIL_IMPORTS_LAST_MONTH.periodLabel} sheet="MKT 4/5" dwg="BDC-MKT-04" status="~1 month lag" revDate={revDate}>
              <Row k="Total Petroleum" v={`${OIL_IMPORTS_LAST_MONTH.totalKt.toFixed(1)} kt`} />
              <Row k="Crude Oil" v={`${OIL_IMPORTS_LAST_MONTH.crudeKt.toFixed(1)} kt`} total />
              <div className="bp-panel-note">Source: {OIL_IMPORTS_LAST_MONTH.source}</div>
            </Panel>

            <Panel eyebrow="Pakistan IMF Program" sub="EFF + RSF" sheet="MKT 5/5" dwg="BDC-MKT-05" status="Per review" revDate={revDate}>
              <Row k="Facility" v={`USD ${IMF_PROGRAM.totalFacilityUsdBn.toFixed(1)}bn`} />
              <Row k="Latest Tranche" v={`USD ${latestTranche.toFixed(2)}bn`} />
              <Row k="Circular Debt" v={`Rs ${IMF_PROGRAM.circularDebtRsTn.toFixed(2)}tn`} />
              <Row k="Total Disbursed" v={`${disbursedPercent.toFixed(0)}% of facility`} total />
            </Panel>
          </div>
        </main>

        <PipelineDivider />
        <footer className="bp-notice-bar">
          <div className="bp-notice-label">Latest Updates</div>
          <div className="bp-marquee-track">
            {notices.length > 0
              ? [...notices, ...notices].map((n, i) => (
                  <a key={`${n.url}-${i}`} href={n.url} target="_blank" rel="noreferrer">
                    ◆ {n.date} — {n.title}
                  </a>
                ))
              : <span>◆ Loading latest PSX &amp; PPIS updates…</span>}
          </div>
        </footer>
      </div>
    </div>
  );
}
