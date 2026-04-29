/**
 * @fileoverview
 * Test suite for the soft-deleted relations filter utilities
 * (`filterSoftDeletedRelations`, `isSoftDeleted`).
 *
 * Covers:
 * - Single relation filtering (object → null when soft-deleted)
 * - Array relation filtering (drops soft-deleted entries)
 * - Untouched entities when no key matches
 * - Null-safe input handling
 * - Date and ISO-string `deletedAt` recognition
 * - Idempotency: returns the original reference when nothing changed
 */

import { describe, expect, it } from 'vitest';
import { filterSoftDeletedRelations, isSoftDeleted } from '../../src/utils/relations';
import '../setupTest';

describe('isSoftDeleted', () => {
    it('returns false for null and undefined', () => {
        expect(isSoftDeleted(null)).toBe(false);
        expect(isSoftDeleted(undefined)).toBe(false);
    });

    it('returns false for non-objects', () => {
        expect(isSoftDeleted('foo')).toBe(false);
        expect(isSoftDeleted(123)).toBe(false);
        expect(isSoftDeleted(true)).toBe(false);
    });

    it('returns false when deletedAt is missing or null', () => {
        expect(isSoftDeleted({})).toBe(false);
        expect(isSoftDeleted({ id: 'x' })).toBe(false);
        expect(isSoftDeleted({ id: 'x', deletedAt: null })).toBe(false);
        expect(isSoftDeleted({ id: 'x', deletedAt: undefined })).toBe(false);
    });

    it('returns true when deletedAt is a valid Date', () => {
        expect(isSoftDeleted({ deletedAt: new Date('2026-01-01') })).toBe(true);
    });

    it('returns true when deletedAt is a non-empty ISO string', () => {
        expect(isSoftDeleted({ deletedAt: '2026-01-01T00:00:00Z' })).toBe(true);
    });

    it('returns false for empty deletedAt string', () => {
        expect(isSoftDeleted({ deletedAt: '' })).toBe(false);
    });
});

describe('filterSoftDeletedRelations', () => {
    it('returns null when entity is null', () => {
        expect(filterSoftDeletedRelations(null, ['owner'])).toBeNull();
    });

    it('returns the same reference when no keys are provided', () => {
        const entity = { id: 'a', owner: { id: 'u', deletedAt: new Date() } };
        expect(filterSoftDeletedRelations(entity, [])).toBe(entity);
    });

    it('returns the same reference when no relation is soft-deleted', () => {
        const entity = {
            id: 'a',
            owner: { id: 'u', deletedAt: null },
            amenities: [{ id: 'am1', deletedAt: null }]
        };
        expect(filterSoftDeletedRelations(entity, ['owner', 'amenities'])).toBe(entity);
    });

    it('nullifies a single relation when its deletedAt is set', () => {
        const entity = {
            id: 'a',
            owner: { id: 'u', deletedAt: new Date('2026-01-01'), name: 'Deleted' }
        };
        const result = filterSoftDeletedRelations(entity, ['owner']);
        expect(result).not.toBe(entity);
        expect(result?.owner).toBeNull();
        expect(entity.owner).not.toBeNull();
    });

    it('removes soft-deleted entries from an array relation', () => {
        const entity = {
            id: 'a',
            amenities: [
                { id: 'am1', deletedAt: null },
                { id: 'am2', deletedAt: new Date('2026-01-01') },
                { id: 'am3', deletedAt: null }
            ]
        };
        const result = filterSoftDeletedRelations(entity, ['amenities']);
        expect(result).not.toBe(entity);
        expect(result?.amenities).toHaveLength(2);
        expect(result?.amenities.map((a) => a.id)).toEqual(['am1', 'am3']);
        expect(entity.amenities).toHaveLength(3);
    });

    it('returns an empty array when all entries are soft-deleted', () => {
        const entity = {
            id: 'a',
            amenities: [
                { id: 'am1', deletedAt: '2026-01-01T00:00:00Z' },
                { id: 'am2', deletedAt: new Date('2026-01-01') }
            ]
        };
        const result = filterSoftDeletedRelations(entity, ['amenities']);
        expect(result?.amenities).toEqual([]);
    });

    it('ignores keys not present on the entity', () => {
        const entity = { id: 'a', owner: { id: 'u', deletedAt: null } };
        const result = filterSoftDeletedRelations(entity as Record<string, unknown>, [
            'destination'
        ]);
        expect(result).toBe(entity);
    });

    it('handles a mix of single and array relations on the same entity', () => {
        const entity = {
            id: 'a',
            owner: { id: 'u', deletedAt: new Date('2026-01-01') },
            destination: { id: 'd', deletedAt: null },
            amenities: [
                { id: 'am1', deletedAt: null },
                { id: 'am2', deletedAt: '2026-01-01T00:00:00Z' }
            ]
        };
        const result = filterSoftDeletedRelations(entity, ['owner', 'destination', 'amenities']);
        expect(result?.owner).toBeNull();
        expect(result?.destination).toEqual({ id: 'd', deletedAt: null });
        expect(result?.amenities).toEqual([{ id: 'am1', deletedAt: null }]);
    });
});
