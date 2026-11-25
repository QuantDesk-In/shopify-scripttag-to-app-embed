// Settings shared by the route, job and webhook below.
export const embed = {
  apiKey: process.env.SHOPIFY_API_KEY!,
  // Block filename without .liquid: extensions/example-widget-embed/blocks/app-embed.liquid
  blockHandle: "app-embed",
  // The <app-handle> part of shopify://apps/<app-handle>/blocks/... in settings_data.json.
  appHandle: "example-widget",
  // Limit cleanup to your storefront loader if the app owns other script tags.
  src: "https://widget.example.com/loader.js",
};
