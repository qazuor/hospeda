/**
 * @file csp-soft-nav-script-hashes.ts
 * @description The union of every page's inline-script hashes, published on
 * EVERY response so a `<ClientRouter />` soft navigation never lands on a page
 * whose inline scripts the in-force policy has not authorised (HOS-807).
 *
 * ## The bug this fixes
 *
 * The CSP is emitted per response, with the hashes of THAT page's inline
 * scripts. A soft navigation does not replace the document, so the ORIGIN
 * page's policy stays in force while Astro injects the DESTINATION page's
 * inline scripts — and every one the origin did not carry is blocked. HOS-798
 * fixed that for Astro's own five runtime snippets
 * (`csp-astro-runtime-hashes.ts`); this fixes it for the app's own scripts: the
 * filter chips, the listing sticky header and partial swap, the /destinos/
 * attraction filter, the map controls, the detail-page widgets, the home stats.
 *
 * ## Where the list comes from
 *
 * NOT a hand list and NOT a crawl. Two parts:
 *
 * 1. **Build-time union.** The `csp-soft-nav-hashes` integration
 *    (`apps/web/integrations/csp-soft-nav-hashes/`) derives it during
 *    `astro build` from two exhaustive sources — every compiled `.astro` module
 *    (`is:inline` scripts) and the build manifest's `inlinedScripts` (processed
 *    `<script>` blocks Vite inlined) — and writes it into the server bundle in
 *    place of the placeholder below, the same substitution Astro performs for
 *    its own serialized manifest. A page type added tomorrow is covered because
 *    its components are compiled, not because somebody listed it.
 * 2. **Deployment constants hashed at boot.** A few scripts are injected with
 *    `set:html` from a TS constant, so the compiled template shows only an
 *    expression and the build scan cannot read them. Their content is the same
 *    on every request, so they are hashed here from the very constant the
 *    component renders — byte-identical by construction. The integration's
 *    `RENDER_TIME_INLINE_SCRIPT_ALLOWLIST` names each one; a render-time script
 *    that is on neither list fails the build.
 *
 * ## Why publishing them everywhere is safe
 *
 * A `sha256-` source authorises one exact byte sequence. Every entry is a
 * script this app ships; an attacker cannot make an injected payload hash to
 * one of them. It is the trade `csp-astro-runtime-hashes.ts` already makes for
 * Astro's own scripts.
 *
 * Do NOT solve this with a nonce: HOS-369 WB0-1 removed it because Cloudflare
 * caches the header with the body (`scripts/check-no-inline-nonce.sh`). And
 * Astro's native `security.csp` does not support `<ClientRouter />`.
 *
 * ## Outside a production build
 *
 * In `astro dev` and in Vitest the placeholder is never substituted, so the
 * build-time part is empty. Dev is unaffected (its CSP carries
 * `'unsafe-inline'`, HOS-91); `astro build` fails if the substitution does not
 * happen, so production never ships without it.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { POSTHOG_INLINE_SNIPPET } from '../components/analytics/posthog.snippet';
import { SOFT_NAV_SCRIPT_HASHES_PLACEHOLDER } from './csp-soft-nav-placeholder';
import { FEEDBACK_NAV_BOOTSTRAP_SNIPPET } from './feedback/feedback-nav-bootstrap.snippet';
import { iconSpriteClientScript } from './icon-sprite';

/**
 * Substituted at build time — this literal is the ONE occurrence of the token
 * in the bundle. Typed as `string` so no bundler can constant-fold the
 * placeholder comparison away before the substitution happens.
 */
const SERIALIZED_BUILD_SCRIPT_HASHES: string = '__HOSPEDA_CSP_SOFT_NAV_SCRIPT_HASHES__';

/** One unquoted CSP hash source, e.g. `sha256-AbC…=`. */
const CspSha256SourceSchema = z.string().regex(/^sha256-[A-Za-z0-9+/]{43}=$/);

/** The serialized list the integration writes into the bundle. */
export const SoftNavScriptHashesSchema = z.array(CspSha256SourceSchema);

interface ParseSoftNavScriptHashesArgs {
    /** The serialized value found in the bundle (or the untouched placeholder). */
    readonly serialized: string;
}

/**
 * Parses the substituted value. The untouched placeholder (dev, tests) yields
 * an empty list; anything else must be a JSON array of `sha256-` sources, and a
 * malformed value throws — a corrupt substitution must crash the server at
 * boot, not silently publish a policy that blocks every soft navigation.
 *
 * @param args - serialized: the value to parse.
 * @returns The hash sources, unquoted.
 * @throws {z.ZodError | SyntaxError} When the value is neither the placeholder
 *   nor a valid serialized list.
 */
export function parseSoftNavScriptHashes({
    serialized
}: ParseSoftNavScriptHashesArgs): readonly string[] {
    if (serialized === SOFT_NAV_SCRIPT_HASHES_PLACEHOLDER) {
        return [];
    }
    return SoftNavScriptHashesSchema.parse(JSON.parse(serialized));
}

/**
 * Inline scripts rendered via `set:html` from a constant, which the build scan
 * cannot read. Keyed by the component that renders each one; every
 * `hashed-at-boot` entry of the integration's allowlist points back here (a
 * unit test holds the two lists equal).
 */
export const DEPLOYMENT_CONSTANT_INLINE_SCRIPTS: readonly {
    /** Component that renders the script, relative to `apps/web`. */
    readonly component: string;
    /**
     * The byte-exact content that component renders, or `null` when it renders
     * nothing in this environment (PostHog in dev or without a key).
     */
    readonly source: string | null;
}[] = [
    { component: 'src/layouts/BaseLayout.astro', source: FEEDBACK_NAV_BOOTSTRAP_SNIPPET },
    { component: 'src/components/analytics/PostHogScript.astro', source: POSTHOG_INLINE_SNIPPET },
    // Deterministic for a build (content-addressed sprite URL + committed
    // symbol manifest). Hashed here rather than trusted to be present on every
    // soft-nav origin, because not every page mounting <ClientRouter /> renders it.
    {
        component: 'src/components/shared/IconSpriteClientData.astro',
        source: iconSpriteClientScript()
    }
];

const toCspHash = (source: string): string =>
    `sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}`;

/**
 * Unquoted `sha256-…` sources for every inline script any page of this build
 * can emit: the build-time union plus the deployment constants.
 * `buildCspHeader()` appends them to `script-src` on every response.
 */
export const SOFT_NAV_SCRIPT_HASHES: readonly string[] = [
    ...new Set([
        ...parseSoftNavScriptHashes({ serialized: SERIALIZED_BUILD_SCRIPT_HASHES }),
        ...DEPLOYMENT_CONSTANT_INLINE_SCRIPTS.flatMap((entry) =>
            entry.source === null ? [] : [toCspHash(entry.source)]
        )
    ])
];
