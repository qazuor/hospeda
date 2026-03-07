/**
 * @file illustration.test.ts
 * @description Tests for Illustration.astro component.
 *
 * Illustration.astro renders a decorative image that is hidden from assistive
 * technologies. It accepts required `src` and `position` props, plus an optional
 * `size` prop for responsive sizing classes (defaults to a responsive h/w set).
 *
 * Strategy: read the source file and assert on its textual content, since
 * Astro components cannot be rendered in a Vitest/jsdom environment.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/shared/Illustration.astro');
const src = readFileSync(componentPath, 'utf8');

describe('Illustration.astro', () => {
    describe('Props interface', () => {
        it('should declare a required src prop', () => {
            // src is the path or URL of the illustration image.
            expect(src).toContain('src: string');
        });

        it('should declare a required position prop', () => {
            // position holds Tailwind utility classes for absolute positioning.
            expect(src).toContain('position: string');
        });

        it('should declare an optional size prop', () => {
            expect(src).toContain('size?: string');
        });

        it('should provide a default value for the size prop', () => {
            // The default is a responsive set of h/w classes.
            expect(src).toContain('size =');
        });

        it('should default size to responsive h-28 / h-40 / h-52 classes', () => {
            expect(src).toContain('h-28 w-28 md:h-40 md:w-40 lg:h-52 lg:w-52');
        });
    });

    describe('DOM structure', () => {
        it('should wrap the image in an absolutely positioned div', () => {
            // The outer div uses "absolute" for decorative overlay positioning.
            expect(src).toContain('absolute');
        });

        it('should apply pointer-events-none to prevent mouse interaction', () => {
            // Decorative elements must not intercept user clicks.
            expect(src).toContain('pointer-events-none');
        });

        it('should apply the position prop to the wrapper div', () => {
            // Astro passes the variable directly inside the class:list array.
            // The source contains: class:list={["absolute pointer-events-none", position]}
            expect(src).toContain('"absolute pointer-events-none", position');
        });

        it('should render an img element', () => {
            expect(src).toContain('<img');
        });

        it('should bind the src prop to the img src attribute', () => {
            expect(src).toContain('{src}');
        });
    });

    describe('Accessibility', () => {
        it('should provide an empty string alt attribute on the img', () => {
            // Empty alt marks the image as decorative for screen readers.
            expect(src).toContain('alt=""');
        });

        it('should set aria-hidden="true" on the img element', () => {
            // Hides the element from the accessibility tree entirely.
            expect(src).toContain('aria-hidden="true"');
        });
    });

    describe('Styling', () => {
        it('should use object-contain to preserve illustration aspect ratio', () => {
            expect(src).toContain('object-contain');
        });

        it('should apply reduced opacity on mobile', () => {
            // The illustration is subtler on small screens (opacity-40).
            expect(src).toContain('opacity-40');
        });

        it('should apply higher opacity on medium and larger screens', () => {
            // The illustration becomes more visible on md+ screens (md:opacity-80).
            expect(src).toContain('md:opacity-80');
        });

        it('should use class:list for Astro conditional class merging', () => {
            expect(src).toContain('class:list');
        });

        it('should pass the size prop to the img class:list', () => {
            // Astro places the variable directly in the array, not in JSX curly braces.
            // The source contains: class:list={["object-contain opacity-40 md:opacity-80", size]}
            expect(src).toContain('"object-contain opacity-40 md:opacity-80", size');
        });
    });
});
