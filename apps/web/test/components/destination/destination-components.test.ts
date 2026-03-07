/**
 * @file destination-components.test.ts
 * @description Source-level tests for destination display components.
 *
 * Covers:
 *  - DestinationCard.client.tsx
 *  - DestinationCarousel.astro
 *  - DestinationFilterPanel.client.tsx
 *  - DestinationPreview.astro
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ─── Resolve source paths ─────────────────────────────────────────────────────

const DEST_DIR = resolve(__dirname, '../../../src/components/destination');

const destinationCard = readFileSync(resolve(DEST_DIR, 'DestinationCard.client.tsx'), 'utf8');

const destinationCarousel = readFileSync(resolve(DEST_DIR, 'DestinationCarousel.astro'), 'utf8');

const destinationFilterPanel = readFileSync(
    resolve(DEST_DIR, 'DestinationFilterPanel.client.tsx'),
    'utf8'
);

const destinationPreview = readFileSync(resolve(DEST_DIR, 'DestinationPreview.astro'), 'utf8');

// ─── DestinationCard.client ───────────────────────────────────────────────────

describe('DestinationCard.client.tsx', () => {
    describe('Exports', () => {
        it('should use named export for DestinationCardClient', () => {
            expect(destinationCard).toContain('export function DestinationCardClient');
        });

        it('should export DestinationAttraction interface', () => {
            expect(destinationCard).toContain('export interface DestinationAttraction');
        });

        it('should export DestinationItem interface', () => {
            expect(destinationCard).toContain('export interface DestinationItem');
        });

        it('should export CardLabels interface', () => {
            expect(destinationCard).toContain('export interface CardLabels');
        });

        it('should export DestinationCardClientProps interface', () => {
            expect(destinationCard).toContain('export interface DestinationCardClientProps');
        });
    });

    describe('Props contract with readonly', () => {
        it('should define destination prop as readonly', () => {
            expect(destinationCard).toContain('readonly destination: DestinationItem');
        });

        it('should define locale prop as readonly string', () => {
            expect(destinationCard).toContain('readonly locale: string');
        });

        it('should define labels prop as readonly', () => {
            expect(destinationCard).toContain('readonly labels: CardLabels');
        });

        it('should use readonly on DestinationItem fields', () => {
            expect(destinationCard).toContain('readonly id: string');
            expect(destinationCard).toContain('readonly slug: string');
            expect(destinationCard).toContain('readonly name: string');
        });
    });

    describe('i18n', () => {
        it('should import useTranslation hook', () => {
            expect(destinationCard).toContain("from '../../hooks/useTranslation'");
        });

        it('should use destinations namespace', () => {
            expect(destinationCard).toContain("namespace: 'destinations'");
        });

        it('should receive locale as a prop', () => {
            expect(destinationCard).toContain('locale: locale as SupportedLocale');
        });
    });

    describe('Locale-aware URL generation', () => {
        it('should build the detail URL using the locale param', () => {
            expect(destinationCard).toContain('`/${locale}/destinos/');
        });
    });

    describe('Semantic color tokens', () => {
        it('should use bg-card for card background', () => {
            expect(destinationCard).toContain('bg-card');
        });

        it('should use text-foreground for main text', () => {
            expect(destinationCard).toContain('text-foreground');
        });

        it('should use text-muted-foreground for secondary text', () => {
            expect(destinationCard).toContain('text-muted-foreground');
        });

        it('should use bg-accent for featured badge', () => {
            expect(destinationCard).toContain('bg-accent');
        });

        it('should use text-primary for attraction badge icons', () => {
            expect(destinationCard).toContain('text-primary');
        });

        it('should not contain hardcoded hex colors', () => {
            expect(destinationCard).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
    });

    describe('Accessibility', () => {
        it('should use article element as the card root', () => {
            expect(destinationCard).toContain('<article');
        });

        it('should add aria-label to attraction badge spans', () => {
            expect(destinationCard).toContain('aria-label={attraction.name}');
        });

        it('should use role="img" on attraction badge spans', () => {
            expect(destinationCard).toContain('role="img"');
        });

        it('should set aria-hidden on attraction icons', () => {
            expect(destinationCard).toContain('aria-hidden="true"');
        });

        it('should use loading="lazy" on card image', () => {
            expect(destinationCard).toContain('loading="lazy"');
        });
    });

    describe('Attraction sorting', () => {
        it('should sort attractions by displayWeight DESC', () => {
            expect(destinationCard).toContain('(b.displayWeight ?? 50) - (a.displayWeight ?? 50)');
        });

        it('should cap visible attractions at MAX_ATTRACTIONS', () => {
            expect(destinationCard).toContain('MAX_ATTRACTIONS');
            expect(destinationCard).toContain('const MAX_ATTRACTIONS = 3');
        });

        it('should show extra count badge when attractions exceed max', () => {
            expect(destinationCard).toContain('extraAttractionCount');
        });
    });

    describe('Image fallback chain', () => {
        it('should fall back through media, featuredImage, heroImage to placeholder', () => {
            expect(destinationCard).toContain('destination.featuredImage');
            expect(destinationCard).toContain('destination.heroImage');
            expect(destinationCard).toContain('/images/placeholder-destination.svg');
        });
    });
});

// ─── DestinationCarousel.astro ────────────────────────────────────────────────

describe('DestinationCarousel.astro', () => {
    describe('Props contract', () => {
        it('should define count prop', () => {
            expect(destinationCarousel).toContain('count:');
        });

        it('should define optional locale prop defaulting to "es"', () => {
            expect(destinationCarousel).toContain("locale = 'es'");
        });

        it('should define optional class prop', () => {
            expect(destinationCarousel).toContain('class?:');
        });
    });

    describe('i18n', () => {
        it('should import createT for translations', () => {
            expect(destinationCarousel).toContain('createT');
        });

        it('should use translation key for carousel label', () => {
            expect(destinationCarousel).toContain('destinations.featured.carousel.label');
        });

        it('should use translation key for progress label', () => {
            expect(destinationCarousel).toContain('destinations.featured.carousel.progressLabel');
        });
    });

    describe('Accessibility', () => {
        it('should use role="region" on the root element', () => {
            expect(destinationCarousel).toContain('role="region"');
        });

        it('should have aria-label on the region', () => {
            expect(destinationCarousel).toContain('aria-label={carouselLabel}');
        });

        it('should use aria-roledescription="carousel"', () => {
            expect(destinationCarousel).toContain('aria-roledescription="carousel"');
        });

        it('should render progress bar with role="progressbar"', () => {
            expect(destinationCarousel).toContain('role="progressbar"');
        });

        it('should include aria-valuemin, aria-valuemax, aria-valuenow on progressbar', () => {
            expect(destinationCarousel).toContain('aria-valuemin={0}');
            expect(destinationCarousel).toContain('aria-valuemax={100}');
            expect(destinationCarousel).toContain('aria-valuenow={initialWidth}');
        });

        it('should use aria-hidden on decorative fade gradients', () => {
            expect(destinationCarousel).toContain('aria-hidden="true"');
        });
    });

    describe('Progress bar initialization', () => {
        it('should compute initialWidth from count', () => {
            expect(destinationCarousel).toContain('Math.round(100 / count)');
        });

        it('should only render progress bar when count > 1', () => {
            expect(destinationCarousel).toContain('{count > 1 && (');
        });
    });

    describe('Semantic color tokens', () => {
        it('should use bg-border for the progress track', () => {
            expect(destinationCarousel).toContain('bg-border');
        });

        it('should use bg-primary for the progress fill', () => {
            expect(destinationCarousel).toContain('bg-primary');
        });

        it('should use bg-background for edge fade gradients', () => {
            expect(destinationCarousel).toContain('from-background');
        });

        it('should not contain hardcoded hex colors', () => {
            expect(destinationCarousel).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
    });

    describe('Keyboard navigation', () => {
        it('should import resolveKeyboardNavigation utility', () => {
            expect(destinationCarousel).toContain('resolveKeyboardNavigation');
        });

        it('should handle keydown events on the carousel', () => {
            expect(destinationCarousel).toContain("'keydown'");
        });
    });

    describe('Lifecycle hooks', () => {
        it('should re-initialize on astro:page-load', () => {
            expect(destinationCarousel).toContain('astro:page-load');
        });

        it('should clean up on astro:before-swap', () => {
            expect(destinationCarousel).toContain('astro:before-swap');
        });
    });
});

// ─── DestinationFilterPanel.client ───────────────────────────────────────────

describe('DestinationFilterPanel.client.tsx', () => {
    describe('Exports', () => {
        it('should use named export for DestinationFilterPanel', () => {
            expect(destinationFilterPanel).toContain('export function DestinationFilterPanel');
        });

        it('should export DestinationFilterPanelProps interface', () => {
            expect(destinationFilterPanel).toContain(
                'export interface DestinationFilterPanelProps'
            );
        });

        it('should export DESTINATION_TYPES constant', () => {
            expect(destinationFilterPanel).toContain('export const DESTINATION_TYPES');
        });

        it('should export DestinationType type alias', () => {
            expect(destinationFilterPanel).toContain('export type DestinationType');
        });
    });

    describe('Props contract with readonly', () => {
        it('should define query as readonly string', () => {
            expect(destinationFilterPanel).toContain('readonly query: string');
        });

        it('should define onQueryChange as readonly callback', () => {
            expect(destinationFilterPanel).toContain(
                'readonly onQueryChange: (value: string) => void'
            );
        });

        it('should define selectedType as readonly string', () => {
            expect(destinationFilterPanel).toContain('readonly selectedType: string');
        });

        it('should define onTypeChange as readonly callback', () => {
            expect(destinationFilterPanel).toContain(
                'readonly onTypeChange: (value: string) => void'
            );
        });

        it('should define hasActiveFilters as readonly boolean', () => {
            expect(destinationFilterPanel).toContain('readonly hasActiveFilters: boolean');
        });

        it('should define showParentFilter as readonly boolean', () => {
            expect(destinationFilterPanel).toContain('readonly showParentFilter: boolean');
        });

        it('should define isLoadingParents as readonly boolean', () => {
            expect(destinationFilterPanel).toContain('readonly isLoadingParents: boolean');
        });

        it('should define parentError as readonly boolean', () => {
            expect(destinationFilterPanel).toContain('readonly parentError: boolean');
        });

        it('should define t as translation function prop', () => {
            expect(destinationFilterPanel).toContain('readonly t: (key: string');
        });
    });

    describe('DESTINATION_TYPES constant', () => {
        it('should include COUNTRY type', () => {
            expect(destinationFilterPanel).toContain("'COUNTRY'");
        });

        it('should include REGION type', () => {
            expect(destinationFilterPanel).toContain("'REGION'");
        });

        it('should include PROVINCE type', () => {
            expect(destinationFilterPanel).toContain("'PROVINCE'");
        });

        it('should include DEPARTMENT type', () => {
            expect(destinationFilterPanel).toContain("'DEPARTMENT'");
        });

        it('should include CITY type', () => {
            expect(destinationFilterPanel).toContain("'CITY'");
        });

        it('should include TOWN type', () => {
            expect(destinationFilterPanel).toContain("'TOWN'");
        });

        it('should include NEIGHBORHOOD type', () => {
            expect(destinationFilterPanel).toContain("'NEIGHBORHOOD'");
        });
    });

    describe('Semantic color tokens', () => {
        it('should use bg-card for panel background', () => {
            expect(destinationFilterPanel).toContain('bg-card');
        });

        it('should use border-border on inputs and selects', () => {
            expect(destinationFilterPanel).toContain('border-border');
        });

        it('should use bg-primary for search button', () => {
            expect(destinationFilterPanel).toContain('bg-primary');
        });

        it('should use text-primary-foreground on search button text', () => {
            expect(destinationFilterPanel).toContain('text-primary-foreground');
        });

        it('should use text-muted-foreground for labels', () => {
            expect(destinationFilterPanel).toContain('text-muted-foreground');
        });

        it('should not contain hardcoded hex colors', () => {
            expect(destinationFilterPanel).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
    });

    describe('Accessibility', () => {
        it('should use a sr-only label for the search input', () => {
            expect(destinationFilterPanel).toContain('sr-only');
        });

        it('should associate the type select with a label via htmlFor', () => {
            expect(destinationFilterPanel).toContain('htmlFor="destination-type-filter"');
        });

        it('should associate the parent select with a label via htmlFor', () => {
            expect(destinationFilterPanel).toContain('htmlFor="destination-parent-filter"');
        });

        it('should disable the parent select when loading or error state', () => {
            expect(destinationFilterPanel).toContain('disabled={isLoadingParents || parentError}');
        });

        it('should apply aria-label on the search submit button', () => {
            expect(destinationFilterPanel).toContain("aria-label={t('search.button')}");
        });
    });

    describe('Conditional rendering', () => {
        it('should show parent filter only when showParentFilter is true', () => {
            expect(destinationFilterPanel).toContain('{showParentFilter && (');
        });

        it('should show clear filters button only when hasActiveFilters is true', () => {
            expect(destinationFilterPanel).toContain('{hasActiveFilters && (');
        });
    });
});

// ─── DestinationPreview.astro ─────────────────────────────────────────────────

describe('DestinationPreview.astro', () => {
    describe('Props contract', () => {
        it('should define destinations as ReadonlyArray of PreviewData', () => {
            expect(destinationPreview).toContain('destinations: ReadonlyArray<PreviewData>');
        });

        it('should define optional locale prop defaulting to "es"', () => {
            expect(destinationPreview).toContain("locale = 'es'");
        });

        it('should define optional class prop', () => {
            expect(destinationPreview).toContain('class?:');
        });
    });

    describe('i18n', () => {
        it('should import createT for translations', () => {
            expect(destinationPreview).toContain('createT');
        });

        it('should use translation key for gallery label', () => {
            expect(destinationPreview).toContain('destinations.featured.preview.gallery');
        });

        it('should use translation key for ratings label', () => {
            expect(destinationPreview).toContain('destinations.featured.preview.topRatings');
        });

        it('should use translation key for CTA label', () => {
            expect(destinationPreview).toContain(
                'destinations.featured.preview.viewAccommodations'
            );
        });
    });

    describe('Locale-aware URL generation', () => {
        it('should build detail URL with locale prefix', () => {
            expect(destinationPreview).toContain('`/${locale}/destinos/');
        });
    });

    describe('Accessibility', () => {
        it('should use inert attribute on the container by default', () => {
            expect(destinationPreview).toContain('inert');
        });

        it('should use role="meter" for rating dimension bars', () => {
            expect(destinationPreview).toContain('role="meter"');
        });

        it('should include aria-valuenow, aria-valuemin, aria-valuemax on meters', () => {
            expect(destinationPreview).toContain('aria-valuenow={val}');
            expect(destinationPreview).toContain('aria-valuemin={0}');
            expect(destinationPreview).toContain('aria-valuemax={5}');
        });

        it('should add aria-label on each meter', () => {
            expect(destinationPreview).toContain('aria-label={labels[key] ?? key}');
        });

        it('should use loading="lazy" on gallery images', () => {
            expect(destinationPreview).toContain('loading="lazy"');
        });

        it('should use focus-visible outline on CTA link', () => {
            expect(destinationPreview).toContain('focus-visible:outline');
        });
    });

    describe('Semantic color tokens', () => {
        it('should use bg-surface for preview panel background', () => {
            expect(destinationPreview).toContain('bg-surface');
        });

        it('should use border-border for preview panel border', () => {
            expect(destinationPreview).toContain('border-border');
        });

        it('should use bg-primary for CTA button', () => {
            expect(destinationPreview).toContain('bg-primary');
        });

        it('should use text-primary-foreground on CTA text', () => {
            expect(destinationPreview).toContain('text-primary-foreground');
        });

        it('should use text-text-secondary for summary text', () => {
            expect(destinationPreview).toContain('text-text-secondary');
        });

        it('should not contain hardcoded hex colors', () => {
            expect(destinationPreview).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
    });

    describe('Gallery and rating rendering', () => {
        it('should limit gallery thumbnails to 3', () => {
            expect(destinationPreview).toContain('.slice(0, 3)');
        });

        it('should limit top rating dimensions to 4', () => {
            expect(destinationPreview).toContain('.slice(0, 4)');
        });

        it('should filter rating dimensions with val > 0', () => {
            expect(destinationPreview).toContain('val > 0');
        });

        it('should sort rating dimensions descending', () => {
            expect(destinationPreview).toContain('.sort(([, a], [, b]) => b - a)');
        });
    });

    describe('Lifecycle / JS behavior', () => {
        it('should import calculatePreviewPosition utility', () => {
            expect(destinationPreview).toContain('calculatePreviewPosition');
        });

        it('should re-initialize on astro:page-load', () => {
            expect(destinationPreview).toContain('astro:page-load');
        });

        it('should clean up on astro:before-swap', () => {
            expect(destinationPreview).toContain('astro:before-swap');
        });

        it('should only activate on desktop (lg breakpoint)', () => {
            expect(destinationPreview).toContain('min-width: 1024px');
        });

        it('should respect prefers-reduced-motion', () => {
            expect(destinationPreview).toContain('prefers-reduced-motion');
        });

        it('should show preview after delay to avoid flicker', () => {
            expect(destinationPreview).toContain('setTimeout');
        });
    });
});

// ─── StarsDisplay.astro ───────────────────────────────────────────────────────

const starsDisplay = readFileSync(resolve(DEST_DIR, '../shared/StarsDisplay.astro'), 'utf8');

describe('StarsDisplay.astro', () => {
    describe('Props contract', () => {
        it('should define count as a required readonly number prop', () => {
            expect(starsDisplay).toContain('readonly count: number');
        });

        it('should define max as an optional readonly number prop defaulting to 5', () => {
            expect(starsDisplay).toContain('readonly max?');
            expect(starsDisplay).toContain('max = 5');
        });

        it('should define size as an optional readonly "sm" | "md" prop', () => {
            expect(starsDisplay).toContain('readonly size?');
            expect(starsDisplay).toContain('"sm" | "md"');
        });

        it('should default size to "sm"', () => {
            expect(starsDisplay).toContain('size = "sm"');
        });
    });

    describe('Star icon rendering', () => {
        it('should import StarIcon from @repo/icons', () => {
            expect(starsDisplay).toContain('StarIcon');
            expect(starsDisplay).toContain('@repo/icons');
        });

        it('should use "fill" weight for filled stars', () => {
            expect(starsDisplay).toContain('"fill"');
        });

        it('should use "duotone" weight for unfilled stars', () => {
            expect(starsDisplay).toContain('"duotone"');
        });

        it('should compute iconSize: 16 for sm, 20 for md', () => {
            expect(starsDisplay).toContain('iconSize');
            expect(starsDisplay).toContain('16');
            expect(starsDisplay).toContain('20');
        });
    });

    describe('Semantic color tokens', () => {
        it('should use text-accent for filled stars', () => {
            expect(starsDisplay).toContain('text-accent');
        });

        it('should use text-muted for unfilled stars', () => {
            expect(starsDisplay).toContain('text-muted');
        });

        it('should not contain hardcoded hex colors', () => {
            expect(starsDisplay).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
    });

    describe('Layout', () => {
        it('should render stars in a flex container', () => {
            expect(starsDisplay).toContain('<div class="flex');
        });

        it('should use gap-0.5 for tight spacing between stars', () => {
            expect(starsDisplay).toContain('gap-0.5');
        });

        it('should use Array.from to iterate over max stars', () => {
            expect(starsDisplay).toContain('Array.from({ length: max })');
        });
    });
});

// ─── DestinationCarousel.astro - additional CSS snap scroll and glassmorphism ─

describe('DestinationCarousel.astro - CSS snap scroll and visual details', () => {
    describe('Scroll snap classes', () => {
        it('should use snap-x for horizontal snap axis', () => {
            expect(destinationCarousel).toContain('snap-x');
        });

        it('should use snap-mandatory for strict snap behavior', () => {
            expect(destinationCarousel).toContain('snap-mandatory');
        });

        it('should use overflow-x-auto to enable horizontal scrolling', () => {
            expect(destinationCarousel).toContain('overflow-x-auto');
        });

        it('should use scroll-snap-align: start in per-card CSS', () => {
            expect(destinationCarousel).toContain('scroll-snap-align: start');
        });

        it('should render cards at ~85% viewport width for peek effect', () => {
            expect(destinationCarousel).toContain('85%');
        });
    });

    describe('Edge fade gradients', () => {
        it('should use bg-gradient-to-r for the left fade', () => {
            expect(destinationCarousel).toContain('bg-gradient-to-r');
        });

        it('should use bg-gradient-to-l for the right fade', () => {
            expect(destinationCarousel).toContain('bg-gradient-to-l');
        });

        it('should use from-background for gradient start color', () => {
            expect(destinationCarousel).toContain('from-background');
        });

        it('should use to-transparent for gradient end color', () => {
            expect(destinationCarousel).toContain('to-transparent');
        });
    });

    describe('Scrollbar hiding', () => {
        it('should apply scrollbar-none utility class', () => {
            expect(destinationCarousel).toContain('scrollbar-none');
        });

        it('should set scrollbar-width: none in CSS for Firefox', () => {
            expect(destinationCarousel).toContain('scrollbar-width: none');
        });

        it('should use ::-webkit-scrollbar display:none for Chrome/Safari', () => {
            expect(destinationCarousel).toContain('::-webkit-scrollbar');
        });
    });

    describe('Debounced scroll handler', () => {
        it('should debounce the scroll update with setTimeout at 50ms', () => {
            expect(destinationCarousel).toContain('setTimeout');
            expect(destinationCarousel).toContain('50');
        });

        it('should clear timeout on new scroll events', () => {
            expect(destinationCarousel).toContain('clearTimeout');
        });
    });
});

// ─── DestinationPreview.astro - additional position and glassmorphism tests ───

describe('DestinationPreview.astro - position calculation and visual classes', () => {
    describe('Position calculation', () => {
        it('should use position: fixed for runtime panel positioning', () => {
            expect(destinationPreview).toContain('position: fixed');
        });

        it('should apply calculatePreviewPosition result to style.cssText', () => {
            expect(destinationPreview).toContain('style.cssText');
        });

        it('should pass triggerRect, previewWidth, previewHeight to calculatePreviewPosition', () => {
            expect(destinationPreview).toContain('triggerRect');
            expect(destinationPreview).toContain('previewWidth');
            expect(destinationPreview).toContain('previewHeight');
        });

        it('should include viewportWidth and viewportHeight in the position call', () => {
            expect(destinationPreview).toContain('viewportWidth');
            expect(destinationPreview).toContain('viewportHeight');
        });
    });

    describe('Glassmorphism and visual effects', () => {
        it('should apply shadow-xl for elevated card shadow', () => {
            expect(destinationPreview).toContain('shadow-xl');
        });

        it('should use rounded-xl for rounded preview panel corners', () => {
            expect(destinationPreview).toContain('rounded-xl');
        });

        it('should use opacity-0 as the hidden state class', () => {
            expect(destinationPreview).toContain('opacity-0');
        });

        it('should transition to opacity-100 when a preview is shown', () => {
            expect(destinationPreview).toContain('opacity-100');
        });

        it('should use transition-all duration-200 for smooth visibility changes', () => {
            expect(destinationPreview).toContain('transition-all');
            expect(destinationPreview).toContain('duration-200');
        });

        it('should use pointer-events-none when hidden to prevent interaction', () => {
            expect(destinationPreview).toContain('pointer-events-none');
        });

        it('should switch to pointer-events-auto when visible', () => {
            expect(destinationPreview).toContain('pointer-events-auto');
        });

        it('should use w-72 for a fixed width preview panel', () => {
            expect(destinationPreview).toContain('w-72');
        });
    });

    describe('Show/hide delay logic', () => {
        it('should use a 300ms hover delay before showing preview', () => {
            expect(destinationPreview).toContain('300');
        });

        it('should listen to focusin events as well as mouseenter', () => {
            expect(destinationPreview).toContain('focusin');
        });

        it('should listen to focusout events as well as mouseleave', () => {
            expect(destinationPreview).toContain('focusout');
        });

        it('should hide preview on Escape key', () => {
            expect(destinationPreview).toContain("'Escape'");
        });

        it('should hide preview on scroll to prevent misaligned panels', () => {
            expect(destinationPreview).toContain("'scroll'");
        });
    });
});
