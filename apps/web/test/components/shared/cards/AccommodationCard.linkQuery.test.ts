/**
 * @file AccommodationCard.linkQuery.test.ts
 * @description Asserts the AccommodationCard source forwards an optional
 * `linkQuery` suffix on the detail anchor — used to propagate hero-search
 * context (checkIn, checkOut, adults, children) from the listing into the
 * detail page so the contact form can pre-fill its message.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/cards/AccommodationCard.astro'),
    'utf8'
);

describe('AccommodationCard.astro — linkQuery prop', () => {
    it('declares an optional linkQuery prop', () => {
        expect(src).toContain('readonly linkQuery?: string');
    });

    it('appends the linkQuery to the base detail URL when provided', () => {
        expect(src).toContain('linkQuery ? `${baseDetailUrl}?${linkQuery}` : baseDetailUrl');
    });
});
