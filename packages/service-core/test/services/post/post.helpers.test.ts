import { PostModel } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    generatePostSlug,
    mapPostFilterKeysToColumns
} from '../../../src/services/post/post.helpers';

beforeEach(() => {
    vi.spyOn(PostModel.prototype, 'findOne').mockResolvedValue(null);
});

describe('generatePostSlug', () => {
    const category = 'news';
    const name = 'Hello World!';
    const date = '2024-07-03';

    it('should generate a slug for a regular post', async () => {
        const slug = await generatePostSlug(category, name, false);
        expect(typeof slug).toBe('string');
        expect(slug).toContain('hello-world');
    });

    it('should generate a slug for a news post with date', async () => {
        const slug = await generatePostSlug(category, name, true, date);
        expect(typeof slug).toBe('string');
        expect(slug).toContain('hello-world');
        expect(slug).toContain('2024-07-03');
    });

    it('should handle empty name', async () => {
        const slug = await generatePostSlug(category, '', false);
        expect(slug).toBe('news');
    });

    it('should handle special characters and multiple spaces', async () => {
        const slug = await generatePostSlug(category, '  Hello   @World!!  ', false);
        expect(slug).toContain('hello-world');
    });

    it('should lowercase all characters', async () => {
        const slug = await generatePostSlug(category, 'HeLLo WoRLD', false);
        expect(slug).toContain('hello-world');
    });

    it('should remove non-alphanumeric characters', async () => {
        const slug = await generatePostSlug(category, 'Post #1: The Beginning', false);
        expect(slug).toContain('post-1-the-beginning');
    });

    // If the function requires a fourth argument, add it here:
    // expect(generatePostSlug('Title', dummyName, dummyCategory, dummyId)).toBe(...);

    // Add more tests for other helpers if they exist
});

describe('mapPostFilterKeysToColumns', () => {
    it('maps relation-id keys to their `related*Id` column names', () => {
        const out = mapPostFilterKeysToColumns({
            destinationId: 'dest-uuid',
            accommodationId: 'acc-uuid',
            eventId: 'evt-uuid'
        });
        expect(out).toEqual({
            relatedDestinationId: 'dest-uuid',
            relatedAccommodationId: 'acc-uuid',
            relatedEventId: 'evt-uuid'
        });
    });

    it('maps date-range schema keys to buildWhereClause `_gte` / `_lte` suffixes', () => {
        const after = new Date('2026-01-01');
        const before = new Date('2026-12-31');
        const out = mapPostFilterKeysToColumns({
            publishedAfter: after,
            publishedBefore: before,
            createdAfter: after,
            createdBefore: before
        });
        expect(out).toEqual({
            publishedAt_gte: after,
            publishedAt_lte: before,
            createdAt_gte: after,
            createdAt_lte: before
        });
    });

    it('forwards unknown keys unchanged (direct-column filters)', () => {
        const out = mapPostFilterKeysToColumns({
            isFeatured: true,
            category: 'CULTURE',
            authorId: 'author-uuid',
            visibility: 'PUBLIC'
        });
        expect(out).toEqual({
            isFeatured: true,
            category: 'CULTURE',
            authorId: 'author-uuid',
            visibility: 'PUBLIC'
        });
    });

    it('drops `undefined` values so they do not reach the SQL builder', () => {
        const out = mapPostFilterKeysToColumns({
            destinationId: undefined,
            isFeatured: true,
            category: undefined
        });
        expect(out).toEqual({ isFeatured: true });
    });
});
