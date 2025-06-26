/**
 * BaseEntityFactory<T>
 *
 * Generic base factory for creating entity mocks in a fluent and DRY way.
 *
 * Allows you to start from a base entity and apply overrides in a chainable manner.
 *
 * @template T - The entity type to mock.
 *
 * @example
 * const factory = new BaseEntityFactory(baseUser).with({ name: 'Alice' });
 * const user = factory.build();
 */
export class BaseEntityFactory<T> {
    protected base: T;
    protected data: Partial<T> = {};
    constructor(base: T) {
        this.base = base;
    }
    /**
     * Applies overrides to the base entity in a chainable way.
     * @param overrides - Partial fields to override in the base entity.
     * @returns {BaseEntityFactory<T>} The factory instance for chaining.
     */
    with(overrides: Partial<T>) {
        Object.assign(this.data, overrides);
        return this;
    }
    /**
     * Builds and returns the final mocked entity with all overrides applied.
     * @returns {T} The resulting entity instance.
     */
    build(): T {
        return { ...this.base, ...this.data };
    }
}
