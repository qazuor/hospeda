/**
 * HOS-929 regression — `resolvePublicIsFeatured` must OR the two independent
 * "featured" source columns (`isFeatured`, admin-curated; `featuredByEntitlement`,
 * billing-derived) into the single public-facing `isFeatured` value.
 *
 * Before the fix, public routes echoed the raw `isFeatured` column only, so an
 * accommodation whose owner bought the "visibility boost" addon (or held a
 * plan that grants FEATURED_LISTING) never showed the featured badge anywhere.
 */
import { describe, expect, it } from 'vitest';
import { resolvePublicIsFeatured } from '../../src/utils/accommodation-featured';

describe('resolvePublicIsFeatured', () => {
    it('is featured when only the admin-curated flag is true', () => {
        expect(resolvePublicIsFeatured({ isFeatured: true, featuredByEntitlement: false })).toBe(
            true
        );
    });

    it('is featured when only the billing-derived entitlement flag is true (HOS-929 bug case)', () => {
        expect(resolvePublicIsFeatured({ isFeatured: false, featuredByEntitlement: true })).toBe(
            true
        );
    });

    it('is featured when both flags are true', () => {
        expect(resolvePublicIsFeatured({ isFeatured: true, featuredByEntitlement: true })).toBe(
            true
        );
    });

    it('is NOT featured when both flags are false', () => {
        expect(resolvePublicIsFeatured({ isFeatured: false, featuredByEntitlement: false })).toBe(
            false
        );
    });

    it('treats a missing featuredByEntitlement as false (older/partial rows)', () => {
        expect(resolvePublicIsFeatured({ isFeatured: false })).toBe(false);
    });

    it('treats a null featuredByEntitlement as false', () => {
        expect(resolvePublicIsFeatured({ isFeatured: false, featuredByEntitlement: null })).toBe(
            false
        );
    });
});
