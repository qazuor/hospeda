/**
 * @file union-build-checks.ts
 * @description The build-failing checks of the CSP soft-nav union (HOS-807),
 * kept pure so they are unit-testable without running `astro build`.
 */

import type { DynamicInlineScript } from './extract-inline-scripts';

/** File written next to the server entry for the over-the-wire verifier. */
export const SOFT_NAV_REPORT_FILE_NAME = 'csp-soft-nav-script-hashes.json';

/** A component allowed to emit an executable inline script with render-time content. */
export interface RenderTimeInlineScriptException {
    /** Component path relative to `apps/web`, as the build reports it. */
    readonly component: string;
    /** Which deployment constant it renders, and why that is safe. */
    readonly reason: string;
}

/**
 * Components whose executable inline script is injected with `set:html` from a
 * deployment constant, so the compiled template shows only an expression and
 * the build scan cannot read it. Each one is hashed AT BOOT instead, from the
 * same export the component renders: every entry here must have a matching
 * entry in `DEPLOYMENT_CONSTANT_INLINE_SCRIPTS`
 * (`src/lib/csp-soft-nav-script-hashes.ts`), and a unit test holds the two
 * lists equal.
 *
 * A script whose content genuinely varies per request cannot be listed here —
 * it cannot be authorised on soft navigation at all. Move its data to a
 * `data-*` attribute read by a static script (what
 * `guest/messages/request-access.astro` did under HOS-807), which makes the
 * script static and lets the union cover it.
 */
export const RENDER_TIME_INLINE_SCRIPT_ALLOWLIST: readonly RenderTimeInlineScriptException[] = [
    {
        component: 'src/layouts/BaseLayout.astro',
        reason: 'FEEDBACK_NAV_BOOTSTRAP_SNIPPET is a constant.'
    },
    {
        component: 'src/components/shared/IconSpriteClientData.astro',
        reason: 'iconSpriteClientScript() is deterministic for a build: the content-addressed sprite URL plus the committed symbol manifest.'
    },
    {
        component: 'src/components/analytics/PostHogScript.astro',
        reason: 'POSTHOG_INLINE_SNIPPET is built from build-time env constants. Only BaseLayout renders it, so pages on AuthLayout and ErrorLayout do not carry it themselves.'
    }
];

/**
 * Lower bounds for the two sources of the build-time union. They exist to
 * catch a BROKEN derivation — a compiler or manifest change that makes the
 * scan silently see fewer scripts — which would otherwise ship a union that
 * quietly stops covering pages. Measured on 2026-09-28: 7 `is:inline` bodies
 * from 386 compiled components and 20 manifest-inlined scripts.
 *
 * Deleting real inline scripts can legitimately take a count under its floor;
 * then lower the floor in the same change, with the new measured count.
 */
export const UNION_SOURCE_FLOORS = {
    /** Distinct static `is:inline` bodies found across compiled components. */
    isInlineScripts: 6,
    /** Distinct non-empty scripts in the manifest's `inlinedScripts`. */
    manifestInlinedScripts: 16,
    /** `.astro` modules the transform hook saw. */
    scannedComponents: 300
} as const;

interface CheckUnionSourceCountsArgs {
    readonly isInlineScripts: number;
    readonly manifestInlinedScripts: number;
    readonly scannedComponents: number;
    readonly floors?: typeof UNION_SOURCE_FLOORS;
}

/**
 * Compares each source count with its floor.
 *
 * @param args - The measured counts and, optionally, the floors.
 * @returns One message per count under its floor (empty when all pass).
 */
export function checkUnionSourceCounts({
    isInlineScripts,
    manifestInlinedScripts,
    scannedComponents,
    floors = UNION_SOURCE_FLOORS
}: CheckUnionSourceCountsArgs): readonly string[] {
    const measured = { isInlineScripts, manifestInlinedScripts, scannedComponents };
    return (Object.keys(floors) as (keyof typeof UNION_SOURCE_FLOORS)[])
        .filter((key) => measured[key] < floors[key])
        .map(
            (key) =>
                `implausible CSP soft-nav union: ${key} = ${measured[key]}, floor ${floors[key]}. The derivation is more likely broken than the app; if scripts were really removed, lower UNION_SOURCE_FLOORS.${key} in the same change.`
        );
}

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
