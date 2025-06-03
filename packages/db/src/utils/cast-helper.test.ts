import { describe, expect, it } from 'vitest';
import { castBrandedIds, castDateFields } from './cast-helper';

// Tipos de ejemplo para tests
import type { AccommodationId, DestinationId } from '@repo/types/common/id.types';

describe('castBrandedIds', () => {
    it('should cast known brandId fields to their branded types', () => {
        const input = {
            ownerId: 'user-1',
            destinationId: 'dest-1',
            createdById: 'user-2',
            unrelated: 'foo'
        };
        const result = castBrandedIds(input);
        // @ts-expect-no-error
        expect(result.ownerId).toBe('user-1');
        // @ts-expect-no-error
        expect(result.destinationId).toBe('dest-1');
        // @ts-expect-no-error
        expect(result.createdById).toBe('user-2');
        expect(result.unrelated).toBe('foo');
    });

    it('should cast id using idCaster when provided (AccommodationId)', () => {
        const input = { id: 'acc-1', ownerId: 'user-1' };
        const result = castBrandedIds(input, (id) => id as AccommodationId);
        expect(result.id).toBe('acc-1');
        expect(result.ownerId).toBe('user-1');
    });

    it('should cast id using idCaster when provided (DestinationId)', () => {
        const input = { id: 'dest-1', createdById: 'user-2' };
        const result = castBrandedIds(input, (id) => id as DestinationId);
        expect(result.id).toBe('dest-1');
        expect(result.createdById).toBe('user-2');
    });

    it('should not cast id if idCaster is not provided', () => {
        const input = { id: 'acc-1', ownerId: 'user-1' };
        const result = castBrandedIds(input);
        expect(result.id).toBe('acc-1');
        expect(result.ownerId).toBe('user-1');
    });

    it('should not modify fields that are not brandIds', () => {
        const input = { foo: 'bar', count: 42 };
        const result = castBrandedIds(input);
        expect(result.foo).toBe('bar');
        expect(result.count).toBe(42);
    });
});

describe('castDateFields', () => {
    it('should cast known date fields from string to Date', () => {
        const input = {
            createdAt: '2024-06-01T12:00:00Z',
            updatedAt: '2024-06-02T12:00:00Z',
            unrelated: 'foo'
        };
        const result = castDateFields(input);
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);
        expect(result.unrelated).toBe('foo');
    });

    it('should not modify date fields that are already Date', () => {
        const now = new Date();
        const input = { createdAt: now };
        const result = castDateFields(input);
        expect(result.createdAt).toBe(now);
    });

    it('should not modify fields that are not date fields', () => {
        const input = { foo: 'bar', count: 42 };
        const result = castDateFields(input);
        expect(result.foo).toBe('bar');
        expect(result.count).toBe(42);
    });

    it('should handle invalid date strings gracefully', () => {
        const input = { createdAt: 'not-a-date' };
        const result = castDateFields(input);
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(Number.isNaN((result.createdAt as unknown as Date).getTime())).toBe(true);
    });
});
