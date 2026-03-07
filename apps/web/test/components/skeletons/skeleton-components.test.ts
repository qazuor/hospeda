/**
 * @file skeleton-components.test.ts
 * @description Tests for all skeleton loading placeholder components.
 * Validates pulse animation, semantic token usage, grid layout,
 * and appropriate item counts for each content type.
 *
 * Components covered:
 * - AccommodationGridSkeleton.astro
 * - DestinationGridSkeleton.astro
 * - EventGridSkeleton.astro
 * - PostGridSkeleton.astro
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const skeletonsDir = resolve(__dirname, '../../../src/components/skeletons');

const accommodationGridSkeleton = readFileSync(
    resolve(skeletonsDir, 'AccommodationGridSkeleton.astro'),
    'utf8'
);
const destinationGridSkeleton = readFileSync(
    resolve(skeletonsDir, 'DestinationGridSkeleton.astro'),
    'utf8'
);
const eventGridSkeleton = readFileSync(resolve(skeletonsDir, 'EventGridSkeleton.astro'), 'utf8');
const postGridSkeleton = readFileSync(resolve(skeletonsDir, 'PostGridSkeleton.astro'), 'utf8');

// ---------------------------------------------------------------------------
// AccommodationGridSkeleton
// ---------------------------------------------------------------------------
describe('AccommodationGridSkeleton.astro', () => {
    it('should use animate-pulse for loading animation', () => {
        expect(accommodationGridSkeleton).toContain('animate-pulse');
    });

    it('should render 8 skeleton cards', () => {
        expect(accommodationGridSkeleton).toContain('length: 8');
    });

    it('should use semantic bg-card token for skeleton cards', () => {
        expect(accommodationGridSkeleton).toContain('bg-card');
    });

    it('should use semantic bg-muted token for placeholder elements', () => {
        expect(accommodationGridSkeleton).toContain('bg-muted');
    });

    it('should use semantic border-border token', () => {
        expect(accommodationGridSkeleton).toContain('border-border');
    });

    it('should render a responsive grid layout', () => {
        expect(accommodationGridSkeleton).toContain('grid');
        expect(accommodationGridSkeleton).toContain('grid-cols-1');
        expect(accommodationGridSkeleton).toContain('sm:grid-cols-2');
        expect(accommodationGridSkeleton).toContain('lg:grid-cols-3');
        expect(accommodationGridSkeleton).toContain('xl:grid-cols-4');
    });

    it('should use rounded-2xl for consistent card styling', () => {
        expect(accommodationGridSkeleton).toContain('rounded-2xl');
    });

    it('should have shadow-sm on skeleton cards', () => {
        expect(accommodationGridSkeleton).toContain('shadow-sm');
    });

    it('should include pill-shaped placeholder elements for tags', () => {
        expect(accommodationGridSkeleton).toContain('rounded-full');
    });

    it('should use overflow-hidden on cards', () => {
        expect(accommodationGridSkeleton).toContain('overflow-hidden');
    });
});

// ---------------------------------------------------------------------------
// DestinationGridSkeleton
// ---------------------------------------------------------------------------
describe('DestinationGridSkeleton.astro', () => {
    it('should use animate-pulse for loading animation', () => {
        expect(destinationGridSkeleton).toContain('animate-pulse');
    });

    it('should render 3 skeleton cards', () => {
        expect(destinationGridSkeleton).toContain('length: 3');
    });

    it('should use semantic bg-card token', () => {
        expect(destinationGridSkeleton).toContain('bg-card');
    });

    it('should use semantic bg-muted token for placeholder shapes', () => {
        expect(destinationGridSkeleton).toContain('bg-muted');
    });

    it('should render a 3-column grid layout', () => {
        expect(destinationGridSkeleton).toContain('grid');
        expect(destinationGridSkeleton).toContain('md:grid-cols-3');
    });

    it('should use rounded-2xl for consistent card styling', () => {
        expect(destinationGridSkeleton).toContain('rounded-2xl');
    });

    it('should have shadow-sm on skeleton cards', () => {
        expect(destinationGridSkeleton).toContain('shadow-sm');
    });

    it('should use overflow-hidden on cards', () => {
        expect(destinationGridSkeleton).toContain('overflow-hidden');
    });
});

// ---------------------------------------------------------------------------
// EventGridSkeleton
// ---------------------------------------------------------------------------
describe('EventGridSkeleton.astro', () => {
    it('should use animate-pulse for loading animation', () => {
        expect(eventGridSkeleton).toContain('animate-pulse');
    });

    it('should render 4 skeleton cards', () => {
        expect(eventGridSkeleton).toContain('length: 4');
    });

    it('should use semantic bg-card token', () => {
        expect(eventGridSkeleton).toContain('bg-card');
    });

    it('should use semantic bg-muted token for placeholder shapes', () => {
        expect(eventGridSkeleton).toContain('bg-muted');
    });

    it('should render a 4-column grid at large breakpoint', () => {
        expect(eventGridSkeleton).toContain('grid');
        expect(eventGridSkeleton).toContain('lg:grid-cols-4');
    });

    it('should use rounded-2xl for consistent card styling', () => {
        expect(eventGridSkeleton).toContain('rounded-2xl');
    });

    it('should have shadow-sm on skeleton cards', () => {
        expect(eventGridSkeleton).toContain('shadow-sm');
    });

    it('should include a pill-shaped placeholder for category badge', () => {
        expect(eventGridSkeleton).toContain('rounded-full');
    });

    it('should use overflow-hidden on cards', () => {
        expect(eventGridSkeleton).toContain('overflow-hidden');
    });
});

// ---------------------------------------------------------------------------
// PostGridSkeleton
// ---------------------------------------------------------------------------
describe('PostGridSkeleton.astro', () => {
    it('should use animate-pulse for loading animation', () => {
        expect(postGridSkeleton).toContain('animate-pulse');
    });

    it('should render 2 secondary skeleton articles', () => {
        expect(postGridSkeleton).toContain('length: 2');
    });

    it('should use semantic bg-card token', () => {
        expect(postGridSkeleton).toContain('bg-card');
    });

    it('should use semantic bg-muted token for placeholder shapes', () => {
        expect(postGridSkeleton).toContain('bg-muted');
    });

    it('should use the magazine 12-column grid layout', () => {
        expect(postGridSkeleton).toContain('lg:grid-cols-12');
    });

    it('should have featured article spanning 7 columns', () => {
        expect(postGridSkeleton).toContain('lg:col-span-7');
    });

    it('should have secondary articles column spanning 5', () => {
        expect(postGridSkeleton).toContain('lg:col-span-5');
    });

    it('should use rounded-2xl for consistent card styling', () => {
        expect(postGridSkeleton).toContain('rounded-2xl');
    });

    it('should include a pill-shaped placeholder for category badge', () => {
        expect(postGridSkeleton).toContain('rounded-full');
    });

    it('should have shadow-sm on skeleton cards', () => {
        expect(postGridSkeleton).toContain('shadow-sm');
    });
});
