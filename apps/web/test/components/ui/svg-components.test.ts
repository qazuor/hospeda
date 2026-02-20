/**
 * Tests for SVG divider components and illustrations (T-016 + T-030).
 * Verifies proper SVG attributes, accessibility, and file existence for all
 * regional visual identity SVG assets.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const uiDir = resolve(__dirname, '../../../src/components/ui');
const illustrationsDir = resolve(__dirname, '../../../src/components/illustrations');
const categoryIconsDir = resolve(__dirname, '../../../src/components/illustrations/category-icons');

// Helper to read a UI component
function readUi(name: string): string {
    return readFileSync(resolve(uiDir, name), 'utf8');
}

describe('SVG divider components', () => {
    describe('RiverWavesDivider.astro', () => {
        const content = readUi('RiverWavesDivider.astro');

        it('should exist as a file', () => {
            expect(existsSync(resolve(uiDir, 'RiverWavesDivider.astro'))).toBe(true);
        });

        it('should have aria-hidden="true" for decorative role', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should have focusable="false" to prevent tab focus', () => {
            expect(content).toContain('focusable="false"');
        });

        it('should have preserveAspectRatio="none" for fluid stretching', () => {
            expect(content).toContain('preserveAspectRatio="none"');
        });

        it('should span full width via Tailwind w-full class on svg', () => {
            expect(content).toContain('w-full');
        });

        it('should contain SVG path elements', () => {
            expect(content).toContain('<path');
        });

        it('should accept fill prop for color theming', () => {
            expect(content).toContain('fill?');
        });

        it('should export RiverWavesDividerProps interface', () => {
            expect(content).toContain('RiverWavesDividerProps');
        });

        it('should have multiple layered wave paths for depth effect', () => {
            const pathCount = (content.match(/<path/g) ?? []).length;
            expect(pathCount).toBeGreaterThanOrEqual(3);
        });

        it('should use river-waves-divider class on wrapper element', () => {
            expect(content).toContain('river-waves-divider');
        });
    });

    describe('CostaneraTreelineDivider.astro', () => {
        const content = readUi('CostaneraTreelineDivider.astro');

        it('should exist as a file', () => {
            expect(existsSync(resolve(uiDir, 'CostaneraTreelineDivider.astro'))).toBe(true);
        });

        it('should have aria-hidden="true" for decorative role', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should have focusable="false" to prevent tab focus', () => {
            expect(content).toContain('focusable="false"');
        });

        it('should have preserveAspectRatio="none" for fluid stretching', () => {
            expect(content).toContain('preserveAspectRatio="none"');
        });

        it('should have width="100%" for full-width spanning', () => {
            expect(content).toContain('width="100%"');
        });

        it('should contain SVG path elements', () => {
            expect(content).toContain('<path');
        });

        it('should accept fill prop for color theming', () => {
            expect(content).toContain('fill?');
        });

        it('should export CostaneraTreelineDividerProps interface', () => {
            expect(content).toContain('CostaneraTreelineDividerProps');
        });

        it('should use wave-divider class on svg element', () => {
            expect(content).toContain('wave-divider');
        });
    });

    describe('TotoraReedsDivider.astro', () => {
        const content = readUi('TotoraReedsDivider.astro');

        it('should exist as a file', () => {
            expect(existsSync(resolve(uiDir, 'TotoraReedsDivider.astro'))).toBe(true);
        });

        it('should have aria-hidden="true" for decorative role', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should have focusable="false" to prevent tab focus', () => {
            expect(content).toContain('focusable="false"');
        });

        it('should have preserveAspectRatio="none" for fluid stretching', () => {
            expect(content).toContain('preserveAspectRatio="none"');
        });

        it('should have width="100%" for full-width spanning', () => {
            expect(content).toContain('width="100%"');
        });

        it('should contain SVG path elements for ground fill', () => {
            expect(content).toContain('<path');
        });

        it('should contain rect elements for reed stalks', () => {
            expect(content).toContain('<rect');
        });

        it('should contain ellipse elements for cattail tops', () => {
            expect(content).toContain('<ellipse');
        });

        it('should accept fill prop for color theming', () => {
            expect(content).toContain('fill?');
        });

        it('should export TotoraReedsDividerProps interface', () => {
            expect(content).toContain('TotoraReedsDividerProps');
        });

        it('should use wave-divider class on svg element', () => {
            expect(content).toContain('wave-divider');
        });
    });

    describe('SimpleCurveDivider.astro', () => {
        const content = readUi('SimpleCurveDivider.astro');

        it('should exist as a file', () => {
            expect(existsSync(resolve(uiDir, 'SimpleCurveDivider.astro'))).toBe(true);
        });

        it('should have aria-hidden="true" for decorative role', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should have focusable="false" to prevent tab focus', () => {
            expect(content).toContain('focusable="false"');
        });

        it('should have preserveAspectRatio="none" for fluid stretching', () => {
            expect(content).toContain('preserveAspectRatio="none"');
        });

        it('should have width="100%" for full-width spanning', () => {
            expect(content).toContain('width="100%"');
        });

        it('should contain a single SVG path element', () => {
            expect(content).toContain('<path');
        });

        it('should accept fill prop for color theming', () => {
            expect(content).toContain('fill?');
        });

        it('should export SimpleCurveDividerProps interface', () => {
            expect(content).toContain('SimpleCurveDividerProps');
        });

        it('should use wave-divider class on svg element', () => {
            expect(content).toContain('wave-divider');
        });
    });

    describe('DecorativeCorner.astro', () => {
        const content = readUi('DecorativeCorner.astro');

        it('should exist as a file', () => {
            expect(existsSync(resolve(uiDir, 'DecorativeCorner.astro'))).toBe(true);
        });

        it('should have aria-hidden="true" for decorative role', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should have focusable="false" to prevent tab focus', () => {
            expect(content).toContain('focusable="false"');
        });

        it('should accept motif prop with leaf and wave values', () => {
            expect(content).toContain("motif: 'leaf' | 'wave'");
        });

        it('should accept position prop with four corner values', () => {
            expect(content).toContain(
                "position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'"
            );
        });

        it('should export DecorativeCornerProps interface', () => {
            expect(content).toContain('DecorativeCornerProps');
        });

        it('should render leaf motif paths', () => {
            expect(content).toContain("motif === 'leaf'");
        });

        it('should render wave motif paths', () => {
            expect(content).toContain("motif === 'wave'");
        });

        it('should have absolute positioning via inline style', () => {
            expect(content).toContain('position: absolute;');
        });

        it('should have pointer-events: none to avoid blocking interaction', () => {
            expect(content).toContain('pointer-events: none;');
        });
    });
});

describe('Illustration components - file existence', () => {
    describe('Main illustrations (14 files)', () => {
        const illustrations = [
            'ArtGalleryIllustration.astro',
            'BatucadaDrumsIllustration.astro',
            'BeachUmbrellaIllustration.astro',
            'CarnivalFloatIllustration.astro',
            'CarnivalHeaddressIllustration.astro',
            'ColonialFacadeIllustration.astro',
            'ComparsaDancerIllustration.astro',
            'FishingSceneIllustration.astro',
            'FloatTubesIllustration.astro',
            'KayakIllustration.astro',
            'MateIllustration.astro',
            'PalacioSanJoseIllustration.astro',
            'RiverSwimmersIllustration.astro',
            'SunsetCostaneraIllustration.astro'
        ] as const;

        for (const illustration of illustrations) {
            it(`should have ${illustration}`, () => {
                expect(existsSync(resolve(illustrationsDir, illustration))).toBe(true);
            });
        }
    });

    describe('Category icon illustrations (6 files)', () => {
        const categoryIcons = [
            'ApartmentBalconyIcon.astro',
            'BnbGardenIcon.astro',
            'CabanaIcon.astro',
            'CampingRiversideIcon.astro',
            'EstanciaRuralIcon.astro',
            'HotelColonialIcon.astro'
        ] as const;

        for (const icon of categoryIcons) {
            it(`should have category icon ${icon}`, () => {
                expect(existsSync(resolve(categoryIconsDir, icon))).toBe(true);
            });
        }
    });
});
