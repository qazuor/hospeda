/**
 * @file critical-styles-consistency.test.ts
 * @description Guard: `global.css` must be inlined as critical CSS through
 * ONE shared component (`CriticalStyles.astro`), rendered identically by
 * every top-level HTML shell layout (HOS-369).
 *
 * ## Why this guard exists
 *
 * The CSP carries no nonce — `middleware.ts` hashes every inline `<style>` by
 * CONTENT (`collectCspHashes`) and allows it in `style-src` for that response
 * only. Astro's `<ClientRouter />` does soft-navigation, but the CSP that
 * stays enforced in the browser is the one stamped for the FIRST page load.
 * A soft-navigated page's inline `<style>` only keeps rendering if its hash
 * was ALREADY present in that first page's CSP — which only holds if EVERY
 * layout emits byte-identical content for the critical CSS block (see
 * HOS-91: a differently-hashed inline `<style>` after a soft-nav leaves the
 * whole page unstyled).
 *
 * Four layouts each render their own `<head>`
 * (`BaseLayout`/`StandaloneLayout`/`AuthLayout`/`ErrorLayout`). "Keep the
 * inline CSS identical" cannot be a convention four files individually
 * honor — it has to be a structural guarantee: exactly one component
 * (`CriticalStyles.astro`) holds the single `?inline` import of `global.css`,
 * and every layout renders THAT component instead of importing the
 * stylesheet (or authoring its own inline block) directly.
 *
 * This guard fails if:
 *   - `CriticalStyles.astro` stops using the `?inline` + `is:inline` +
 *     `set:html` mechanism the CSP hasher depends on, OR
 *   - any of the four layouts stops rendering `<CriticalStyles />`, OR
 *   - any `.astro` file under `src/` reintroduces a side-effect
 *     `import '@/styles/global.css'` (or a relative equivalent), which would
 *     put a SECOND, differently-shaped stylesheet reference back into the
 *     page — either a duplicated render-blocking `<link>` (defeating the
 *     whole point of HOS-369) or a diverging inline block (breaking the
 *     byte-identity invariant above).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(__dirname, '../../..');
const SRC_DIR = join(WEB_ROOT, 'src');

const CRITICAL_STYLES_PATH = join(SRC_DIR, 'components/shared/CriticalStyles.astro');
const CRITICAL_STYLES_SOURCE = readFileSync(CRITICAL_STYLES_PATH, 'utf8');

/** The four top-level HTML shell layouts, relative to `src/layouts/`. */
const SHELL_LAYOUTS = [
    'BaseLayout.astro',
    'StandaloneLayout.astro',
    'AuthLayout.astro',
    'ErrorLayout.astro'
] as const;

/** Recursively collect every `.astro` file under `dir`. */
function collectAstroFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stats = statSync(full);
        if (stats.isDirectory()) {
            if (entry === 'node_modules' || entry === 'dist') continue;
            files.push(...collectAstroFiles(full));
            continue;
        }
        if (entry.endsWith('.astro')) files.push(full);
    }
    return files;
}

const ALL_ASTRO_FILES = collectAstroFiles(SRC_DIR);

describe('the scan itself', () => {
    it('finds a non-trivial number of .astro files', () => {
        // Without this, "no file reintroduces the direct import" would pass
        // vacuously if the scan stopped reaching src/.
        expect(ALL_ASTRO_FILES.length).toBeGreaterThan(100);
    });
});

describe('CriticalStyles.astro — the single source of the inline block', () => {
    it('imports global.css with the `?inline` Vite suffix (resolved @import chain, no separate stylesheet)', () => {
        expect(CRITICAL_STYLES_SOURCE).toMatch(
            /import\s+globalCss\s+from\s+['"]@\/styles\/global\.css\?inline['"]/
        );
    });

    it('does NOT use `?raw` (would ship unresolved @import statements)', () => {
        expect(CRITICAL_STYLES_SOURCE).not.toMatch(/global\.css\?raw/);
    });

    it('renders the CSS via `is:inline` + `set:html` (required for astro.config.mjs inlineStylesheets: "never", and for the CSP hasher to see raw, unmodified text)', () => {
        expect(CRITICAL_STYLES_SOURCE).toMatch(
            /<style\s+is:inline\s+set:html=\{globalCss\}\s*><\/style>/
        );
    });
});

describe('every shell layout renders CriticalStyles (byte-identity structural guarantee)', () => {
    for (const layoutFile of SHELL_LAYOUTS) {
        const layoutPath = join(SRC_DIR, 'layouts', layoutFile);
        const source = readFileSync(layoutPath, 'utf8');

        it(`${layoutFile} imports the shared CriticalStyles component`, () => {
            expect(
                source,
                `${layoutFile} must import CriticalStyles from '@/components/shared/CriticalStyles.astro' — ` +
                    'a divergent import (or authoring its own inline <style>) breaks the cross-page CSP hash match (HOS-91).'
            ).toMatch(
                /import\s+CriticalStyles\s+from\s+['"]@\/components\/shared\/CriticalStyles\.astro['"]/
            );
        });

        it(`${layoutFile} renders <CriticalStyles /> in its <head>`, () => {
            expect(
                source,
                `${layoutFile} imports CriticalStyles but never renders <CriticalStyles /> — global.css tokens would not resolve.`
            ).toMatch(/<CriticalStyles\s*\/>/);
        });
    }
});

describe('nothing reintroduces a direct global.css import', () => {
    it('leaves no `.astro` file importing global.css directly (only CriticalStyles.astro may)', () => {
        const DIRECT_IMPORT_PATTERN = /import\s+['"][^'"]*styles\/global\.css['"]/;

        const offenders = ALL_ASTRO_FILES.filter((file) => {
            if (file === CRITICAL_STYLES_PATH) return false;
            return DIRECT_IMPORT_PATTERN.test(readFileSync(file, 'utf8'));
        }).map((file) => relative(WEB_ROOT, file));

        expect(
            offenders,
            "A direct `import '.../global.css'` reintroduces a render-blocking <link> " +
                '(or a second, divergent inline block) alongside CriticalStyles — route ' +
                'every consumer through the shared component instead.'
        ).toEqual([]);
    });
});
