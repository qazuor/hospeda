import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/content/FeaturedDestinations.astro'
);
const content = readFileSync(componentPath, 'utf8');

describe('FeaturedDestinations.astro', () => {
    describe('File integrity', () => {
        it('should be a non-empty readable file', () => {
            expect(content.length).toBeGreaterThan(0);
        });

        it('should contain valid Astro frontmatter delimiters', () => {
            expect(content).toMatch(/^---/);
            expect(content).toMatch(/---\n/);
        });

        it('should have import statements in frontmatter', () => {
            const imports = content.match(/^import .+from .+;?$/gm) ?? [];
            expect(imports.length).toBeGreaterThan(0);
        });
    });

    describe('Imports', () => {
        it('should import DestinationCard component', () => {
            expect(content).toContain('DestinationCard');
            expect(content).toContain('DestinationCard.astro');
        });

        it('should not import deleted DestinationCardHero component', () => {
            expect(content).not.toContain('DestinationCardHero');
        });

        it('should import DestinationCarousel component', () => {
            expect(content).toContain('DestinationCarousel');
            expect(content).toContain('DestinationCarousel.astro');
        });

        it('should import DestinationPreview component', () => {
            expect(content).toContain('DestinationPreview');
            expect(content).toContain('DestinationPreview.astro');
        });

        it('should import LitoralMap component', () => {
            expect(content).toContain('import LitoralMap');
            expect(content).toContain('LitoralMap.astro');
        });

        it('should import EmptyState component', () => {
            expect(content).toContain('import EmptyState');
            expect(content).toContain('EmptyState.astro');
        });

        it('should import destinationsApi from endpoints', () => {
            expect(content).toContain('destinationsApi');
            expect(content).toContain('lib/api/endpoints');
        });

        it('should import t and SupportedLocale from i18n', () => {
            expect(content).toContain('import { t, type SupportedLocale }');
            expect(content).toContain('lib/i18n');
        });

        it('should import toDestinationCardProps from transforms', () => {
            expect(content).toContain('toDestinationCardProps');
            expect(content).toContain('lib/api/transforms');
        });

        it('should import DestinationPublic type from schemas', () => {
            expect(content).toContain('import type { DestinationPublic }');
            expect(content).toContain('@repo/schemas');
        });
    });

    describe('Props', () => {
        it('should define Props interface with optional locale', () => {
            expect(content).toContain('interface Props');
            expect(content).toContain('locale?: SupportedLocale');
        });

        it('should destructure locale from Astro.props with es default', () => {
            expect(content).toContain('locale = "es"');
            expect(content).toContain('Astro.props');
        });
    });

    describe('FEATURED_DESTINATION_TYPE constant', () => {
        it('should define the constant as CITY', () => {
            expect(content).toContain('const FEATURED_DESTINATION_TYPE = "CITY" as const');
        });

        it('should use the constant in the API call', () => {
            expect(content).toContain('destinationType: FEATURED_DESTINATION_TYPE');
        });
    });

    describe('API call', () => {
        it('should call destinationsApi.list', () => {
            expect(content).toContain('destinationsApi.list(');
        });

        it('should request exactly 8 items via pageSize', () => {
            expect(content).toContain('pageSize: 8');
        });

        it('should not filter by isFeatured', () => {
            expect(content).not.toMatch(/destinationsApi\.list\([^)]*isFeatured/);
        });

        it('should include event count in request', () => {
            expect(content).toContain('includeEventCount: true');
        });

        it('should await the API call', () => {
            expect(content).toContain('await destinationsApi.list(');
        });

        it('should handle failed result with empty array fallback', () => {
            expect(content).toContain('result.ok');
            expect(content).toContain('result.data.items');
            expect(content).toMatch(/result\.ok\s*\?\s*result\.data\.items\s*:\s*\[\]/);
        });
    });

    describe('DestinationWithEventCount interface', () => {
        it('should define interface extending DestinationPublic', () => {
            expect(content).toContain(
                'interface DestinationWithEventCount extends DestinationPublic'
            );
        });

        it('should include optional eventsCount field', () => {
            expect(content).toContain('readonly eventsCount?: number');
        });
    });

    describe('Card data mapping', () => {
        it('should map API response to destinationCards using toDestinationCardProps', () => {
            expect(content).toContain('const destinationCards = destinations.map(');
            expect(content).toContain('toDestinationCardProps');
        });
    });

    describe('Client-side sorting', () => {
        it('should sort featured destinations first', () => {
            expect(content).toContain('a.isFeatured');
            expect(content).toContain('b.isFeatured');
        });

        it('should use averageRating as secondary sort', () => {
            expect(content).toContain('b.averageRating');
            expect(content).toContain('a.averageRating');
        });
    });

    describe('Uniform card layout', () => {
        it('should not have hero card selection logic', () => {
            expect(content).not.toContain('const featuredCard');
            expect(content).not.toContain('const regularCards');
        });

        it('should not use col-span-2 or row-span-2', () => {
            expect(content).not.toContain('col-span-2');
            expect(content).not.toContain('row-span-2');
        });
    });

    describe('Preview and map data', () => {
        it('should build previewDestinations from all destinationCards', () => {
            expect(content).toContain('const previewDestinations = destinationCards.map(');
        });

        it('should include slug, name, summary, path, gallery and ratingDimensions in preview', () => {
            expect(content).toContain('slug: d.slug');
            expect(content).toContain('name: d.name');
            expect(content).toContain('summary: d.summary');
            expect(content).toContain('path: d.path');
            expect(content).toContain('gallery: d.gallery');
            expect(content).toContain('ratingDimensions: d.ratingDimensions');
        });

        it('should build mapDestinations from all destinationCards', () => {
            expect(content).toContain('const mapDestinations = destinationCards.map(');
        });

        it('should include slug, name and coordinates in map destinations', () => {
            expect(content).toContain('coordinates: d.coordinates');
        });
    });

    describe('i18n usage', () => {
        it('should call t() for empty state title', () => {
            expect(content).toContain('namespace: "destinations"');
            expect(content).toContain('key: "emptyTitle"');
        });

        it('should call t() for empty state message', () => {
            expect(content).toContain('key: "emptyMessage"');
        });

        it('should provide Spanish fallback for empty title', () => {
            expect(content).toContain('fallback: "No hay destinos disponibles"');
        });

        it('should provide Spanish fallback for empty message', () => {
            expect(content).toContain('fallback: "Pronto agregaremos destinos."');
        });

        it('should pass locale to t() calls', () => {
            expect(content).toContain('locale, namespace:');
        });
    });

    describe('Conditional rendering', () => {
        it('should render content only when destinationCards has items', () => {
            expect(content).toContain('destinationCards.length > 0');
        });

        it('should wrap both layouts in a Fragment', () => {
            expect(content).toContain('<Fragment>');
        });

        it('should render EmptyState when no destinations', () => {
            expect(content).toContain('<EmptyState');
        });

        it('should pass emptyTitle to EmptyState title prop', () => {
            expect(content).toContain('title={emptyTitle}');
        });

        it('should pass emptyMsg to EmptyState message prop', () => {
            expect(content).toContain('message={emptyMsg}');
        });
    });

    describe('Mobile layout (carousel)', () => {
        it('should hide mobile layout on sm and above', () => {
            expect(content).toContain('class="sm:hidden"');
        });

        it('should use DestinationCarousel in mobile layout', () => {
            expect(content).toContain('<DestinationCarousel');
        });

        it('should pass destinationCards count to carousel', () => {
            expect(content).toContain('count={destinationCards.length}');
        });

        it('should pass locale to DestinationCarousel', () => {
            expect(content).toMatch(/<DestinationCarousel[^>]+locale={locale}/);
        });

        it('should render all cards uniformly as DestinationCard in carousel', () => {
            expect(content).toContain('<DestinationCard');
        });

        it('should apply snap-start class to cards in carousel', () => {
            expect(content).toContain('class="snap-start"');
        });
    });

    describe('Desktop layout (uniform grid)', () => {
        it('should hide desktop layout below sm breakpoint', () => {
            expect(content).toContain('class="hidden sm:block"');
        });

        it('should use flex container with gap-5 for grid and sidebar', () => {
            expect(content).toContain('class="flex gap-5"');
        });

        it('should apply destinations-grid class to the grid', () => {
            expect(content).toContain('destinations-grid');
        });

        it('should use a 2-column base grid', () => {
            expect(content).toContain('grid-cols-2');
        });

        it('should use 3-column grid on large screens', () => {
            expect(content).toContain('lg:grid-cols-3');
        });

        it('should use 3-column grid on extra-large screens', () => {
            expect(content).toContain('xl:grid-cols-3');
        });

        it('should include data-scroll-reveal attribute on grid', () => {
            expect(content).toContain('data-scroll-reveal');
        });

        it('should have gap-4 on default and gap-5 on large screens', () => {
            expect(content).toContain('gap-4');
            expect(content).toContain('lg:gap-5');
        });

        it('should wrap cards in a flex-1 min-w-0 container', () => {
            expect(content).toContain('class="min-w-0 flex-1"');
        });
    });

    describe('Stagger animations', () => {
        it('should apply scroll-reveal-stagger base class to card wrappers', () => {
            expect(content).toContain('"scroll-reveal-stagger"');
        });

        it('should generate indexed stagger delay class starting from 1', () => {
            expect(content).toContain('`scroll-reveal-stagger-${i + 1}`');
        });

        it('should use class:list directive for dynamic stagger classes', () => {
            expect(content).toContain('class:list={[');
        });

        it('should apply stagger-9 to LitoralMap sidebar', () => {
            expect(content).toContain('scroll-reveal-stagger-9');
        });
    });

    describe('Map sidebar', () => {
        it('should render LitoralMap component', () => {
            expect(content).toContain('<LitoralMap');
        });

        it('should pass mapDestinations to LitoralMap', () => {
            expect(content).toContain('destinations={mapDestinations}');
        });

        it('should apply w-100 width constraint to LitoralMap', () => {
            expect(content).toContain('w-100');
        });

        it('should apply shrink-0 to prevent LitoralMap from shrinking', () => {
            expect(content).toContain('shrink-0');
        });

        it('should pass locale to LitoralMap', () => {
            expect(content).toMatch(/<LitoralMap[\s\S]*?locale={locale}/);
        });
    });

    describe('Preview panel', () => {
        it('should render DestinationPreview component', () => {
            expect(content).toContain('<DestinationPreview');
        });

        it('should pass previewDestinations to DestinationPreview', () => {
            expect(content).toContain('destinations={previewDestinations}');
        });

        it('should pass locale to DestinationPreview', () => {
            expect(content).toMatch(/<DestinationPreview[\s\S]*?locale={locale}/);
        });

        it('should place DestinationPreview inside the desktop-only block', () => {
            const desktopBlockStart = content.indexOf('hidden sm:block');
            const previewStart = content.indexOf('<DestinationPreview');
            expect(desktopBlockStart).toBeGreaterThan(-1);
            expect(previewStart).toBeGreaterThan(desktopBlockStart);
        });
    });

    describe('locale propagation', () => {
        it('should pass locale to DestinationCarousel', () => {
            expect(content).toMatch(/DestinationCarousel[\s\S]*?locale={locale}/);
        });

        it('should pass locale to DestinationCard instances', () => {
            const cardMatches = content.match(/DestinationCard\b/g) ?? [];
            expect(cardMatches.length).toBeGreaterThanOrEqual(2);
            expect(content).toMatch(/DestinationCard[\s\S]*?locale={locale}/);
        });

        it('should pass locale to LitoralMap', () => {
            expect(content).toMatch(/LitoralMap[\s\S]*?locale={locale}/);
        });

        it('should pass locale to DestinationPreview', () => {
            expect(content).toMatch(/DestinationPreview[\s\S]*?locale={locale}/);
        });
    });
});
