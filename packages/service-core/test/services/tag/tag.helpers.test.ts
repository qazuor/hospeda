import { TagModel } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateTagSlug } from '../../../src/services/tag/tag.helpers';

/**
 * Test suite for generateTagSlug helper in TagService.
 * Ensures robust, unique, and predictable slug generation for tags.
 */
describe('generateTagSlug (TagService)', () => {
    let findOneMock: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        findOneMock = vi.fn();
        vi.spyOn(TagModel.prototype, 'findOne').mockImplementation(findOneMock);
    });

    it('generates a slug from name if not taken', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateTagSlug('Tag Name');
        expect(typeof slug).toBe('string');
        expect(slug).toBe('tag-name');
    });

    it('appends a suffix if slug is already taken', async () => {
        findOneMock.mockResolvedValueOnce({}).mockResolvedValueOnce(null);
        const slug = await generateTagSlug('Tag Name');
        expect(slug).toMatch(/^tag-name-[a-z0-9]+$/);
    });

    it('is idempotent for the same input if slug is available', async () => {
        findOneMock.mockResolvedValue(null);
        const slug1 = await generateTagSlug('Unique Tag');
        const slug2 = await generateTagSlug('Unique Tag');
        expect(slug1).toBe(slug2);
    });

    it('handles names with special characters and spaces', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateTagSlug('José & María! 2024');
        expect(slug).toBe('jose-and-maria-2024');
    });

    it('throws if model throws', async () => {
        findOneMock.mockRejectedValue(new Error('DB error'));
        await expect(generateTagSlug('Error Name')).rejects.toThrow('DB error');
    });
});
