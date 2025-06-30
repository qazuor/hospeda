import { AccommodationModel } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateSlug } from '../../../src/services/accommodation/accommodation.helpers';

/**
 * Test suite for generateSlug helper in AccommodationService.
 * Ensures robust, unique, and predictable slug generation for accommodations.
 */
describe('generateSlug (AccommodationService)', () => {
    let findOneMock: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        findOneMock = vi.fn();
        vi.spyOn(AccommodationModel.prototype, 'findOne').mockImplementation(findOneMock);
    });

    it('generates a slug from type and name if not taken', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateSlug('hotel', 'Gran Hotel Plaza');
        expect(typeof slug).toBe('string');
        expect(slug).toMatch(/^hotel-gran-hotel-plaza/);
    });

    it('handles special characters, spaces, and case', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateSlug('cabaña', 'El Río & Sol! 2024');
        // The slugify utility replaces '&' with 'and'
        expect(slug).toBe('cabana-el-rio-and-sol-2024');
    });

    it('appends a suffix if slug is already taken', async () => {
        findOneMock.mockResolvedValueOnce({}).mockResolvedValueOnce(null);
        const slug = await generateSlug('hostel', 'La Posta');
        expect(slug).toMatch(/^hostel-la-posta-[a-z0-9]+$/);
    });

    it('handles multiple collisions and increments suffix', async () => {
        findOneMock
            .mockResolvedValueOnce({}) // slug exists
            .mockResolvedValueOnce({}) // slug-xxxx exists
            .mockResolvedValueOnce(null); // finally available
        const slug = await generateSlug('apartment', 'El Centro');
        expect(slug).toMatch(/^apartment-el-centro-[a-z0-9]+$/);
    });

    it('is idempotent for the same type and name if slug is available', async () => {
        findOneMock.mockResolvedValue(null);
        const slug1 = await generateSlug('cabin', 'Monte Verde');
        const slug2 = await generateSlug('cabin', 'Monte Verde');
        expect(slug1).toBe(slug2);
    });

    it('throws if model throws', async () => {
        findOneMock.mockRejectedValue(new Error('DB error'));
        await expect(generateSlug('hotel', 'Error Name')).rejects.toThrow('DB error');
    });
});
