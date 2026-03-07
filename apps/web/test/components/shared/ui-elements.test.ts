/**
 * @file ui-elements.test.ts
 * @description Tests for shared Astro UI element components.
 * Validates Props interfaces, semantic token usage, accessibility,
 * and structural conventions.
 *
 * Components covered:
 * - AmenityTag.astro
 * - CategoryBadge.astro
 * - FilterChip.astro
 * - GradientButton.astro
 * - LocationBadge.astro
 * - RatingBadge.astro
 * - SectionHeader.astro
 * - StarsDisplay.astro
 * - NavigationProgress.astro
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sharedDir = resolve(__dirname, '../../../src/components/shared');

const amenityTag = readFileSync(resolve(sharedDir, 'AmenityTag.astro'), 'utf8');
const categoryBadge = readFileSync(resolve(sharedDir, 'CategoryBadge.astro'), 'utf8');
const filterChip = readFileSync(resolve(sharedDir, 'FilterChip.astro'), 'utf8');
const gradientButton = readFileSync(resolve(sharedDir, 'GradientButton.astro'), 'utf8');
const locationBadge = readFileSync(resolve(sharedDir, 'LocationBadge.astro'), 'utf8');
const ratingBadge = readFileSync(resolve(sharedDir, 'RatingBadge.astro'), 'utf8');
const sectionHeader = readFileSync(resolve(sharedDir, 'SectionHeader.astro'), 'utf8');
const starsDisplay = readFileSync(resolve(sharedDir, 'StarsDisplay.astro'), 'utf8');
const navigationProgress = readFileSync(resolve(sharedDir, 'NavigationProgress.astro'), 'utf8');

// ---------------------------------------------------------------------------
// AmenityTag
// ---------------------------------------------------------------------------
describe('AmenityTag.astro', () => {
    it('should define a Props interface', () => {
        expect(amenityTag).toContain('interface Props');
    });

    it('should declare amenity prop as readonly', () => {
        expect(amenityTag).toContain('readonly amenity:');
    });

    it('should declare optional class prop as readonly', () => {
        expect(amenityTag).toContain('readonly class?:');
    });

    it('should use semantic bg-muted token', () => {
        expect(amenityTag).toContain('bg-muted');
    });

    it('should use semantic text-muted-foreground token', () => {
        expect(amenityTag).toContain('text-muted-foreground');
    });

    it('should render amenity text', () => {
        expect(amenityTag).toContain('{amenity}');
    });

    it('should use a span as root element', () => {
        expect(amenityTag).toContain('<span');
    });

    it('should use class:list for conditional class merging', () => {
        expect(amenityTag).toContain('class:list');
    });
});

// ---------------------------------------------------------------------------
// CategoryBadge
// ---------------------------------------------------------------------------
describe('CategoryBadge.astro', () => {
    it('should define a Props interface', () => {
        expect(categoryBadge).toContain('interface Props');
    });

    it('should declare category prop as readonly', () => {
        expect(categoryBadge).toContain('readonly category:');
    });

    it('should declare colorClass prop as readonly', () => {
        expect(categoryBadge).toContain('readonly colorClass?:');
    });

    it('should declare optional class prop as readonly', () => {
        expect(categoryBadge).toContain('readonly class?:');
    });

    it('should default to semantic primary token colors', () => {
        expect(categoryBadge).toContain('bg-primary text-primary-foreground');
    });

    it('should render category text', () => {
        expect(categoryBadge).toContain('{category}');
    });

    it('should use a span as root element', () => {
        expect(categoryBadge).toContain('<span');
    });

    it('should use class:list for conditional class merging', () => {
        expect(categoryBadge).toContain('class:list');
    });
});

// ---------------------------------------------------------------------------
// FilterChip
// ---------------------------------------------------------------------------
describe('FilterChip.astro', () => {
    it('should define a Props interface', () => {
        expect(filterChip).toContain('interface Props');
    });

    it('should have href prop', () => {
        expect(filterChip).toContain('href:');
    });

    it('should have icon prop', () => {
        expect(filterChip).toContain('icon:');
    });

    it('should have label prop', () => {
        expect(filterChip).toContain('label:');
    });

    it('should have variant prop with primary/accent options', () => {
        expect(filterChip).toContain('"primary" | "accent"');
    });

    it('should use semantic bg-card token for primary variant', () => {
        expect(filterChip).toContain('bg-card');
    });

    it('should use semantic hover:bg-primary for primary variant', () => {
        expect(filterChip).toContain('hover:bg-primary');
    });

    it('should use semantic accent tokens for accent variant', () => {
        expect(filterChip).toContain('hover:bg-accent');
        expect(filterChip).toContain('hover:text-accent-foreground');
    });

    it('should use semantic border-border for accent variant', () => {
        expect(filterChip).toContain('border-border');
    });

    it('should render as an anchor element with href', () => {
        expect(filterChip).toContain('<a');
        expect(filterChip).toContain('href={href}');
    });

    it('should render label text', () => {
        expect(filterChip).toContain('{label}');
    });

    it('should use class:list for conditional styling', () => {
        expect(filterChip).toContain('class:list');
    });
});

// ---------------------------------------------------------------------------
// GradientButton
// ---------------------------------------------------------------------------
describe('GradientButton.astro', () => {
    it('should define a Props interface', () => {
        expect(gradientButton).toContain('interface Props');
    });

    it('should declare href prop as readonly', () => {
        expect(gradientButton).toContain('readonly href:');
    });

    it('should declare label prop as readonly', () => {
        expect(gradientButton).toContain('readonly label:');
    });

    it('should declare showArrow prop as readonly', () => {
        expect(gradientButton).toContain('readonly showArrow?:');
    });

    it('should declare optional class prop as readonly', () => {
        expect(gradientButton).toContain('readonly class?:');
    });

    it('should use semantic from-primary gradient token', () => {
        expect(gradientButton).toContain('from-primary');
    });

    it('should use semantic to-hospeda-river gradient token', () => {
        expect(gradientButton).toContain('to-hospeda-river');
    });

    it('should use semantic text-primary-foreground token', () => {
        expect(gradientButton).toContain('text-primary-foreground');
    });

    it('should render as an anchor element', () => {
        expect(gradientButton).toContain('<a');
        expect(gradientButton).toContain('href={href}');
    });

    it('should render label text', () => {
        expect(gradientButton).toContain('{label}');
    });

    it('should conditionally render ArrowRightIcon when showArrow is true', () => {
        expect(gradientButton).toContain('showArrow');
        expect(gradientButton).toContain('ArrowRightIcon');
    });

    it('should import icon from @repo/icons', () => {
        expect(gradientButton).toContain('from "@repo/icons"');
    });
});

// ---------------------------------------------------------------------------
// LocationBadge
// ---------------------------------------------------------------------------
describe('LocationBadge.astro', () => {
    it('should define a Props interface', () => {
        expect(locationBadge).toContain('interface Props');
    });

    it('should declare location prop as readonly', () => {
        expect(locationBadge).toContain('readonly location:');
    });

    it('should declare variant prop as readonly', () => {
        expect(locationBadge).toContain('readonly variant?:');
    });

    it('should support solid and glass variant', () => {
        expect(locationBadge).toContain('"solid" | "glass"');
    });

    it('should use semantic bg-card token in solid variant', () => {
        expect(locationBadge).toContain('bg-card');
    });

    it('should use semantic text-foreground token', () => {
        expect(locationBadge).toContain('text-foreground');
    });

    it('should render location text', () => {
        expect(locationBadge).toContain('{location}');
    });

    it('should use a span as root element', () => {
        expect(locationBadge).toContain('<span');
    });

    it('should import icon from @repo/icons', () => {
        expect(locationBadge).toContain('from "@repo/icons"');
    });
});

// ---------------------------------------------------------------------------
// RatingBadge
// ---------------------------------------------------------------------------
describe('RatingBadge.astro', () => {
    it('should define a Props interface', () => {
        expect(ratingBadge).toContain('interface Props');
    });

    it('should declare rating prop as readonly', () => {
        expect(ratingBadge).toContain('readonly rating:');
    });

    it('should declare reviewsCount prop as readonly', () => {
        expect(ratingBadge).toContain('readonly reviewsCount?:');
    });

    it('should declare noReviewsLabel prop as readonly', () => {
        expect(ratingBadge).toContain('readonly noReviewsLabel?:');
    });

    it('should use semantic bg-card/90 token', () => {
        expect(ratingBadge).toContain('bg-card/90');
    });

    it('should use semantic accent token for star icon', () => {
        expect(ratingBadge).toContain('text-accent');
    });

    it('should use semantic text-foreground for the rating value', () => {
        expect(ratingBadge).toContain('text-foreground');
    });

    it('should use semantic text-muted-foreground for no-reviews fallback', () => {
        expect(ratingBadge).toContain('text-muted-foreground');
    });

    it('should conditionally show rating or no-reviews state', () => {
        expect(ratingBadge).toContain('rating > 0');
    });

    it('should display rating value', () => {
        expect(ratingBadge).toContain('{rating}');
    });

    it('should import StarIcon from @repo/icons', () => {
        expect(ratingBadge).toContain('StarIcon');
        expect(ratingBadge).toContain('from "@repo/icons"');
    });
});

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------
describe('SectionHeader.astro', () => {
    it('should define a Props interface', () => {
        expect(sectionHeader).toContain('interface Props');
    });

    it('should declare tagline prop as readonly', () => {
        expect(sectionHeader).toContain('readonly tagline?:');
    });

    it('should declare taglineColor prop as readonly', () => {
        expect(sectionHeader).toContain('readonly taglineColor?:');
    });

    it('should declare title prop as readonly', () => {
        expect(sectionHeader).toContain('readonly title:');
    });

    it('should declare subtitle prop as readonly', () => {
        expect(sectionHeader).toContain('readonly subtitle?:');
    });

    it('should declare align prop with center/left options', () => {
        expect(sectionHeader).toContain('"center" | "left"');
    });

    it('should declare size prop with default/sm options', () => {
        expect(sectionHeader).toContain('"default" | "sm"');
    });

    it('should declare spacing prop with default/compact options', () => {
        expect(sectionHeader).toContain('"default" | "compact"');
    });

    it('should use semantic text-foreground for the heading', () => {
        expect(sectionHeader).toContain('text-foreground');
    });

    it('should use semantic text-muted-foreground for subtitle', () => {
        expect(sectionHeader).toContain('text-muted-foreground');
    });

    it('should default taglineColor to text-accent', () => {
        expect(sectionHeader).toContain('text-accent');
    });

    it('should render title in an h2 element', () => {
        expect(sectionHeader).toContain('<h2');
    });

    it('should use scroll-reveal class for animation', () => {
        expect(sectionHeader).toContain('scroll-reveal');
    });

    it('should use font-serif for the heading', () => {
        expect(sectionHeader).toContain('font-serif');
    });
});

// ---------------------------------------------------------------------------
// StarsDisplay
// ---------------------------------------------------------------------------
describe('StarsDisplay.astro', () => {
    it('should define a Props interface', () => {
        expect(starsDisplay).toContain('interface Props');
    });

    it('should declare count prop as readonly', () => {
        expect(starsDisplay).toContain('readonly count:');
    });

    it('should declare max prop as readonly', () => {
        expect(starsDisplay).toContain('readonly max?:');
    });

    it('should declare size prop as readonly', () => {
        expect(starsDisplay).toContain('readonly size?:');
    });

    it('should support sm and md size variants', () => {
        expect(starsDisplay).toContain('"sm" | "md"');
    });

    it('should use semantic text-accent for filled stars', () => {
        expect(starsDisplay).toContain('text-accent');
    });

    it('should use semantic text-muted for empty stars', () => {
        expect(starsDisplay).toContain('text-muted');
    });

    it('should render stars from an Array.from loop', () => {
        expect(starsDisplay).toContain('Array.from');
    });

    it('should import StarIcon from @repo/icons', () => {
        expect(starsDisplay).toContain('StarIcon');
        expect(starsDisplay).toContain('from "@repo/icons"');
    });

    it('should use fill weight for filled stars and duotone for empty', () => {
        expect(starsDisplay).toContain('"fill"');
        expect(starsDisplay).toContain('"duotone"');
    });
});

// ---------------------------------------------------------------------------
// NavigationProgress
// ---------------------------------------------------------------------------
describe('NavigationProgress.astro', () => {
    it('should have aria-hidden on the progress bar element', () => {
        expect(navigationProgress).toContain('aria-hidden="true"');
    });

    it('should use semantic accent CSS variable for color', () => {
        expect(navigationProgress).toContain('var(--accent)');
    });

    it('should have the nav-progress id', () => {
        expect(navigationProgress).toContain('id="nav-progress"');
    });

    it('should be fixed positioned at the top', () => {
        expect(navigationProgress).toContain('fixed top-0');
    });

    it('should use z-50 for stacking', () => {
        expect(navigationProgress).toContain('z-50');
    });

    it('should listen to astro:before-preparation event for start', () => {
        expect(navigationProgress).toContain('astro:before-preparation');
    });

    it('should listen to astro:after-swap event for completion', () => {
        expect(navigationProgress).toContain('astro:after-swap');
    });

    it('should have a startProgress function', () => {
        expect(navigationProgress).toContain('startProgress');
    });

    it('should have a completeProgress function', () => {
        expect(navigationProgress).toContain('completeProgress');
    });

    it('should include a pageshow fallback for non-VT navigation', () => {
        expect(navigationProgress).toContain('pageshow');
    });
});
