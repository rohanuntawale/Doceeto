import type { MetadataRoute } from "next";
import { COMPANY, POLICY_VERSION, absoluteUrl } from "@/lib/legal/company";
import { LEGAL_DOCS, legalHref } from "@/lib/legal/documents";
import { indexableEntries } from "@/lib/legal/site-map";

/**
 * /sitemap.xml — the machine-readable index, generated from the same registries
 * the human pages read, so a new legal document is submitted to search engines
 * the moment it is published.
 *
 * Only entries explicitly flagged `indexable` are emitted. Every signed-in
 * surface, the operations console and prescription share links are deliberately
 * absent: a search engine has no business crawling a patient's dashboard, and a
 * prescription token in an index would be a data breach.
 *
 * The human-readable counterpart lives at /sitemap.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(`${POLICY_VERSION.lastUpdated}T00:00:00Z`);

  const pages: MetadataRoute.Sitemap = indexableEntries().map((e) => ({
    url: absoluteUrl(e.href),
    lastModified,
    changeFrequency: e.changeFrequency ?? "monthly",
    priority: e.priority ?? 0.5,
  }));

  const legal: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/legal"),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
    ...LEGAL_DOCS.map((d) => ({
      url: absoluteUrl(legalHref(d.slug)),
      lastModified,
      changeFrequency: "yearly" as const,
      // The store-required policies are the ones reviewers and users actually
      // go looking for, so they outrank the rest.
      priority: d.storeRequired ? 0.6 : 0.4,
    })),
  ];

  const meta: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/sitemap"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  return [...pages, ...legal, ...meta];
}

/** Named so the origin is obvious in a diff if it is ever wrong. */
export const canonicalOrigin = COMPANY.web.origin;
