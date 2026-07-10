/**
 * Tests for the `categories` (array, OR-union) filter on `PostSearchSchema`
 * (domain) and `PostSearchHttpSchema` (HTTP/query-string), added in HOS-96
 * T-003 to close the latent multi-category bug (US-9): the blog sidebar
 * already serializes `?category=A,B`, but until this change only a single
 * `category` enum was accepted.
 *
 * The singular `category` enum MUST remain accepted unchanged (US-10,
 * backward compatibility) — these tests assert both fields coexist.
 */
import { describe, expect, it } from 'vitest';
import { PostSearchHttpSchema } from '../../../src/entities/post/post.http.schema.js';
import { PostSearchSchema } from '../../../src/entities/post/post.query.schema.js';
import { PostCategoryEnumSchema } from '../../../src/enums/index.js';

// ---------------------------------------------------------------------------
// PostSearchSchema (domain)
// ---------------------------------------------------------------------------

describe('PostSearchSchema — categories', () => {
    it('should accept a `categories` array of valid enum members', () => {
        const result = PostSearchSchema.safeParse({ categories: ['CULTURE', 'GASTRONOMY'] });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toEqual(['CULTURE', 'GASTRONOMY']);
        }
    });

    it('should be optional — omitting categories passes', () => {
        const result = PostSearchSchema.safeParse({});

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toBeUndefined();
        }
    });

    it('should reject an array containing an invalid enum member', () => {
        const result = PostSearchSchema.safeParse({ categories: ['CULTURE', 'NOT_A_CATEGORY'] });

        expect(result.success).toBe(false);
    });

    it('should keep accepting the singular `category` enum alone (US-10)', () => {
        const result = PostSearchSchema.safeParse({ category: 'TOURISM' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.category).toBe('TOURISM');
            expect(result.data.categories).toBeUndefined();
        }
    });

    it('should accept both `category` and `categories` present simultaneously', () => {
        const result = PostSearchSchema.safeParse({
            category: 'CULTURE',
            categories: ['GASTRONOMY', 'NATURE']
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.category).toBe('CULTURE');
            expect(result.data.categories).toEqual(['GASTRONOMY', 'NATURE']);
        }
    });
});

// ---------------------------------------------------------------------------
// PostSearchHttpSchema (HTTP / query-string)
// ---------------------------------------------------------------------------

describe('PostSearchHttpSchema — categories', () => {
    it('should parse a CSV query string into an array of categories', () => {
        const result = PostSearchHttpSchema.safeParse({ categories: 'CULTURE,GASTRONOMY' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toEqual(['CULTURE', 'GASTRONOMY']);
        }
    });

    it('should trim whitespace and filter empty CSV segments', () => {
        const result = PostSearchHttpSchema.safeParse({ categories: ' CULTURE , GASTRONOMY ,' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toEqual(['CULTURE', 'GASTRONOMY']);
        }
    });

    it('should resolve an empty string to `undefined` (unfiltered, US-11)', () => {
        const result = PostSearchHttpSchema.safeParse({ categories: '' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toBeUndefined();
        }
    });

    it('should keep accepting the singular `category` enum alone (US-10)', () => {
        const result = PostSearchHttpSchema.safeParse({ category: 'CULTURE' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.category).toBe('CULTURE');
        }
    });

    it('should accept both `category` and `categories` at the HTTP layer', () => {
        const result = PostSearchHttpSchema.safeParse({
            category: 'CULTURE',
            categories: 'GASTRONOMY,NATURE'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.category).toBe('CULTURE');
            expect(result.data.categories).toEqual(['GASTRONOMY', 'NATURE']);
        }
    });

    it('should be optional — omitting categories passes', () => {
        const result = PostSearchHttpSchema.safeParse({});

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toBeUndefined();
        }
    });

    it('sanity: PostCategoryEnumSchema still validates a single CULTURE value', () => {
        // Guards against accidental enum drift breaking this test file's fixtures.
        expect(PostCategoryEnumSchema.safeParse('CULTURE').success).toBe(true);
    });
});
