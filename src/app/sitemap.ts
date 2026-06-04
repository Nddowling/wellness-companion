import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/seo";

// Regenerate hourly so newly published programs appear without a redeploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/match`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/programs`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];

  // One entry per published program. Failures must not break the sitemap.
  let programs: MetadataRoute.Sitemap = [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("facilities")
      .select("id, updated_at")
      .eq("is_published", true)
      .order("updated_at", { ascending: false });

    programs = (data ?? []).map((f) => ({
      url: `${SITE_URL}/programs/${f.id}`,
      lastModified: f.updated_at ? new Date(f.updated_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // DB unavailable at build/runtime — ship the static routes anyway.
  }

  return [...staticRoutes, ...programs];
}
