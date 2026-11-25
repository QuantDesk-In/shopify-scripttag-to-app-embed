import { describe, expect, it } from "vitest";
import {
  embedState,
  findEmbedBlocks,
  parseSettingsData,
  SettingsDataError,
  stripJsonComments,
} from "../src/settings-data.js";
import { fixture } from "./fixtures.js";

const ours = { appHandle: "example-widget", blockHandle: "app-embed" };

describe("stripJsonComments", () => {
  it("removes the header and keeps comment-like text inside strings", () => {
    const data = parseSettingsData(fixture("settings-enabled.json"));
    const current = data.current as Record<string, unknown>;
    expect(current.social_instagram_link).toBe("https://instagram.com/example");
    expect(current.announcement_text).toBe("Free shipping /* today */ only");
  });

  it("removes line comments and handles escaped quotes", () => {
    const text = '{ "a": "say \\"hi\\" // not a comment" // trailing\n, "b": 1 }';
    expect(JSON.parse(stripJsonComments(text))).toEqual({ a: 'say "hi" // not a comment', b: 1 });
  });

  it("rejects an unterminated comment", () => {
    expect(() => stripJsonComments("/* open {")).toThrow(SettingsDataError);
  });
});

describe("parseSettingsData", () => {
  it("rejects invalid JSON", () => {
    expect(() => parseSettingsData('{ "current": ')).toThrow(SettingsDataError);
  });

  it("rejects a non-object", () => {
    expect(() => parseSettingsData("[]")).toThrow(SettingsDataError);
  });
});

describe("findEmbedBlocks", () => {
  it("parses the block type into its parts", () => {
    const data = parseSettingsData(fixture("settings-enabled.json"));
    expect(findEmbedBlocks(data, ours)).toEqual([
      {
        key: "4207964911486483523",
        type: "shopify://apps/example-widget/blocks/app-embed/0b9a3c2e-5d41-4f7a-9e2b-7c1d8f6a4e30",
        appHandle: "example-widget",
        blockHandle: "app-embed",
        extensionId: "0b9a3c2e-5d41-4f7a-9e2b-7c1d8f6a4e30",
        disabled: false,
      },
    ]);
  });

  it("matches any app when appHandle is omitted", () => {
    const data = parseSettingsData(fixture("settings-disabled.json"));
    const blocks = findEmbedBlocks(data, { blockHandle: "app-embed" });
    expect(blocks.map((b) => b.appHandle)).toEqual(["example-widget", "sticky-cart-pro"]);
  });
});

describe("embedState", () => {
  it("is enabled when our block is present and not disabled", () => {
    expect(embedState(parseSettingsData(fixture("settings-enabled.json")), ours)).toBe("enabled");
  });

  it("is disabled when the merchant turned it off", () => {
    expect(embedState(parseSettingsData(fixture("settings-disabled.json")), ours)).toBe("disabled");
  });

  it("ignores another app's embed with the same block handle", () => {
    expect(embedState(parseSettingsData(fixture("settings-other-app.json")), ours)).toBe("missing");
  });

  it("is missing when the theme has no blocks", () => {
    expect(embedState(parseSettingsData(fixture("settings-no-blocks.json")), ours)).toBe("missing");
  });

  it("reads blocks from the preset when current is a preset name", () => {
    expect(embedState(parseSettingsData(fixture("settings-preset.json")), ours)).toBe("enabled");
  });

  it("is enabled if any matching entry is on, and treats a missing disabled flag as on", () => {
    expect(embedState(parseSettingsData(fixture("settings-duplicate.json")), ours)).toBe("enabled");
  });

  it("throws when current names a preset that does not exist", () => {
    const data = parseSettingsData('{ "current": "Gone", "presets": {} }');
    expect(() => embedState(data, ours)).toThrow(SettingsDataError);
  });
});
