/**
 * mockLogger.ts
 *
 * Mock logger utility for service tests.
 * Provides a complete mock of ServiceLogger with all standard logging methods.
 */

import { vi } from 'vitest';
import type { ServiceLogger } from '../../src/types';

/**
 * Creates a mock ServiceLogger instance for testing.
 * All logging methods are mocked with vi.fn() and do nothing by default.
 *
 * @returns A mock ServiceLogger instance
 */
export function createMockLogger(): ServiceLogger {
    return {
        // Standard logging methods
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),

        // ServiceLogger-specific method
        permission: vi.fn(),

        // Additional logger methods that might be needed
        fatal: vi.fn(),
        success: vi.fn(),
        log: vi.fn()
    } as unknown as ServiceLogger;
}
