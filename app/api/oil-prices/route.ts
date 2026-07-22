import { NextResponse } from "next/server";

const PSO_FUEL_PRICES_URL = "https://psopk.com/en/fuels/fuel-prices";

const PRODUCTS = [
  { match: "PREMIER EURO 5", code: "PETROL", label: "Petrol (Premier Euro 5)" },
  { match: "HI-CETANE DIESEL EURO 5", code: "HSD", label: "HSD (Hi-Cetane Diesel Euro 5)" },
] as const;

function extractPrice(html: string, productMatch: string): number | null {
  const re = new RegExp(`<td>\\s*${productMatch}\\s*</td>\\s*<td>Rs\\.([\\d.]+)/Ltr</td>`, "i");
  const match = html.match(re);
  return match ? parseFloat(match[1]) : null;
}

function extractEffectiveDate(html: string): string | null {
  const match = html.match(/Effective From:\s*([^<]+?)\s*<img/);
  return match ? match[1].trim() : null;
}

export async function GET() {
  try {
    const res = await fetch(PSO_FUEL_PRICES_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; bdc-oil-prices-dashboard/1.0)" },
      next: { revalidate: 21600 },
    });

    if (!res.ok) {
      throw new Error(`PSO website request failed: ${res.status}`);
    }

    const html = await res.text();

    const prices = PRODUCTS.map(({ match, code, label }) => {
      const price = extractPrice(html, match);
      return { code, label, price, currency: "PKR", unit: "Ltr" };
    });

    if (prices.some((p) => p.price === null)) {
      throw new Error("Could not find Petrol/HSD prices on the PSO page — the site layout may have changed.");
    }

    return NextResponse.json({
      prices,
      effectiveFrom: extractEffectiveDate(html),
      fetchedAt: new Date().toISOString(),
      source: PSO_FUEL_PRICES_URL,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error fetching PSO fuel prices";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
