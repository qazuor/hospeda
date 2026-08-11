/**
 * HOS-294 T-018 / AC-7 — the single partner indexability predicate.
 *
 * One function decides two things that must never disagree: whether the detail
 * page sends `noindex`, and whether the dynamic sitemap emits the URL. The
 * failure it exists to prevent is the sitemap advertising a URL the page then
 * serves `noindex` — the same reasoning `evaluateAuthorIndexability` records.
 *
 * Each case below breaks exactly ONE condition, so a green run means the
 * predicate rejects for the stated reason and not incidentally.
 *
 * @module test/lib/seo/partner-indexable
 */

import { describe, expect, it } from 'vitest';
import { evaluatePartnerIndexability } from '../../../src/lib/seo/partner-indexable';

/** A partner that satisfies every condition. */
const indexable = {
    tier: 'gold',
    lifecycleState: 'ACTIVE',
    subscriptionStatus: 'active',
    description: 'Excursiones por el Litoral con guías locales.'
};

describe('evaluatePartnerIndexability', () => {
    it('accepts a gold, active, paying partner with a description', () => {
        // Arrange / Act
        const result = evaluatePartnerIndexability(indexable);

        // Assert
        expect(result.isIndexable).toBe(true);
        expect(result.reason).toBeNull();
    });

    it('rejects a silver partner', () => {
        // Arrange / Act — the tier IS the product gate; a silver partner has no
        // page, so its URL must never reach the sitemap either.
        const result = evaluatePartnerIndexability({ ...indexable, tier: 'silver' });

        // Assert
        expect(result.isIndexable).toBe(false);
        expect(result.reason).toBe('not-gold');
    });

    it('rejects a partner whose lifecycle is not ACTIVE', () => {
        // Arrange / Act
        const result = evaluatePartnerIndexability({
            ...indexable,
            lifecycleState: 'INACTIVE'
        });

        // Assert
        expect(result.isIndexable).toBe(false);
        expect(result.reason).toBe('not-visible');
    });

    it('rejects a partner who stopped paying', () => {
        // Arrange / Act
        const result = evaluatePartnerIndexability({
            ...indexable,
            subscriptionStatus: 'pending'
        });

        // Assert
        expect(result.isIndexable).toBe(false);
        expect(result.reason).toBe('not-visible');
    });

    it('rejects a partner with no description at all', () => {
        // Arrange / Act — R-3: a page carrying a logo and a name is thin
        // content. Indexing two of them invites the doorway-page judgment this
        // condition exists to avoid.
        const result = evaluatePartnerIndexability({ ...indexable, description: null });

        // Assert
        expect(result.isIndexable).toBe(false);
        expect(result.reason).toBe('missing-description');
    });

    it('treats a whitespace-only description as missing', () => {
        // Arrange / Act — otherwise the thin-content guard is defeated by a
        // space bar.
        const result = evaluatePartnerIndexability({ ...indexable, description: '   \n  ' });

        // Assert
        expect(result.isIndexable).toBe(false);
        expect(result.reason).toBe('missing-description');
    });

    it('treats an absent field as failing its condition, never as passing', () => {
        // Arrange / Act — a payload that omitted the tier must not be indexed
        // on the assumption it was gold.
        const result = evaluatePartnerIndexability({ description: 'Algo escrito.' });

        // Assert
        expect(result.isIndexable).toBe(false);
        expect(result.reason).toBe('not-gold');
    });
});
