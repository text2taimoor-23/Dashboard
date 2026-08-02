"use client";

import { useEffect, useState } from "react";
import {
  ApiResponse,
  CommodityApiResponse,
  COMMODITY_POLL_INTERVAL_MS,
  GlobalOilBenchmarksResponse,
  HormuzStatusResponse,
  HORMUZ_POLL_INTERVAL_MS,
  MariApiResponse,
  MariShareApiResponse,
  MARI_POLL_INTERVAL_MS,
  MARI_SHARE_POLL_INTERVAL_MS,
  OIL_BENCHMARKS_POLL_INTERVAL_MS,
  PkrUsdResponse,
  PKR_USD_POLL_INTERVAL_MS,
  PpisNewsResponse,
  PPIS_NEWS_POLL_INTERVAL_MS,
  POLL_INTERVAL_MS,
  PsxAnnouncementsResponse,
  PSX_ANNOUNCEMENTS_POLL_INTERVAL_MS,
  PsxPeerPricesResponse,
  PSX_PEER_PRICES_POLL_INTERVAL_MS,
} from "./dashboard-data";

// All the dashboard's live-polled state in one hook, shared by every page that renders this
// data (the live report at app/page.tsx, and any alternate-styling preview) so they can never
// drift out of sync with each other or duplicate fetch logic.
export function useDashboardData() {
  const [prices, setPrices] = useState<ApiResponse["prices"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(null);
  const [mari, setMari] = useState<MariApiResponse | null>(null);
  const [mariError, setMariError] = useState<string | null>(null);
  const [mariShare, setMariShare] = useState<MariShareApiResponse | null>(null);
  const [mariShareError, setMariShareError] = useState<string | null>(null);
  const [commodities, setCommodities] = useState<CommodityApiResponse | null>(null);
  const [commodityError, setCommodityError] = useState<string | null>(null);
  const [oilBenchmarks, setOilBenchmarks] = useState<GlobalOilBenchmarksResponse | null>(null);
  const [oilBenchmarksError, setOilBenchmarksError] = useState<string | null>(null);
  const [psxAnnouncements, setPsxAnnouncements] = useState<PsxAnnouncementsResponse | null>(null);
  const [psxAnnouncementsError, setPsxAnnouncementsError] = useState<string | null>(null);
  const [hormuzStatus, setHormuzStatus] = useState<HormuzStatusResponse | null>(null);
  const [hormuzStatusError, setHormuzStatusError] = useState<string | null>(null);
  const [ppisNews, setPpisNews] = useState<PpisNewsResponse | null>(null);
  const [ppisNewsError, setPpisNewsError] = useState<string | null>(null);
  const [pkrUsd, setPkrUsd] = useState<PkrUsdResponse | null>(null);
  const [pkrUsdError, setPkrUsdError] = useState<string | null>(null);
  const [psxPeerPrices, setPsxPeerPrices] = useState<PsxPeerPricesResponse | null>(null);
  const [psxPeerPricesError, setPsxPeerPricesError] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchPrices() {
      try {
        const res = await fetch("/api/oil-prices", { cache: "no-store" });
        const data: ApiResponse = await res.json();
        if (cancelled) return;
        if (!res.ok || data.error) {
          setError(data.error ?? "Failed to fetch fuel prices");
          return;
        }
        setError(null);
        setPrices(data.prices ?? []);
        setEffectiveFrom(data.effectiveFrom ?? null);
      } catch {
        if (!cancelled) setError("Network error while fetching fuel prices");
      }
    }

    fetchPrices();
    const interval = setInterval(fetchPrices, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchMari() {
      try {
        const res = await fetch("/api/mari-gas-price", { cache: "no-store" });
        const data: MariApiResponse = await res.json();
        if (cancelled) return;
        if (!res.ok || data.error) {
          setMariError(data.error ?? "Failed to check OGRA notifications");
          return;
        }
        setMariError(data.ograError ?? null);
        setMari(data);
      } catch {
        if (!cancelled) setMariError("Network error while checking OGRA notifications");
      }
    }

    fetchMari();
    const interval = setInterval(fetchMari, MARI_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchMariShare() {
      try {
        const res = await fetch("/api/mari-share-price", { cache: "no-store" });
        const data: MariShareApiResponse = await res.json();
        if (cancelled) return;
        if (!res.ok || data.error) {
          setMariShareError(data.error ?? "Failed to fetch MARI share price");
          return;
        }
        setMariShareError(null);
        setMariShare(data);
      } catch {
        if (!cancelled) setMariShareError("Network error while fetching MARI share price");
      }
    }

    fetchMariShare();
    const interval = setInterval(fetchMariShare, MARI_SHARE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchCommodities() {
      try {
        const res = await fetch("/api/commodity-prices", { cache: "no-store" });
        const data: CommodityApiResponse = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setCommodityError(data.error ?? "Failed to fetch oil/LNG prices");
          return;
        }
        setCommodityError(data.error ?? null);
        setCommodities(data);
      } catch {
        if (!cancelled) setCommodityError("Network error while fetching oil/LNG prices");
      }
    }

    fetchCommodities();
    const interval = setInterval(fetchCommodities, COMMODITY_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchOilBenchmarks() {
      try {
        const res = await fetch("/api/global-oil-benchmarks", { cache: "no-store" });
        const data: GlobalOilBenchmarksResponse = await res.json();
        if (cancelled) return;
        if (!res.ok || data.error) {
          setOilBenchmarksError(data.error ?? "Failed to fetch global oil benchmarks");
          return;
        }
        setOilBenchmarksError(null);
        setOilBenchmarks(data);
      } catch {
        if (!cancelled) setOilBenchmarksError("Network error while fetching global oil benchmarks");
      }
    }

    fetchOilBenchmarks();
    const interval = setInterval(fetchOilBenchmarks, OIL_BENCHMARKS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchPsxAnnouncements() {
      try {
        const res = await fetch("/api/psx-announcements", { cache: "no-store" });
        const data: PsxAnnouncementsResponse = await res.json();
        if (cancelled) return;
        if (!res.ok || data.error) {
          setPsxAnnouncementsError(data.error ?? "Failed to fetch PSX announcements");
          return;
        }
        setPsxAnnouncementsError(null);
        setPsxAnnouncements(data);
      } catch {
        if (!cancelled) setPsxAnnouncementsError("Network error while fetching PSX announcements");
      }
    }

    fetchPsxAnnouncements();
    const interval = setInterval(fetchPsxAnnouncements, PSX_ANNOUNCEMENTS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchHormuzStatus() {
      try {
        const res = await fetch("/api/hormuz-status", { cache: "no-store" });
        const data: HormuzStatusResponse = await res.json();
        if (cancelled) return;
        if (!res.ok || data.error) {
          setHormuzStatusError(data.error ?? "Failed to fetch Strait of Hormuz status");
          return;
        }
        setHormuzStatusError(null);
        setHormuzStatus(data);
      } catch {
        if (!cancelled) setHormuzStatusError("Network error while fetching Strait of Hormuz status");
      }
    }

    fetchHormuzStatus();
    const interval = setInterval(fetchHormuzStatus, HORMUZ_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchPpisNews() {
      try {
        const res = await fetch("/api/ppis-news", { cache: "no-store" });
        const data: PpisNewsResponse = await res.json();
        if (cancelled) return;
        if (!res.ok || data.error) {
          setPpisNewsError(data.error ?? "Failed to fetch PPIS news");
          return;
        }
        setPpisNewsError(null);
        setPpisNews(data);
      } catch {
        if (!cancelled) setPpisNewsError("Network error while fetching PPIS news");
      }
    }

    fetchPpisNews();
    const interval = setInterval(fetchPpisNews, PPIS_NEWS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchPkrUsd() {
      try {
        const res = await fetch("/api/pkr-usd-rate", { cache: "no-store" });
        const data: PkrUsdResponse = await res.json();
        if (cancelled) return;
        if (!res.ok || data.error) {
          setPkrUsdError(data.error ?? "Failed to fetch PKR/USD exchange rate");
          return;
        }
        setPkrUsdError(null);
        setPkrUsd(data);
      } catch {
        if (!cancelled) setPkrUsdError("Network error while fetching PKR/USD exchange rate");
      }
    }

    fetchPkrUsd();
    const interval = setInterval(fetchPkrUsd, PKR_USD_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchPsxPeerPrices() {
      try {
        const res = await fetch("/api/psx-peer-prices", { cache: "no-store" });
        const data: PsxPeerPricesResponse = await res.json();
        if (cancelled) return;
        if (!res.ok || (!data.quotes && data.error)) {
          setPsxPeerPricesError(data.error ?? "Failed to fetch PSX peer prices");
          return;
        }
        setPsxPeerPricesError(data.error ?? null);
        setPsxPeerPrices(data);
      } catch {
        if (!cancelled) setPsxPeerPricesError("Network error while fetching PSX peer prices");
      }
    }

    fetchPsxPeerPrices();
    const interval = setInterval(fetchPsxPeerPrices, PSX_PEER_PRICES_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const petrol = (prices ?? []).find((p) => p.code === "PETROL");
  const hsd = (prices ?? []).find((p) => p.code === "HSD");
  const lastVerifiedGas = mari?.lastVerified;
  const overallLive = !error && !mariShareError && (prices ?? []).length > 0 && typeof mariShare?.price === "number";

  return {
    prices: prices ?? [],
    error,
    effectiveFrom,
    mari,
    mariError,
    mariShare,
    mariShareError,
    commodities,
    commodityError,
    oilBenchmarks,
    oilBenchmarksError,
    psxAnnouncements,
    psxAnnouncementsError,
    hormuzStatus,
    hormuzStatusError,
    ppisNews,
    ppisNewsError,
    pkrUsd,
    pkrUsdError,
    psxPeerPrices,
    psxPeerPricesError,
    today,
    petrol,
    hsd,
    lastVerifiedGas,
    overallLive,
  };
}
