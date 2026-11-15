import { describe, expect, it } from 'vitest';
import { evaluatePartnerIndexability } from '../../../src/lib/seo/partner-indexable';

describe('evaluatePartnerIndexability', () => {
    it('indexes a page when its entitlement and description are present', () => {
        expect(
            evaluatePartnerIndexability({
                hasPublicPage: true,
                description: 'Excursiones por el Litoral con guías locales.'
            })
        ).toEqual({ isIndexable: true, reason: null });
    });

    it('keeps a partner without a page out of the index', () => {
        expect(
            evaluatePartnerIndexability({ hasPublicPage: false, description: 'Description' })
        ).toEqual({
            isIndexable: false,
            reason: 'not-visible'
        });
    });

    it('requires a non-empty description', () => {
        expect(evaluatePartnerIndexability({ hasPublicPage: true, description: '  ' })).toEqual({
            isIndexable: false,
            reason: 'missing-description'
        });
    });
});
