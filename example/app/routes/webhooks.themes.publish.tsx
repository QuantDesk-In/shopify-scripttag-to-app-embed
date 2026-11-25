import type { ActionFunctionArgs } from "react-router";
import { fromAdmin, recheckAfterThemePublish } from "shopify-scripttag-to-app-embed";
import { authenticate } from "../shopify.server";
import { embed } from "../embed.server";

// The embed is saved per theme. If the merchant publishes a theme where it
// is off, the storefront script stops once the script tag is gone.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, admin } = await authenticate.webhook(request);
  // No admin context means the app was uninstalled.
  if (!admin) return new Response();

  const result = await recheckAfterThemePublish(fromAdmin(admin), { shop, ...embed });
  if (result.kind === "needs-activation") {
    // Email the merchant result.activationUrl here. The admin banner also
    // shows again on their next visit, because it checks live.
    console.warn(`${shop}: embed ${result.reason} on new theme ${result.theme.name}`);
  } else if (result.kind === "error") {
    console.error(`${shop}: theme re-check failed: ${result.message}`);
  }
  return new Response();
};
