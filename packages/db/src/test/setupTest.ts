import { vi } from 'vitest';

/**
 * Creates a new mockDb object for use in tests.
 * You can extend or override its methods per test.
 */
export const createMockDb = () => ({
    query: {},
    insert: vi.fn(() => ({ values: () => ({ returning: vi.fn() }) })),
    update: vi.fn(() => ({ set: () => ({ where: () => ({ returning: vi.fn() }) }) })),
    delete: vi.fn(() => ({ where: () => ({ returning: vi.fn() }) })),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis()
});

/**
 * Creates a new db mockLogger object for use in tests.
 */
export const createMockDbLogger = () => ({
    query: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
});

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
const mockDb = createMockDb();
const mockDbLogger = createMockDbLogger();

// Base module mocks for all tests
vi.mock('../client.ts', () => ({
    getDb: () => globalThis.mockDb,
    initializeDb: vi.fn(() => globalThis.mockDb)
}));
vi.mock('../utils/logger.ts', () => ({
    dbLogger: globalThis.mockDbLogger
}));
vi.mock('../utils/serviceLogger.ts', () => ({
    serviceLogger: globalThis.mockServiceLogger
}));

globalThis.mockDb = mockDb;
globalThis.mockDbLogger = mockDbLogger;
globalThis.mockServiceLogger = mockServiceLogger;
