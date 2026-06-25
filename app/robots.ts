import type { MetadataRoute } from "next";

// Allow crawling of public pages; keep the app/admin, API, auth, and Sentry tunnel out of the index.
const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/auth/", "/monitoring", "/login", "/extension/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
