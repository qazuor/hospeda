import { vi } from 'vitest';

/**
 * Helper to mock a Drizzle RelationalQueryBuilder in tests.
 * Includes the minimal required properties to avoid type errors.
 *
 * @template T - The type of the relation mock
 * @param {Partial<T>} [overrides={}] - Properties to override in the mock
 * @returns {T} The mock object
 */
export const createDrizzleRelationMock = <T extends object>(overrides: Partial<T> = {}): T => {
    // Minimal properties required by Drizzle (dummies)
    return {
        findFirst: vi.fn(),
        fullSchema: {},
        schema: {},
        tableNamesMap: {},
        table: {},
        // Drizzle internals (dummies)
        tableConfig: {},
        dialect: {},
        session: {},
        findMany: vi.fn(),
        ...overrides
    } as unknown as T;
};
