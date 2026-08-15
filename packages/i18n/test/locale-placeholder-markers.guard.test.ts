/**
 * @file locale-placeholder-markers.guard.test.ts
 * @description Regression guard for H-57 — production served 3.272 locale values
 * carrying a bracketed development marker straight to end users, e.g.
 * `[EN] La capacidad no puede ser menor a 1` in the accommodation editor on
 * `/en` and `/pt`.
 *
 * Three sources produced them, all in `en`/`pt` only (`es` had none):
 *  1. `scripts/add-missing-zod-keys.ts` bulk-filled `validation.json` with
 *     `[EN]`/`[PT]`-prefixed Spanish copy — 1.568 keys per locale, 3.136 total.
 *  2. Four `[EN]`/`[PT]` values hand-written into `host.json` alongside the
 *     HOS-309 featured toggle — 8 total.
 *  3. The SPEC-208 editor MVP (b83b8862e) wrote the bare string `[TODO]` as the
 *     whole value for 64 `host.json` keys per locale — 128 total. Those show no
 *     Spanish fallback at all, just the marker.
 *
 * Neither is a runtime fallback: the markers are versioned content committed to
 * the locale JSON files, so they ship with every build.
 *
 * Falling back to the Spanish copy is the documented policy (`apps/web/CLAUDE.md`:
 * "Until translated, en and pt fall back to es strings"). Carrying a marker on top
 * of that fallback is not — this guard asserts only that no servable locale value
 * BEGINS with a bracketed uppercase marker. It makes no claim about translation
 * quality or completeness.
 */

import { describe, expect, it } from 'vitest';

/**
 * The locale files are pulled in as MODULES, not read from disk.
 *
 * `test/setup.ts` mocks `node:fs.readFileSync` package-wide to return a 51-byte
 * stub for anything under `locales/`, so an fs-based walker here would inspect
 * the stub and report a clean sweep over files it never opened. `import.meta.glob`
 * is resolved by Vite at transform time and never touches the mock.
 */
const LOCALE_MODULES = import.meta.glob<Record<string, unknown>>('../src/locales/*/*.json', {
    eager: true,
    import: 'default'
});

/**
 * A development marker at the START of a locale value: `[EN] `, `[PT] `,
 * `[TODO]`, `[FIXME]`, `[TBD]`, … Bracketed uppercase tokens are never
 * legitimate user-facing copy in this repo — no locale value is expected to
 * open with one.
 */
const PLACEHOLDER_MARKER_RE = /^\s*\[[A-Z][A-Z0-9_]*\]/;

interface MarkedValue {
    readonly locale: string;
    readonly namespace: string;
    readonly key: string;
    readonly value: string;
}

/**
 * Collect every string leaf of a parsed locale namespace, flagging the ones
 * whose value opens with a bracketed uppercase marker.
 */
function collectMarkedValues(params: {
    readonly node: unknown;
    readonly path: readonly string[];
    readonly locale: string;
    readonly namespace: string;
}): MarkedValue[] {
    const { node, path, locale, namespace } = params;

    if (typeof node === 'string') {
        if (!PLACEHOLDER_MARKER_RE.test(node)) return [];
        return [{ locale, namespace, key: path.join('.'), value: node }];
    }

    if (Array.isArray(node)) {
        return node.flatMap((child, index) =>
            collectMarkedValues({
                node: child,
                path: [...path, String(index)],
                locale,
                namespace
            })
        );
    }

    if (node !== null && typeof node === 'object') {
        return Object.entries(node as Record<string, unknown>).flatMap(([key, child]) =>
            collectMarkedValues({ node: child, path: [...path, key], locale, namespace })
        );
    }

    return [];
}

/**
 * Walk every locale namespace and return the values that carry a marker,
 * together with the number of namespaces and string leaves inspected.
 */
function scanLocales(): {
    readonly marked: readonly MarkedValue[];
    readonly inspected: number;
    readonly namespaces: number;
} {
    const marked: MarkedValue[] = [];
    let inspected = 0;
    let namespaces = 0;

    for (const [modulePath, parsed] of Object.entries(LOCALE_MODULES)) {
        const match = /\/locales\/([^/]+)\/([^/]+)\.json$/.exec(modulePath);
        if (!match) continue;
        const [, locale = '', namespace = ''] = match;

        namespaces += 1;
        inspected += countStrings(parsed);
        marked.push(...collectMarkedValues({ node: parsed, path: [], locale, namespace }));
    }

    return { marked, inspected, namespaces };
}

/** Count the string leaves of a parsed JSON value. */
function countStrings(node: unknown): number {
    if (typeof node === 'string') return 1;
    if (Array.isArray(node)) return node.reduce<number>((sum, c) => sum + countStrings(c), 0);
    if (node !== null && typeof node === 'object') {
        return Object.values(node as Record<string, unknown>).reduce<number>(
            (sum, c) => sum + countStrings(c),
            0
        );
    }
    return 0;
}

describe('locale placeholder markers (H-57)', () => {
    const { marked, inspected, namespaces } = scanLocales();

    it('inspects every locale namespace, with their real contents', () => {
        // Without this the suite could pass by scanning nothing — or by scanning
        // the 51-byte `node:fs` stub from `test/setup.ts`, which is exactly how a
        // walker can report a clean sweep over files it never opened. Both floors
        // are asserted: one namespace per locale file, and a string count only the
        // real dictionaries can reach.
        expect(namespaces).toBeGreaterThanOrEqual(3 * 60);
        expect(inspected).toBeGreaterThan(30_000);
    });

    it('detects a marker when one is present', () => {
        // Verifies the instrument before trusting its "found nothing": each of
        // the three shapes that actually shipped to production must match.
        expect(PLACEHOLDER_MARKER_RE.test('[EN] La capacidad no puede ser menor a 1')).toBe(true);
        expect(PLACEHOLDER_MARKER_RE.test('[PT] La capacidad no puede ser menor a 1')).toBe(true);
        expect(PLACEHOLDER_MARKER_RE.test('[TODO]')).toBe(true);
        // And must not fire on ordinary copy.
        expect(PLACEHOLDER_MARKER_RE.test('La capacidad no puede ser menor a 1')).toBe(false);
        expect(PLACEHOLDER_MARKER_RE.test('Capacity cannot be lower than 1')).toBe(false);
    });

    it('serves no locale value that begins with a bracketed uppercase marker', () => {
        const report = marked
            .slice(0, 20)
            .map(
                (m) => `  ${m.locale}/${m.namespace}.json :: ${m.key} = ${JSON.stringify(m.value)}`
            )
            .join('\n');
        const more = marked.length > 20 ? `\n  ... and ${marked.length - 20} more` : '';

        expect(
            marked,
            marked.length === 0
                ? ''
                : `${marked.length} locale value(s) start with a development marker and would be shown to users:\n${report}${more}\n\nFall back to the Spanish copy WITHOUT the marker.`
        ).toEqual([]);
    });
});
