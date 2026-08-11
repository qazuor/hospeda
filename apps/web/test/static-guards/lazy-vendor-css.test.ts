/**
 * @file lazy-vendor-css.test.ts
 * @description Guard: vendor stylesheets for click-only UI must be imported
 * with Vite's `?url` suffix, never as a style dependency (HOS-369 W3-5).
 *
 * ## The failure this exists to prevent
 *
 * **Astro hoists the CSS of every module in a page's module graph into that
 * page's `<head>`, and it does not distinguish a static import from a dynamic
 * one.** Two features in this app were lazy-loaded correctly and still shipped
 * their stylesheet render-blocking on every page, which nothing at runtime
 * reported:
 *
 * - GLightbox: `BaseLayout.astro` guarded it behind
 *   `if (document.querySelector('[data-glightbox]'))` AND imported both the JS
 *   and the CSS dynamically. 11,089 B of rules still linked in `<head>` on the
 *   home, where no gallery can exist.
 * - react-day-picker: `SearchBarCalendar.client.tsx` is behind `React.lazy` +
 *   `Suspense` with a prefetch. 8,845 B still linked in `<head>` on the home,
 *   for a panel that appears only after a click.
 *
 * Moving the import into a module of its own does NOT fix it — Vite merges a
 * module whose only content is a CSS import back into its parent chunk, and the
 * stylesheet reappears in `<head>`. That was tried, measured in the served HTML,
 * and discarded.
 *
 * `?url` is what breaks the chain: the file is emitted as an asset and imported
 * as a plain string, so the importing module declares no style dependency for
 * Astro to hoist. `lib/ensure-stylesheet.ts` then injects the `<link>` when the
 * feature actually loads.
 *
 * ## Why this guard is narrow on purpose
 *
 * It pins two specific vendor stylesheets rather than trying to express "no
 * lazy component may import CSS". The general rule is not statically decidable
 * — whether a component is on the critical path depends on which pages mount
 * it. Adding a third vendor stylesheet for click-only UI means adding it here.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = path.resolve(__dirname, '../../src');

/**
 * Vendor stylesheets that back click-only UI. Each must be imported with
 * `?url`, and reached through `ensureStylesheet`.
 */
const LAZY_VENDOR_CSS = [
    'glightbox/dist/css/glightbox.min.css',
    'react-day-picker/style.css'
] as const;

const SCANNED_EXTENSIONS = new Set(['.astro', '.css', '.ts', '.tsx']);

function collectFiles(dir: string): { rel: string; source: string }[] {
    if (!fs.existsSync(dir)) return [];

    const files: { rel: string; source: string }[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist') continue;
            files.push(...collectFiles(full));
            continue;
        }
        if (!SCANNED_EXTENSIONS.has(path.extname(entry.name))) continue;
        files.push({
            rel: path.relative(WEB_SRC, full).split(path.sep).join('/'),
            source: fs.readFileSync(full, 'utf8')
        });
    }
    return files;
}

/**
 * Strips comments so the matchers below see code, not prose.
 *
 * Every file that fixes this class of bug explains it in a comment, and those
 * explanations necessarily quote the forbidden import verbatim. A guard that
 * flagged them would force people to delete the documentation that makes the
 * invariant understandable — so it reads code only.
 *
 * Removes `/* … *\/` blocks and whole lines whose first non-space character
 * starts a line comment or continues a JSDoc block. It deliberately does NOT
 * try to strip trailing `//` comments mid-line: an import statement never has
 * one before its specifier, and a looser rule would start mangling `https://`
 * inside string literals.
 */
function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => {
            const t = line.trimStart();
            return !t.startsWith('//') && !t.startsWith('*');
        })
        .join('\n');
}

const ALL_FILES = collectFiles(WEB_SRC).map((f) => ({ ...f, code: stripComments(f.source) }));

describe('the lazy-vendor-css scan itself', () => {
    it('scans a non-trivial number of files', () => {
        expect(ALL_FILES.length).toBeGreaterThan(100);
    });

    it('finds each vendor stylesheet actually imported somewhere', () => {
        // Without this, "no bare import exists" would also pass if the feature
        // were deleted, or if the specifier were renamed upstream.
        for (const specifier of LAZY_VENDOR_CSS) {
            const importers = ALL_FILES.filter((f) => f.source.includes(specifier));
            expect(
                importers.length,
                `nothing imports ${specifier} any more — if it was removed, drop it from LAZY_VENDOR_CSS`
            ).toBeGreaterThan(0);
        }
    });
});

describe('vendor CSS for click-only UI is imported with ?url', () => {
    it.each(LAZY_VENDOR_CSS)('%s is never imported as a style dependency', (specifier) => {
        // A bare import — `import 'x.css'` or `@import "x.css"` — is what makes
        // Astro hoist it. `?url` right after the specifier is what does not.
        const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const bareImport = new RegExp(
            `(@import\\s+|\\bfrom\\s*|\\bimport\\s*\\(?\\s*)["']${escaped}["']`
        );

        const violations = ALL_FILES.filter((f) => bareImport.test(f.code)).map((f) => f.rel);

        expect(
            violations,
            `Astro hoists any stylesheet in a page's module graph into <head>, dynamic import or not — a bare import here puts ${specifier} back on the critical path of every page that reaches this module, silently. Import it as \`${specifier}?url\` and attach it with ensureStylesheet().`
        ).toEqual([]);
    });

    it.each(LAZY_VENDOR_CSS)('%s is imported with ?url somewhere', (specifier) => {
        const withUrl = ALL_FILES.filter((f) => f.code.includes(`${specifier}?url`)).map(
            (f) => f.rel
        );
        expect(withUrl.length, `no module imports ${specifier}?url`).toBeGreaterThan(0);
    });
});

describe('the injected link goes through the shared helper', () => {
    it('every ?url importer of these stylesheets also uses ensureStylesheet', () => {
        const offenders = ALL_FILES.filter(
            (f) =>
                LAZY_VENDOR_CSS.some((s) => f.code.includes(`${s}?url`)) &&
                !f.code.includes('ensureStylesheet')
        ).map((f) => f.rel);

        expect(
            offenders,
            'a `?url` import with no ensureStylesheet call emits the asset but never attaches it — the feature renders unstyled'
        ).toEqual([]);
    });
});
