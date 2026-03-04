/**
 * Mock ServiceError class used across all service-core mock modules.
 *
 * Mirrors the shape of the real ServiceError so routes and handlers
 * that inspect `error.code` continue to work under test.
 *
 * @module test/helpers/mocks/service-error
 */

/**
 * Lightweight ServiceError used in unit-test mocks.
 */
export class ServiceError extends Error {
    constructor(
        public readonly code: string,
        message: string
    ) {
        super(message);
        this.name = 'ServiceError';
    }
}
