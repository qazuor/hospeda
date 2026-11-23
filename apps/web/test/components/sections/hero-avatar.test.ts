/** Regression tests for the hero social-proof avatar URL (HOS-2572). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildHeroAvatarUrl } from '@/components/sections/hero-avatar';

const RAW = 'https://res.cloudinary.com/demo/image/upload/v1/hospeda/avatars/jane.jpg';

describe('buildHeroAvatarUrl', () => {
    it('should request a 92x92 fill crop with auto format and quality for Cloudinary URLs', () => {
        // Act
        const result = buildHeroAvatarUrl({ url: RAW });

        // Assert
        expect(result).not.toBe(RAW);
        expect(result).toContain('/upload/w_92,h_92,c_fill,g_face,q_auto,f_auto/v1/');
    });

    it('should leave non-Cloudinary URLs untouched', () => {
        // Arrange
        const unsplash = 'https://images.unsplash.com/photo-1?w=150&h=150&fit=crop';

        // Act / Assert
        expect(buildHeroAvatarUrl({ url: unsplash })).toBe(unsplash);
    });

    it('should be used by HeroSection instead of the raw slot URL', () => {
        // Arrange
        const source = readFileSync(
            resolve(__dirname, '../../../src/components/sections/HeroSection.astro'),
            'utf8'
        );

        // Assert
        expect(source).not.toContain('src={slot.url}');
        expect(source).toContain('buildHeroAvatarUrl({ url: slot.url })');
    });
});
