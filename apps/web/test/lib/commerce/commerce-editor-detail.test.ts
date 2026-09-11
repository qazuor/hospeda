/**
 * @file commerce-editor-detail.test.ts
 * @description Unit tests for `readCommerceListingFaqs` (HOS-1080 / HOS-400).
 *
 * HOS-400 gave `isVisibleOnListing` / `isUsableByAi` to the reader's output
 * shape (`CommerceFaq`). Both default to `true` when the raw field is absent
 * or not a boolean, mirroring the DB columns' `NOT NULL DEFAULT true` — a
 * listing saved before the columns existed (or a payload from an older API
 * build) must read as published/AI-usable, today's behaviour.
 */

import { describe, expect, it } from 'vitest';
import { readCommerceListingFaqs } from '@/lib/commerce/commerce-editor-detail';
import type { CommerceListingDetail } from '@/lib/commerce/owner-listings';

/** Builds a loose detail object carrying the given raw `faqs` array. */
function detailWithFaqs(faqs: unknown): CommerceListingDetail {
    return { faqs } as unknown as CommerceListingDetail;
}

describe('readCommerceListingFaqs', () => {
    it('returns an empty array when the detail carries no faqs field', () => {
        expect(readCommerceListingFaqs({ detail: detailWithFaqs(undefined) })).toEqual([]);
    });

    it('returns an empty array when faqs is not an array', () => {
        expect(readCommerceListingFaqs({ detail: detailWithFaqs('not-an-array') })).toEqual([]);
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

        const [faq] = readCommerceListingFaqs({ detail });
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

        const [faq] = readCommerceListingFaqs({ detail });
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

        const [faq] = readCommerceListingFaqs({ detail });
        expect(faq?.isVisibleOnListing).toBe(true);
        expect(faq?.isUsableByAi).toBe(true);
    });
});
