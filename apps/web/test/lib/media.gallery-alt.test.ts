/**
 * Regression tests for gallery `alt` propagation (H-125).
 *
 * The API composes `alt` per media row (`accommodation.media-compose.ts`), but
 * `extractGalleryItems` used to drop it, so the public detail page fell back to
 * `caption ?? accommodation.name` for every photo. Measured against production
 * on 2026-08-16: all four photos of the only live public accommodation shared
 * the same alt text (the listing name), with `alt` empty in 22 of 22 live rows.
 *
 * Writing `alt` is therefore not enough on its own — the reader has to carry it
 * through. These tests pin that contract.
 */
import { describe, expect, it } from 'vitest';
import { extractFeaturedImage, extractGalleryItems } from '../../src/lib/media.js';

describe('extractGalleryItems — alt propagation (H-125)', () => {
    it('preserves the alt text composed by the API for each gallery row', () => {
        const item = {
            media: {
                gallery: [
                    { url: 'https://cdn.example.com/a.jpg', alt: 'Galería con vista al río' },
                    { url: 'https://cdn.example.com/b.jpg', alt: 'Dormitorio principal' }
                ]
            }
        };

        const result = extractGalleryItems(item);

        expect(result).toHaveLength(2);
        expect(result[0]?.alt).toBe('Galería con vista al río');
        expect(result[1]?.alt).toBe('Dormitorio principal');
    });

    it('keeps alt and caption independent — one does not stand in for the other', () => {
        const item = {
            media: {
                gallery: [
                    {
                        url: 'https://cdn.example.com/a.jpg',
                        alt: 'Pileta climatizada vista desde la galería',
                        caption: 'La pileta'
                    }
                ]
            }
        };

        const [first] = extractGalleryItems(item);

        expect(first?.alt).toBe('Pileta climatizada vista desde la galería');
        expect(first?.caption).toBe('La pileta');
    });

    it('omits alt when the row carries none, so the render-time fallback still applies', () => {
        const item = {
            media: { gallery: [{ url: 'https://cdn.example.com/a.jpg', caption: 'Sólo epígrafe' }] }
        };

        const [first] = extractGalleryItems(item);

        expect(first?.alt).toBeUndefined();
        expect(first?.caption).toBe('Sólo epígrafe');
    });

    it('ignores an empty-string alt rather than emitting a blank alt attribute', () => {
        const item = { media: { gallery: [{ url: 'https://cdn.example.com/a.jpg', alt: '' }] } };

        const [first] = extractGalleryItems(item);

        expect(first?.alt).toBeUndefined();
    });
});

describe('extractFeaturedImage — alt propagation (H-125)', () => {
    it('preserves the alt text of the featured photo', () => {
        const item = {
            media: {
                featuredImage: {
                    url: 'https://cdn.example.com/cover.jpg',
                    alt: 'Frente de la casa quinta al atardecer'
                }
            }
        };

        expect(extractFeaturedImage(item).alt).toBe('Frente de la casa quinta al atardecer');
    });

    it('omits alt when the featured photo carries none', () => {
        const item = { media: { featuredImage: { url: 'https://cdn.example.com/cover.jpg' } } };

        expect(extractFeaturedImage(item).alt).toBeUndefined();
    });
});
