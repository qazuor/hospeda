// TODO [96ec6f25-86ea-4410-9581-3e45095aa652]: Implement tests for all helpers in feature.helpers.ts, including slug generation and utility functions.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateFeatureSlug } from '../../../src/services/feature/feature.helpers';

describe('generateFeatureSlug', () => {
    let findOneMock: ReturnType<typeof vi.fn>;
    let model: { findOne: typeof findOneMock };
    beforeEach(() => {
        findOneMock = vi.fn();
        model = { findOne: findOneMock };
    });

    it('generates a slug from the es locale when not taken', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateFeatureSlug(
            { es: 'Test Feature', en: 'Test Feature', pt: 'Test Feature' },
            model
        );
        expect(typeof slug).toBe('string');
        expect(slug).toMatch(/^test-feature/);
    });

    it('appends a suffix if slug is already taken', async () => {
        findOneMock.mockResolvedValueOnce({}).mockResolvedValueOnce(null).mockResolvedValue(null); // all subsequent calls return null
        const slug = await generateFeatureSlug(
            { es: 'Test Feature', en: 'Test Feature', pt: 'Test Feature' },
            model
        );
        expect(slug).toMatch(/^test-feature-[a-z0-9]+$/);
    });

    it('is idempotent for the same name if slug is available', async () => {
        findOneMock.mockResolvedValue(null);
        const slug1 = await generateFeatureSlug(
            { es: 'Unique Name', en: 'Unique Name', pt: 'Unique Name' },
            model
        );
        const slug2 = await generateFeatureSlug(
            { es: 'Unique Name', en: 'Unique Name', pt: 'Unique Name' },
            model
        );
        expect(slug1).toBe(slug2);
    });

    it('derives the slug from the es locale and handles special characters', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateFeatureSlug(
            { es: 'Córdoba & Río! 2024', en: 'Cordoba and Rio 2024', pt: 'Córdoba e Rio 2024' },
            model
        );
        expect(slug).toBe('cordoba-and-rio-2024');
    });

    it('handles repeated collisions and increments suffix', async () => {
        findOneMock
            .mockResolvedValueOnce({}) // slug exists
            .mockResolvedValueOnce({}) // slug-xxxx exists
            .mockResolvedValueOnce(null)
            .mockResolvedValue(null); // all subsequent calls return null
        const slug = await generateFeatureSlug(
            { es: 'Test Feature', en: 'Test Feature', pt: 'Test Feature' },
            model
        );
        expect(slug).toMatch(/^test-feature-[a-z0-9]+$/);
    });

    it('uses the es locale as canonical source, ignoring en/pt', async () => {
        findOneMock.mockResolvedValue(null);
        // Different es vs en — slug must come from es
        const slug = await generateFeatureSlug(
            { es: 'Frente al río', en: 'River Front', pt: 'Frente ao rio' },
            model
        );
        expect(slug).toMatch(/^frente-al-rio/);
    });
});
