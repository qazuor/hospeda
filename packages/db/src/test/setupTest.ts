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
 * Creates a new mockLogger object for use in tests.
 */
export const createMockLogger = () => ({
    query: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
});

// Global mockDb and mockLogger for compatibility with existing tests
const mockDb = createMockDb();
const mockLogger = createMockLogger();

globalThis.mockDb = mockDb;
globalThis.mockLogger = mockLogger;

// Base module mocks for all tests
vi.mock('../client.ts', () => ({
    getDb: () => globalThis.mockDb,
    initializeDb: vi.fn(() => globalThis.mockDb)
}));
vi.mock('../utils/logger.ts', () => ({
    dbLogger: globalThis.mockLogger
}));
