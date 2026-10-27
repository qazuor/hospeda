/**
 * Test setup file for Vitest in Icons package
 * Configures test environment and global mocks for icon components
 */

import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
// Type-only: provides the `vitest` Assertion augmentation without jest-dom's own
// `require('vitest')` side effect, which breaks `rejects.toThrow` on vitest 5.
import type {} from '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
// biome-ignore lint/correctness/noUnusedImports: React import required for JSX transform in test environment
import React from 'react';
import { afterEach, beforeAll, expect, vi } from 'vitest';

// vitest 5: register jest-dom on this file's own `expect`; the '/vitest' entry breaks `rejects.toThrow`.
expect.extend(jestDomMatchers);

// Global test setup
beforeAll(() => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
});

// Cleanup after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

// Mock SVG imports for testing
vi.mock('*.svg', () => ({
    default: 'svg-mock',
    ReactComponent: ({ title, ...props }: any) => {
        const titleText = title || 'Mock SVG Icon';
        return (
            <svg
                {...props}
                data-testid="svg-icon"
            >
                <title>{titleText}</title>
            </svg>
        );
    }
}));

// Global SVG mock for React components
Object.defineProperty(window, 'SVGElement', {
    value: class MockSVGElement extends HTMLElement {}
});
