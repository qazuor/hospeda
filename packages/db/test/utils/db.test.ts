import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';

// Mock ESM correctamente
vi.mock('drizzle-orm/node-postgres', () => {
    const drizzle = vi.fn(() => 'MOCK_DB_CLIENT');
    return { drizzle };
});

type MockPool = Record<string, unknown>;
const mockPool = {} as unknown as MockPool;

/**
 * Helper to reset the internal runtimeClient to null using the public setDb() API.
 * Direct property mutation does not work with ESM live bindings.
 * @ts-expect-error setDb accepts non-null type but null is valid for test teardown.
 */
// biome-ignore lint/suspicious/noExplicitAny: intentional test teardown cast
const resetDbClient = () => dbUtils.setDb(null as any);

// This file uses '@ts-expect-error' in Pool mocks because it's not possible to replicate the entire Pool interface in tests. Only used methods are mocked.
// This is documented and justified according to project rules.

describe('initializeDb', () => {
    beforeEach(async () => {
        resetDbClient();
        // Cleans the spy using dynamic import and type assertion
        const mod = await import('drizzle-orm/node-postgres');
        (mod.drizzle as ReturnType<typeof vi.fn>).mockClear();
    });

    afterEach(() => {
        resetDbClient();
    });

    it('should initialize and return a new client', async () => {
        // @ts-expect-error: mock Pool para test
        const client = dbUtils.initializeDb(mockPool);
        expect(client).toBe('MOCK_DB_CLIENT');
        const mod = await import('drizzle-orm/node-postgres');
        expect(mod.drizzle as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
            mockPool,
            expect.any(Object)
        );
    });

    it('should return the same client if already initialized', () => {
        // @ts-expect-error: mockPool no implementa Pool real, solo para test
        dbUtils.initializeDb(mockPool);
        // @ts-expect-error: mockPool no implementa Pool real, solo para test
        const client2 = dbUtils.initializeDb({} as unknown as MockPool);
        expect(client2).toBe('MOCK_DB_CLIENT');
    });
});

describe('getDb', () => {
    beforeEach(() => {
        resetDbClient();
    });

    afterEach(() => {
        resetDbClient();
    });

    it('throws when called without prior initialization', () => {
        // Arrange - client is null (reset in beforeEach via resetDbClient)

        // Act & Assert
        expect(() => dbUtils.getDb()).toThrow(
            'Database not initialized. Call initializeDb() before using database operations.'
        );
    });

    it('returns the client injected via setDb()', () => {
        // Arrange
        const mockClient = 'MOCK_DI_CLIENT' as unknown as ReturnType<typeof dbUtils.getDb>;
        dbUtils.setDb(mockClient);

        // Act
        const db = dbUtils.getDb();

        // Assert
        expect(db).toBe('MOCK_DI_CLIENT');
    });

    it('returns client initialized via initializeDb()', () => {
        // Arrange - reset is done in beforeEach, then initialize via pool
        // @ts-expect-error: mockPool no implementa Pool real, solo para test
        dbUtils.initializeDb(mockPool);

        // Act
        const db = dbUtils.getDb();

        // Assert
        expect(db).toBe('MOCK_DB_CLIENT');
    });
});
