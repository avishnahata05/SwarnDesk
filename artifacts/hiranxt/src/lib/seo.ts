import { useEffect } from "react";

export const SITE_URL = "https://swarndesk.in";
export const SITE_NAME = "SwarnDesk";
export const SUPPORT_PHONE = "+91 89894 96800";
export const SUPPORT_PHONE_INTL = "+918989496800";
export const WHATSAPP_URL = "https://wa.me/918989496800";

interface SEOOptions {
  /** Document title, without the site name suffix — that's added automatically. */
  title: string;
  description: string;
  /** Path starting with "/", used to build the canonical URL and og:url. */
  path: string;
  /** Defaults to "website"; use "article" for blog posts. */
  type?: "website" | "article";
  image?: string;
  keywords?: string;
  /** One or more JSON-LD objects to inject as <script type="application/ld+json"> tags. */
  jsonLd?: object | object[];
  noindex?: boolean;
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

const MANAGED_JSONLD_ATTR = "data-seo-managed";

function setJsonLd(jsonLd: object | object[] | undefined) {
  document.head.querySelectorAll(`script[${MANAGED_JSONLD_ATTR}]`).forEach(el => el.remove());
  if (!jsonLd) return;
  const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  for (const item of items) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute(MANAGED_JSONLD_ATTR, "true");
    script.textContent = JSON.stringify(item);
    document.head.appendChild(script);
  }
}

/**
 * Sets per-route document title, meta tags, canonical link, and JSON-LD for this CSR app.
 * The static tags in index.html cover the "/" landing route for the pre-hydration crawl;
 * this hook keeps every other route (blog posts included) correct after the client mounts.
 */
export function useSEO(opts: SEOOptions) {
  useEffect(() => {
    const fullTitle = opts.path === "/" ? opts.title : `${opts.title} | ${SITE_NAME}`;
    document.title = fullTitle;

    upsertMeta("name", "description", opts.description);
    if (opts.keywords) upsertMeta("name", "keywords", opts.keywords);
    upsertMeta("name", "robots", opts.noindex ? "noindex, follow" : "index, follow");

    const url = `${SITE_URL}${opts.path}`;
    upsertLink("canonical", url);

    upsertMeta("property", "og:type", opts.type ?? "website");
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", opts.description);
    upsertMeta("property", "og:image", opts.image ?? `${SITE_URL}/opengraph.jpg`);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", opts.description);
    upsertMeta("name", "twitter:image", opts.image ?? `${SITE_URL}/opengraph.jpg`);

    setJsonLd(opts.jsonLd);
  }, [opts.title, opts.description, opts.path, opts.type, opts.image, opts.keywords, opts.jsonLd, opts.noindex]);
}
