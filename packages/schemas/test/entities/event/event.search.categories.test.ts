/**
 * Tests for the `categories` (array, OR-union) filter on `EventSearchSchema`
 * (domain) and `EventSearchHttpSchema` (HTTP/query-string), added in HOS-96
 * T-002 to close the latent multi-category bug (US-9): the events sidebar
 * already serializes `?category=A,B`, but until this change only a single
 * `category` enum was accepted.
 *
 * The singular `category` enum MUST remain accepted unchanged (US-10,
 * backward compatibility) — these tests assert both fields coexist.
 */
import { describe, expect, it } from 'vitest';
import { EventSearchHttpSchema } from '../../../src/entities/event/event.http.schema.js';
import { EventSearchSchema } from '../../../src/entities/event/event.query.schema.js';
import { EventCategoryEnumSchema } from '../../../src/enums/index.js';

// ---------------------------------------------------------------------------
// EventSearchSchema (domain)
// ---------------------------------------------------------------------------

describe('EventSearchSchema — categories', () => {
    it('should accept a `categories` array of valid enum members', () => {
        const result = EventSearchSchema.safeParse({ categories: ['MUSIC', 'CULTURE'] });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toEqual(['MUSIC', 'CULTURE']);
        }
    });

    it('should be optional — omitting categories passes', () => {
        const result = EventSearchSchema.safeParse({});

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toBeUndefined();
        }
    });

    it('should reject an array containing an invalid enum member', () => {
        const result = EventSearchSchema.safeParse({ categories: ['MUSIC', 'NOT_A_CATEGORY'] });

        expect(result.success).toBe(false);
    });

    it('should keep accepting the singular `category` enum alone (US-10)', () => {
        const result = EventSearchSchema.safeParse({ category: 'SPORTS' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.category).toBe('SPORTS');
            expect(result.data.categories).toBeUndefined();
        }
    });

    it('should accept both `category` and `categories` present simultaneously', () => {
        const result = EventSearchSchema.safeParse({
            category: 'MUSIC',
            categories: ['CULTURE', 'SPORTS']
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.category).toBe('MUSIC');
            expect(result.data.categories).toEqual(['CULTURE', 'SPORTS']);
        }
    });
});

// ---------------------------------------------------------------------------
// EventSearchHttpSchema (HTTP / query-string)
// ---------------------------------------------------------------------------

describe('EventSearchHttpSchema — categories', () => {
    it('should parse a CSV query string into an array of categories', () => {
        const result = EventSearchHttpSchema.safeParse({ categories: 'MUSIC,CULTURE' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toEqual(['MUSIC', 'CULTURE']);
        }
    });

    it('should trim whitespace and filter empty CSV segments', () => {
        const result = EventSearchHttpSchema.safeParse({ categories: ' MUSIC , CULTURE ,' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toEqual(['MUSIC', 'CULTURE']);
        }
    });

    it('should resolve an empty string to `undefined` (unfiltered, US-11)', () => {
        const result = EventSearchHttpSchema.safeParse({ categories: '' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toBeUndefined();
        }
    });

    it('should keep accepting the singular `category` enum alone (US-10)', () => {
        const result = EventSearchHttpSchema.safeParse({ category: 'MUSIC' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.category).toBe('MUSIC');
        }
    });

    it('should accept both `category` and `categories` at the HTTP layer', () => {
        const result = EventSearchHttpSchema.safeParse({
            category: 'MUSIC',
            categories: 'CULTURE,SPORTS'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.category).toBe('MUSIC');
            expect(result.data.categories).toEqual(['CULTURE', 'SPORTS']);
        }
    });

    it('should be optional — omitting categories passes', () => {
        const result = EventSearchHttpSchema.safeParse({});

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toBeUndefined();
        }
    });

    it('sanity: EventCategoryEnumSchema still validates a single MUSIC value', () => {
        // Guards against accidental enum drift breaking this test file's fixtures.
        expect(EventCategoryEnumSchema.safeParse('MUSIC').success).toBe(true);
    });
});
