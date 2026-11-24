/**
 * @file GalleryCounter.test.tsx
 * @description The shared «Z/X» counter (HOS-2520 item 16): one component for the
 * mobile swipe track and the lightbox of every vertical.
 */
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GalleryCounter } from '@/components/gallery/GalleryCounter';

describe('GalleryCounter', () => {
    it('renders the label as a polite live region and merges the caller position class', () => {
        render(
            <GalleryCounter
                label="3/12"
                className="pos"
            />
        );
        const counter = screen.getByText('3/12');
        expect(counter).toHaveAttribute('aria-live', 'polite');
        expect(counter).toHaveAttribute('aria-atomic', 'true');
        expect(counter.className).toContain('pos');
    });

    it('is the only counter markup in both gallery surfaces', () => {
        for (const file of [
            'src/components/ImageGalleryMobileTrack.client.tsx',
            'src/components/ImageGallery.client.tsx'
        ]) {
            const src = readFileSync(file, 'utf8');
            expect(src).toContain("import { GalleryCounter } from './gallery/GalleryCounter';");
            expect(src).toMatch(/<GalleryCounter[\s\S]*?ui\.accessibility\.galleryCounter/);
        }
    });

    it('owns the pill look; callers only position it', () => {
        const pill = readFileSync('src/components/gallery/GalleryCounter.module.css', 'utf8');
        const lightbox = readFileSync('src/components/ImageGallery.module.css', 'utf8');
        expect(pill).toMatch(/background: var\(--surface-dark\);/);
        expect(pill).toMatch(/font-variant-numeric: tabular-nums;/);
        const lightboxRule = lightbox.match(/\.lightboxCounter \{[^}]*\}/)?.[0] ?? '';
        expect(lightboxRule).not.toMatch(/font-size|color:/);
    });
});
