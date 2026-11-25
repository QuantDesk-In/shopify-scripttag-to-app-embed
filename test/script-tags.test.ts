import { describe, expect, it } from "vitest";
import { deleteScriptTag, listScriptTags } from "../src/script-tags.js";
import { mockClient } from "./mock-client.js";

const tag = (n: number) => ({
  id: `gid://shopify/ScriptTag/${n}`,
  src: "https://widget.example.com/loader.js",
  displayScope: "ONLINE_STORE",
});

describe("listScriptTags", () => {
  it("follows pagination", async () => {
    const client = mockClient({
      AppScriptTags: (vars) =>
        vars?.after === undefined
          ? { data: { scriptTags: { nodes: [tag(1), tag(2)], pageInfo: { hasNextPage: true, endCursor: "c1" } } } }
          : { data: { scriptTags: { nodes: [tag(3)], pageInfo: { hasNextPage: false, endCursor: "c2" } } } },
    });
    expect((await listScriptTags(client)).map((t) => t.id)).toEqual([
      "gid://shopify/ScriptTag/1",
      "gid://shopify/ScriptTag/2",
      "gid://shopify/ScriptTag/3",
    ]);
    expect(client.calls.map((c) => c.variables)).toEqual([
      { first: 100, after: undefined, src: undefined },
      { first: 100, after: "c1", src: undefined },
    ]);
  });

  it("passes the src filter", async () => {
    const client = mockClient({
      AppScriptTags: () => ({ data: { scriptTags: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } }),
    });
    await listScriptTags(client, { src: "https://widget.example.com/loader.js" });
    expect(client.calls[0]?.variables?.src).toBe("https://widget.example.com/loader.js");
  });
});

describe("deleteScriptTag", () => {
  it("resolves when Shopify returns the deleted id", async () => {
    const client = mockClient({
      DeleteScriptTag: (vars) => ({ data: { scriptTagDelete: { deletedScriptTagId: vars?.id, userErrors: [] } } }),
    });
    await expect(deleteScriptTag(client, "gid://shopify/ScriptTag/1")).resolves.toBeUndefined();
  });

  it("throws on user errors", async () => {
    const client = mockClient({
      DeleteScriptTag: () => ({
        data: { scriptTagDelete: { deletedScriptTagId: null, userErrors: [{ field: ["id"], message: "Script tag not found" }] } },
      }),
    });
    await expect(deleteScriptTag(client, "gid://shopify/ScriptTag/1")).rejects.toThrow("Script tag not found");
  });

  it("throws when nothing was deleted and no error was given", async () => {
    const client = mockClient({
      DeleteScriptTag: () => ({ data: { scriptTagDelete: { deletedScriptTagId: null, userErrors: [] } } }),
    });
    await expect(deleteScriptTag(client, "gid://shopify/ScriptTag/1")).rejects.toThrow("did not delete");
  });
});
