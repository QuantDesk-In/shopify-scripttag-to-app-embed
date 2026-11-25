export interface ActivationLinkInput {
  /** The store's myshopify domain, e.g. `cool-store.myshopify.com`. */
  shop: string;
  /** The app's API key, the `client_id` in shopify.app.toml. */
  apiKey: string;
  /** Liquid filename of the embed block without `.liquid`, e.g. `app-embed`. */
  blockHandle: string;
  /** Template to open in the editor. Shopify uses the home page when omitted. */
  template?: "product" | "collection" | "article" | "blog";
}

/**
 * Theme editor link that opens the app embeds panel with this embed switched
 * on. The merchant still has to press Save.
 *
 * `activateAppId` is `{api_key}/{handle}`. The older `{uuid}/{handle}` form
 * that used the extension id is deprecated.
 * https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration#app-embed-block-deep-linking
 */
export function buildActivationLink(input: ActivationLinkInput): string {
  const shop = input.shop.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop)) {
    throw new Error(`Expected a myshopify.com domain, got "${input.shop}"`);
  }
  const params = [
    "context=apps",
    ...(input.template ? [`template=${input.template}`] : []),
    `activateAppId=${encodeURIComponent(input.apiKey)}/${encodeURIComponent(input.blockHandle)}`,
  ];
  return `https://${shop}/admin/themes/current/editor?${params.join("&")}`;
}
