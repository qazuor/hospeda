/**
 * @file head-priority-slot.test.ts
 * @description HOS-2575: the home hero's LCP image preload must reach the
 * browser's preload scanner before the ~83 KB inline critical CSS.
 *
 * `<CriticalStyles />` inlines global.css at the very top of `<head>`. Any hint
 * emitted after it — the `head-extra` / `head` slots — only becomes visible to
 * the preload scanner once those bytes have arrived, which measured as 1,250 ms
 * of LCP resource load delay on mobile PageSpeed. The `head-priority` slot is
 * rendered before `<CriticalStyles />` so a page can put its LCP preload first.
 *
 * Source-level assertions: Astro components cannot be rendered in Vitest (the
 * project's documented approach for .astro coverage).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(resolve(__dirname, '../../src', path), 'utf8');

const baseLayout = read('layouts/BaseLayout.astro');
const defaultLayout = read('layouts/DefaultLayout.astro');
const homePage = read('pages/[lang]/index.astro');

describe('head-priority slot (HOS-2575)', () => {
    it('BaseLayout renders the head-priority slot before the inline critical CSS', () => {
        const slotAt = baseLayout.indexOf('<slot name="head-priority" />');
        const criticalAt = baseLayout.indexOf('<CriticalStyles />');

        expect(slotAt).toBeGreaterThan(-1);
        expect(criticalAt).toBeGreaterThan(-1);
        expect(slotAt).toBeLessThan(criticalAt);
    });

    it('BaseLayout renders the head-priority slot after the charset meta', () => {
        // The charset declaration must stay within the first 1024 bytes and
        // precede any content, so nothing may be slotted ahead of it.
        const charsetAt = baseLayout.indexOf('<meta charset="UTF-8" />');
        const slotAt = baseLayout.indexOf('<slot name="head-priority" />');

        expect(charsetAt).toBeGreaterThan(-1);
        expect(charsetAt).toBeLessThan(slotAt);
    });

    it('DefaultLayout forwards head-priority to BaseLayout', () => {
        expect(defaultLayout).toMatch(/<slot\s+name="head-priority"\s+slot="head-priority"\s*\/>/);
    });

    it('the home page puts its hero image preload in head-priority', () => {
        const preload =
            homePage.match(/<link\b[^>]*rel="preload"[^>]*as="image"[^>]*\/>/s)?.[0] ?? '';

        expect(preload).not.toBe('');
        expect(preload).toContain('slot="head-priority"');
        expect(preload).toContain('fetchpriority="high"');
    });
});
