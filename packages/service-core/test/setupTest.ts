/**
 * setupTest.ts
 *
 * Global setup for Vitest tests in @repo/service-core.
 * Use this file to mock global dependencies (logger, DB, etc.) and configure Vitest hooks.
 * All test files should import this setup.
 */

import { vi } from 'vitest';

// Mock logger globally
vi.mock('@repo/logger', () => {
    const mockedLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        })),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(() => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        })),
        registerLogMethod: vi.fn()
    };

    return {
        default: mockedLogger,
        logger: mockedLogger
    };
});

export const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis()
};

export const mockModel = {
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    restore: vi.fn(),
    hardDelete: vi.fn(),
    count: vi.fn(),
    findAll: vi.fn()
};

vi.mock('../src/utils/service-logger', () => ({
    serviceLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        permission: vi.fn()
    }
}));

// Add more global mocks as needed
