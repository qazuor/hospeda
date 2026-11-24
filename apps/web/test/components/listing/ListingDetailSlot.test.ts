/**
 * @file ListingDetailSlot.test.ts
 * @description Source tests for the slot wrapper of the listing detail pages
 * (HOS-2579 §6.1.2). Vitest does not render `.astro` here, so the markup and
 * CSS contract is read from the source.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../../src/components/listing/ListingDetailSlot.astro'),
    'utf8'
);

describe('ListingDetailSlot.astro', () => {
    it('uses the canonical slot id and exposes data-listing-slot', () => {
        expect(source).toContain('const slotId = LISTING_DETAIL_SLOT_IDS[name];');
        expect(source).toContain('id={slotId}');
        expect(source).toContain('data-listing-slot={name}');
    });

    it('puts a differing tab anchor on an inner element', () => {
        expect(source).toContain('anchorId && anchorId !== slotId ? anchorId : undefined');
        expect(source).toMatch(/id=\{innerId\}\s*class="listing-slot listing-slot__anchor"/);
    });

    it('hides a slot whose only element is an empty inner anchor (review fix)', () => {
        // `:not(:has(*))` alone never matched an anchored slot: the anchor is an element.
        expect(source).toContain('.listing-slot:not(:has(:not(.listing-slot__anchor)))');
        expect(source).not.toMatch(/\.listing-slot:not\(:has\(\*\)\)/);
    });
});
