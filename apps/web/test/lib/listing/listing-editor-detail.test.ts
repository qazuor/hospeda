/**
 * @file listing-editor-detail.test.ts
 * @description Unit tests for `readListingFaqs` (HOS-1080 / HOS-400).
 *
 * HOS-400 gave `isVisibleOnListing` / `isUsableByAi` to the reader's output
 * shape (`ListingFaq`). Both default to `true` when the raw field is absent
 * or not a boolean, mirroring the DB columns' `NOT NULL DEFAULT true` — a
 * listing saved before the columns existed (or a payload from an older API
 * build) must read as published/AI-usable, today's behaviour.
 */

import { describe, expect, it } from 'vitest';
import { readListingFaqs } from '@/lib/listing/listing-editor-detail';
import type { ListingDetail } from '@/lib/listing/owner-listings';

/** Builds a loose detail object carrying the given raw `faqs` array. */
function detailWithFaqs(faqs: unknown): ListingDetail {
    return { faqs } as unknown as ListingDetail;
}

describe('readListingFaqs', () => {
    it('returns an empty array when the detail carries no faqs field', () => {
        expect(readListingFaqs({ detail: detailWithFaqs(undefined) })).toEqual([]);
    });

    it('returns an empty array when faqs is not an array', () => {
        expect(readListingFaqs({ detail: detailWithFaqs('not-an-array') })).toEqual([]);
    });

    it('preserves an explicit false for both channel-visibility flags', () => {
        const detail = detailWithFaqs([
            {
                id: 'faq-1',
                question: '¿Hacen envíos?',
                answer: 'Sí, dentro del radio de la ciudad.',
                category: null,
                displayOrder: 0,
                isVisibleOnListing: false,
                isUsableByAi: false
            }
        ]);

        const [faq] = readListingFaqs({ detail });
        expect(faq).toEqual({
            id: 'faq-1',
            question: '¿Hacen envíos?',
            answer: 'Sí, dentro del radio de la ciudad.',
            category: null,
            displayOrder: 0,
            isVisibleOnListing: false,
            isUsableByAi: false
        });
    });

    it('defaults both flags to true when the raw field is absent (pre-migration payload)', () => {
        const detail = detailWithFaqs([
            {
                id: 'faq-1',
                question: '¿Hacen envíos?',
                answer: 'Sí, dentro del radio de la ciudad.',
                category: null,
                displayOrder: 0
            }
        ]);

        const [faq] = readListingFaqs({ detail });
        expect(faq?.isVisibleOnListing).toBe(true);
        expect(faq?.isUsableByAi).toBe(true);
    });

    it('defaults both flags to true when the raw field is not a boolean', () => {
        const detail = detailWithFaqs([
            {
                id: 'faq-1',
                question: '¿Hacen envíos?',
                answer: 'Sí, dentro del radio de la ciudad.',
                isVisibleOnListing: 'false',
                isUsableByAi: 0
            }
        ]);

        const [faq] = readListingFaqs({ detail });
        expect(faq?.isVisibleOnListing).toBe(true);
        expect(faq?.isUsableByAi).toBe(true);
    });
});
