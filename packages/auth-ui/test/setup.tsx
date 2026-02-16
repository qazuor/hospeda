/**
 * Test setup file for Vitest in Auth UI package
 * Configures test environment and global mocks
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// Global test setup
beforeAll(() => {
    process.env.NODE_ENV = 'test';
});

// Cleanup after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});
