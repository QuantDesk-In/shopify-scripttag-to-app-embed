import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { buildActivationLink, checkAppEmbed, fromAdmin } from "shopify-scripttag-to-app-embed";
import { authenticate } from "../shopify.server";
import { embed } from "../embed.server";
import { removeScriptTagsForShop } from "../jobs/remove-script-tags.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const check = await checkAppEmbed(fromAdmin(admin), embed);

  if (check.status === "active") {
    // Hand this to your queue in production. It is a no-op once the tag is gone.
    removeScriptTagsForShop(session.shop).catch(console.error);
    return { activationUrl: null, checkFailed: false };
  }
  return {
    activationUrl: buildActivationLink({ shop: session.shop, ...embed }),
    checkFailed: check.status === "error",
  };
};

export default function Index() {
  const { activationUrl, checkFailed } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Example widget">
      {activationUrl && (
        <s-banner tone="warning" heading="Turn on the Example widget embed">
          {checkFailed
            ? "We could not confirm the widget is on in your live theme."
            : "The widget will stop showing on your store on 1 March 2027 unless you turn on its app embed."}{" "}
          Open the theme editor, check that Example widget is on, and click Save.
          <s-button slot="secondary-actions" href={activationUrl} target="_top">
            Open theme editor
          </s-button>
        </s-banner>
      )}
    </s-page>
  );
}
