import { NextResponse } from "next/server";

// PPIS's news page is a Next.js client app whose content loads from this JSON API after
// hydration (nothing is in the initial server HTML) — call it directly instead of scraping
// markup. "press-release" and "publications" categories are currently empty; "sector-news" is
// the one PPIS actually publishes to (E&P licence/lease/discovery notices), already sorted
// newest-first by published_at.
const PPIS_NEWS_API = "https://ppisonline.com/api/blogs?category=sector-news&limit=3";
const PPIS_NEWS_BASE = "https://ppisonline.com/news";

type PpisBlogItem = {
  title: string;
  category: string;
  slug: string;
  date: { day: number; month: string };
  published_at: string;
  details: string;
};

function titleCase(month: string) {
  return month.charAt(0) + month.slice(1).toLowerCase();
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// PPIS's headlines ("Oil Discovery", "Extension of EL") are too generic to be useful on their
// own — the actual substance is in `details`. Condense that to the first 1-2 sentences (dropping
// well-depth/DST technical trailers on longer discovery notices) instead of showing the headline.
// Sentence boundaries require a following capital letter (or end of string) so periods inside
// abbreviations like "w.e.f." don't get misread as sentence ends.
function summarize(details: string): string {
  const text = stripHtml(details);
  const sentenceEndRe = /[.!?](?=\s+[A-Z]|\s*$)/g;
  const sentences: string[] = [];
  let start = 0;
  let match: RegExpExecArray | null;
  while ((match = sentenceEndRe.exec(text)) !== null) {
    sentences.push(text.slice(start, match.index + 1).trim());
    start = match.index + 1;
  }
  if (start < text.length) sentences.push(text.slice(start).trim());

  const summary = sentences.slice(0, 2).join(" ").trim() || text;
  return summary.length > 220 ? `${summary.slice(0, 217).trimEnd()}...` : summary;
}

export async function GET() {
  try {
    const res = await fetch(PPIS_NEWS_API, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; bdc-oil-prices-dashboard/1.0)" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error(`PPIS news API request failed: ${res.status}`);
    }

    const items: PpisBlogItem[] = await res.json();

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("PPIS returned no sector news items — the API shape may have changed.");
    }

    const news = items.slice(0, 3).map((item) => ({
      date: `${titleCase(item.date.month)} ${item.date.day}, ${new Date(item.published_at).getFullYear()}`,
      title: summarize(item.details),
      category: item.category,
      url: `${PPIS_NEWS_BASE}/${item.slug}`,
    }));

    return NextResponse.json({
      news,
      fetchedAt: new Date().toISOString(),
      source: "https://ppisonline.com/media-hub/news",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error fetching PPIS news";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
