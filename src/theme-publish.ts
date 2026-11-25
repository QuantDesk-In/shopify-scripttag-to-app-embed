import { buildActivationLink, type ActivationLinkInput } from "./deep-link.js";
import { checkAppEmbed, type CheckOptions, type ThemeRef } from "./embed-status.js";
import type { GraphqlClient } from "./graphql.js";

export interface RecheckOptions extends ActivationLinkInput, CheckOptions {
  appHandle?: string;
}

export type RecheckResult =
  | { kind: "active"; theme: ThemeRef }
  | { kind: "needs-activation"; reason: "missing" | "disabled"; activationUrl: string; theme: ThemeRef }
  | { kind: "error"; message: string };

/**
 * Call from the `themes/publish` webhook. App embed settings live in each
 * theme's settings_data.json, so publishing a different theme can leave the
 * store without the embed. Once the script tag is gone, that means the
 * storefront script stops running until the merchant turns the embed on in
 * the new theme.
 *
 * It reads whatever theme is MAIN now rather than the one in the payload, so
 * a delayed webhook still reports the current state.
 */
export async function recheckAfterThemePublish(
  client: GraphqlClient,
  options: RecheckOptions,
): Promise<RecheckResult> {
  const check = await checkAppEmbed(client, options, options);
  switch (check.status) {
    case "active":
      return { kind: "active", theme: check.theme };
    case "inactive":
      return {
        kind: "needs-activation",
        reason: check.reason,
        activationUrl: buildActivationLink(options),
        theme: check.theme,
      };
    case "error":
      return { kind: "error", message: check.message };
  }
}
