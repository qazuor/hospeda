import { vi } from 'vitest';
import { createModelMock } from './modelMockFactory';

/**
 * Instantiates a service class for testing, injecting mocked logger and model dependencies.
 *
 * This utility is intended for unit/integration tests to ensure that the service under test
 * receives fully mocked dependencies, allowing for isolated and controlled test scenarios.
 *
 * @template S - The service class type to instantiate.
 * @template M - The model type to inject (default: unknown).
 * @template L - The logger type to inject (default: unknown).
 * @param ServiceClass - The service class constructor to instantiate.
 * @param modelMock - (Optional) A mock implementation of the model. If not provided, a default mock is created.
 * @param loggerMock - (Optional) A mock implementation of the logger. If not provided, a default logger mock is created.
 * @returns {S} An instance of the service class with mocked dependencies injected.
 */
export function createServiceTestInstance<S, M = unknown, L = unknown>(
    ServiceClass: new (deps: { logger: L }, model: M) => S,
    modelMock?: M,
    loggerMock?: L
): S {
    const defaultLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    } as unknown as L;
    const model = modelMock ?? (createModelMock() as M);
    const logger = loggerMock ?? defaultLogger;
    return new ServiceClass({ logger }, model);
}
