import { describe, expect, it } from "vitest";
import type { GraphqlResult } from "../src/graphql.js";
import { removeScriptTagsIfEmbedActive } from "../src/migrate.js";
import { fixture } from "./fixtures.js";
import { mainTheme, mockClient } from "./mock-client.js";

const options = {
  shop: "cool-store.myshopify.com",
  apiKey: "3a9f0c1e5b7d2f8a4c6e0b1d3f5a7c9e",
  appHandle: "example-widget",
  blockHandle: "app-embed",
};

const tags = (...ids: number[]): GraphqlResult => ({
  data: {
    scriptTags: {
      nodes: ids.map((n) => ({
        id: `gid://shopify/ScriptTag/${n}`,
        src: "https://widget.example.com/loader.js",
        displayScope: "ONLINE_STORE",
      })),
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  },
});

const deleted = (vars?: Record<string, unknown>): GraphqlResult => ({
  data: { scriptTagDelete: { deletedScriptTagId: vars?.id, userErrors: [] } },
});

const deletes = (client: { calls: { operation: string }[] }) =>
  client.calls.filter((c) => c.operation === "DeleteScriptTag").length;

describe("removeScriptTagsIfEmbedActive", () => {
  it("returns already-clean without reading the theme when there are no tags", async () => {
    const client = mockClient({ AppScriptTags: () => tags() });
    expect(await removeScriptTagsIfEmbedActive(client, options)).toEqual({ kind: "already-clean" });
    expect(client.calls.map((c) => c.operation)).toEqual(["AppScriptTags"]);
  });

  it("deletes every tag once the embed is active", async () => {
    const client = mockClient({
      AppScriptTags: () => tags(1, 2),
      MainThemeSettingsData: () => mainTheme(fixture("settings-enabled.json")),
      DeleteScriptTag: deleted,
    });
    expect(await removeScriptTagsIfEmbedActive(client, options)).toEqual({
      kind: "deleted",
      deletedIds: ["gid://shopify/ScriptTag/1", "gid://shopify/ScriptTag/2"],
    });
  });

  it("keeps the tags and returns the activation link when the embed is off", async () => {
    const client = mockClient({
      AppScriptTags: () => tags(1),
      MainThemeSettingsData: () => mainTheme(fixture("settings-disabled.json")),
      DeleteScriptTag: deleted,
    });
    expect(await removeScriptTagsIfEmbedActive(client, options)).toEqual({
      kind: "embed-not-active",
      reason: "disabled",
      scriptTagCount: 1,
      activationUrl:
        "https://cool-store.myshopify.com/admin/themes/current/editor?context=apps&activateAppId=3a9f0c1e5b7d2f8a4c6e0b1d3f5a7c9e/app-embed",
    });
    expect(deletes(client)).toBe(0);
  });

  it("does not count another app's embed as ours", async () => {
    const client = mockClient({
      AppScriptTags: () => tags(1),
      MainThemeSettingsData: () => mainTheme(fixture("settings-other-app.json")),
      DeleteScriptTag: deleted,
    });
    const result = await removeScriptTagsIfEmbedActive(client, options);
    expect(result.kind).toBe("embed-not-active");
    expect(deletes(client)).toBe(0);
  });

  it("deletes nothing when the theme cannot be read", async () => {
    const client = mockClient({
      AppScriptTags: () => tags(1),
      MainThemeSettingsData: () => ({ errors: [{ message: "Access denied for themes field." }] }),
      DeleteScriptTag: deleted,
    });
    expect(await removeScriptTagsIfEmbedActive(client, options)).toEqual({
      kind: "error",
      message: "Embed check failed: Access denied for themes field.",
      deletedIds: [],
    });
    expect(deletes(client)).toBe(0);
  });

  it("deletes nothing when settings_data.json is corrupt", async () => {
    const client = mockClient({
      AppScriptTags: () => tags(1),
      MainThemeSettingsData: () => mainTheme("/* header */ {"),
      DeleteScriptTag: deleted,
    });
    expect((await removeScriptTagsIfEmbedActive(client, options)).kind).toBe("error");
    expect(deletes(client)).toBe(0);
  });

  it("returns an error when listing tags fails", async () => {
    const client = mockClient({ AppScriptTags: () => ({ errors: [{ message: "Throttled" }] }) });
    expect(await removeScriptTagsIfEmbedActive(client, options)).toEqual({
      kind: "error",
      message: "Throttled",
      deletedIds: [],
    });
  });

  it("stops at the first failed delete and reports what was removed", async () => {
    const client = mockClient({
      AppScriptTags: () => tags(1, 2, 3),
      MainThemeSettingsData: () => mainTheme(fixture("settings-enabled.json")),
      DeleteScriptTag: (vars) =>
        vars?.id === "gid://shopify/ScriptTag/2"
          ? { errors: [{ message: "Internal error" }] }
          : deleted(vars),
    });
    expect(await removeScriptTagsIfEmbedActive(client, options)).toEqual({
      kind: "error",
      message: "Internal error",
      deletedIds: ["gid://shopify/ScriptTag/1"],
    });
    expect(deletes(client)).toBe(2);
  });

  it("only lists tags with the given src", async () => {
    const client = mockClient({ AppScriptTags: () => tags() });
    await removeScriptTagsIfEmbedActive(client, { ...options, src: "https://widget.example.com/loader.js" });
    expect(client.calls[0]?.variables?.src).toBe("https://widget.example.com/loader.js");
  });
});
