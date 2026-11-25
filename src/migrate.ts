import { buildActivationLink, type ActivationLinkInput } from "./deep-link.js";
import { checkAppEmbed, type CheckOptions } from "./embed-status.js";
import type { GraphqlClient } from "./graphql.js";
import { deleteScriptTag, listScriptTags } from "./script-tags.js";

export interface MigrateOptions extends ActivationLinkInput, CheckOptions {
  /** App handle in the block type. Set it to avoid matching another app's block with the same handle. */
  appHandle?: string;
  /** Only touch script tags with this exact src. Omit to remove all of the app's script tags. */
  src?: string;
}

export type MigrationResult =
  | { kind: "already-clean" }
  | {
      kind: "embed-not-active";
      reason: "missing" | "disabled";
      activationUrl: string;
      scriptTagCount: number;
    }
  | { kind: "deleted"; deletedIds: string[] }
  | { kind: "error"; message: string; deletedIds: string[] };

/**
 * Deletes the app's script tags for one shop, but only after confirming the
 * app embed is on in the published theme. If the check fails for any
 * reason, nothing is deleted. Safe to run again: it picks up where it stopped.
 */
export async function removeScriptTagsIfEmbedActive(
  client: GraphqlClient,
  options: MigrateOptions,
): Promise<MigrationResult> {
  const deletedIds: string[] = [];
  try {
    const tags = await listScriptTags(client, { src: options.src });
    if (tags.length === 0) return { kind: "already-clean" };

    const check = await checkAppEmbed(client, options, options);
    if (check.status === "error") {
      return { kind: "error", message: `Embed check failed: ${check.message}`, deletedIds };
    }
    if (check.status === "inactive") {
      return {
        kind: "embed-not-active",
        reason: check.reason,
        activationUrl: buildActivationLink(options),
        scriptTagCount: tags.length,
      };
    }

    for (const tag of tags) {
      await deleteScriptTag(client, tag.id);
      deletedIds.push(tag.id);
    }
    return { kind: "deleted", deletedIds };
  } catch (err) {
    return { kind: "error", message: (err as Error).message, deletedIds };
  }
}
