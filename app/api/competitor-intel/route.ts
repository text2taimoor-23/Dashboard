import { NextResponse } from "next/server";

// Same PSX Data Portal "Announcements" scraping pattern already used by /api/psx-announcements
// for MARI itself, generalized to Mari's three listed E&P peers (the same tickers already tracked
// in /api/psx-peer-prices) — this is live, real market intelligence: each competitor's own PSX
// disclosures (financial results, board meetings, discoveries, corporate actions), not a
// third-party news aggregator. category is set to the company name (not the disclosure type) so
// the ticker reads as "which competitor did what", matching what a market-intel feed needs.
const COMPETITORS = [
  { symbol: "OGDC", companyName: "OGDCL" },
  { symbol: "PPL", companyName: "PPL" },
  { symbol: "POL", companyName: "Pakistan Oilfields" },
];

const PANELS = [
  { name: "Financial Results" },
  { name: "Board Meetings" },
  { name: "Others" },
] as const;

type CompetitorAnnouncement = { date: string; title: string; category: string; url: string };

function extractPanelRows(html: string, panelName: string, companyName: string): CompetitorAnnouncement[] {
  const panelIdx = html.indexOf(`class="tabs__panel" data-name="${panelName}"`);
  if (panelIdx === -1) return [];

  const tbodyIdx = html.indexOf('<tbody class="tbl__body">', panelIdx);
  if (tbodyIdx === -1) return [];
  const tbodyEnd = html.indexOf("</tbody>", tbodyIdx);
  if (tbodyEnd === -1) return [];

  const chunk = html.slice(tbodyIdx, tbodyEnd);
  const rowRe =
    /<tr><td>([^<]+)<\/td><td>([^<]*)<\/td><td>[\s\S]*?href="(\/download\/document\/\d+\.pdf)"[^>]*>PDF<\/a><\/td><\/tr>/g;

  const rows: CompetitorAnnouncement[] = [];
  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(chunk)) !== null) {
    rows.push({
      date: match[1].trim(),
      title: match[2].trim(),
      category: companyName,
      url: `https://dps.psx.com.pk${match[3]}`,
    });
  }

  return rows;
}

async function fetchCompetitorAnnouncements(symbol: string, companyName: string): Promise<CompetitorAnnouncement[]> {
  const url = `https://dps.psx.com.pk/company/${symbol}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; bdc-oil-prices-dashboard/1.0)" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`PSX request failed for ${symbol}: ${res.status}`);
  }

  const html = await res.text();
  return PANELS.flatMap(({ name }) => extractPanelRows(html, name, companyName));
}

export async function GET() {
  const results = await Promise.allSettled(
    COMPETITORS.map((c) => fetchCompetitorAnnouncements(c.symbol, c.companyName))
  );

  const all = results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((v): v is CompetitorAnnouncement[] => v !== null)
    .flat();

  const errors = results
    .map((r, i) => (r.status === "rejected" ? `${COMPETITORS[i].symbol}: ${r.reason}` : null))
    .filter((e): e is string => e !== null);

  if (all.length === 0) {
    return NextResponse.json(
      { error: errors.join("; ") || "Could not find any competitor announcements — the site layout may have changed." },
      { status: 502 }
    );
  }

  all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({
    announcements: all.slice(0, 5),
    error: errors.length > 0 ? errors.join("; ") : null,
    fetchedAt: new Date().toISOString(),
    source: "https://dps.psx.com.pk",
  });
}
