import { type Mock, vi } from 'vitest';

/**
 * Represents a standard mock for a repository/ORM model, with all common CRUD methods mocked using Vitest.
 *
 * Each property is a Vitest mock function (vi.fn()), allowing for flexible test assertions and behavior overrides.
 * Additional methods can be added dynamically as needed.
 */
export type ModelMock = {
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
 * Creates a model mock object with the standard repository/ORM methods mocked using Vitest.
 *
 * This utility is intended for use in service and repository tests, providing a fully mocked model
 * that can be extended with additional method names as needed.
 *
 * @param methods - Additional method names to include as mocks (optional).
 * @returns {ModelMock} A model mock object with all standard and custom methods mocked.
 */
export function createModelMock(methods: string[] = []): ModelMock {
    const base: ModelMock = {
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
 * Creates a mock for AccommodationFaqModel with all expected FAQ-related methods mocked using Vitest.
 *
 * This utility is intended for use in FAQ-related service tests. Add more methods if the FAQ model evolves.
 *
 * @returns An object with all expected AccommodationFaqModel methods mocked.
 */
export const createFaqModelMock = () => ({
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    findAll: vi.fn(),
    hardDelete: vi.fn()
    // Add more methods here if FAQ models require them in the future
});
