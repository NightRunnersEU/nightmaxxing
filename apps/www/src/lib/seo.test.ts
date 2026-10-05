import { describe, expect, it } from "vite-plus/test";

import { pageHead } from "./seo";

describe("pageHead", () => {
  it("gives every page its own og:url and canonical link", () => {
    const head = pageHead({ description: "About us", path: "/privacy", title: "Privacy" });

    expect(head.links).toEqual([{ href: "https://maxxing.nrght.eu/privacy", rel: "canonical" }]);
    expect(head.meta).toEqual([
      { title: "Privacy" },
      { content: "Privacy", property: "og:title" },
      { content: "About us", name: "description" },
      { content: "About us", property: "og:description" },
      { content: "website", property: "og:type" },
      { content: "https://maxxing.nrght.eu/privacy", property: "og:url" },
    ]);
  });

  it("marks noindex pages and drops their canonical link", () => {
    const head = pageHead({ noindex: true, path: "/settings" });

    expect(head.links).toEqual([]);
    expect(head.meta).toContainEqual({ content: "noindex, follow", name: "robots" });
  });

  it("appends page-specific meta after the defaults", () => {
    const head = pageHead({
      meta: [{ content: "https://maxxing.nrght.eu/og/a.png", property: "og:image" }],
      path: "/a",
      type: "profile",
    });

    expect(head.meta).toContainEqual({ content: "profile", property: "og:type" });
    expect(head.meta.at(-1)).toEqual({
      content: "https://maxxing.nrght.eu/og/a.png",
      property: "og:image",
    });
  });
});
