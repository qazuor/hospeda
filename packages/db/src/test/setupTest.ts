import { vi } from 'vitest';

// Global mockDb y mockLogger
const mockDb = {
    query: {
        // Cada test puede extender esto según la tabla/modelo
    },
    insert: vi.fn(() => ({ values: () => ({ returning: vi.fn() }) })),
    update: vi.fn(() => ({ set: () => ({ where: () => ({ returning: vi.fn() }) }) }))
};
const mockLogger = {
    query: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
};

globalThis.mockDb = mockDb;
globalThis.mockLogger = mockLogger;

// Mocks de módulos base
vi.mock('../client.ts', () => ({
    getDb: () => globalThis.mockDb,
    initializeDb: vi.fn(() => globalThis.mockDb)
}));
vi.mock('../utils/logger.ts', () => ({
    dbLogger: globalThis.mockLogger
}));
vi.mock('../utils/db-utils', () => ({
    castReturning: (v: unknown) => v,
    castUserJsonFields: (v: unknown) => v,
    enumToTuple: (e: unknown) => Object.values(e as Record<string, unknown>)
}));
