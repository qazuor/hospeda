/**
 * @file BaseLayout.compare-mode-clear.test.ts
 * @description Source-assertion tests verifying BaseLayout.astro runs the
 * global compare-mode "clear on leave" check (HOS-85 T-005) on every page
 * load.
 *
 * BaseLayout wraps (directly or transitively) every layout except AuthLayout
 * and ErrorLayout (neither of which render compare-mode-reactive UI), so
 * calling `clearCompareModeIfOutsideSection` here on the existing
 * `astro:page-load` handler is sufficient to turn compare mode off the
 * instant the user navigates outside `/{locale}/alojamientos/*` — including
 * ClientRouter-driven (non full-reload) navigations, since `astro:page-load`
 * fires after every navigation, not just the initial one.
 *
 * Astro components cannot be rendered in Vitest — we assert on source text,
 * the project's documented approach for `.astro` coverage.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/layouts/BaseLayout.astro'), 'utf8');

describe('BaseLayout.astro — global compare-mode clear-on-leave (HOS-85 T-005)', () => {
    it('imports clearCompareModeIfOutsideSection from the compare store', () => {
        expect(src).toContain(
            "import { clearCompareModeIfOutsideSection } from '@/store/compare-store';"
        );
    });

    it('calls clearCompareModeIfOutsideSection with the current pathname', () => {
        expect(src).toContain('clearCompareModeIfOutsideSection(window.location.pathname);');
    });

    it('runs the call inside initPage(), which is registered on astro:page-load', () => {
        const initPageStart = src.indexOf('async function initPage');
        const initPageEnd = src.indexOf('\n\t\t\t}', initPageStart);
        const clearCallIdx = src.indexOf(
            'clearCompareModeIfOutsideSection(window.location.pathname);'
        );
        const listenerIdx = src.indexOf("document.addEventListener('astro:page-load', initPage);");

        expect(initPageStart).toBeGreaterThan(-1);
        expect(clearCallIdx).toBeGreaterThan(initPageStart);
        expect(clearCallIdx).toBeLessThan(initPageEnd);
        expect(listenerIdx).toBeGreaterThan(-1);
    });
});
