/**
 * @file locale-segment-not-from-lang.test.ts
 * @description Static guard: no client code may read the `lang` attribute
 * (HOS-585 G-5).
 *
 * Why this guard exists, precisely: `<html lang>` used to hold the bare locale
 * (`es`), and three call sites built route URLs out of it —
 * `/${lang}/registro/`, `/${lang}/beneficios/` and the ErrorBanner feedback
 * link. G-5 changed the attribute to a regional BCP-47 tag (`es-AR`) because
 * Bing weighs country signals explicitly. There is no `/es-AR/...` route, so
 * every one of those links would have started 404ing — silently, in a client
 * script, on a path nothing renders server-side.
 *
 * The bare locale now lives in `data-locale`, and this guard is what keeps the
 * two from being confused again. It bans reading `lang` outright rather than
 * banning "reading lang to build a URL": the narrower rule would need to
 * understand what the value is used for, which static text cannot, and a reader
 * that merely LOGS the locale today is one refactor away from routing on it.
 *
 * @module test/static-guards/locale-segment-not-from-lang
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = path.resolve(__dirname, '../../src');

/** File extensions this guard inspects. */
const SCANNED_EXTENSIONS = new Set(['.astro', '.ts', '.tsx']);

/**
 * Files allowed to read the `lang` attribute.
 *
 * Empty on purpose. The honesty test below would have nothing to assert about
 * an entry, so adding one requires a reason written next to it AND a check that
 * removing it makes this guard fail.
 */
const EXEMPTIONS: readonly string[] = [];

/**
 * Ways of reading the attribute, all anchored on the attribute NAME so a
 * rename cannot slip past. Covers the property form (`.lang`), the explicit
 * getter, and a `[lang=...]` selector.
 */
const LANG_READ_PATTERNS: readonly RegExp[] = [
    /documentElement\s*\.\s*lang\b/,
    /getAttribute\(\s*['"`]lang['"`]\s*\)/,
    /querySelector(?:All)?\(\s*['"`][^'"`]*\[lang[=\]]/
];

/** Recursively collect every scanned source file under `dir`. */
function collectSourceFiles(dir: string): string[] {
    const found: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            found.push(...collectSourceFiles(full));
            continue;
        }
        if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
            found.push(full);
        }
    }
    return found;
}

/** Files that read the `lang` attribute, relative to `src/`. */
function findViolations({ exemptions }: { readonly exemptions: readonly string[] }): string[] {
    return collectSourceFiles(WEB_SRC)
        .filter((file) => {
            const relative = path.relative(WEB_SRC, file);
            if (exemptions.includes(relative)) return false;
            const source = fs.readFileSync(file, 'utf8');
            return LANG_READ_PATTERNS.some((pattern) => pattern.test(source));
        })
        .map((file) => path.relative(WEB_SRC, file));
}

describe('the locale route segment never comes from the lang attribute', () => {
    it('no source file reads the lang attribute', () => {
        expect(findViolations({ exemptions: EXEMPTIONS })).toEqual([]);
    });

    it('recognises a reintroduced read (the guard is not vacuous)', () => {
        // The predicate must fire on the exact shapes that were removed, or the
        // green above means only that the patterns match nothing anywhere.
        const removedShapes = [
            "const lang = document.documentElement.lang || 'es';",
            "const lang = document.documentElement.getAttribute('lang') ?? 'es';"
        ];

        for (const shape of removedShapes) {
            expect(LANG_READ_PATTERNS.some((pattern) => pattern.test(shape))).toBe(true);
        }
    });

    it('does not fire on the data-locale reads that replaced them', () => {
        const allowedShape = "document.documentElement.getAttribute('data-locale') ?? 'es'";

        expect(LANG_READ_PATTERNS.some((pattern) => pattern.test(allowedShape))).toBe(false);
    });

    it('does not fire on the hreflang attribute, which is a different thing', () => {
        const hreflang = '<link rel="alternate" hreflang="es-AR" href={esUrl} />';

        expect(LANG_READ_PATTERNS.some((pattern) => pattern.test(hreflang))).toBe(false);
    });
});
