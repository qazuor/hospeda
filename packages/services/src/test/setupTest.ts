import { vi } from 'vitest';

/**
 * Creates a new service mockLogger object for use in tests.
 */
export const createMockServiceLogger = () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    permission: vi.fn()
});

export const mockServiceLogger = createMockServiceLogger();

// Base module mocks for all tests
vi.mock('../utils/service-logger.ts', () => ({
    serviceLogger: globalThis.mockServiceLogger
}));

globalThis.mockServiceLogger = mockServiceLogger;
