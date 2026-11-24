/**
 * @file listing-action-bar-presence.guard.test.ts
 * @description HOS-2579 owner criterion (24/11/2026) and §6.10.1: every listing
 * detail page of the three verticals mounts the action bar unconditionally, so
 * the mobile dock always has a `[data-mobile-dock-slot="contact"] [data-dock-item]`
 * and stays pinned while scrolling (`mobile-dock-autohide.ts`). Favorito and
 * Compartir always exist, so the bar never has a reason to be absent.
 *
 * What it cannot see: it reads source, so it proves the mount is not wrapped in
 * a JSX condition and that the bar gets the facts it needs, not that the island
 * hydrates. That half is `ListingContactBar.test.tsx` (bare listing of each
 * vertical) and the E2E pin case in `guest-13-listing-detail-standard.spec.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../src');

const PAGES = [
    ['accommodation', 'pages/[lang]/alojamientos/[slug].astro'],
    ['venue', 'pages/[lang]/comer-y-salir/[slug].astro'],
    ['experience', 'pages/[lang]/experiencias/[slug].astro']
] as const;

/** The template part of an .astro file, with HTML and JSX comments removed. */
function templateOf(source: string): string {
    const fence = source.indexOf('---', source.indexOf('---') + 3);
    return source
        .slice(fence + 3)
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

describe('every listing page mounts the action bar (HOS-2579 owner criterion)', () => {
    it.each(
        PAGES
    )('the %s page mounts ListingContactBar exactly once, outside any condition', (_vertical, page) => {
        const template = templateOf(readFileSync(resolve(root, page), 'utf8'));
        const mounts = [...template.matchAll(/<ListingContactBar\b/g)];

        expect(mounts).toHaveLength(1);
        const before = template.slice(0, mounts[0]?.index).trimEnd();
        // A conditional mount ends its guard with `&& (`, `? (` or `<>` right before the tag.
        expect(before).not.toMatch(/(&&|\?|\|\||<>)\s*\(?$/);
        expect(before.endsWith('(')).toBe(false);
    });

    it.each(PAGES)('the %s page hands the bar the public facts it needs', (vertical, page) => {
        const template = templateOf(readFileSync(resolve(root, page), 'utf8'));
        const mount = template.slice(template.indexOf('<ListingContactBar'));
        const props = mount.slice(0, mount.indexOf('/>'));

        expect(props).toContain(`vertical="${vertical}"`);
        expect(props).toMatch(/listingName=\{/);
        expect(props).toMatch(/shareUrl=\{`\$\{siteOrigin\}\$\{Astro\.url\.pathname\}`\}/);
        expect(props).toMatch(/phoneHref=\{barPhoneHref\}/);
        expect(props).toMatch(/primary=\{/);
        // §6.10.3: nothing per-viewer crosses into the island.
        expect(props).not.toMatch(/Astro\.locals|session|user\b|isFavorited|entitle/i);
    });

    it('only the accommodation bar carries Comparar', () => {
        for (const [vertical, page] of PAGES) {
            const template = templateOf(readFileSync(resolve(root, page), 'utf8'));
            const mount = template.slice(template.indexOf('<ListingContactBar'));
            const props = mount.slice(0, mount.indexOf('/>'));

            expect(/compare=\{/.test(props)).toBe(vertical === 'accommodation');
        }
    });
});
