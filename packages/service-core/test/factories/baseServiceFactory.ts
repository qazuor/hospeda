/**
 * baseServiceFactory.ts
 *
 * Factory and mocks for BaseService tests.
 */

import { vi } from 'vitest';
import type { BaseModel } from '../../src/types';

/**
 * Creates a mock implementation of BaseModel with all required CRUD methods mocked using Vitest.
 *
 * This utility is intended for use in BaseService-related tests, providing a fully mocked model
 * that can be injected into service instances for isolated and controlled testing.
 *
 * @template T - The entity type for the BaseModel.
 * @returns {BaseModel<T>} A mock BaseModel with all required methods mocked.
 */
export const createMockBaseModel = <T>(): BaseModel<T> => ({
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    restore: vi.fn(),
    hardDelete: vi.fn(),
    count: vi.fn(),
    findAll: vi.fn()
});

/**
 * Example input object for use in BaseService tests.
 */
export const exampleInput = { id: 'entity-1' };

/**
 * Example output object for use in BaseService tests.
 */
export const exampleOutput = { id: 'entity-1', name: 'Entity' };
