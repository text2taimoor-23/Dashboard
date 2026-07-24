import { NextResponse } from "next/server";

const PSX_MARI_URL = "https://dps.psx.com.pk/company/MARI";

// PSX's company page groups disclosures into three tabs under the "Announcements" section.
// "Others" is where general news/disclosures (corporate briefings, clarifications, etc.) land —
// not just financial-results transmissions — so all three are pulled and merged by date.
const PANELS = [
  { name: "Financial Results", category: "Financials" },
  { name: "Board Meetings", category: "Board Meeting" },
  { name: "Others", category: "News" },
] as const;

type Announcement = { date: string; title: string; category: string; pdfUrl: string };

function extractPanelRows(html: string, panelName: string, category: string): Announcement[] {
  const panelIdx = html.indexOf(`class="tabs__panel" data-name="${panelName}"`);
  if (panelIdx === -1) return [];

  const tbodyIdx = html.indexOf('<tbody class="tbl__body">', panelIdx);
  if (tbodyIdx === -1) return [];
  const tbodyEnd = html.indexOf("</tbody>", tbodyIdx);
  if (tbodyEnd === -1) return [];

  const chunk = html.slice(tbodyIdx, tbodyEnd);
  const rowRe =
    /<tr><td>([^<]+)<\/td><td>([^<]*)<\/td><td>[\s\S]*?href="(\/download\/document\/\d+\.pdf)"[^>]*>PDF<\/a><\/td><\/tr>/g;

  const rows: Announcement[] = [];
  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(chunk)) !== null) {
    rows.push({
      date: match[1].trim(),
      title: match[2].trim(),
      category,
      pdfUrl: `https://dps.psx.com.pk${match[3]}`,
    });
  }

  return rows;
}

export async function GET() {
  try {
    const res = await fetch(PSX_MARI_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; bdc-oil-prices-dashboard/1.0)" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error(`PSX request failed: ${res.status}`);
    }

    const html = await res.text();

    const all = PANELS.flatMap(({ name, category }) => extractPanelRows(html, name, category));

    if (all.length === 0) {
      throw new Error("Could not find any PSX announcements for MARI — the site layout may have changed.");
    }

    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      announcements: all.slice(0, 3),
      fetchedAt: new Date().toISOString(),
      source: PSX_MARI_URL,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error fetching PSX announcements";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
