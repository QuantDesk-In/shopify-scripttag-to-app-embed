import { describe, expect, it, vi } from "vitest";
import { checkAppEmbed } from "../src/embed-status.js";
import { fixture } from "./fixtures.js";
import { mainTheme, mockClient, THEME_ID } from "./mock-client.js";

const match = { appHandle: "example-widget", blockHandle: "app-embed" };
const theme = { id: THEME_ID, name: "Dawn" };

function themeWithBody(body: unknown) {
  const result = mainTheme("");
  const node = (result.data as any).themes.nodes[0];
  node.files.nodes[0].body = body;
  return result;
}

describe("checkAppEmbed", () => {
  it("reports active when the embed is on in the main theme", async () => {
    const client = mockClient({ MainThemeSettingsData: () => mainTheme(fixture("settings-enabled.json")) });
    expect(await checkAppEmbed(client, match)).toEqual({ status: "active", theme });
  });

  it("asks only for the MAIN theme", async () => {
    const client = mockClient({ MainThemeSettingsData: () => mainTheme(fixture("settings-enabled.json")) });
    await checkAppEmbed(client, match);
    expect(client.calls).toEqual([{ operation: "MainThemeSettingsData", variables: undefined }]);
  });

  it("reports inactive with the reason", async () => {
    const disabled = mockClient({ MainThemeSettingsData: () => mainTheme(fixture("settings-disabled.json")) });
    expect(await checkAppEmbed(disabled, match)).toEqual({ status: "inactive", reason: "disabled", theme });

    const missing = mockClient({ MainThemeSettingsData: () => mainTheme(fixture("settings-other-app.json")) });
    expect(await checkAppEmbed(missing, match)).toEqual({ status: "inactive", reason: "missing", theme });
  });

  it("decodes a base64 body", async () => {
    const contentBase64 = Buffer.from(fixture("settings-enabled.json")).toString("base64");
    const client = mockClient({
      MainThemeSettingsData: () => themeWithBody({ __typename: "OnlineStoreThemeFileBodyBase64", contentBase64 }),
    });
    expect((await checkAppEmbed(client, match)).status).toBe("active");
  });

  it("downloads a URL body with the given fetch", async () => {
    const fetchMock = vi.fn(async () => new Response(fixture("settings-enabled.json")));
    const client = mockClient({
      MainThemeSettingsData: () =>
        themeWithBody({ __typename: "OnlineStoreThemeFileBodyUrl", url: "https://cdn.shopify.com/s/files/x" }),
    });
    expect((await checkAppEmbed(client, match, { fetch: fetchMock })).status).toBe("active");
    expect(fetchMock).toHaveBeenCalledWith("https://cdn.shopify.com/s/files/x");
  });

  it("returns an error when the URL download fails", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 403 }));
    const client = mockClient({
      MainThemeSettingsData: () =>
        themeWithBody({ __typename: "OnlineStoreThemeFileBodyUrl", url: "https://cdn.shopify.com/s/files/x" }),
    });
    expect(await checkAppEmbed(client, match, { fetch: fetchMock })).toEqual({
      status: "error",
      theme,
      message: "Fetching settings_data.json failed with HTTP 403",
    });
  });

  it("returns an error when there is no main theme", async () => {
    const client = mockClient({ MainThemeSettingsData: () => ({ data: { themes: { nodes: [] } } }) });
    expect(await checkAppEmbed(client, match)).toEqual({
      status: "error",
      message: "Store has no published (MAIN) theme",
    });
  });

  it("returns an error when the file cannot be read", async () => {
    const result = mainTheme("");
    const files = (result.data as any).themes.nodes[0].files;
    files.nodes = [];
    files.userErrors = [{ code: "NOT_FOUND", filename: "config/settings_data.json" }];
    const client = mockClient({ MainThemeSettingsData: () => result });
    expect(await checkAppEmbed(client, match)).toEqual({
      status: "error",
      theme,
      message: "Could not read config/settings_data.json (NOT_FOUND)",
    });
  });

  it("returns an error when the scope is missing", async () => {
    const client = mockClient({
      MainThemeSettingsData: () => ({
        errors: [{ message: "Access denied for themes field. Required access: `read_themes` access scope." }],
      }),
    });
    const check = await checkAppEmbed(client, match);
    expect(check.status).toBe("error");
    expect(check.status === "error" && check.message).toContain("read_themes");
  });

  it("returns an error when the file is not valid JSON", async () => {
    const client = mockClient({ MainThemeSettingsData: () => mainTheme("/* header */ { broken") });
    expect((await checkAppEmbed(client, match)).status).toBe("error");
  });

  it("returns an error when the client throws", async () => {
    const client = async () => {
      throw new Error("socket hang up");
    };
    expect(await checkAppEmbed(client, match)).toEqual({ status: "error", theme: undefined, message: "socket hang up" });
  });
});
