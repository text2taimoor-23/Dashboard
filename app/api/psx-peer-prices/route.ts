import { NextResponse } from "next/server";

// Same PSX Data Portal quote page already used by /api/mari-share-price, generalized to any
// listed symbol — dps.psx.com.pk/company/<SYMBOL>. Used here for the top-of-page ticker's four
// E&P peer quotes (Mari, OGDCL, PPL, Pakistan Oilfields) so they're PSX's own numbers, not a
// third-party feed.
const SYMBOLS = [
  { symbol: "MARI", companyName: "Mari Energies" },
  { symbol: "OGDC", companyName: "OGDCL" },
  { symbol: "PPL", companyName: "PPL" },
  { symbol: "POL", companyName: "Pakistan Oilfields" },
];

function extractBetween(html: string, re: RegExp): string | null {
  const match = html.match(re);
  return match ? match[1].trim() : null;
}

async function fetchQuote(symbol: string, companyName: string) {
  const url = `https://dps.psx.com.pk/company/${symbol}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; bdc-oil-prices-dashboard/1.0)" },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`PSX website request failed for ${symbol}: ${res.status}`);
  }

  const html = await res.text();
  const priceStr = extractBetween(html, /class="quote__close">Rs\.([\d,.]+)<\/div>/);
  const changeDirection = extractBetween(html, /class="quote__change change__text--(neg|pos)"/);
  const changeValueStr = extractBetween(html, /class="change__value">([-\d,.]+)<\/div>/);
  const changePercentStr = extractBetween(html, /class="change__percent">\s*\(([-\d,.]+)%\)<\/div>/);

  if (priceStr === null || changeValueStr === null) {
    throw new Error(`Could not find ${symbol} share price on the PSX page — the site layout may have changed.`);
  }

  const price = parseFloat(priceStr.replace(/,/g, ""));
  const changeValue = parseFloat(changeValueStr.replace(/,/g, ""));
  const changePercent = changePercentStr ? parseFloat(changePercentStr.replace(/,/g, "")) : null;
  const direction =
    changeDirection === "pos" ? "up" : changeDirection === "neg" ? "down" : changeValue === 0 ? "flat" : changeValue > 0 ? "up" : "down";

  return { symbol, companyName, price, currency: "PKR", change: changeValue, changePercent, direction, source: url };
}

export async function GET() {
  const results = await Promise.allSettled(SYMBOLS.map((s) => fetchQuote(s.symbol, s.companyName)));

  const quotes = results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((q): q is NonNullable<typeof q> => q !== null);

  const errors = results
    .map((r, i) => (r.status === "rejected" ? `${SYMBOLS[i].symbol}: ${r.reason}` : null))
    .filter((e): e is string => e !== null);

  if (quotes.length === 0) {
    return NextResponse.json({ error: errors.join("; ") || "Failed to fetch PSX peer prices" }, { status: 502 });
  }

  return NextResponse.json({
    quotes,
    error: errors.length > 0 ? errors.join("; ") : null,
    fetchedAt: new Date().toISOString(),
    source: "https://dps.psx.com.pk",
  });
}
