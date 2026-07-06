import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Public, indexable surface = marketing + the program directory. Everything behind
// auth (dashboards, admin, APIs, account) is disallowed. AI crawlers are explicitly
// ALLOWLISTED (being cited in AI answers is the growth surface) — each gets the same
// disallow list, because a per-agent rule fully overrides the "*" rule for that agent,
// so omitting the disallows would expose /admin etc. to that bot.

// Traditional + AI search/answer engines we want crawling the public site.
const ALLOWED_AGENTS = [
  "*",
  "Googlebot",
  "Google-Extended", // Gemini / Google AI training + grounding
  "Bingbot", // also powers ChatGPT search retrieval
  "GPTBot", // OpenAI
  "OAI-SearchBot", // ChatGPT search
  "ChatGPT-User",
  "ClaudeBot", // Anthropic
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot", // Siri / Apple Intelligence
];

const DISALLOW = ["/admin", "/api/", "/me", "/home", "/bd", "/facility", "/get-started", "/login"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: ALLOWED_AGENTS.map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOW })),
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
