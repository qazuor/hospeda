/**
 * @file union-build-checks.ts
 * @description The build-failing checks of the CSP soft-nav union (HOS-807),
 * kept pure so they are unit-testable without running `astro build`.
 */

import type { DynamicInlineScript } from './extract-inline-scripts';

/** File written next to the server entry for the over-the-wire verifier. */
export const SOFT_NAV_REPORT_FILE_NAME = 'csp-soft-nav-script-hashes.json';

/**
 * How a render-time inline script stays authorised on soft navigation even
 * though the build cannot pre-hash it.
 * - `hashed-at-boot`: its content is a deployment constant listed in
 *   `DEPLOYMENT_CONSTANT_INLINE_SCRIPTS` (`src/lib/csp-soft-nav-script-hashes.ts`),
 *   hashed at server start and published on every response.
 * - `on-every-client-router-page`: every layout that mounts `<ClientRouter />`
 *   renders it with identical content, so the origin page's own hashes always
 *   carry it. `scripts/verify-csp-over-the-wire.mjs` checks the property.
 */
export type RenderTimeInlineScriptCoverage = 'hashed-at-boot' | 'on-every-client-router-page';

/** A component allowed to emit an executable inline script with render-time content. */
export interface RenderTimeInlineScriptException {
    /** Component path relative to `apps/web`, as the build reports it. */
    readonly component: string;
    readonly coverage: RenderTimeInlineScriptCoverage;
    /** Why soft navigation cannot break it. */
    readonly reason: string;
}

/**
 * Components whose executable inline script depends on render-time data and
 * therefore cannot be in the build-time union. Every entry says how soft
 * navigation stays safe; "it works on a reload" is not a reason.
 *
 * Adding an entry is a decision, not a fix: prefer moving the data to a
 * `data-*` attribute read by a static script (what
 * `guest/messages/request-access.astro` did under HOS-807), which makes the
 * script static and lets the union cover it.
 */
export const RENDER_TIME_INLINE_SCRIPT_ALLOWLIST: readonly RenderTimeInlineScriptException[] = [
    {
        component: 'src/layouts/BaseLayout.astro',
        coverage: 'hashed-at-boot',
        reason: 'FEEDBACK_NAV_BOOTSTRAP_SNIPPET is a constant; hashed from the same export at boot.'
    },
    {
        component: 'src/components/billing/StripCheckoutReturnParams.astro',
        coverage: 'hashed-at-boot',
        reason: 'STRIP_CHECKOUT_RETURN_PARAMS_SNIPPET is a constant; hashed from the same export at boot.'
    },
    {
        component: 'src/components/shared/IconSpriteClientData.astro',
        coverage: 'on-every-client-router-page',
        reason: 'Rendered with identical content (the sprite URL of this build) by BaseLayout, AuthLayout, ErrorLayout and StandaloneLayout — every layout that mounts <ClientRouter />.'
    },
    {
        component: 'src/components/analytics/PostHogScript.astro',
        coverage: 'hashed-at-boot',
        reason: 'POSTHOG_INLINE_SNIPPET is built from build-time env constants; hashed from the same export at boot. Needed because only BaseLayout renders it, so Auth/Error/Standalone pages do not carry it themselves.'
    }
];

interface CheckRenderTimeScriptsArgs {
    /** Render-time executable inline scripts found, per component. */
    readonly dynamicByComponent: ReadonlyMap<string, readonly DynamicInlineScript[]>;
    readonly allowlist: readonly RenderTimeInlineScriptException[];
}

interface CheckRenderTimeScriptsResult {
    /** One message per violation; the build fails when non-empty. */
    readonly errors: readonly string[];
    /** The allowlisted components found, for the build report. */
    readonly allowed: readonly RenderTimeInlineScriptException[];
}

/**
 * Checks the render-time inline scripts against the allowlist, both ways: an
 * unlisted component fails, and so does a listed one that no longer emits a
 * render-time script (a stale entry would silently pre-approve the next one).
 *
 * @param args - dynamicByComponent and allowlist.
 * @returns The violations and the allowed entries.
 */
export function checkRenderTimeScripts({
    dynamicByComponent,
    allowlist
}: CheckRenderTimeScriptsArgs): CheckRenderTimeScriptsResult {
    const errors: string[] = [];
    const allowedComponents = new Set(allowlist.map((entry) => entry.component));

    for (const [component, scripts] of dynamicByComponent) {
        if (allowedComponents.has(component)) {
            continue;
        }
        const detail = scripts
            .map((script) => `    <script ${script.openingTagAttributes}> ${script.bodyPreview}`)
            .join('\n');
        errors.push(
            `${component} emits an executable inline <script> whose content is only known at render time, so its hash cannot be in the CSP soft-nav union and the script is BLOCKED when a page is reached by <ClientRouter /> navigation. Move the data to a data-* attribute read by a static script, or add the component to RENDER_TIME_INLINE_SCRIPT_ALLOWLIST with the reason soft navigation cannot break it:\n${detail}`
        );
    }

    for (const entry of allowlist) {
        if (!dynamicByComponent.has(entry.component)) {
            errors.push(
                `${entry.component} is on RENDER_TIME_INLINE_SCRIPT_ALLOWLIST but the build found no render-time inline script in it. Remove the stale entry.`
            );
        }
    }

    return {
        errors,
        allowed: allowlist.filter((entry) => dynamicByComponent.has(entry.component))
    };
}

interface ReplacePlaceholderOnceArgs {
    readonly files: readonly { readonly file: string; readonly text: string }[];
    /** The bare placeholder, without quotes. */
    readonly placeholder: string;
    /** The JSON-serialized hash list to write in its place. */
    readonly serialized: string;
}

interface ReplacePlaceholderOnceResult {
    /** The one file that held the placeholder. */
    readonly file: string;
    /** That file's new content. */
    readonly text: string;
}

/**
 * Replaces the quoted placeholder string literal with a string literal holding
 * `serialized`, requiring it to appear exactly once across all bundle files.
 *
 * Zero means the runtime module was dropped from the bundle or renamed; more
 * than one means the literal was duplicated and the runtime's "still the
 * placeholder?" check could be rewritten into a self-comparison. Both would
 * ship a policy without the union, so both throw.
 *
 * @param args - files, placeholder and serialized.
 * @returns The file to rewrite and its new text.
 * @throws {Error} When the placeholder is not found exactly once.
 */
export function replacePlaceholderOnce({
    files,
    placeholder,
    serialized
}: ReplacePlaceholderOnceArgs): ReplacePlaceholderOnceResult {
    const quoted = [`"${placeholder}"`, `'${placeholder}'`];
    const hits = files.flatMap(({ file, text }) =>
        quoted.flatMap((literal) => {
            const count = text.split(literal).length - 1;
            return count > 0 ? [{ file, text, literal, count }] : [];
        })
    );
    const total = hits.reduce((sum, hit) => sum + hit.count, 0);
    const hit = hits[0];

    if (total !== 1 || !hit) {
        throw new Error(
            `[HOS-807] expected the CSP soft-nav placeholder exactly once in the server bundle, found it ${total} time(s)${hits.length > 0 ? ` in ${hits.map((h) => h.file).join(', ')}` : ''}.`
        );
    }

    return {
        file: hit.file,
        text: hit.text.replace(hit.literal, () => JSON.stringify(serialized))
    };
}
