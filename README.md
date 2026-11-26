# shopify-scripttag-to-app-embed

Move a Shopify app's storefront script from a ScriptTag to a theme app embed without a gap and without loading it twice.

## Dates

- **1 October 2026:** `scriptTagCreate` and `scriptTagUpdate` return an error. Existing script tags keep running.
- **1 March 2027:** Shopify stops injecting script tags into storefronts. This applies to every API version.

Sources: [changelog](https://shopify.dev/changelog/posts/online-store-script-tags-deprecation), [migration guide](https://shopify.dev/docs/apps/build/online-store/script-tag-deprecation/storefront).

## The problem

The replacement is an app embed block in a theme app extension. You ship it, but it does nothing until each merchant turns it on in the theme editor and saves. You can't turn it on for them.

So for every store you have two switches, and only one should be on:

| Script tag | Embed | Result |
| --- | --- | --- |
| on | off | Works until 1 March 2027 |
| on | on | Script runs twice |
| off | on | Done |
| off | off | Script does not run |

Deleting the tag before the embed is on breaks the store. Never deleting it runs your script twice. And the embed is saved per theme, so a merchant who publishes a new theme can turn it off without knowing.

## The pattern

1. **Make the script safe to load twice.** Add a guard like `if (window.__myAppLoaded) return;` to the file your script tag loads, and deploy it. Use the same guard in the embed's script. See [`example/extensions/example-widget-embed/assets/loader.js`](example/extensions/example-widget-embed/assets/loader.js).
2. **Ship the theme app extension** with an app embed block. See [`example/extensions`](example/extensions).
3. **Ask the merchant to turn it on.** Show a banner in your app admin with a theme editor link that opens the app embeds panel with your embed switched on. The merchant clicks Save.
4. **Confirm it is on** in the published theme by reading `config/settings_data.json`.
5. **Delete the script tag**, only after step 4 says yes.
6. **Re-check on `themes/publish`**, and ask again if the new theme doesn't have the embed on.

This library does steps 3 to 6.

## Install

Not on npm yet. Copy `src/` into your app (no runtime dependencies), or install once it is published:

```sh
npm install shopify-scripttag-to-app-embed
```

Node 20 or later. ESM only.

## Usage

Everything takes a `GraphqlClient`, a function `(query, variables) => Promise<{ data, errors }>`. `fromAdmin` wraps the `admin` object from the React Router app template. In tests, pass a plain function.

```ts
import {
  buildActivationLink,
  checkAppEmbed,
  fromAdmin,
  recheckAfterThemePublish,
  removeScriptTagsIfEmbedActive,
} from "shopify-scripttag-to-app-embed";

const embed = {
  apiKey: process.env.SHOPIFY_API_KEY!, // client_id in shopify.app.toml
  blockHandle: "app-embed",             // blocks/app-embed.liquid
  appHandle: "example-widget",          // optional, see below
  src: "https://widget.example.com/loader.js", // optional, limits which tags are deleted
};

const { admin, session } = await authenticate.admin(request);
const client = fromAdmin(admin);

// Is the embed on in the published theme?
const check = await checkAppEmbed(client, embed);
// { status: "active", theme }
// { status: "inactive", reason: "missing" | "disabled", theme }
// { status: "error", message }

// Link for the banner
const url = buildActivationLink({ shop: session.shop, ...embed });
// https://<shop>/admin/themes/current/editor?context=apps&activateAppId=<apiKey>/app-embed

// In a background job
const result = await removeScriptTagsIfEmbedActive(client, { shop: session.shop, ...embed });
```

`removeScriptTagsIfEmbedActive` returns one of:

| `kind` | Meaning |
| --- | --- |
| `already-clean` | The app has no script tags on this store (or none matching `src`). The theme is not read. |
| `embed-not-active` | Tags kept. Includes `reason`, `scriptTagCount` and `activationUrl` for the merchant. |
| `deleted` | Embed confirmed, then every tag deleted. `deletedIds` lists them. |
| `error` | Something failed. `deletedIds` lists anything removed before the failure. |

If the theme can't be read, the file doesn't parse, there is no published theme, or any request fails, the result is `error` and nothing is deleted. Running it again is safe.

`recheckAfterThemePublish(client, { shop, ...embed })` is for the `themes/publish` webhook. It returns `active`, `needs-activation` with the link, or `error`.

Example route, job and webhook files for the React Router template are in [`example/app`](example/app).

### Matching your block

Shopify stores an enabled embed in `settings_data.json` as:

```json
"blocks": {
  "4207964911486483523": {
    "type": "shopify://apps/<app-handle>/blocks/<block-handle>/<extension-uuid>",
    "disabled": false
  }
}
```

The entry appears the first time the merchant turns the embed on. Turning it off later sets `disabled: true` and keeps the entry. The library treats the embed as on if a matching entry exists without `disabled: true`.

`blockHandle` is the Liquid filename without `.liquid`. `appHandle` is optional, but set it: another app can use the same block filename. To find it, turn the embed on in a dev store and read the `type` in that theme's `config/settings_data.json`. It can differ from the handle in your app's admin URL (`/apps/<handle>`). Use the one from the `type`, or the embed will never match.

The file starts with a `/* ... */` comment that Shopify adds, so it is not plain JSON. The parser strips comments outside strings. If `current` is a preset name instead of an object, it reads that preset.

### The theme editor link

The link format and the `activateAppId={api_key}/{handle}` value come from [Shopify's deep linking docs](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration#app-embed-block-deep-linking). The older form with the extension `uuid` is deprecated. Pass `template` (`product`, `collection`, `article` or `blog`) to open the editor on that page type; the default is the home page. The merchant still has to click Save.

Inside an embedded app, open it in the top frame (`target="_top"`), or the admin loads inside your iframe.

## Access scopes

| Scope | Why |
| --- | --- |
| `read_themes` | `themes` query and theme files, and the `themes/publish` webhook |
| `write_script_tags` | `scriptTagDelete`. Write scopes include read, so this also covers the `scriptTags` query. |

Changing theme files needs `write_themes` plus an exemption from Shopify. Reading them does not, and this library never writes to the theme.

## API version

The queries are written against Admin GraphQL `2026-10`:

- `themes(first: 1, roles: [MAIN])`, then `files(filenames: ["config/settings_data.json"])`. The file body can come back as text, base64 or a short-lived URL. All three are handled.
- `scriptTags(first, after, src)`, which only returns the calling app's tags.
- `scriptTagDelete(id)` returning `deletedScriptTagId` and `userErrors`.

## What this does not do

- Create the theme app extension. You still write and deploy it. The example is a starting point.
- Turn the embed on. Only the merchant can.
- Store state, queue jobs or send emails. Call it from whatever you already use.
- Handle order status page script tags. Those were covered by an earlier deprecation.
- Check unpublished themes. Only the MAIN theme is read, because that is what shoppers see.
- Replace analytics scripts. If your script only tracks events, Shopify's guide points to web pixels instead, which need no theme editor step.

## Need this done for your app?

We do these migrations for app vendors: https://shopify.quantdesk.in

## License

MIT, Quantdesk Pvt Ltd
