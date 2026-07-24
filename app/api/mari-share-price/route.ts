import { NextResponse } from "next/server";

const PSX_MARI_QUOTE_URL = "https://dps.psx.com.pk/company/MARI";

function extractBetween(html: string, re: RegExp): string | null {
  const match = html.match(re);
  return match ? match[1].trim() : null;
}

export async function GET() {
  try {
    const res = await fetch(PSX_MARI_QUOTE_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; bdc-oil-prices-dashboard/1.0)" },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`PSX website request failed: ${res.status}`);
    }

    const html = await res.text();

    const priceStr = extractBetween(html, /class="quote__close">Rs\.([\d,.]+)<\/div>/);
    const changeDirection = extractBetween(html, /class="quote__change change__text--(neg|pos)"/);
    const changeValueStr = extractBetween(html, /class="change__value">([-\d,.]+)<\/div>/);
    const changePercentStr = extractBetween(html, /class="change__percent">\s*\(([-\d,.]+)%\)<\/div>/);
    const ldcpStr = extractBetween(html, /class="stats_label">LDCP<\/div><div class="stats_value">([\d,.]+)<\/div>/);
    const asOf = extractBetween(html, /class="quote__date">\^?\s*As of ([^<]+)<\/div>/);
    // Equity Profile's "Market Cap (000's)" stat is in thousands of PKR — divide by 1e6 for PKR bn.
    const marketCapThousandsStr = extractBetween(
      html,
      /Market Cap \(000'<span[^>]*>s<\/span>\)<\/div><div class="stats_value">([\d,.]+)<\/div>/
    );

    if (priceStr === null || changeValueStr === null) {
      throw new Error("Could not find MARI share price on the PSX page — the site layout may have changed.");
    }

    const price = parseFloat(priceStr.replace(/,/g, ""));
    const changeValue = parseFloat(changeValueStr.replace(/,/g, ""));
    const changePercent = changePercentStr ? parseFloat(changePercentStr.replace(/,/g, "")) : null;
    const previousClose = ldcpStr ? parseFloat(ldcpStr.replace(/,/g, "")) : null;
    const direction = changeDirection === "pos" ? "up" : changeDirection === "neg" ? "down" : changeValue === 0 ? "flat" : changeValue > 0 ? "up" : "down";
    const marketCapPkrBn = marketCapThousandsStr
      ? parseFloat(marketCapThousandsStr.replace(/,/g, "")) / 1_000_000
      : null;

    return NextResponse.json({
      symbol: "MARI",
      companyName: "Mari Energies Limited",
      price,
      currency: "PKR",
      change: changeValue,
      changePercent,
      direction,
      previousClose,
      marketCapPkrBn,
      asOf,
      fetchedAt: new Date().toISOString(),
      source: PSX_MARI_QUOTE_URL,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error fetching MARI share price";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
