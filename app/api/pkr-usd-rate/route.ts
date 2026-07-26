import { NextResponse } from "next/server";

// Free, no-API-key exchange rate service (exchangerate-api.com's open endpoint). Rates refresh
// roughly once every 24h per their own `time_next_update_utc` field, so polling more often than
// that just re-serves the same cached value — matched by this route's revalidate window.
const RATE_API_URL = "https://open.er-api.com/v6/latest/USD";

export async function GET() {
  try {
    const res = await fetch(RATE_API_URL, { next: { revalidate: 21600 } });

    if (!res.ok) {
      throw new Error(`Exchange rate API request failed: ${res.status}`);
    }

    const json = await res.json();
    const rate = json?.rates?.PKR;

    if (typeof rate !== "number") {
      throw new Error("Exchange rate API did not return a PKR rate — the response shape may have changed.");
    }

    return NextResponse.json({
      pkrPerUsd: rate,
      lastUpdatedUtc: json.time_last_update_utc ?? null,
      fetchedAt: new Date().toISOString(),
      source: "https://www.exchangerate-api.com/",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error fetching PKR/USD exchange rate";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
