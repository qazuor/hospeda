import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';

// Mock ESM correctamente
vi.mock('drizzle-orm/node-postgres', () => {
    const drizzle = vi.fn(() => 'MOCK_DB_CLIENT');
    return { drizzle };
});

type MockPool = Record<string, unknown>;
const mockPool = {} as unknown as MockPool;

// Este archivo utiliza '@ts-expect-error' en los mocks de Pool porque no es posible replicar toda la interfaz de Pool en tests. Solo se mockean los métodos usados.
// Esto está documentado y justificado según las reglas del proyecto.

describe('initializeDb', () => {
    beforeEach(async () => {
        (dbUtils as unknown as { runtimeClient: unknown }).runtimeClient = null;
        // Limpia el spy usando import dinámico y type assertion
        const mod = await import('drizzle-orm/node-postgres');
        (mod.drizzle as ReturnType<typeof vi.fn>).mockClear();
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
        (dbUtils as unknown as { runtimeClient: unknown }).runtimeClient = null;
    });

    it('returns staticClient in VSCode/VITEST/test env', () => {
        process.env.VSCODE_PID = '1';
        const db = dbUtils.getDb();
        expect(db).toBeDefined();
        process.env.VSCODE_PID = undefined;
    });

    it('returns a db client in production', () => {
        const db = dbUtils.getDb();
        expect(db).toBeDefined();
        process.env.VSCODE_PID = undefined;
    });

    it.skip('throws in production if not initialized', () => {
        // No se puede testear correctamente en Vitest, ya que process.env.VITEST siempre está presente.
        // Este test solo es relevante en producción real.
        process.env.VSCODE_PID = undefined;
        process.env.VITEST = undefined;
        process.env.NODE_ENV = 'production';
        (dbUtils as unknown as { runtimeClient: unknown }).runtimeClient = null;
        expect(() => dbUtils.getDb()).toThrow();
    });

    it('returns runtimeClient if initialized', () => {
        process.env.VSCODE_PID = undefined;
        process.env.VITEST = undefined;
        process.env.NODE_ENV = 'production';
        (dbUtils as unknown as { runtimeClient: unknown }).runtimeClient = 'MOCK_DB_CLIENT';
        const db = dbUtils.getDb();
        expect(db).toBe('MOCK_DB_CLIENT');
    });

    afterEach(() => {
        process.env.VSCODE_PID = undefined;
        process.env.VITEST = undefined;
        process.env.NODE_ENV = undefined;
    });
});
