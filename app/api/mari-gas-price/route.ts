import { NextResponse } from "next/server";

const OGRA_WELLHEAD_PAGE = "https://www.ogra.org.pk/well-head-gas-prices";

// Last figures actually confirmed by reading the OGRA notification PDF (OCR of the scanned
// gazette PDFs is unreliable for pricing data, so these are only updated by manually reading
// a newly published notification, not scraped automatically).
const LAST_VERIFIED_MARI_PRICE = {
  period: "January 01, 2026 to June 30, 2026",
  periodShort: "Jan - Jun 2026",
  reservoir: "Mari HRL & Mari Deep (Goru-B)",
  benchmark: { value: 490.3733, currency: "PKR", unit: "MMBTU" },
  incremental: { value: 5.3724, currency: "USD", unit: "MMBTU" },
  reference: "OGRA-Fin-28-9(85)/2015 dated Mar 30, 2026",
};

function extractLatestMariNotification(html: string) {
  const re = /<p>([^<]*\bMari\b[^<]*)<\/p>\s*<\/div>\s*<a href="(https:\/\/www\.ogra\.org\.pk\/download\/\d+)"/;
  const match = html.match(re);
  if (!match) return null;
  return { period: match[1].trim(), pdfUrl: match[2] };
}

function extractLatestPeriodGroupLabel(html: string) {
  const match = html.match(/Wellhead Gas Price Notifications Issued \(([^)]+)\)/);
  return match ? match[1].trim() : null;
}

async function isPdfReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  // The manually-verified benchmark/incremental figures don't depend on OGRA's site being
  // reachable — only the "latest notification" status check below does. OGRA's server 403s
  // requests from some hosting providers' IPs (seen from Vercel) even though it works fine from
  // a residential IP, so that check is isolated in its own try/catch: a scrape failure should only
  // degrade the OGRA Notification Status panel, not blank out the always-available gas price KPI.
  let latestPeriodGroup: string | null = null;
  let latestMari: { period: string; pdfUrl: string } | null = null;
  let pdfAvailable = false;
  let ograError: string | null = null;

  try {
    const res = await fetch(OGRA_WELLHEAD_PAGE, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; bdc-oil-prices-dashboard/1.0)" },
      next: { revalidate: 21600 },
    });

    if (!res.ok) {
      throw new Error(`OGRA website request failed: ${res.status}`);
    }

    const html = await res.text();
    latestPeriodGroup = extractLatestPeriodGroupLabel(html);
    latestMari = extractLatestMariNotification(html);
    pdfAvailable = latestMari ? await isPdfReachable(latestMari.pdfUrl) : false;
  } catch (err) {
    ograError = err instanceof Error ? err.message : "Unknown error checking OGRA notifications";
  }

  return NextResponse.json({
    lastVerified: LAST_VERIFIED_MARI_PRICE,
    latestOgraPeriodGroup: latestPeriodGroup,
    latestMariNotification: latestMari,
    pdfAvailable,
    ograError,
    fetchedAt: new Date().toISOString(),
    source: OGRA_WELLHEAD_PAGE,
  });
}
