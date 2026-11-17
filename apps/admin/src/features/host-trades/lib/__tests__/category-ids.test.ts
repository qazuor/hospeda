/**
 * @file category-ids.test.ts
 * @description The edit form keys its category picker `categoryIds`, but the
 * read API returns `categories: [{ id, ... }]` (HOS-919 T-045). The mapping is
 * what pre-selects the provider's current categories when the form opens.
 */

import { describe, expect, it } from 'vitest';
import { withCategoryIds } from '../category-ids';

describe('withCategoryIds', () => {
    it('derives categoryIds from the categories relation', () => {
        const entity = { id: 'h-1', categories: [{ id: 'c-1' }, { id: 'c-2' }] };

        expect(withCategoryIds({ entity }).categoryIds).toEqual(['c-1', 'c-2']);
    });

    it('keeps an existing categoryIds untouched', () => {
        const entity = { id: 'h-1', categories: [{ id: 'c-1' }], categoryIds: ['c-9'] };

        expect(withCategoryIds({ entity }).categoryIds).toEqual(['c-9']);
    });

    it('falls back to an empty list when the provider has no relation', () => {
        expect(withCategoryIds({ entity: { id: 'h-1' } }).categoryIds).toEqual([]);
    });
});
