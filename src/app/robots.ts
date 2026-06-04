import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Public, indexable surface = marketing + the program directory. Everything
// behind auth (dashboards, admin, APIs, account) is disallowed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          "/me",
          "/home",
          "/bd",
          "/facility",
          "/get-started",
          "/login",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
