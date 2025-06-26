/**
 * BaseFactoryBuilder<T>
 *
 * Generic, composable builder for test entities.
 * Provides fluent .with()/.withOverrides() and .build() methods for robust, DRY, and type-safe test data creation.
 *
 * @template T - The entity type to mock.
 *
 * @example
 * const builder = new BaseFactoryBuilder(baseUser).with({ name: 'Alice' });
 * const user = builder.build();
 */
export class BaseFactoryBuilder<T> {
    protected base: T;
    protected data: Partial<T> = {};
    constructor(base: T) {
        this.base = base;
    }
    /**
     * Applies overrides to the base entity in a chainable way.
     * @param overrides - Partial fields to override in the base entity.
     * @returns {BaseFactoryBuilder<T>} The builder instance for chaining.
     */
    with(overrides: Partial<T>) {
        Object.assign(this.data, overrides);
        return this;
    }
    /**
     * Alias for .with().
     * @param overrides - Partial fields to override in the base entity.
     * @returns {BaseFactoryBuilder<T>} The builder instance for chaining.
     */
    withOverrides(overrides: Partial<T>) {
        return this.with(overrides);
    }
    /**
     * Builds and returns the final mocked entity with all overrides applied.
     * @returns {T} The resulting entity instance.
     */
    build(): T {
        return { ...this.base, ...this.data };
    }
}
