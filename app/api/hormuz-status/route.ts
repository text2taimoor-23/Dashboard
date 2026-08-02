import { NextResponse } from "next/server";

const STRAITS_LIVE_URL = "https://straits.live/";

export async function GET() {
  try {
    const res = await fetch(STRAITS_LIVE_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; bdc-oil-prices-dashboard/1.0)" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error(`straits.live request failed: ${res.status}`);
    }

    const html = await res.text();

    // straits.live embeds a plain-text share/SEO summary that's more stable than its CSS
    // classes, e.g. `Strait of Hormuz: Closed. Day 155 since closure. Brent $87.93.
    // War-risk 8.0x normal.` — it's serialized inside a JS string literal with escaped quotes
    // (\"text\":\"...\"), so match on the sentence itself rather than the surrounding JSON keys.
    // The site dropped the "(±X%)" change figure that used to follow the Brent price at some
    // point (confirmed 2026-08-02 — it broke this route's match entirely since the group was
    // required), so that part is now optional and brentChangePercent may come back null.
    const summaryMatch = html.match(
      /Strait of Hormuz:\s*(Open|Closed)\.\s*Day (\d+) since closure\.\s*Brent \$([\d.]+)(?:\s*\(([-+]?[\d.]+)%\))?\.\s*War-risk ([\d.]+)/i
    );
    if (!summaryMatch) {
      throw new Error("Could not find the Strait of Hormuz status summary — the site layout may have changed.");
    }

    const [, statusText, dayText, brentText, brentChangeText, warRiskText] = summaryMatch;
    const timestampMatch = html.match(/<span class="eyebrow">([^<]+)<\/span>/);

    return NextResponse.json({
      status: statusText.toLowerCase(),
      dayCount: parseInt(dayText, 10),
      brentPrice: parseFloat(brentText),
      brentChangePercent: brentChangeText ? parseFloat(brentChangeText) : null,
      warRiskMultiplier: parseFloat(warRiskText),
      asOf: timestampMatch ? timestampMatch[1] : null,
      fetchedAt: new Date().toISOString(),
      source: STRAITS_LIVE_URL,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error fetching Strait of Hormuz status";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
