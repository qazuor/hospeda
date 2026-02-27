import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/destination/DestinationCard.astro'
);
const content = readFileSync(componentPath, 'utf8');

/** Shared types file that DestinationCard imports from */
const typesPath = resolve(
    __dirname,
    '../../../src/components/destination/destination-card.types.ts'
);
const typesContent = readFileSync(typesPath, 'utf8');

describe('DestinationCard.astro', () => {
    describe('Props', () => {
        it('should accept destination prop with DestinationCardData type', () => {
            expect(content).toContain('destination: DestinationCardData');
        });

        it('should accept optional locale prop with SupportedLocale type', () => {
            expect(content).toContain('locale?: SupportedLocale');
        });

        it('should accept maxAttractions prop', () => {
            expect(content).toContain('maxAttractions');
        });

        it('should re-export DestinationCardData type', () => {
            expect(content).toContain('export type { DestinationCardData }');
        });
    });

    describe('Shared types file', () => {
        it('should define DestinationCardData interface', () => {
            expect(typesContent).toContain('interface DestinationCardData');
        });

        it('should support optional path for hierarchy', () => {
            expect(typesContent).toContain('path?: string');
        });

        it('should support averageRating field', () => {
            expect(typesContent).toContain('averageRating?: number');
        });

        it('should support eventsCount field', () => {
            expect(typesContent).toContain('eventsCount?: number');
        });

        it('should support attractions field with icon', () => {
            expect(typesContent).toContain('attractions?: ReadonlyArray');
            expect(typesContent).toContain('readonly icon?: string');
        });

        it('should support gallery field for preview component', () => {
            expect(typesContent).toContain('gallery?: ReadonlyArray');
        });

        it('should support coordinates field for map component', () => {
            expect(typesContent).toContain('coordinates?');
        });

        it('should support ratingDimensions field for preview component', () => {
            expect(typesContent).toContain('ratingDimensions?: Readonly<Record<string, number>>');
        });

        it('should have computeCardText function', () => {
            expect(typesContent).toContain('function computeCardText');
        });

        it('should use i18n for accommodation counter text', () => {
            expect(typesContent).toContain('featured.card.accommodationSingular');
            expect(typesContent).toContain('featured.card.accommodationPlural');
        });

        it('should use i18n for event counter text', () => {
            expect(typesContent).toContain('featured.card.eventSingular');
            expect(typesContent).toContain('featured.card.eventPlural');
        });
    });

    describe('Glassmorphism info bar', () => {
        it('should use glass-bar class', () => {
            expect(content).toContain('glass-bar');
        });

        it('should position glass bar at the bottom', () => {
            expect(content).toContain('absolute bottom-0');
        });

        it('should display destination name', () => {
            expect(content).toContain('destination.name');
        });
    });

    describe('Star rating', () => {
        it('should import StarRating component', () => {
            expect(content).toContain('import StarRating from "../ui/StarRating.astro"');
        });

        it('should conditionally render StarRating when averageRating > 0', () => {
            expect(content).toContain('averageRating');
            expect(content).toContain('<StarRating');
        });
    });

    describe('Enriched counter', () => {
        it('should import AccommodationIcon', () => {
            expect(content).toContain('AccommodationIcon');
        });

        it('should import CalendarIcon for events', () => {
            expect(content).toContain('CalendarIcon');
        });

        it('should conditionally show events counter when evtCount > 0', () => {
            expect(content).toContain('evtCount > 0');
        });

        it('should use computeCardText for i18n text', () => {
            expect(content).toContain('computeCardText');
        });
    });

    describe('Attraction icon badges', () => {
        it('should import resolveIcon from @repo/icons', () => {
            expect(content).toContain('resolveIcon');
        });

        it('should import LocationIcon as fallback', () => {
            expect(content).toContain('LocationIcon');
            expect(content).toContain('FallbackIcon');
        });

        it('should use dest-attraction-badge class for icon badges', () => {
            expect(content).toContain('dest-attraction-badge');
        });

        it('should render data-tooltip with attraction name', () => {
            expect(content).toContain('data-tooltip={attraction.name}');
        });

        it('should resolve icon via resolveIcon', () => {
            expect(content).toContain('resolveIcon({ iconName: attraction.icon })');
        });

        it('should fallback to LocationIcon when no icon', () => {
            expect(content).toContain('FallbackIcon');
        });

        it('should set aria-label for accessibility', () => {
            expect(content).toContain('aria-label={attraction.name}');
        });

        it('should set role="img" on badge', () => {
            expect(content).toContain('role="img"');
        });

        it('should limit badges via maxAttractions', () => {
            expect(content).toContain('slice(0, maxAttractions)');
        });

        it('should hide badges when no attractions', () => {
            expect(content).toContain('visibleAttractions.length > 0');
        });

        it('should show overflow count when attractions exceed max', () => {
            expect(content).toContain('extraAttractionCount');
        });
    });

    describe('Torn-edge aesthetic', () => {
        it('should use card-tilt class for hover effect', () => {
            expect(content).toContain('card-tilt');
        });

        it('should use torn-edge-mask class for image wrapper', () => {
            expect(content).toContain('torn-edge-mask');
        });

        it('should use font-serif on title', () => {
            expect(content).toContain('font-serif');
        });

        it('should use lighter gradient overlay', () => {
            expect(content).toContain('from-black/50');
        });

        it('should render title below image', () => {
            expect(content).toContain('px-1 pt-2.5 pb-1');
        });

        it('should scale image on hover', () => {
            expect(content).toContain('group-hover:scale-105');
        });
    });

    describe('Performance', () => {
        it('should have will-change-transform on image', () => {
            expect(content).toContain('will-change-transform');
        });

        it('should have explicit width and height', () => {
            expect(content).toContain('"640"');
            expect(content).toContain('"360"');
        });
    });

    describe('Structure', () => {
        it('should use article element', () => {
            expect(content).toContain('<article');
        });

        it('should render image with alt text', () => {
            expect(content).toContain('<img');
            expect(content).toContain('alt=');
        });

        it('should preserve transition:name for view transitions', () => {
            expect(content).toContain('transition:name=');
        });

        it('should set data-destination-slug for preview interaction', () => {
            expect(content).toContain('data-destination-slug');
        });
    });

    describe('Gradient overlay', () => {
        it('should render gradient overlay', () => {
            expect(content).toContain('bg-gradient-to-t');
        });
    });

    describe('Accessibility', () => {
        it('should hide decorative elements', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('File integrity', () => {
        it('should be a non-empty readable file', () => {
            expect(content.length).toBeGreaterThan(0);
        });

        it('should contain valid Astro frontmatter', () => {
            expect(content).toMatch(/^---/);
        });

        it('should have import statements', () => {
            const imports = content.match(/^import .+from .+;?$/gm) ?? [];
            expect(imports.length).toBeGreaterThan(0);
        });
    });
});
