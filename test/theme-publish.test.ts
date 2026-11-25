import { describe, expect, it } from "vitest";
import { recheckAfterThemePublish } from "../src/theme-publish.js";
import { fixture } from "./fixtures.js";
import { mainTheme, mockClient, THEME_ID } from "./mock-client.js";

const options = {
  shop: "cool-store.myshopify.com",
  apiKey: "3a9f0c1e5b7d2f8a4c6e0b1d3f5a7c9e",
  appHandle: "example-widget",
  blockHandle: "app-embed",
};

describe("recheckAfterThemePublish", () => {
  it("reports active when the new theme has the embed on", async () => {
    const client = mockClient({ MainThemeSettingsData: () => mainTheme(fixture("settings-preset.json")) });
    expect(await recheckAfterThemePublish(client, options)).toEqual({
      kind: "active",
      theme: { id: THEME_ID, name: "Dawn" },
    });
  });

  it("returns the activation link when the new theme lacks the embed", async () => {
    const client = mockClient({ MainThemeSettingsData: () => mainTheme(fixture("settings-no-blocks.json")) });
    expect(await recheckAfterThemePublish(client, { ...options, template: "product" })).toEqual({
      kind: "needs-activation",
      reason: "missing",
      theme: { id: THEME_ID, name: "Dawn" },
      activationUrl:
        "https://cool-store.myshopify.com/admin/themes/current/editor?context=apps&template=product&activateAppId=3a9f0c1e5b7d2f8a4c6e0b1d3f5a7c9e/app-embed",
    });
  });

  it("passes errors through", async () => {
    const client = mockClient({ MainThemeSettingsData: () => ({ errors: [{ message: "Throttled" }] }) });
    expect(await recheckAfterThemePublish(client, options)).toEqual({ kind: "error", message: "Throttled" });
  });
});
