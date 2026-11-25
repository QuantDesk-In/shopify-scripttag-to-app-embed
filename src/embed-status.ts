import { request, type GraphqlClient } from "./graphql.js";
import { embedState, parseSettingsData, type EmbedMatch } from "./settings-data.js";

export interface ThemeRef {
  id: string;
  name: string;
}

export type EmbedCheck =
  | { status: "active"; theme: ThemeRef }
  | { status: "inactive"; reason: "missing" | "disabled"; theme: ThemeRef }
  | { status: "error"; message: string; theme?: ThemeRef };

export interface CheckOptions {
  /** Used only when Shopify returns the file body as a short-lived URL. Defaults to global fetch. */
  fetch?: typeof fetch;
}

// Needs the read_themes scope.
// https://shopify.dev/docs/api/admin-graphql/latest/objects/OnlineStoreTheme
export const MAIN_THEME_SETTINGS_QUERY = `#graphql
  query MainThemeSettingsData {
    themes(first: 1, roles: [MAIN]) {
      nodes {
        id
        name
        files(filenames: ["config/settings_data.json"], first: 1) {
          nodes {
            filename
            body {
              __typename
              ... on OnlineStoreThemeFileBodyText { content }
              ... on OnlineStoreThemeFileBodyBase64 { contentBase64 }
              ... on OnlineStoreThemeFileBodyUrl { url }
            }
          }
          userErrors { code filename }
        }
      }
    }
  }
`;

type FileBody =
  | { __typename: "OnlineStoreThemeFileBodyText"; content: string }
  | { __typename: "OnlineStoreThemeFileBodyBase64"; contentBase64: string }
  | { __typename: "OnlineStoreThemeFileBodyUrl"; url: string };

interface MainThemeData {
  themes: {
    nodes: Array<{
      id: string;
      name: string;
      files: {
        nodes: Array<{ filename: string; body: FileBody }>;
        userErrors: Array<{ code: string; filename: string }>;
      } | null;
    }>;
  };
}

/**
 * Checks whether the app embed is turned on in the store's published theme.
 * Never throws: anything that stops us reading the theme comes back as
 * `status: "error"`, which callers must treat as "not active".
 */
export async function checkAppEmbed(
  client: GraphqlClient,
  match: EmbedMatch,
  options: CheckOptions = {},
): Promise<EmbedCheck> {
  let theme: ThemeRef | undefined;
  try {
    const data = await request<MainThemeData>(client, MAIN_THEME_SETTINGS_QUERY);
    const node = data.themes.nodes[0];
    if (!node) return { status: "error", message: "Store has no published (MAIN) theme" };
    theme = { id: node.id, name: node.name };

    const file = node.files?.nodes.find((f) => f.filename === "config/settings_data.json");
    if (!file) {
      const codes = node.files?.userErrors.map((e) => e.code).join(", ");
      return {
        status: "error",
        theme,
        message: `Could not read config/settings_data.json${codes ? ` (${codes})` : ""}`,
      };
    }

    const text = await readBody(file.body, options.fetch ?? fetch);
    const state = embedState(parseSettingsData(text), match);
    if (state === "enabled") return { status: "active", theme };
    return { status: "inactive", reason: state, theme };
  } catch (err) {
    return { status: "error", theme, message: (err as Error).message };
  }
}

async function readBody(body: FileBody, fetchImpl: typeof fetch): Promise<string> {
  switch (body.__typename) {
    case "OnlineStoreThemeFileBodyText":
      return body.content;
    case "OnlineStoreThemeFileBodyBase64":
      return new TextDecoder().decode(Uint8Array.from(atob(body.contentBase64), (c) => c.charCodeAt(0)));
    case "OnlineStoreThemeFileBodyUrl": {
      const res = await fetchImpl(body.url);
      if (!res.ok) throw new Error(`Fetching settings_data.json failed with HTTP ${res.status}`);
      return await res.text();
    }
    default:
      throw new Error(`Unexpected theme file body type ${(body as { __typename: string }).__typename}`);
  }
}
