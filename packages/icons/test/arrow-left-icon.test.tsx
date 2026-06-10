/**
 * @file arrow-left-icon.test.tsx
 * @description Regression test for ArrowLeftIcon (SPEC-191 T-015 smoke finding).
 *
 * The /colaborar pages import ArrowLeftIcon for their back-to-hub links, but
 * the icon was missing from the package exports — Astro pages crashed at
 * render time ("Unable to render ArrowLeftIcon because it is undefined") and
 * tsc does not typecheck .astro frontmatter, so only a runtime smoke caught
 * it. This test pins the export so it can never silently disappear.
 */

import { render } from '@testing-library/react';
// biome-ignore lint/correctness/noUnusedImports: React import required for JSX transform in test environment
import React from 'react';
import { describe, expect, it } from 'vitest';
import { ArrowLeftIcon, ArrowRightIcon } from '../src';

describe('ArrowLeftIcon (SPEC-191 regression)', () => {
    it('is exported from @repo/icons', () => {
        expect(ArrowLeftIcon).toBeDefined();
        expect(typeof ArrowLeftIcon).toBe('function');
    });

    it('renders an svg like its ArrowRightIcon sibling', () => {
        const { container: left } = render(<ArrowLeftIcon size={20} />);
        const { container: right } = render(<ArrowRightIcon size={20} />);
        expect(left.querySelector('svg')).not.toBeNull();
        expect(right.querySelector('svg')).not.toBeNull();
    });
});
