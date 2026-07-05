import { describe, expect, it } from 'vitest';
import { buildPlanQuery } from '../hooks';

describe('buildPlanQuery', () => {
    // BETA-97: the admin list route validates against BillingPlanSearchSchema,
    // which names the active-status filter `active`. Sending the client's
    // `isActive` key verbatim was rejected with 400 INVALID_PAGINATION_PARAMS.
    it('translates the isActive filter to the server active param', () => {
        const params = buildPlanQuery({ isActive: true });
        expect(params.get('active')).toBe('true');
        expect(params.has('isActive')).toBe(false);
    });

    it('translates isActive=false as well', () => {
        const params = buildPlanQuery({ isActive: false });
        expect(params.get('active')).toBe('false');
        expect(params.has('isActive')).toBe(false);
    });

    it('passes non-isActive filter keys through unchanged', () => {
        const params = buildPlanQuery({ category: 'owner', page: 2 });
        expect(params.get('category')).toBe('owner');
        expect(params.get('page')).toBe('2');
    });

    it('drops undefined, null, empty and the "all" sentinel', () => {
        const params = buildPlanQuery({
            category: 'all',
            isActive: undefined,
            page: '',
            limit: null
        });
        expect([...params.keys()]).toHaveLength(0);
    });
});
