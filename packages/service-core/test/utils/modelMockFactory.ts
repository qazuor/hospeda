/**
 * modelMockFactory.ts
 *
 * Provides unified helpers for creating model and logger mocks for service-core tests.
 * All mocks are strongly typed, extensible, and DRY.
 */

import { type Mock, vi } from 'vitest';
import type { ServiceLogger } from '../../src/utils/service-logger';

/**
 * Standard CRUD methods for a typical repository/model.
 */
export type StandardModelMock = {
    findById: Mock;
    findOne: Mock;
    create: Mock;
    update: Mock;
    softDelete: Mock;
    restore: Mock;
    hardDelete: Mock;
    count: Mock;
    findAll: Mock;
    [key: string]: Mock;
};

/**
 * Creates a model mock object with standard CRUD methods and any additional methods.
 *
 * @param methods - Additional method names to include as mocks (optional).
 * @returns {StandardModelMock} A model mock object with all standard and custom methods mocked.
 *
 * @example
 * const model = createModelMock(['customMethod']);
 * model.customMethod.mockResolvedValue(...);
 */
export function createModelMock(methods: string[] = []): StandardModelMock {
    const base: StandardModelMock = {
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
    for (const m of methods) {
        if (!(m in base)) base[m] = vi.fn();
    }
    return base;
}

/**
 * Creates a mock logger with all standard log methods mocked.
 * @returns {ServiceLogger} A fully mocked logger.
 */
export function createLoggerMock(): ServiceLogger {
    return {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(),
        registerLogMethod: vi.fn(),
        permission: vi.fn()
    } as unknown as ServiceLogger;
}
