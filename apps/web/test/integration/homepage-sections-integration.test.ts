/**
 * @file homepage-sections-integration.test.ts
 * @description Integration tests verifying that the homepage composes all
 * expected section components, passes the required props, uses server:defer
 * for dynamic Server Islands, and renders skeletons as fallbacks.
 *
 * Tests read the homepage source file and validate imports, directive usage,
 * prop passing, and section order as expressed in the template.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source fixtures
// ---------------------------------------------------------------------------

const WEB_ROOT = resolve(__dirname, '../../');
const HOMEPAGE_PATH = resolve(WEB_ROOT, 'src/pages/[lang]/index.astro');
const homepageSrc = readFileSync(HOMEPAGE_PATH, 'utf8');

// ---------------------------------------------------------------------------
// Expected sections with their metadata
// ---------------------------------------------------------------------------

interface SectionMeta {
    /** Import identifier used in the file */
    readonly importName: string;
    /** Relative path used in the import statement */
    readonly importPath: string;
    /** Whether this section uses server:defer (Server Island) */
    readonly isServerIsland: boolean;
    /** Whether this section requires a skeleton fallback slot */
    readonly hasFallback: boolean;
    /** Expected skeleton component name, if any */
    readonly skeletonName?: string;
}

const EXPECTED_SECTIONS: readonly SectionMeta[] = [
    {
        importName: 'HeroSection',
        importPath: '../../components/sections/HeroSection.astro',
        isServerIsland: false,
        hasFallback: false
    },
    {
        importName: 'AccommodationsSection',
        importPath: '../../components/sections/AccommodationsSection.astro',
        isServerIsland: true,
        hasFallback: true,
        skeletonName: 'AccommodationGridSkeleton'
    },
    {
        importName: 'DestinationsSection',
        importPath: '../../components/sections/DestinationsSection.astro',
        isServerIsland: true,
        hasFallback: true,
        skeletonName: 'DestinationGridSkeleton'
    },
    {
        importName: 'EventsSection',
        importPath: '../../components/sections/EventsSection.astro',
        isServerIsland: true,
        hasFallback: true,
        skeletonName: 'EventGridSkeleton'
    },
    {
        importName: 'PostsSection',
        importPath: '../../components/sections/PostsSection.astro',
        isServerIsland: true,
        hasFallback: true,
        skeletonName: 'PostGridSkeleton'
    },
    {
        importName: 'ReviewsSection',
        importPath: '../../components/sections/ReviewsSection.astro',
        isServerIsland: false,
        hasFallback: false
    },
    {
        importName: 'StatsSection',
        importPath: '../../components/sections/StatsSection.astro',
        isServerIsland: false,
        hasFallback: false
    },
    {
        importName: 'ListPropertySection',
        importPath: '../../components/sections/ListPropertySection.astro',
        isServerIsland: false,
        hasFallback: false
    }
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('homepage-sections-integration', () => {
    describe('section imports', () => {
        it.each(EXPECTED_SECTIONS)(
            'should import $importName from $importPath',
            ({ importName, importPath }) => {
                // Arrange / Act / Assert
                expect(homepageSrc).toContain(`import ${importName} from '${importPath}'`);
            }
        );
    });

    describe('section template rendering', () => {
        it.each(EXPECTED_SECTIONS)(
            'should render <$importName> in the template body',
            ({ importName }) => {
                // Arrange / Act / Assert
                expect(homepageSrc).toContain(`<${importName}`);
            }
        );

        it.each(EXPECTED_SECTIONS)('$importName should receive locale prop', ({ importName }) => {
            // Arrange / Act / Assert
            expect(homepageSrc).toContain(`<${importName}`);
            // The template passes locale={locale} to every section component
            const sectionBlock = homepageSrc.slice(
                homepageSrc.indexOf(`<${importName}`),
                homepageSrc.indexOf(`<${importName}`) + 200
            );
            expect(sectionBlock).toContain('locale={locale}');
        });
    });

    describe('server:defer Server Islands', () => {
        it.each(EXPECTED_SECTIONS.filter((s) => s.isServerIsland))(
            '$importName should use server:defer directive',
            ({ importName }) => {
                // Arrange - extract the opening tag up to the closing > to avoid
                // reading into adjacent elements.
                const tagStart = homepageSrc.indexOf(`<${importName}`);
                const tagEnd = homepageSrc.indexOf('>', tagStart) + 1;
                const openTag = homepageSrc.slice(tagStart, tagEnd);

                // Act / Assert
                expect(openTag).toContain('server:defer');
            }
        );

        it.each(EXPECTED_SECTIONS.filter((s) => !s.isServerIsland))(
            '$importName should NOT use server:defer (it is a static component)',
            ({ importName }) => {
                // Arrange - find the tag and extract only up to the closing angle bracket
                // to avoid false positives from adjacent server:defer sections.
                const tagStart = homepageSrc.indexOf(`<${importName}`);
                // Self-closing tags end with />; regular opening tags end with >.
                // Take the smaller of the two to stay within the tag boundary.
                const selfCloseEnd = homepageSrc.indexOf('/>', tagStart);
                const openEnd = homepageSrc.indexOf('>', tagStart);
                const tagEnd = Math.min(
                    selfCloseEnd !== -1 ? selfCloseEnd + 2 : Number.POSITIVE_INFINITY,
                    openEnd !== -1 ? openEnd + 1 : Number.POSITIVE_INFINITY
                );
                const openTag = homepageSrc.slice(tagStart, tagEnd);

                // Act / Assert
                expect(openTag).not.toContain('server:defer');
            }
        );
    });

    describe('skeleton fallbacks', () => {
        it.each(EXPECTED_SECTIONS.filter((s) => s.hasFallback))(
            '$importName should import its skeleton component ($skeletonName)',
            ({ skeletonName }) => {
                // Arrange / Act / Assert
                expect(homepageSrc).toContain(`import ${skeletonName}`);
            }
        );

        it.each(EXPECTED_SECTIONS.filter((s) => s.hasFallback))(
            '$importName should render skeleton with slot="fallback"',
            ({ skeletonName }) => {
                // Arrange / Act / Assert
                expect(homepageSrc).toContain(`<${skeletonName}`);
                expect(homepageSrc).toContain('slot="fallback"');
            }
        );
    });

    describe('section order in template', () => {
        it('sections should appear in the correct order in the template', () => {
            // Arrange - find the position of each section's opening tag
            const positions: Record<string, number> = {};
            for (const { importName } of EXPECTED_SECTIONS) {
                positions[importName] = homepageSrc.indexOf(`<${importName}`);
            }

            // Act / Assert - validate relative ordering matches design spec
            expect(positions.HeroSection).toBeLessThan(positions.AccommodationsSection);
            expect(positions.AccommodationsSection).toBeLessThan(positions.DestinationsSection);
            expect(positions.DestinationsSection).toBeLessThan(positions.EventsSection);
            expect(positions.EventsSection).toBeLessThan(positions.PostsSection);
            expect(positions.PostsSection).toBeLessThan(positions.ReviewsSection);
            expect(positions.ReviewsSection).toBeLessThan(positions.StatsSection);
            expect(positions.StatsSection).toBeLessThan(positions.ListPropertySection);
        });
    });

    describe('ParallaxDivider between sections', () => {
        it('should import ParallaxDivider for section separators', () => {
            // Arrange / Act / Assert
            expect(homepageSrc).toContain('import ParallaxDivider');
            expect(homepageSrc).toContain('../../components/shared/ParallaxDivider.astro');
        });

        it('should use at least three ParallaxDivider instances', () => {
            // Arrange
            const dividerMatches = homepageSrc.match(/<ParallaxDivider/g) ?? [];

            // Act / Assert
            expect(dividerMatches.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('page-level setup', () => {
        it('should use BaseLayout as the outer wrapper', () => {
            // Arrange / Act / Assert
            expect(homepageSrc).toContain(
                "import BaseLayout from '../../layouts/BaseLayout.astro'"
            );
            expect(homepageSrc).toContain('<BaseLayout');
        });

        it('should include SEOHead in the head slot', () => {
            // Arrange / Act / Assert
            expect(homepageSrc).toContain(
                "import SEOHead from '../../components/seo/SEOHead.astro'"
            );
            expect(homepageSrc).toContain('<SEOHead');
            expect(homepageSrc).toContain('slot="head"');
        });

        it('should use SSR (no prerender export)', () => {
            // Arrange / Act / Assert
            expect(homepageSrc).not.toContain('export const prerender = true');
        });

        it('should use getLocaleFromParams for runtime locale resolution', () => {
            // Arrange / Act / Assert
            expect(homepageSrc).toContain('getLocaleFromParams');
        });

        it('should pass isHero and isHomepage flags to BaseLayout', () => {
            // Arrange / Act / Assert
            expect(homepageSrc).toContain('isHero');
            expect(homepageSrc).toContain('isHomepage');
        });
    });
});
