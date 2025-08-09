/**
 * modelMockFactory.ts
 *
 * Provides unified helpers for creating model and logger mocks for service-core tests.
 * All mocks are strongly typed, extensible, and DRY.
 */

import { BaseModel } from '@repo/db';
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
    findWithRelations: Mock;
    table: string;
    entityName: string;
    getClient: () => unknown;
    raw: unknown;
    [key: string]: Mock | string | unknown | (() => unknown);
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
        findAll: vi.fn(),
        findWithRelations: vi.fn(),
        table: 'mock_table',
        entityName: 'mock_entity',
        getClient: () => ({}),
        raw: {}
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

/**
 * Creates a strongly-typed mock instance of a model class, with all methods replaced by vi.fn().
 *
 * @template M - The model class to mock (e.g., DestinationModel, AccommodationModel)
 * @param ModelClass - The model class constructor
 * @param methods - Additional method names to mock (optional)
 * @returns {M} An instance of the model class with all methods mocked
 *
 * @example
 * const mock = createTypedModelMock(DestinationModel, ['findWithRelations']);
 * // To access Vitest methods like .mockResolvedValue():
 * const asMock = <T>(fn: T) => fn as unknown as import('vitest').Mock;
 * asMock(mock.findById).mockResolvedValue(...);
 */
export function createTypedModelMock<M extends new (...args: unknown[]) => unknown>(
    ModelClass: M,
    methods: string[] = []
): InstanceType<M> {
    const instance = new ModelClass({}) as unknown as Record<string, unknown>;

    // Mock all prototype methods
    let proto = ModelClass.prototype;
    while (proto && proto !== Object.prototype) {
        for (const key of Object.getOwnPropertyNames(proto)) {
            if (key === 'constructor') continue;
            const desc = Object.getOwnPropertyDescriptor(proto, key);
            if (desc && typeof desc.value === 'function') {
                instance[key] = vi.fn();
            }
        }
        proto = Object.getPrototypeOf(proto);
    }

    // Mock all own methods (instance properties)
    for (const key of Object.keys(instance)) {
        if (typeof instance[key] === 'function') {
            instance[key] = vi.fn();
        }
    }

    // Mock additional methods if needed
    for (const m of methods) {
        if (!(m in instance)) instance[m] = vi.fn();
    }
    return instance as unknown as InstanceType<M>;
}

/**
 * Mock class that extends BaseModel<T> and mocks all required methods/properties for strict type compatibility.
 */
export class MockBaseModel<T> extends BaseModel<T> {
    protected table = {} as any;
    protected entityName = 'mock_entity';
    findById = vi.fn();
    findOne = vi.fn();
    create = vi.fn();
    update = vi.fn();
    softDelete = vi.fn();
    restore = vi.fn();
    hardDelete = vi.fn();
    count = vi.fn();
    findAll = vi.fn();
    findWithRelations = vi.fn();
    raw = vi.fn();
    protected override getClient = vi.fn();
}

/**
 * Creates a strict BaseModel mock instance for use in tests.
 * @returns {MockBaseModel<T>} A mock model instance compatible with BaseModel<T>.
 */
export function createBaseModelMock<T>(): BaseModel<T> {
    return new MockBaseModel<T>();
}
