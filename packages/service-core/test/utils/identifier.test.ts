/**
 * @file identifier.test.ts
 *
 * Unit tests for identifier utility functions.
 * Covers uncovered lines from v8 report: isUuid (34-35) and isSlug (43-44).
 */

import { describe, expect, it } from 'vitest';
import { isSlug, isUuid, parseIdOrSlug } from '../../src/utils/identifier';

describe('parseIdOrSlug', () => {
    it('should return field=id when given a valid UUID', () => {
        const uuid = '550e8400-e29b-41d4-a716-446655440000';
        const result = parseIdOrSlug(uuid);
        expect(result.field).toBe('id');
        expect(result.isUuid).toBe(true);
        expect(result.value).toBe(uuid);
    });

    it('should return field=slug when given a non-UUID string', () => {
        const slug = 'my-cool-accommodation';
        const result = parseIdOrSlug(slug);
        expect(result.field).toBe('slug');
        expect(result.isUuid).toBe(false);
        expect(result.value).toBe(slug);
    });
});

describe('isUuid', () => {
    it('should return true for a valid UUID v4', () => {
        expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should return true for a valid UUID v1', () => {
        expect(isUuid('550e8400-e29b-11d4-a716-446655440000')).toBe(true);
    });

    it('should return false for a slug string', () => {
        expect(isUuid('my-slug')).toBe(false);
    });

    it('should return false for empty string', () => {
        expect(isUuid('')).toBe(false);
    });

    it('should return false for a partially valid UUID', () => {
        expect(isUuid('550e8400-e29b-41d4')).toBe(false);
    });
});

describe('isSlug', () => {
    it('should return true for a slug string (not a UUID)', () => {
        expect(isSlug('my-accommodation-slug')).toBe(true);
    });

    it('should return true for any non-UUID string', () => {
        expect(isSlug('just-a-name')).toBe(true);
        expect(isSlug('123')).toBe(true);
        expect(isSlug('')).toBe(true);
    });

    it('should return false for a valid UUID', () => {
        expect(isSlug('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
    });
});
