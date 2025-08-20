/**
 * Test setup file for Vitest in Icons package
 * Configures test environment and global mocks for icon components
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import React from 'react';
import { afterEach, beforeAll, vi } from 'vitest';

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
