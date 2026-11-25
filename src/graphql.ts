export interface GraphqlResult {
  data?: unknown;
  errors?: unknown;
}

/**
 * The only thing the library needs from your app: run one Admin GraphQL
 * operation and return the parsed body. Easy to mock in tests.
 */
export type GraphqlClient = (
  query: string,
  variables?: Record<string, unknown>,
) => Promise<GraphqlResult>;

/** The shape of `admin` from `authenticate.admin()` or `unauthenticated.admin()`. */
export interface AdminApiContext {
  graphql(
    query: string,
    options?: { variables?: Record<string, unknown> },
  ): Promise<{ json(): Promise<unknown> }>;
}

/** Wrap `admin.graphql` from the React Router app template. */
export function fromAdmin(admin: AdminApiContext): GraphqlClient {
  return async (query, variables) => {
    const response = await admin.graphql(query, { variables });
    return (await response.json()) as GraphqlResult;
  };
}

export class GraphqlError extends Error {
  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "GraphqlError";
  }
}

export async function request<T>(
  client: GraphqlClient,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const result = await client(query, variables);
  if (result.errors) {
    throw new GraphqlError(describeErrors(result.errors), result.errors);
  }
  if (result.data == null) {
    throw new GraphqlError("GraphQL response had no data");
  }
  return result.data as T;
}

function describeErrors(errors: unknown): string {
  if (Array.isArray(errors)) {
    const messages = errors
      .map((e) => (e && typeof e === "object" && "message" in e ? String(e.message) : ""))
      .filter(Boolean);
    if (messages.length > 0) return messages.join("; ");
  }
  return "GraphQL request failed";
}
