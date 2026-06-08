import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/seo";
import { LEVELS_OF_CARE } from "@/lib/constants";
import { stateSlug, slugify } from "@/lib/geo";
import { GUIDES } from "@/lib/guides";
import { PAYERS } from "@/lib/payers";

// Regenerate hourly so newly published programs + SEO landing pages appear without a redeploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/match`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/programs`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/treatment`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/guides`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
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
    const { data } = await supabase
      .from("facilities")
      .select("id, updated_at, state, city, levels_of_care, facility_payers(payer_type)")
      .eq("is_published", true)
      .order("updated_at", { ascending: false });
    const rows = data ?? [];

    // One entry per published program.
    programs = rows.map((f) => ({
      url: `${SITE_URL}/programs/${f.id}`,
      lastModified: f.updated_at ? new Date(f.updated_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    // Programmatic SEO landing pages: state, state×level, state×city — only for
    // (state, level/city) combos that actually have published programs.
    const stateLevels = new Set<string>(); // "georgia|detox"
    const stateCities = new Set<string>(); // "georgia|atlanta"
    const cityLevels = new Set<string>(); // "georgia|atlanta|detox"
    const states = new Set<string>();
    const typeStates = new Map<string, Set<string>>(); // payer_type -> set of state slugs
    for (const f of rows) {
      const code = (f.state ?? "").toUpperCase();
      if (!code) continue;
      const sslug = stateSlug(code);
      states.add(sslug);
      const cslug = f.city ? slugify(f.city) : null;
      if (cslug) stateCities.add(`${sslug}|${cslug}`);
      for (const l of (f.levels_of_care ?? []) as string[]) {
        if (!(LEVELS_OF_CARE as readonly string[]).includes(l)) continue;
        stateLevels.add(`${sslug}|${l}`);
        if (cslug) cityLevels.add(`${sslug}|${cslug}|${l}`);
      }
      for (const p of (f.facility_payers ?? []) as { payer_type: string }[]) {
        if (!typeStates.has(p.payer_type)) typeStates.set(p.payer_type, new Set());
        typeStates.get(p.payer_type)!.add(sslug);
      }
    }
    // Map each payer (incl. named carriers) onto the states that have its type.
    const payerPages: string[] = [];
    const payerStatePages: string[] = [];
    for (const p of PAYERS) {
      const sset = typeStates.get(p.payerType);
      if (!sset || sset.size === 0) continue;
      payerPages.push(`/insurance/${p.slug}`);
      for (const s of sset) payerStatePages.push(`/insurance/${p.slug}/${s}`);
    }
    const mk = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority,
    });
    landing = [
      ...[...states].map((s) => mk(`/treatment/${s}`, 0.7)),
      ...[...stateLevels].map((k) => mk(`/treatment/${k.split("|")[0]}/${k.split("|")[1]}`, 0.7)),
      ...[...stateCities].map((k) => mk(`/treatment/${k.split("|")[0]}/${k.split("|")[1]}`, 0.6)),
      ...[...cityLevels].map((k) => {
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

  return [...staticRoutes, ...programs, ...landing];
}
