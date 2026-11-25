import { GraphqlError, request, type GraphqlClient } from "./graphql.js";

export interface ScriptTag {
  id: string;
  src: string;
  displayScope: string;
}

// Shopify only returns script tags created by the calling app.
// https://shopify.dev/docs/api/admin-graphql/latest/queries/scriptTags
export const SCRIPT_TAGS_QUERY = `#graphql
  query AppScriptTags($first: Int!, $after: String, $src: URL) {
    scriptTags(first: $first, after: $after, src: $src) {
      nodes { id src displayScope }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

// https://shopify.dev/docs/api/admin-graphql/latest/mutations/scriptTagDelete
export const SCRIPT_TAG_DELETE_MUTATION = `#graphql
  mutation DeleteScriptTag($id: ID!) {
    scriptTagDelete(id: $id) {
      deletedScriptTagId
      userErrors { field message }
    }
  }
`;

interface ScriptTagsData {
  scriptTags: {
    nodes: ScriptTag[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

interface DeleteData {
  scriptTagDelete: {
    deletedScriptTagId: string | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  } | null;
}

/** Lists the app's script tags. Pass `src` to match one exact script URL. */
export async function listScriptTags(client: GraphqlClient, options: { src?: string } = {}): Promise<ScriptTag[]> {
  const tags: ScriptTag[] = [];
  let after: string | undefined;
  for (;;) {
    const data = await request<ScriptTagsData>(client, SCRIPT_TAGS_QUERY, { first: 100, after, src: options.src });
    tags.push(...data.scriptTags.nodes);
    const { hasNextPage, endCursor } = data.scriptTags.pageInfo;
    if (!hasNextPage || !endCursor) return tags;
    after = endCursor;
  }
}

export async function deleteScriptTag(client: GraphqlClient, id: string): Promise<void> {
  const data = await request<DeleteData>(client, SCRIPT_TAG_DELETE_MUTATION, { id });
  const result = data.scriptTagDelete;
  if (result?.userErrors.length) {
    throw new GraphqlError(result.userErrors.map((e) => e.message).join("; "), result.userErrors);
  }
  if (!result?.deletedScriptTagId) {
    throw new GraphqlError(`scriptTagDelete did not delete ${id}`);
  }
}
