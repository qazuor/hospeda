/**
 * @file GastronomyMenu.photo.test.ts
 * @description Source-read guards for the per-dish photo on the public carta
 * (HOS-1045).
 *
 * ## Why source-read, and what that costs
 *
 * Biome does not lint `.astro`, and this component is server-rendered inside a
 * page that needs a listing payload, a locale and a translation table to mount.
 * The repo's answer for that shape is a source-read test, and the sibling
 * `gastronomia-detail.test.ts` is the precedent.
 *
 * A source read cannot tell declared from rendered, so these assertions are
 * anchored on the EXACT token that carries the behaviour rather than on an
 * ordering regex over the whole file — `toMatch(/A[\s\S]*?B/)` across a source
 * this size passes with almost any mutation in place. The three facts asserted
 * are the three a reviewer would otherwise have to take on trust, and each was
 * confirmed to fail when the corresponding token is removed.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/gastronomy/GastronomyMenu.astro'),
    'utf8'
);

describe('GastronomyMenu.astro — the per-dish photo (HOS-1045)', () => {
    it('routes the photo URL through resolveSafeExternalUrl', () => {
        // The read half of the two-sided scheme guard. `photoUrl` is written by
        // our own upload route today, but the column is readable by anything
        // that can write a row, and `z.string().url()` — which several sibling
        // schemas still use — accepts `javascript:`. The write half lives on
        // `GastronomyMenuItemInputSchema`.
        // Asserted on the `src=` BINDING, not merely on the call appearing
        // somewhere in the file: the call is also made in the render condition,
        // so a looser assertion would stay green with the `src` bound to the
        // raw column — which is the whole vulnerability.
        expect(src).toContain('src={resolveSafeExternalUrl(item.photoUrl)}');
    });

    it('falls back to the dish name for alt text, never to an empty alt', () => {
        // `alt=""` declares an image decorative, and a photo OF the dish being
        // named is the opposite of decorative. `photoAlt` is optional by design
        // (the editor does not force it), so the fallback is what keeps every
        // published dish photo announced.
        expect(src).toContain('alt={item.photoAlt || item.name}');
    });

    it('lazy-loads the dish photos', () => {
        // A carta may hold up to thirty sections of a hundred dishes
        // (GASTRONOMY_MENU_MAX_*), so an eager image per dish would be the
        // single largest thing on the page.
        expect(src).toContain('class="gastro-menu__item-photo"');
        expect(src).toMatch(/gastro-menu__item-photo"\s+loading="lazy"/);
    });
});
