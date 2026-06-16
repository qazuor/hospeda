import { EventModel } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildEventPriceConditions,
    generateEventSlug
} from '../../../src/services/event/event.helpers';

/**
 * Test suite for generateEventSlug helper in EventService.
 * Ensures robust, unique, and predictable slug generation for events.
 */
describe('generateEventSlug (EventService)', () => {
    let findOneMock: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        findOneMock = vi.fn();
        vi.spyOn(EventModel.prototype, 'findOne').mockImplementation(findOneMock);
    });

    it('generates a slug from category, name, and date if not taken', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateEventSlug('music', 'Jazz Night', '2024-07-01');
        expect(typeof slug).toBe('string');
        expect(slug).toMatch(/^music-jazz-night-2024-07-01/);
    });

    it('handles special characters, spaces, and case', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateEventSlug('cultura', 'El Río & Sol! 2024', '2024-09-10');
        // The slugify utility replaces '&' with 'and', removes accents, etc.
        expect(slug).toBe('cultura-el-rio-and-sol-2024-2024-09-10');
    });

    it('appends a suffix if slug is already taken', async () => {
        findOneMock.mockResolvedValueOnce({}).mockResolvedValueOnce(null);
        const slug = await generateEventSlug('sports', 'Marathon', '2024-08-15');
        expect(slug).toMatch(/^sports-marathon-2024-08-15-[a-z0-9]+$/);
    });

    it('handles multiple collisions and increments suffix', async () => {
        findOneMock
            .mockResolvedValueOnce({}) // slug exists
            .mockResolvedValueOnce({}) // slug-xxxx exists
            .mockResolvedValueOnce(null); // finally available
        const slug = await generateEventSlug('expo', 'Arte', '2024-10-01');
        expect(slug).toMatch(/^expo-arte-2024-10-01-[a-z0-9]+$/);
    });

    it('is idempotent for the same category, name, and date if slug is available', async () => {
        findOneMock.mockResolvedValue(null);
        const slug1 = await generateEventSlug('feria', 'Monte Verde', '2024-12-01');
        const slug2 = await generateEventSlug('feria', 'Monte Verde', '2024-12-01');
        expect(slug1).toBe(slug2);
    });

    it('throws if model throws', async () => {
        findOneMock.mockRejectedValue(new Error('DB error'));
        await expect(generateEventSlug('error', 'Name', '2024-01-01')).rejects.toThrow('DB error');
    });
});

describe('buildEventPriceConditions', () => {
    it('should return empty array when no filters are provided', () => {
        const result = buildEventPriceConditions({});
        expect(result).toEqual([]);
    });

    it('should return isFree condition when isFree is provided', () => {
        const result = buildEventPriceConditions({ isFree: true });
        expect(result).toHaveLength(1);
    });

    it('should return minPrice condition when minPrice is provided', () => {
        const result = buildEventPriceConditions({ minPrice: 100 });
        expect(result).toHaveLength(1);
    });

    it('should return maxPrice condition when maxPrice is provided', () => {
        const result = buildEventPriceConditions({ maxPrice: 500 });
        expect(result).toHaveLength(1);
    });

    it('should return price condition when price is provided', () => {
        const result = buildEventPriceConditions({ price: 250 });
        expect(result).toHaveLength(1);
    });

    it('should return currency condition when currency is provided', () => {
        const result = buildEventPriceConditions({ currency: 'ARS' });
        expect(result).toHaveLength(1);
    });

    it('should combine multiple conditions', () => {
        const result = buildEventPriceConditions({ minPrice: 100, maxPrice: 500, currency: 'ARS' });
        // Three separate conditions without includeUnpriced
        expect(result).toHaveLength(3);
    });

    it('should wrap with includeUnpriced OR clause when includeUnpriced=true and conditions exist', () => {
        const result = buildEventPriceConditions({ minPrice: 100, includeUnpriced: true });
        // Single OR clause wrapping the conditions
        expect(result).toHaveLength(1);
    });

    it('should ignore includeUnpriced when no price conditions are active', () => {
        const result = buildEventPriceConditions({ includeUnpriced: true });
        // No other filters → includeUnpriced has no effect
        expect(result).toHaveLength(0);
    });
});
