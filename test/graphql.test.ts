import { describe, expect, it } from "vitest";
import { fromAdmin, GraphqlError, request } from "../src/graphql.js";

describe("fromAdmin", () => {
  it("passes variables through and returns the parsed body", async () => {
    const calls: unknown[] = [];
    const admin = {
      graphql: async (query: string, options?: { variables?: Record<string, unknown> }) => {
        calls.push([query, options]);
        return { json: async () => ({ data: { ok: true } }) };
      },
    };
    const client = fromAdmin(admin);
    expect(await client("query Q { ok }", { a: 1 })).toEqual({ data: { ok: true } });
    expect(calls).toEqual([["query Q { ok }", { variables: { a: 1 } }]]);
  });
});

describe("request", () => {
  it("throws with the error messages when the response has errors", async () => {
    const client = async () => ({ errors: [{ message: "Access denied for themes field." }] });
    await expect(request(client, "query { x }")).rejects.toThrow(GraphqlError);
    await expect(request(client, "query { x }")).rejects.toThrow("Access denied for themes field.");
  });

  it("throws when data is missing", async () => {
    await expect(request(async () => ({}), "query { x }")).rejects.toThrow("no data");
  });
});
