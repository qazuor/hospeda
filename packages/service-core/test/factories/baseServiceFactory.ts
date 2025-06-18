/**
 * baseServiceFactory.ts
 *
 * Factory and mocks for BaseService tests.
 */

import { vi } from 'vitest';
import type { BaseModel } from '../../src/types';

/**
 * Creates a mock BaseModel que implementa todos los métodos requeridos por la interfaz.
 */
export const createMockBaseModel = <T>(): BaseModel<T> => ({
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    restore: vi.fn(),
    hardDelete: vi.fn(),
    count: vi.fn()
});

export const exampleInput = { id: 'entity-1' };
export const exampleOutput = { id: 'entity-1', name: 'Entity' };
