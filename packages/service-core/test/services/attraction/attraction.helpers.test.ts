import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAttractionSlug } from '../../../src/services/attraction/attraction.helpers';

describe('generateAttractionSlug', () => {
    let findOneMock: ReturnType<typeof vi.fn>;
    let model: { findOne: typeof findOneMock };
    beforeEach(() => {
        findOneMock = vi.fn();
        model = { findOne: findOneMock };
    });

    it('generates a slug from name if not taken', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateAttractionSlug('Test Attraction', model);
        expect(typeof slug).toBe('string');
        expect(slug).toMatch(/^test-attraction/);
    });

    it('appends a suffix if slug is already taken', async () => {
        findOneMock.mockResolvedValueOnce({}).mockResolvedValueOnce(null);
        const slug = await generateAttractionSlug('Test Attraction', model);
        expect(slug).toMatch(/^test-attraction-[a-z0-9]+$/);
    });

    it('is idempotent for the same name if slug is available', async () => {
        findOneMock.mockResolvedValue(null);
        const slug1 = await generateAttractionSlug('Unique Name', model);
        const slug2 = await generateAttractionSlug('Unique Name', model);
        expect(slug1).toBe(slug2);
    });

    it('handles names with special characters and spaces', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateAttractionSlug('Córdoba & Río! 2024', model);
        expect(slug).toBe('cordoba-and-rio-2024');
    });
});
