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
// The production sitemap is currently well under both, so a single /sitemap.xml is
// correct — and it's what robots.txt points at. If the directory grows past 50k,
// states), split into a sitemap index THEN. Note: Next's `generateSitemaps` on the
// ROOT sitemap emits /sitemap/[id].xml shards but does NOT create a /sitemap.xml
// index, so a future split needs a nested sitemap route or an explicit index file.
const MAX_URLS_PER_FILE = 50000;

function sitemapDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

const STATIC_ROUTES = [
  ["/", "weekly", 1],
  ["/about", "monthly", 0.6],
  ["/contact", "monthly", 0.6],
  ["/data", "monthly", 0.6],
  ["/for-partners", "monthly", 0.6],
  ["/for-providers", "monthly", 0.6],
  ["/for-reps", "monthly", 0.6],
  ["/guides", "monthly", 0.7],
  ["/how-we-make-money", "monthly", 0.6],
  ["/insurance", "monthly", 0.7],
  ["/library", "monthly", 0.6],
  ["/match", "monthly", 0.9],
  ["/pricing", "monthly", 0.6],
  ["/privacy", "yearly", 0.3],
  ["/programs", "daily", 0.9],
  ["/resources", "monthly", 0.6],
  ["/terms", "yearly", 0.3],
  ["/treatment", "weekly", 0.9],
] as const;

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
  carriers_named: string[] | null;
  facility_payers: { payer_type: string }[];
};

// Build the full ordered URL list once (deduped per request via React cache).
const buildAll = cache(async (): Promise<MetadataRoute.Sitemap> => {
  const staticRoutes: MetadataRoute.Sitemap = [
    ...STATIC_ROUTES.map(([path, changeFrequency, priority]) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency,
      priority,
    })),
    ...PAYERS.map((payer) => ({
      url: `${SITE_URL}/insurance/${payer.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...GUIDES.map((g) => {
      const lastModified = sitemapDate(g.updated);
      return {
        url: `${SITE_URL}/guides/${g.slug}`,
        ...(lastModified ? { lastModified } : {}),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      };
    }),
  ];

  let programs: MetadataRoute.Sitemap = [];
  let landing: MetadataRoute.Sitemap = [];
  try {
    const supabase = createAdminClient();
    // Page past PostgREST's 1,000-row cap so EVERY published program reaches the
    // sitemap (we publish the full directory for SEO — tens of thousands of pages).
    const rows: SitemapFacility[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("facilities")
        .select("id, slug, updated_at, state, city, main_phone, intake_line, website, levels_of_care, carriers_named, facility_payers(payer_type)")
        .eq("is_published", true)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        console.error("[sitemap] facility page query failed", {
          code: error.code ?? "unknown",
          from,
        });
        throw new Error("Sitemap facility query failed.");
      }
      if (!data || data.length === 0) break;
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
      const lastModified = sitemapDate(f.updated_at);
      return [
        {
          url: `${SITE_URL}/treatment/${sslug}/${cslug}/${f.slug}`,
          ...(lastModified ? { lastModified } : {}),
          changeFrequency: "weekly" as const,
          priority: 0.8,
        },
      ];
    });

    // Programmatic SEO landing pages, derived only from combos that actually have
    // published programs. State + city hubs carry an honest lastmod = the newest
    // valid updated_at among their programs. We omit lastmod where there is no
    // defensible source timestamp instead of claiming every hourly rebuild changed it.
    // Only count PROFILE-INDEXABLE facilities toward combos, and require ≥3 to
    // include a combo (mirrors the pages' noindex gate — thin combos stay out).
    const states = new Set<string>();
    const stateCityCount = new Map<string, number>(); // "georgia|atlanta" -> n
    const stateLevelCount = new Map<string, number>(); // "georgia|detox" -> n
    const cityLevelCount = new Map<string, number>(); // "georgia|atlanta|detox" -> n
    const payerStateCount = new Map<string, number>(); // "payer_type|georgia" -> n
    const carrierStateCount = new Map<string, number>(); // "carrier_slug|georgia" -> n
    const stateLastMod = new Map<string, number>(); // sslug -> ms
    const cityLastMod = new Map<string, number>(); // "sslug|cslug" -> ms
    const typeStates = new Map<string, Set<string>>(); // payer_type -> set of state slugs (for /insurance/[payer] index)
    const carrierStates = new Map<string, Set<string>>(); // exact carrier slug -> state slugs
    const commercialByName = new Map(PAYERS.filter((p) => p.kind === 'commercial').map((p) => [p.name, p]));
    const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

    for (const f of rows) {
      const code = (f.state ?? "").toUpperCase();
      if (!code || !profileIndexable(f)) continue;
      const sslug = stateSlug(code);
      states.add(sslug);
      const modified = sitemapDate(f.updated_at);
      if (modified) {
        stateLastMod.set(sslug, Math.max(stateLastMod.get(sslug) ?? 0, modified.getTime()));
      }

      const cslug = f.city ? slugify(f.city) : null;
      if (cslug) {
        const ckey = `${sslug}|${cslug}`;
        bump(stateCityCount, ckey);
        if (modified) {
          cityLastMod.set(ckey, Math.max(cityLastMod.get(ckey) ?? 0, modified.getTime()));
        }
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
      for (const carrierName of f.carriers_named ?? []) {
        const payer = commercialByName.get(carrierName);
        if (!payer) continue; // only exact canonical carrier evidence creates SEO URLs
        if (!carrierStates.has(payer.slug)) carrierStates.set(payer.slug, new Set());
        carrierStates.get(payer.slug)!.add(sslug);
        bump(carrierStateCount, `${payer.slug}|${sslug}`);
      }
    }

    // Map each payer (incl. named carriers) onto states that have enough matching
    // facilities for an indexable payer×state landing page. The payer guides
    // themselves are static content and are always included above.
    const payerStatePages: string[] = [];
    for (const p of PAYERS) {
      const sset = p.kind === 'commercial' ? carrierStates.get(p.slug) : typeStates.get(p.payerType);
      if (!sset || sset.size === 0) continue;
      for (const s of sset) {
        const count =
          p.kind === 'commercial'
            ? carrierStateCount.get(`${p.slug}|${s}`) ?? 0
            : payerStateCount.get(`${p.payerType}|${s}`) ?? 0;
        if (landingIndexable(count)) {
          payerStatePages.push(`/insurance/${p.slug}/${s}`);
        }
      }
    }

    const mk = (
      path: string,
      priority: number,
      lastModified?: Date,
    ): MetadataRoute.Sitemap[number] => ({
      url: `${SITE_URL}${path}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "weekly" as const,
      priority,
    });

    // Combos only appear when they have ≥3 indexable facilities (landingIndexable).
    const keysAtLeast3 = (m: Map<string, number>) => [...m.entries()].filter(([, n]) => landingIndexable(n)).map(([k]) => k);
    landing = [
      // State hub pages — /treatment/[state] (state hubs are never thin; always index)
      ...[...states].map((s) => {
        const timestamp = stateLastMod.get(s);
        return mk(`/treatment/${s}`, 0.7, timestamp ? new Date(timestamp) : undefined);
      }),
      // City hub pages — /treatment/[state]/[city]
      ...keysAtLeast3(stateCityCount).map((k) => {
        const timestamp = cityLastMod.get(k);
        return mk(
          `/treatment/${k.split("|")[0]}/${k.split("|")[1]}`,
          0.6,
          timestamp ? new Date(timestamp) : undefined,
        );
      }),
      // Secondary landing: state×level, city×level, insurance×state (all ≥3-gated).
      ...keysAtLeast3(stateLevelCount).map((k) => mk(`/treatment/${k.split("|")[0]}/${k.split("|")[1]}`, 0.7)),
      ...keysAtLeast3(cityLevelCount).map((k) => {
        const [s, c, l] = k.split("|");
        return mk(`/treatment/${s}/${c}/${l}`, 0.6);
      }),
      ...payerStatePages.map((path) => mk(path, 0.6)),
    ];
  } catch (error) {
    // Do not cache a plausible-looking but incomplete sitemap. Crawlers retry
    // temporary route failures; a partial 200 response can hide thousands of
    // canonical profiles and landing pages until the cache expires.
    console.error("[sitemap] build failed; refusing a partial sitemap", {
      cause: error instanceof Error ? error.name : "unknown",
    });
    throw error;
  }

  // Defensive de-duplication keeps one canonical entry when dynamic dimensions
  // happen to converge on the same route path.
  return [...new Map([...staticRoutes, ...landing, ...programs].map((entry) => [entry.url, entry])).values()];
});

// Single /sitemap.xml with every URL. Refuse to emit an invalid oversized file;
// growth past the protocol limit must be handled with an explicit sitemap index.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const all = await buildAll();
  if (all.length > MAX_URLS_PER_FILE) {
    console.error(`[sitemap] ${all.length} URLs exceeds ${MAX_URLS_PER_FILE}/file; sitemap sharding is required.`);
    throw new Error("Sitemap URL limit exceeded.");
  }
  return all;
}
