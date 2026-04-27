/**
 * @file tag.admin-search.schema.test.ts
 * @description Coverage for TagAdminSearchSchema.
 *
 * Spec reference: SPEC-049 T-068 (GAP-005). Verifies:
 *  - The legacy `nameContains` field has been removed (no longer accepted).
 *  - The `color` filter accepts valid TagColorEnum values.
 *  - The base AdminSearch fields (page, pageSize, search, status,
 *    includeDeleted) are inherited and behave as expected.
 */

import { describe, expect, it } from 'vitest';
import { TagAdminSearchSchema } from '../../../src/entities/tag/tag.admin-search.schema.js';
import { TagColorEnum } from '../../../src/enums/tag-color.enum.js';

describe('TagAdminSearchSchema', () => {
    describe('color filter', () => {
        it('should accept every TagColorEnum value', () => {
            for (const color of Object.values(TagColorEnum)) {
                const result = TagAdminSearchSchema.safeParse({ color });
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.color).toBe(color);
                }
            }
        });

        it('should accept the canonical RED literal', () => {
            const result = TagAdminSearchSchema.safeParse({ color: 'RED' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.color).toBe(TagColorEnum.RED);
            }
        });

        it('should reject hex strings (not valid TagColorEnum values)', () => {
            // The schema-level note explicitly calls out that color is an enum,
            // not a hex code. A hex string must be rejected.
            const result = TagAdminSearchSchema.safeParse({ color: '#ff0000' });
            expect(result.success).toBe(false);
        });

        it('should reject an unknown color name', () => {
            const result = TagAdminSearchSchema.safeParse({ color: 'TURQUOISE' });
            expect(result.success).toBe(false);
        });

        it('should accept omission of color (filter is optional)', () => {
            const result = TagAdminSearchSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.color).toBeUndefined();
            }
        });
    });

    describe('legacy nameContains (GAP-005)', () => {
        it('should not surface a nameContains field in the parsed output', () => {
            // GAP-005 specifically tracks the removal of nameContains. With Zod's
            // default behaviour, unknown keys are stripped. We assert that the
            // parsed object does NOT carry a nameContains property — even when one
            // is provided, it must not survive parsing.
            const result = TagAdminSearchSchema.safeParse({ nameContains: 'beach' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).not.toHaveProperty('nameContains');
            }
        });

        it('should expose `search` as the supported text-filter field', () => {
            // The replacement for nameContains is the AdminSearchBaseSchema
            // `search` field. This anchors the migration story: callers that
            // used nameContains must move to `search`.
            const result = TagAdminSearchSchema.safeParse({ search: 'beach' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.search).toBe('beach');
            }
        });
    });

    describe('inherited AdminSearchBase fields', () => {
        it('should apply default pagination when input is empty', () => {
            const result = TagAdminSearchSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(typeof result.data.pageSize).toBe('number');
                expect(result.data.includeDeleted).toBe(false);
            }
        });

        it('should coerce string page/pageSize to numbers', () => {
            const result = TagAdminSearchSchema.safeParse({ page: '3', pageSize: '50' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(3);
                expect(result.data.pageSize).toBe(50);
            }
        });
    });
});
