/**
 * Tests for the texture CSS utility classes (textures.css).
 * Verifies that all regional texture patterns are defined with correct
 * class names, dark mode variants, and low opacity values per SPEC-015.
 *
 * Texture classes follow the regional identity of the Argentine Litoral:
 * - texture-water: Rio Uruguay river ripple pattern
 * - texture-sand: warm sand grain pattern
 * - texture-leaf: subtropical vegetation pattern
 * - texture-stars: night sky for dark backgrounds
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const texturesCssPath = resolve(__dirname, '../../src/styles/textures.css');
const texturesCss = readFileSync(texturesCssPath, 'utf8');

describe('Texture CSS - textures.css', () => {
    describe('File structure', () => {
        it('should be a non-empty CSS file', () => {
            expect(texturesCss.length).toBeGreaterThan(0);
        });

        it('should define at least four texture utility classes', () => {
            const classMatches = texturesCss.match(/\.(texture-\w+)\s*\{/g) ?? [];
            expect(classMatches.length).toBeGreaterThanOrEqual(4);
        });
    });

    describe('.texture-water class', () => {
        it('should define .texture-water class', () => {
            expect(texturesCss).toContain('.texture-water');
        });

        it('should use background-image for the pattern', () => {
            const waterSection =
                texturesCss.split('.texture-water')[1]?.split('.texture-')[0] ?? '';
            expect(waterSection).toContain('background-image');
        });

        it('should use repeating-radial-gradient for water ripple effect', () => {
            expect(texturesCss).toContain('repeating-radial-gradient');
        });

        it('should use ellipse shape for water ripple gradient', () => {
            expect(texturesCss).toContain('ellipse at');
        });

        it('should use low opacity values (0.03-0.04) for subtle texture', () => {
            // The water texture uses rgba with 0.03 or 0.04 opacity
            const waterBlock = texturesCss.split('.texture-water')[1]?.split('\n}\n')[0] ?? '';
            const hasLowOpacity = waterBlock.includes('0.03') || waterBlock.includes('0.04');
            expect(hasLowOpacity).toBe(true);
        });

        it('should define background-size for repeating pattern', () => {
            const waterBlock = texturesCss.split('.texture-water')[1]?.split('\n}\n')[0] ?? '';
            expect(waterBlock).toContain('background-size');
        });

        it('should have dark mode variant [data-theme="dark"] .texture-water', () => {
            expect(texturesCss).toContain('[data-theme="dark"] .texture-water');
        });

        it('should use different color in dark mode water texture (teal tint)', () => {
            const darkWaterSection =
                texturesCss.split('[data-theme="dark"] .texture-water')[1] ?? '';
            // Dark mode uses teal rgba color (61, 189, 192 = #3DBDC0)
            expect(darkWaterSection).toContain('61, 189, 192');
        });

        it('should use slightly higher opacity in dark mode (0.04)', () => {
            const darkWaterSection =
                texturesCss.split('[data-theme="dark"] .texture-water')[1] ?? '';
            expect(darkWaterSection).toContain('0.04');
        });
    });

    describe('.texture-sand class', () => {
        it('should define .texture-sand class', () => {
            expect(texturesCss).toContain('.texture-sand');
        });

        it('should use background-image with SVG data URI for sand grain', () => {
            const sandSection = texturesCss.split('.texture-sand')[1]?.split('.texture-')[0] ?? '';
            expect(sandSection).toContain('background-image');
            expect(sandSection).toContain('data:image/svg+xml');
        });

        it('should use circle elements in the SVG pattern', () => {
            const sandSection = texturesCss.split('.texture-sand')[1]?.split('.texture-')[0] ?? '';
            expect(sandSection).toContain('circle');
        });

        it('should use low fill-opacity (0.03-0.04) for subtle sand grain', () => {
            const sandBlock = texturesCss.split('.texture-sand')[1]?.split('\n}\n')[0] ?? '';
            const hasLowOpacity =
                sandBlock.includes("fill-opacity='0.04'") ||
                sandBlock.includes("fill-opacity='0.03'") ||
                sandBlock.includes('0.04') ||
                sandBlock.includes('0.03');
            expect(hasLowOpacity).toBe(true);
        });

        it('should use background-repeat: repeat for tiling', () => {
            const sandSection = texturesCss.split('.texture-sand')[1]?.split('.texture-')[0] ?? '';
            expect(sandSection).toContain('background-repeat');
            expect(sandSection).toContain('repeat');
        });

        it('should have dark mode variant [data-theme="dark"] .texture-sand', () => {
            expect(texturesCss).toContain('[data-theme="dark"] .texture-sand');
        });

        it('should use lighter color in dark mode sand texture', () => {
            const darkSandSection = texturesCss.split('[data-theme="dark"] .texture-sand')[1] ?? '';
            // Dark mode sand uses C4B8A8 (warm light gray) instead of 8B7355 (warm brown)
            expect(darkSandSection).toContain('C4B8A8');
        });

        it('should use lower opacity in dark mode sand (0.02-0.03)', () => {
            const darkSandSection =
                texturesCss.split('[data-theme="dark"] .texture-sand')[1]?.split('\n}\n')[0] ?? '';
            const hasLowOpacity =
                darkSandSection.includes('0.02') || darkSandSection.includes('0.03');
            expect(hasLowOpacity).toBe(true);
        });
    });

    describe('.texture-leaf class', () => {
        it('should define .texture-leaf class', () => {
            expect(texturesCss).toContain('.texture-leaf');
        });

        it('should use background-image with SVG data URI for leaf shape', () => {
            const leafSection = texturesCss.split('.texture-leaf')[1]?.split('.texture-')[0] ?? '';
            expect(leafSection).toContain('background-image');
            expect(leafSection).toContain('data:image/svg+xml');
        });

        it('should use path element in the SVG for leaf shape', () => {
            const leafSection = texturesCss.split('.texture-leaf')[1]?.split('.texture-')[0] ?? '';
            expect(leafSection).toContain('path');
        });

        it('should use green color #2D6A4F for leaf pattern', () => {
            const leafSection = texturesCss.split('.texture-leaf')[1]?.split('.texture-')[0] ?? '';
            expect(leafSection).toContain('2D6A4F');
        });

        it('should use low fill-opacity (0.03) for subtle leaf texture', () => {
            const leafBlock = texturesCss.split('.texture-leaf')[1]?.split('\n}\n')[0] ?? '';
            expect(leafBlock).toContain('0.03');
        });

        it('should use background-repeat: repeat for tiling', () => {
            const leafSection = texturesCss.split('.texture-leaf')[1]?.split('.texture-')[0] ?? '';
            expect(leafSection).toContain('background-repeat');
        });

        it('should have dark mode variant [data-theme="dark"] .texture-leaf', () => {
            expect(texturesCss).toContain('[data-theme="dark"] .texture-leaf');
        });

        it('should use lighter green #52B788 in dark mode leaf texture', () => {
            const darkLeafSection = texturesCss.split('[data-theme="dark"] .texture-leaf')[1] ?? '';
            expect(darkLeafSection).toContain('52B788');
        });
    });

    describe('.texture-stars class', () => {
        it('should define .texture-stars class', () => {
            expect(texturesCss).toContain('.texture-stars');
        });

        it('should use background-image with multiple radial-gradients for stars', () => {
            const starsSection = texturesCss.split('.texture-stars')[1] ?? '';
            expect(starsSection).toContain('radial-gradient');
        });

        it('should use 1px star points in the gradients', () => {
            const starsSection = texturesCss.split('.texture-stars')[1] ?? '';
            expect(starsSection).toContain('1px 1px');
        });

        it('should use rgba(240, 237, 232, ...) for warm white star color', () => {
            const starsSection = texturesCss.split('.texture-stars')[1] ?? '';
            expect(starsSection).toContain('rgba(240, 237, 232,');
        });

        it('should use multiple gradients for varied star positions', () => {
            const starsSection = texturesCss.split('.texture-stars')[1] ?? '';
            const gradientCount = (starsSection.match(/radial-gradient/g) ?? []).length;
            expect(gradientCount).toBeGreaterThanOrEqual(5);
        });

        it('should define background-size for the star pattern tiling', () => {
            const starsSection = texturesCss.split('.texture-stars')[1] ?? '';
            expect(starsSection).toContain('background-size');
        });
    });

    describe('Opacity constraints across all textures', () => {
        it('should NOT use opacity values above 0.5 in light mode textures', () => {
            // Extract only the light mode parts (before [data-theme="dark"])
            const lightModeSection = texturesCss.split('[data-theme="dark"]')[0] ?? '';
            // Check none of the rgba values exceed 0.5 (except texture-stars which can go higher for visibility)
            const rgbaMatches = lightModeSection.match(/rgba\([^)]+\)/g) ?? [];
            const textureWaterMatches = rgbaMatches.filter(
                (rgba) =>
                    rgba.includes('13, 115, 119') ||
                    rgba.includes('45, 106, 79') ||
                    rgba.includes('139, 115, 85')
            );
            for (const rgba of textureWaterMatches) {
                const opacityMatch = rgba.match(/,\s*([\d.]+)\s*\)$/);
                if (opacityMatch) {
                    const opacity = Number.parseFloat(opacityMatch[1] ?? '0');
                    expect(opacity).toBeLessThanOrEqual(0.1);
                }
            }
        });

        it('should use fill-opacity values of 0.03 or 0.04 in sand texture SVG', () => {
            const sandBlock = texturesCss.split('.texture-sand {')[1]?.split('}')[0] ?? '';
            const hasCorrectOpacity = sandBlock.includes('0.04') || sandBlock.includes('0.03');
            expect(hasCorrectOpacity).toBe(true);
        });
    });

    describe('Dark mode variant coverage', () => {
        it('should have dark mode override for texture-water', () => {
            expect(texturesCss).toContain('[data-theme="dark"] .texture-water');
        });

        it('should have dark mode override for texture-sand', () => {
            expect(texturesCss).toContain('[data-theme="dark"] .texture-sand');
        });

        it('should have dark mode override for texture-leaf', () => {
            expect(texturesCss).toContain('[data-theme="dark"] .texture-leaf');
        });
    });

    describe('Integration with tailwind.css', () => {
        it('tailwind.css should import textures.css to make classes available', () => {
            const tailwindCssPath = resolve(__dirname, '../../src/styles/tailwind.css');
            const tailwindCss = readFileSync(tailwindCssPath, 'utf8');
            expect(tailwindCss).toContain('@import "./textures.css"');
        });
    });
});
