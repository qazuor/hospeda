/**
 * @file listing-detail-icons.test.tsx
 * @description Pins the glyphs the standardized listing detail pages need
 * (HOS-2579 §6.7 and §6.10.1): `BackpackIcon` («Qué llevar») and
 * `ForkKnifeIcon` (the venue «Ver carta» action). Astro frontmatter is not
 * typechecked, so a missing export would only crash at render time.
 */

import { render } from '@testing-library/react';
// biome-ignore lint/correctness/noUnusedImports: React import required for JSX transform in test environment
import React from 'react';
import { describe, expect, it } from 'vitest';
import { BackpackIcon, ForkKnifeIcon } from '../src';

describe('listing detail icons (HOS-2579)', () => {
    it.each([
        ['BackpackIcon', BackpackIcon],
        ['ForkKnifeIcon', ForkKnifeIcon]
    ])('exports %s as a component', (_name, Icon) => {
        // Assert
        expect(typeof Icon).toBe('function');
    });

    it.each([
        ['BackpackIcon', BackpackIcon],
        ['ForkKnifeIcon', ForkKnifeIcon]
    ])('renders %s as a decorative svg', (_name, Icon) => {
        // Arrange / Act
        const { container } = render(
            <Icon
                size={20}
                aria-hidden="true"
            />
        );

        // Assert
        const svg = container.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg?.getAttribute('aria-hidden')).toBe('true');
    });
});
