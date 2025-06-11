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

// Partial global mock for UserBookmarkModel from @repo/db for all service tests
vi.mock('@repo/db', async () => {
    const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db');
    return {
        ...actual,
        UserBookmarkModel: {
            create: vi.fn(),
            getById: vi.fn(),
            getByUserId: vi.fn(),
            delete: vi.fn()
        }
    };
});
