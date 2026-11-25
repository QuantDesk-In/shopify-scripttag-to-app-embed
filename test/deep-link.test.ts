import { describe, expect, it } from "vitest";
import { buildActivationLink } from "../src/deep-link.js";

const apiKey = "3a9f0c1e5b7d2f8a4c6e0b1d3f5a7c9e";

describe("buildActivationLink", () => {
  it("builds the documented URL with a literal slash in activateAppId", () => {
    expect(buildActivationLink({ shop: "cool-store.myshopify.com", apiKey, blockHandle: "app-embed" })).toBe(
      `https://cool-store.myshopify.com/admin/themes/current/editor?context=apps&activateAppId=${apiKey}/app-embed`,
    );
  });

  it("adds the template when given", () => {
    const url = buildActivationLink({ shop: "cool-store.myshopify.com", apiKey, blockHandle: "app-embed", template: "product" });
    expect(url).toBe(
      `https://cool-store.myshopify.com/admin/themes/current/editor?context=apps&template=product&activateAppId=${apiKey}/app-embed`,
    );
  });

  it("accepts a shop with protocol or trailing path", () => {
    const url = buildActivationLink({ shop: "https://cool-store.myshopify.com/admin", apiKey, blockHandle: "app-embed" });
    expect(url.startsWith("https://cool-store.myshopify.com/admin/themes/current/editor?")).toBe(true);
  });

  it("rejects a domain that is not a myshopify.com store", () => {
    expect(() => buildActivationLink({ shop: "evil.example.com", apiKey, blockHandle: "app-embed" })).toThrow();
    expect(() => buildActivationLink({ shop: "cool-store.myshopify.com.evil.com", apiKey, blockHandle: "app-embed" })).toThrow();
  });
});
