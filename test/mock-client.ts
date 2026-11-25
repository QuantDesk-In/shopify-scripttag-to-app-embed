import type { GraphqlClient, GraphqlResult } from "../src/graphql.js";

export interface Call {
  operation: string;
  variables?: Record<string, unknown>;
}

type Handler = (variables?: Record<string, unknown>) => GraphqlResult | Promise<GraphqlResult>;

/**
 * Routes each request by its operation name, e.g. `MainThemeSettingsData`.
 * An operation with no handler fails the test.
 */
export function mockClient(handlers: Record<string, Handler>): GraphqlClient & { calls: Call[] } {
  const calls: Call[] = [];
  const client = async (query: string, variables?: Record<string, unknown>) => {
    const operation = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? "";
    calls.push({ operation, variables });
    const handler = handlers[operation];
    if (!handler) throw new Error(`Unexpected operation ${operation}`);
    return handler(variables);
  };
  return Object.assign(client, { calls });
}

export const THEME_ID = "gid://shopify/OnlineStoreTheme/140362735763";

export function mainTheme(content: string): GraphqlResult {
  return {
    data: {
      themes: {
        nodes: [
          {
            id: THEME_ID,
            name: "Dawn",
            files: {
              nodes: [
                {
                  filename: "config/settings_data.json",
                  body: { __typename: "OnlineStoreThemeFileBodyText", content },
                },
              ],
              userErrors: [],
            },
          },
        ],
      },
    },
  };
}
