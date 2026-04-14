import { describe, expect, it } from 'vitest';
import { generateGalleryId } from '../gallery-id.js';

describe('generateGalleryId', () => {
    it('should return a string of exactly 10 characters', () => {
        const id = generateGalleryId();
        expect(id).toHaveLength(10);
    });

    it('should return different values on subsequent calls', () => {
        const id1 = generateGalleryId();
        const id2 = generateGalleryId();
        const id3 = generateGalleryId();

        // All three should be unique (probability of collision is astronomically low)
        expect(id1).not.toBe(id2);
        expect(id2).not.toBe(id3);
        expect(id1).not.toBe(id3);
    });

    it('should only contain URL-safe characters', () => {
        // Run 50 iterations to catch any rare non-URL-safe character
        const urlSafePattern = /^[A-Za-z0-9_-]+$/;

        for (let i = 0; i < 50; i++) {
            const id = generateGalleryId();
            expect(id).toMatch(urlSafePattern);
        }
    });

    it('should return a string type', () => {
        const id = generateGalleryId();
        expect(typeof id).toBe('string');
    });
});
