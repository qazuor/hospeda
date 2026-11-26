/**
 * @file i18n-critical-prefixes.guard.test.ts
 * @description Keeps the critical half of the client dictionary honest
 * (HOS-2572), by recomputing what the early islands can name from the real
 * import graph.
 *
 * The contract it protects (see `src/lib/i18n-critical-prefixes.ts`): an island
 * in `EARLY_HYDRATION_ISLANDS` hydrates before the deferred rest of the
 * dictionary runs, so every key it can name must be in the parser-blocking
 * critical part. A miss is silent and production-only — the island renders its
 * inline fallback or the raw key, exactly the HOS-2388 symptom — which is why
 * this is a guard over the import graph and not a review checklist.
 *
 * What it derives, and how:
 *
 *  1. Every `<Tag client:x>` in every `.astro` file under `src`, with the module
 *     the tag's import resolves to (`collectIslandUsages`).
 *  2. The import graph out of the modules of the usages whose tag is
 *     allowlisted — ALL usages of that tag name, since the gate matches by name.
 *  3. Every three-segment key prefix a string literal in that graph names, the
 *     same literal scan the HOS-369 client guard uses.
 *
 * ## What it does NOT see
 *
 *  - **Keys passed into an island as props from `.astro`.** The scan reads the
 *    island's own graph; a template that hands it `labelKey="nav.x"` for the
 *    island to `t()` client-side is invisible. The HOS-369 client guard has the
 *    same blind spot. Shell islands receive resolved strings today.
 *  - **Keys built inside a workspace package** that is not in
 *    `CLIENT_PACKAGE_ROOTS`. The two known ones (`common.apiError` via
 *    `lib/api-errors.ts`, `validation` via `lib/forms/field-errors.ts`) are
 *    checked explicitly below; a new one would not be.
 *  - **A key computed entirely at runtime** (no namespace-headed literal at
 *    all). Nothing static can see it.
 *  - **Islands rendered by something other than an `.astro` template** with a
 *    `client:` directive (there are none: Astro only hydrates that way).
 *  - **Whether the gate actually runs.** That is
 *    `test/lib/i18n-hydration-gate.test.ts`, against Astro's installed runtime.
 *
 * Over-inclusion is caught too (dead entries) and bounded by a byte budget, so
 * the critical part cannot quietly grow back into the whole dictionary.
 */

import { gzipSync } from 'node:zlib';
import { trans } from '@repo/i18n';
import { describe, expect, it } from 'vitest';
import { buildI18nAssetBodies } from '../../src/lib/i18n-asset';
import { CLIENT_I18N_KEY_PREFIXES } from '../../src/lib/i18n-client-namespaces';
import {
    CRITICAL_I18N_KEY_PREFIXES,
    EARLY_HYDRATION_ISLANDS
} from '../../src/lib/i18n-critical-prefixes';
import { GATED_DIRECTIVES } from '../../src/lib/i18n-hydration-gate';
import {
    buildGraph,
    collectIslandUsages,
    isCovered,
    prefixesNameableFrom,
    REPO_ROOT
} from '../helpers/i18n-client-graph';

/** Segments per derived prefix. Two would ship all of `listing.owner` (34 KB). */
const CRITICAL_PREFIX_DEPTH = 3;

/**
 * Ceiling for the critical part of the real `es` dictionary, gate included.
 * Measured at ~15 KB raw / ~4.2 KB gzip when introduced; the whole client
 * dictionary is ~631 KB raw. Raising it is allowed, but it is a render-blocking
 * byte decision and should be made on purpose.
 */
const CRITICAL_ES_RAW_BUDGET = 24_000;

/** Key paths built outside any scanned literal, and the prefix each needs. */
const EXTERNAL_KEY_PATHS: ReadonlyArray<readonly [string, string]> = [
    ['apps/web/src/lib/api-errors.ts', 'common.apiError'],
    ['apps/web/src/lib/forms/field-errors.ts', 'validation']
];

const early: readonly string[] = EARLY_HYDRATION_ISLANDS;
const critical: readonly string[] = CRITICAL_I18N_KEY_PREFIXES;
const usages = collectIslandUsages();
const earlyUsages = usages.filter((u) => early.includes(u.tag));
const graph = buildGraph({
    entries: [...new Set(earlyUsages.flatMap((u) => (u.module ? [u.module] : [])))]
});
const nameable = prefixesNameableFrom(graph.modules, CRITICAL_PREFIX_DEPTH);

describe('HOS-2572 — island discovery', () => {
    it('finds the islands (non-vacuity)', () => {
        // ~250 usages when written. A parser regression that found a handful
        // would make every check below pass on almost nothing.
        expect(usages.length).toBeGreaterThan(200);
    });

    it('resolves every island usage to a module', () => {
        const unresolved = usages
            .filter((u) => !u.module)
            .map((u) => `${u.file}: <${u.tag} client:${u.directive}>`);
        expect(
            unresolved,
            `island usages with no resolvable import:\n${unresolved.join('\n')}`
        ).toEqual([]);
    });

    it('uses only directives the gate wraps', () => {
        // A custom directive would bypass the gate entirely: its island could
        // hydrate against the critical part alone.
        const known: readonly string[] = GATED_DIRECTIVES;
        const unknown = usages
            .filter((u) => !known.includes(u.directive))
            .map((u) => `${u.file}: client:${u.directive}`);
        expect(unknown).toEqual([]);
    });

    it('every allowlisted island is rendered somewhere', () => {
        const dead = early.filter((name) => !usages.some((u) => u.tag === name));
        expect(dead, `EARLY_HYDRATION_ISLANDS entries with no usage: ${dead.join(', ')}`).toEqual(
            []
        );
    });
});

describe('HOS-2572 — critical key prefixes', () => {
    it('resolves every import in the early islands’ graph', () => {
        expect(graph.unresolved, `unresolved imports:\n${graph.unresolved.join('\n')}`).toEqual([]);
        // The header/cookie-banner graph alone is ~90 modules.
        expect(graph.modules.size).toBeGreaterThan(50);
    });

    it('ships every prefix an early island can name in the critical part', () => {
        const missing = [...nameable.entries()]
            .filter(([prefix]) => !isCovered(prefix, critical))
            .map(([prefix, files]) => `${prefix}  (named in ${files.join(', ')})`);

        expect(
            missing,
            'These prefixes are reachable from an island in EARLY_HYDRATION_ISLANDS but are ' +
                'NOT in CRITICAL_I18N_KEY_PREFIXES. That island hydrates before the deferred ' +
                `rest of the dictionary runs, so it would render raw keys:\n${missing.join('\n')}`
        ).toEqual([]);
    });

    it.each([
        'es',
        'en',
        'pt'
    ] as const)('ships the early header control labels in %s', (locale) => {
        const keys = [
            'account.profileCompletion.fields.themeDark',
            'account.profileCompletion.fields.themeLight',
            'account.profileCompletion.fields.themeSystem',
            'auth.signUp.submit',
            'nav.userMenu.preferences',
            'nav.userMenu.signOut'
        ];

        const { critical: body } = buildI18nAssetBodies({ locale, messages: trans[locale] });

        for (const key of keys) expect(body, key).toContain(`${JSON.stringify(key)}:"`);
    });

    it('ships the externally built key paths when an early island reaches them', () => {
        const relative = new Set([...graph.modules].map((m) => m.slice(REPO_ROOT.length + 1)));
        const missing = EXTERNAL_KEY_PATHS.filter(
            ([file, prefix]) => relative.has(file) && !isCovered(prefix, critical)
        ).map(([file, prefix]) => `${prefix} (built via ${file})`);
        expect(missing).toEqual([]);
    });

    it('declares no prefix the early islands cannot name', () => {
        const names = [...nameable.keys()];
        const dead = critical.filter(
            (p) => !names.some((n) => n === p || n.startsWith(`${p}.`) || p.startsWith(`${n}.`))
        );
        expect(
            dead,
            `Critical entries no early island names — render-blocking bytes for nothing:\n${dead.join('\n')}`
        ).toEqual([]);
    });

    it('declares only prefixes the client dictionary carries', () => {
        // The critical part is cut FROM the client dictionary: an entry outside
        // CLIENT_I18N_KEY_PREFIXES selects nothing and hides a real miss.
        const outside = critical.filter((p) => !isCovered(p, CLIENT_I18N_KEY_PREFIXES));
        expect(outside).toEqual([]);
    });

    it(`keeps the real es critical part under ${CRITICAL_ES_RAW_BUDGET} bytes`, () => {
        const messages = (trans as Record<string, Record<string, string>>).es ?? {};
        const { critical: body, rest } = buildI18nAssetBodies({ locale: 'es', messages });

        // Non-vacuity: a real catalog, really split.
        expect(rest.length).toBeGreaterThan(400_000);
        expect(
            body.length,
            `critical es part is ${body.length} B raw / ${gzipSync(body).length} B gzip`
        ).toBeLessThanOrEqual(CRITICAL_ES_RAW_BUDGET);
    });
});
