/**
 * Regression tests for SocialHashtagSetSchema nullable columns (HOS-1986).
 *
 * `social_hashtag_sets.platform` ("null means applies to all platforms") and
 * `notes` are nullable columns. The schema used `.optional()`, which rejects
 * `null`, so a single row with either column NULL made
 * `GET /api/v1/admin/social/hashtag-sets` answer 500.
 */
import { describe, expect, it } from 'vitest';
import { SocialHashtagSetCreateSchema } from '../../../src/entities/social/social-hashtag-set.crud.schema.js';
import { SocialHashtagSetSchema } from '../../../src/entities/social/social-hashtag-set.schema.js';

const baseRow = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Brand',
    slug: 'brand',
    hashtagsText: '#Hospeda #Turismo',
    priority: 0,
    active: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdById: null,
    updatedById: null
};

describe('SocialHashtagSetSchema nullable columns', () => {
    it('accepts a row with notes = null', () => {
        const result = SocialHashtagSetSchema.safeParse({
            ...baseRow,
            platform: 'INSTAGRAM',
            notes: null
        });
        expect(result.success).toBe(true);
    });

    it('accepts a row with platform = null (applies to all platforms)', () => {
        const result = SocialHashtagSetSchema.safeParse({
            ...baseRow,
            platform: null,
            notes: null
        });
        expect(result.success).toBe(true);
    });

    it('still rejects a platform outside the enum', () => {
        const result = SocialHashtagSetSchema.safeParse({ ...baseRow, platform: 'MYSPACE' });
        expect(result.success).toBe(false);
    });

    it('still accepts create input without platform and notes', () => {
        const result = SocialHashtagSetCreateSchema.safeParse({
            name: 'Brand',
            hashtagsText: '#Hospeda',
            priority: 0,
            active: true
        });
        expect(result.success).toBe(true);
    });
});
