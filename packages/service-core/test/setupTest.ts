/**
 * setupTest.ts
 *
 * Global setup for Vitest tests in @repo/service-core.
 * Use this file to mock global dependencies (logger, DB, etc.) and configure Vitest hooks.
 * All test files should import this setup.
 */

import { vi } from 'vitest';

// Mock logger globally
vi.mock('@repo/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        }))
    }
}));

// Add more global mocks as needed
