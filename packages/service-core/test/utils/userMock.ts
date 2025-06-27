import { UserModel } from '@repo/db';
import { type Mocked, vi } from 'vitest';
import type { ServiceLogger } from '../../src/types';

/**
 * Creates a typed mock of UserModel with all methods as vi.fn().
 */
export function createUserModelMock(): Mocked<UserModel> {
    const model = new UserModel() as Mocked<UserModel>;
    const modelRecord = model as unknown as Record<string, unknown>;
    for (const key of Object.getOwnPropertyNames(UserModel.prototype)) {
        const prop = modelRecord[key];
        if (typeof prop === 'function') {
            modelRecord[key] = vi.fn();
        }
    }
    return model;
}

/**
 * Creates a mock ServiceLogger for user service tests.
 */
export function createLoggerMock(): ServiceLogger {
    return {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    } as unknown as ServiceLogger;
}
