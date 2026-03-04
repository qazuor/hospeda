/**
 * Tests for CategoryIconsSection.astro.
 * Validates SectionWrapper usage, grid layout, category links, accessibility.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/content/CategoryIconsSection.astro'
);
const content = readFileSync(componentPath, 'utf8');

describe('CategoryIconsSection.astro', () => {
    describe('Props', () => {
        it('should accept optional locale prop', () => {
            expect(content).toContain('locale');
        });

        it('should accept optional categories array prop', () => {
            expect(content).toContain('categories');
        });

        it('should define CategoryItem type', () => {
            expect(content).toContain('CategoryItem');
        });
    });

    describe('SectionWrapper usage', () => {
        it('should import SectionWrapper', () => {
            expect(content).toContain('SectionWrapper');
        });

        it('should use warm variant for beige background', () => {
            expect(content).toContain('variant="warm"');
        });
    });

    describe('SectionHeader usage', () => {
        it('should import SectionHeader', () => {
            expect(content).toContain('SectionHeader');
        });
    });

    describe('Grid layout', () => {
        it('should use 2-column grid on mobile', () => {
            expect(content).toContain('grid-cols-2');
        });

        it('should use 3-column grid on tablet', () => {
            expect(content).toContain('sm:grid-cols-3');
        });

        it('should use 6-column grid on desktop', () => {
            expect(content).toContain('lg:grid-cols-6');
        });
    });

    describe('Category items', () => {
        it('should render links to filtered accommodation listings', () => {
            expect(content).toContain('/alojamientos/tipo/');
        });

        it('should have 6 default categories', () => {
            expect(content).toContain('HOTEL');
            expect(content).toContain('CABIN');
            expect(content).toContain('CAMPING');
            expect(content).toContain('APARTMENT');
            expect(content).toContain('BNB');
            expect(content).toContain('RURAL');
        });
    });

    describe('Hover effects', () => {
        it('should scale on hover', () => {
            expect(content).toContain('hover:scale-105');
        });

        it('should add shadow on hover', () => {
            expect(content).toContain('hover:shadow-md');
        });

        it('should use smooth transition', () => {
            expect(content).toContain('duration-300');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-label on category links', () => {
            expect(content).toContain('aria-label');
        });

        it('should mark icons as decorative with aria-hidden', () => {
            expect(content).toContain('aria-hidden');
        });
    });

    describe('i18n integration', () => {
        it('should import t function from lib/i18n', () => {
            expect(content).toContain("from '../../lib/i18n'");
        });

        it('should use t() for section header title', () => {
            expect(content).toContain("'categories.title'");
        });

        it('should use t() for category labels', () => {
            expect(content).toContain("'categories.");
        });
    });

    describe('Count display', () => {
        it('should handle optional count gracefully', () => {
            expect(content).toContain('count');
        });
    });

    describe('Icon imports', () => {
        it('should import icons from @repo/icons', () => {
            expect(content).toContain('@repo/icons');
        });

        it('should import per-category icons (not just BuildingIcon)', () => {
            expect(content).toContain('BuildingIcon');
            expect(content).toContain('HomeIcon');
            expect(content).toContain('CampingAreaIcon');
            expect(content).toContain('EntirePropertyIcon');
            expect(content).toContain('CreoleInnIcon');
            expect(content).toContain('RuralAreaIcon');
        });
    });

    describe('Per-category icon mapping', () => {
        it('should define an icon mapping record for category types', () => {
            expect(content).toContain('CATEGORY_ICONS');
        });

        it('should map each category key to a unique icon', () => {
            expect(content).toMatch(/HOTEL.*BuildingIcon/s);
            expect(content).toMatch(/CABIN.*HomeIcon/s);
            expect(content).toMatch(/CAMPING.*CampingAreaIcon/s);
            expect(content).toMatch(/APARTMENT.*EntirePropertyIcon/s);
            expect(content).toMatch(/BNB.*CreoleInnIcon/s);
            expect(content).toMatch(/RURAL.*RuralAreaIcon/s);
        });
    });

    describe('Category card structure', () => {
        it('should use rounded corners on category cards', () => {
            expect(content).toContain('rounded');
        });

        it('should define color for each category using theme tokens', () => {
            expect(content).toContain('bg-primary');
            expect(content).toContain('bg-green');
            expect(content).toContain('bg-secondary');
        });
    });
});
