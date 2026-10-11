import { describe, expect, it } from 'vitest';
import { evaluatePartnerIndexability } from '../../../src/lib/seo/partner-indexable';

describe('evaluatePartnerIndexability', () => {
    it('keeps partner pages out of the index until V7 restores them', () => {
        expect(
            evaluatePartnerIndexability({
                lifecycleState: 'ACTIVE',
                description: 'Excursiones por el Litoral con guías locales.'
            })
        ).toEqual({ isIndexable: false, reason: 'not-visible' });
    });

    it('keeps absent and incomplete partner data dark as well', () => {
        expect(evaluatePartnerIndexability({})).toEqual({
            isIndexable: false,
            reason: 'not-visible'
        });
    });
});
