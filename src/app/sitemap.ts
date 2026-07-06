import type { MetadataRoute } from "next";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/seo";
import { LEVELS_OF_CARE } from "@/lib/constants";
import { stateSlug, slugify } from "@/lib/geo";
import { GUIDES } from "@/lib/guides";
import { PAYERS } from "@/lib/payers";
import { profileIndexable, landingIndexable } from "@/lib/indexable";

// Regenerate hourly so newly published programs + SEO landing pages appear without a redeploy.
export const revalidate = 3600;

// Google & Bing hard limits per sitemap FILE: 50,000 URLs or 50 MB uncompressed.
// We're currently ~29k URLs (well under both), so a single /sitemap.xml is correct —
// and it's what robots.txt points at. If the directory grows past ~50k (adding
// states), split into a sitemap index THEN. Note: Next's `generateSitemaps` on the
// ROOT sitemap emits /sitemap/[id].xml shards but does NOT create a /sitemap.xml
// index, so a future split needs a nested sitemap route or an explicit index file.
const MAX_URLS_PER_FILE = 50000;

type SitemapFacility = {
  id: string;
  slug: string | null;
  updated_at: string | null;
  state: string | null;
  city: string | null;
  main_phone: string | null;
  intake_line: string | null;
  website: string | null;
  levels_of_care: string[] | null;
  facility_payers: { payer_type: string }[];
};

// Build the FULL ordered URL list once (deduped per request via React cache).
// Order is stable — static → state hubs → city hubs → other landing → facility
// profiles — so slicing by CHUNK yields deterministic shards.
const buildAll = cache(async (): Promise<MetadataRoute.Sitemap> => {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/match`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/programs`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/treatment`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/guides`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/resources`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/data`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/how-we-make-money`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/for-providers`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    ...GUIDES.map((g) => ({
      url: `${SITE_URL}/guides/${g.slug}`,
      lastModified: new Date(g.updated),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];

  let programs: MetadataRoute.Sitemap = [];
  let landing: MetadataRoute.Sitemap = [];
  try {
    const supabase = createAdminClient();
    // Page past PostgREST's 1,000-row cap so EVERY published program reaches the
    // sitemap (we publish the full directory for SEO — tens of thousands of pages).
    const rows: SitemapFacility[] = [];
    const PAGE = 1000;
    for (let from = 0; from < 100000; from += PAGE) {
      const { data, error } = await supabase
        .from("facilities")
        .select("id, slug, updated_at, state, city, main_phone, intake_line, website, levels_of_care, facility_payers(payer_type)")
        .eq("is_published", true)
        .order("updated_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      rows.push(...(data as SitemapFacility[]));
      if (data.length < PAGE) break;
    }

    // One entry per published program — canonical SLUG URL (not the legacy UUID),
    // with the facility's real updated_at as lastmod.
    programs = rows.flatMap((f) => {
      if (!f.slug || !f.city || !f.state) return []; // can't form the slug URL
      if (!profileIndexable(f)) return []; // stub profiles are noindexed → keep them out of the sitemap
      const sslug = stateSlug(f.state.toUpperCase());
      const cslug = slugify(f.city);
      return [
        {
          url: `${SITE_URL}/treatment/${sslug}/${cslug}/${f.slug}`,
          lastModified: f.updated_at ? new Date(f.updated_at) : now,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        },
      ];
    });

    // Programmatic SEO landing pages, derived only from combos that actually have
    // published programs. State + city hubs carry an honest lastmod = the newest
    // updated_at among their programs; the secondary combos use `now`.
    // Only count PROFILE-INDEXABLE facilities toward combos, and require ≥3 to
    // include a combo (mirrors the pages' noindex gate — thin combos stay out).
    const states = new Set<string>();
    const stateCityCount = new Map<string, number>(); // "georgia|atlanta" -> n
    const stateLevelCount = new Map<string, number>(); // "georgia|detox" -> n
    const cityLevelCount = new Map<string, number>(); // "georgia|atlanta|detox" -> n
    const payerStateCount = new Map<string, number>(); // "payer_type|georgia" -> n
    const stateLastMod = new Map<string, number>(); // sslug -> ms
    const cityLastMod = new Map<string, number>(); // "sslug|cslug" -> ms
    const typeStates = new Map<string, Set<string>>(); // payer_type -> set of state slugs (for /insurance/[payer] index)
    const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

    for (const f of rows) {
      const code = (f.state ?? "").toUpperCase();
      if (!code || !profileIndexable(f)) continue;
      const sslug = stateSlug(code);
      const ts = f.updated_at ? new Date(f.updated_at).getTime() : now.getTime();
      states.add(sslug);
      stateLastMod.set(sslug, Math.max(stateLastMod.get(sslug) ?? 0, ts));

      const cslug = f.city ? slugify(f.city) : null;
      if (cslug) {
        const ckey = `${sslug}|${cslug}`;
        bump(stateCityCount, ckey);
        cityLastMod.set(ckey, Math.max(cityLastMod.get(ckey) ?? 0, ts));
      }
      for (const l of (f.levels_of_care ?? []) as string[]) {
        if (!(LEVELS_OF_CARE as readonly string[]).includes(l)) continue;
        bump(stateLevelCount, `${sslug}|${l}`);
        if (cslug) bump(cityLevelCount, `${sslug}|${cslug}|${l}`);
      }
      for (const p of (f.facility_payers ?? []) as { payer_type: string }[]) {
        if (!typeStates.has(p.payer_type)) typeStates.set(p.payer_type, new Set());
        typeStates.get(p.payer_type)!.add(sslug);
        bump(payerStateCount, `${p.payer_type}|${sslug}`);
      }
    }

    // Map each payer (incl. named carriers) onto the states that have ≥3 of its type.
    const payerPages: string[] = [];
    const payerStatePages: string[] = [];
    for (const p of PAYERS) {
      const sset = typeStates.get(p.payerType);
      if (!sset || sset.size === 0) continue;
      payerPages.push(`/insurance/${p.slug}`);
      for (const s of sset) {
        if (landingIndexable(payerStateCount.get(`${p.payerType}|${s}`) ?? 0)) {
          payerStatePages.push(`/insurance/${p.slug}/${s}`);
        }
      }
    }

    const mk = (path: string, priority: number, lastModified: Date = now): MetadataRoute.Sitemap[number] => ({
      url: `${SITE_URL}${path}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority,
    });

    // Combos only appear when they have ≥3 indexable facilities (landingIndexable).
    const keysAtLeast3 = (m: Map<string, number>) => [...m.entries()].filter(([, n]) => landingIndexable(n)).map(([k]) => k);
    landing = [
      // State hub pages — /treatment/[state] (state hubs are never thin; always index)
      ...[...states].map((s) => mk(`/treatment/${s}`, 0.7, new Date(stateLastMod.get(s) ?? now.getTime()))),
      // City hub pages — /treatment/[state]/[city]
      ...keysAtLeast3(stateCityCount).map((k) => mk(`/treatment/${k.split("|")[0]}/${k.split("|")[1]}`, 0.6, new Date(cityLastMod.get(k) ?? now.getTime()))),
      // Secondary landing: state×level, city×level, insurance×state (all ≥3-gated).
      ...keysAtLeast3(stateLevelCount).map((k) => mk(`/treatment/${k.split("|")[0]}/${k.split("|")[1]}`, 0.7)),
      ...keysAtLeast3(cityLevelCount).map((k) => {
        const [s, c, l] = k.split("|");
        return mk(`/treatment/${s}/${c}/${l}`, 0.6);
      }),
      ...(payerPages.length ? [mk(`/insurance`, 0.7)] : []),
      ...payerPages.map((path) => mk(path, 0.7)),
      ...payerStatePages.map((path) => mk(path, 0.6)),
    ];
  } catch {
    // DB unavailable at build/runtime — ship the static routes anyway.
  }

  return [...staticRoutes, ...landing, ...programs];
});

// Single /sitemap.xml with every URL. If we ever cross the per-file limit, Google
// only reads the first 50k, so surface it in logs as a signal to introduce sharding.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const all = await buildAll();
  if (all.length > MAX_URLS_PER_FILE) {
    console.warn(`[sitemap] ${all.length} URLs exceeds ${MAX_URLS_PER_FILE}/file — time to split into a sitemap index.`);
  }
  return all;
}
