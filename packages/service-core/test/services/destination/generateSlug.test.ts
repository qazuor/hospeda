import { DestinationModel } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDestinationSlug } from '../../../src/services/destination/destination.helpers';

/**
 * @fileoverview
 * Exhaustive unit tests for generateDestinationSlug helper.
 * Ensures robust, unique, and predictable slug generation for destinations.
 */
describe('generateDestinationSlug', () => {
    let findOneMock: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        findOneMock = vi.fn();
        vi.spyOn(DestinationModel.prototype, 'findOne').mockImplementation(findOneMock);
    });

    it('generates a slug from name if not taken', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateDestinationSlug('Test Destination');
        expect(typeof slug).toBe('string');
        expect(slug).toMatch(/^test-destination/);
    });

    it('appends a suffix if slug is already taken', async () => {
        findOneMock.mockResolvedValueOnce({}).mockResolvedValueOnce(null);
        const slug = await generateDestinationSlug('Test Destination');
        expect(slug).toMatch(/^test-destination-[a-z0-9]+$/);
    });

    it('is idempotent for the same name if slug is available', async () => {
        findOneMock.mockResolvedValue(null);
        const slug1 = await generateDestinationSlug('Unique Name');
        const slug2 = await generateDestinationSlug('Unique Name');
        expect(slug1).toBe(slug2);
    });

    it('handles names with special characters and spaces', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateDestinationSlug('Córdoba & Río! 2024');
        // The slugify utility replaces '&' with 'and'
        expect(slug).toBe('cordoba-and-rio-2024');
    });

    it('handles repeated collisions and increments suffix', async () => {
        findOneMock
            .mockResolvedValueOnce({}) // slug exists
            .mockResolvedValueOnce({}) // slug-xxxx exists
            .mockResolvedValueOnce(null); // finally available
        const slug = await generateDestinationSlug('Test Destination');
        expect(slug).toMatch(/^test-destination-[a-z0-9]+$/);
    });

    it('throws if model throws', async () => {
        findOneMock.mockRejectedValue(new Error('DB error'));
        await expect(generateDestinationSlug('Error Name')).rejects.toThrow('DB error');
    });
});
