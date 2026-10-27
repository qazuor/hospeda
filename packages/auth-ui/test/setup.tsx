/**
 * Test setup file for Vitest in Auth UI package
 * Configures test environment and global mocks
 */

import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
// Type-only: provides the `vitest` Assertion augmentation without jest-dom's own
// `require('vitest')` side effect, which breaks `rejects.toThrow` on vitest 5.
import type {} from '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, expect, vi } from 'vitest';

// vitest 5: register jest-dom on this file's own `expect`; the '/vitest' entry breaks `rejects.toThrow`.
expect.extend(jestDomMatchers);

// Global test setup
beforeAll(() => {
    process.env.NODE_ENV = 'test';
});

// Cleanup after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});
