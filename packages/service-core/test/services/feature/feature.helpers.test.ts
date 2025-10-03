// TODO [aec4cbe9-da4f-4730-aeda-32e310599c50]: Implement tests for all helpers in feature.helpers.ts, including slug generation and utility functions.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateFeatureSlug } from '../../../src/services/feature/feature.helpers';

describe('generateFeatureSlug', () => {
    let findOneMock: ReturnType<typeof vi.fn>;
    let model: { findOne: typeof findOneMock };
    beforeEach(() => {
        findOneMock = vi.fn();
        model = { findOne: findOneMock };
    });

    it('generates a slug from name if not taken', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateFeatureSlug('Test Feature', model);
        expect(typeof slug).toBe('string');
        expect(slug).toMatch(/^test-feature/);
    });

    it('appends a suffix if slug is already taken', async () => {
        findOneMock.mockResolvedValueOnce({}).mockResolvedValueOnce(null).mockResolvedValue(null); // all subsequent calls return null
        const slug = await generateFeatureSlug('Test Feature', model);
        expect(slug).toMatch(/^test-feature-[a-z0-9]+$/);
    });

    it('is idempotent for the same name if slug is available', async () => {
        findOneMock.mockResolvedValue(null);
        const slug1 = await generateFeatureSlug('Unique Name', model);
        const slug2 = await generateFeatureSlug('Unique Name', model);
        expect(slug1).toBe(slug2);
    });

    it('handles names with special characters and spaces', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateFeatureSlug('Córdoba & Río! 2024', model);
        expect(slug).toBe('cordoba-and-rio-2024');
    });

    it('handles repeated collisions and increments suffix', async () => {
        findOneMock
            .mockResolvedValueOnce({}) // slug exists
            .mockResolvedValueOnce({}) // slug-xxxx exists
            .mockResolvedValueOnce(null)
            .mockResolvedValue(null); // all subsequent calls return null
        const slug = await generateFeatureSlug('Test Feature', model);
        expect(slug).toMatch(/^test-feature-[a-z0-9]+$/);
    });
});
