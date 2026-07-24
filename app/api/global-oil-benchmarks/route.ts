import { NextResponse } from "next/server";

const OILPRICE_CHARTS_URL = "https://oilprice.com/oil-price-charts/";

// oilprice.com's chart table keys each row by a stable numeric data-id (survives page redesigns
// better than name-based matching). Arab Light appears TWICE on this page — data-id 4402 is the
// daily-updating market estimate (under "OPEC Members (Daily Pricing)"), data-id 30 is the
// official monthly Aramco Official Selling Price (under "OPEC Members (Monthly Pricing)", labeled
// "(24-Day Delay)"). We want the daily one — do not swap this to id 30.
const BLENDS = [
  { id: "4402", code: "ARAB_LIGHT", label: "Arab Light" },
  { id: "48", code: "OMAN", label: "Oman (DME)" },
  { id: "4397", code: "DAS", label: "Das" },
  { id: "45", code: "WTI", label: "WTI" },
  { id: "46", code: "BRENT", label: "Brent" },
  { id: "29", code: "OPEC_BASKET", label: "OPEC Basket" },
] as const;

function extractRow(html: string, id: string) {
  const idIdx = html.indexOf(`data-id='${id}'`);
  if (idIdx === -1) return null;

  const chunk = html.slice(idIdx, idIdx + 700);
  const priceMatch = chunk.match(/data-price='([\-\d.]+)'/);
  const changeMatch = chunk.match(/class='change_(?:up|down)(?:\s+flat_change_cell)?'>([\-+\d.]+)<\/td>/);
  const percentMatch = chunk.match(/class='change_(?:up|down)_percent(?:\s+percent_change_cell)?'>([\-+\d.]+)%/);
  const delayMatch = chunk.match(/blend_update_text'>\(([^)]+)\)/);

  if (!priceMatch) return null;

  return {
    price: parseFloat(priceMatch[1]),
    change: changeMatch ? parseFloat(changeMatch[1]) : null,
    changePercent: percentMatch ? parseFloat(percentMatch[1]) : null,
    delay: delayMatch ? delayMatch[1] : null,
  };
}

export async function GET() {
  try {
    const res = await fetch(OILPRICE_CHARTS_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; bdc-oil-prices-dashboard/1.0)" },
      next: { revalidate: 1800 },
    });

    if (!res.ok) {
      throw new Error(`oilprice.com request failed: ${res.status}`);
    }

    const html = await res.text();

    const benchmarks = BLENDS.map(({ id, code, label }) => {
      const row = extractRow(html, id);
      return { code, label, ...row };
    });

    if (benchmarks.every((b) => b.price === undefined)) {
      throw new Error("Could not find any benchmark rows on the oilprice.com chart page — the site layout may have changed.");
    }

    return NextResponse.json({
      benchmarks,
      currency: "USD",
      unit: "barrel",
      fetchedAt: new Date().toISOString(),
      source: OILPRICE_CHARTS_URL,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error fetching global oil benchmarks";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
