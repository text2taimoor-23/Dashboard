import { NextResponse } from "next/server";

const OILPRICEAPI_BASE = "https://api.oilpriceapi.com/v1/prices/latest";

// Dubai Crude is the Gulf-linked benchmark closest to what Pakistan actually imports
// (more relevant here than Brent/WTI). JKM (Platts Japan-Korea-Marker) is the global
// spot LNG benchmark and the closest public proxy for what Pakistan pays on spot cargoes.
const COMMODITIES = [
  { code: "DUBAI_CRUDE_USD", key: "oil", label: "Dubai Crude" },
  { code: "JKM_LNG_USD", key: "lng", label: "JKM LNG" },
] as const;

type OilPriceApiResponse = {
  status?: string;
  data?: {
    code: string;
    price: number;
    currency: string;
    unit: string;
    as_of: string;
    changes?: { "24h"?: { percent: number; previous_price: number } };
  };
};

async function fetchCommodity(code: string, apiKey: string) {
  const res = await fetch(`${OILPRICEAPI_BASE}?by_code=${code}`, {
    headers: { Authorization: `Token ${apiKey}` },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`OilPriceAPI request failed for ${code}: ${res.status}`);
  }

  const json: OilPriceApiResponse = await res.json();
  if (!json.data) {
    throw new Error(`OilPriceAPI returned no data for ${code}`);
  }

  return {
    code: json.data.code,
    price: json.data.price,
    currency: json.data.currency,
    unit: json.data.unit,
    changePercent24h: json.data.changes?.["24h"]?.percent ?? null,
    previousPrice24h: json.data.changes?.["24h"]?.previous_price ?? null,
    asOf: json.data.as_of,
  };
}

export async function GET() {
  const apiKey = process.env.OILPRICEAPI_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OILPRICEAPI_KEY is not configured" }, { status: 500 });
  }

  try {
    const results = await Promise.allSettled(
      COMMODITIES.map(({ code }) => fetchCommodity(code, apiKey))
    );

    const payload: Record<string, unknown> = {};
    let firstError: string | null = null;

    results.forEach((result, i) => {
      const { key, label } = COMMODITIES[i];
      if (result.status === "fulfilled") {
        payload[key] = result.value;
      } else {
        firstError ??= `Failed to fetch ${label}: ${result.reason instanceof Error ? result.reason.message : "unknown error"}`;
      }
    });

    return NextResponse.json({
      ...payload,
      error: firstError,
      fetchedAt: new Date().toISOString(),
      source: "https://www.oilpriceapi.com/",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error fetching commodity prices";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
