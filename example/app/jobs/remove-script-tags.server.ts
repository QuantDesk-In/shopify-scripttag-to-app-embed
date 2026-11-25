import { fromAdmin, removeScriptTagsIfEmbedActive } from "shopify-scripttag-to-app-embed";
import { unauthenticated } from "../shopify.server";
import { embed } from "../embed.server";

// Run from your job queue, from a daily sweep over installed shops, or right
// after the admin page sees the embed turn on. It re-checks the embed itself
// before deleting, so a stale trigger cannot remove a tag too early.
export async function removeScriptTagsForShop(shop: string) {
  const { admin } = await unauthenticated.admin(shop);
  const result = await removeScriptTagsIfEmbedActive(fromAdmin(admin), { shop, ...embed });

  switch (result.kind) {
    case "already-clean":
      break;
    case "deleted":
      console.info(`${shop}: deleted ${result.deletedIds.length} script tag(s)`);
      break;
    case "embed-not-active":
      // Leave the tag in place. The admin banner keeps asking the merchant.
      console.info(`${shop}: embed ${result.reason}, ${result.scriptTagCount} tag(s) kept`);
      break;
    case "error":
      // Nothing was deleted after the failure. Retry later.
      console.error(`${shop}: ${result.message}`, result.deletedIds);
      break;
  }
  return result;
}
