/**
 * Mock ServiceError class used across all service-core mock modules.
 *
 * Mirrors the shape of the real ServiceError so routes and handlers
 * that inspect `error.code` continue to work under test.
 *
 * ## Why the full 4-argument signature matters (HOS-1236)
 *
 * `test/setup.ts` installs a GLOBAL `vi.mock('@repo/service-core')` that swaps
 * this class in for the real one across every suite in this app. It used to
 * declare only `(code, message)`, so the real class's 3rd and 4th arguments —
 * `details` and `reason` — were accepted by JavaScript and then silently
 * dropped on the floor.
 *
 * `reason` is not a debug field: it is the machine-readable discriminator the
 * web routes on (`translateApiErrorWithT` prefers it over `code`, and
 * `PlanChangeFlow` reads it to decide what the user is offered next). ~113 call
 * sites pass one. Under the old stub every one of them read back `undefined`
 * inside an apps/api test — so an assertion on `reason` was not merely
 * unavailable, it was IMPOSSIBLE to write correctly, and a route that stopped
 * emitting one would go on passing. `details` is the same story for the two
 * codes `error-contract.md` puts on the public contract (`LIMIT_REACHED`,
 * `ENTITLEMENT_REQUIRED`).
 *
 * Keep this constructor in step with `packages/service-core/src/types/index.ts`.
 *
 * @module test/helpers/mocks/service-error
 */

/**
 * Lightweight ServiceError used in unit-test mocks.
 */
export class ServiceError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly details?: unknown,
        public readonly reason?: string
    ) {
        super(message);
        this.name = 'ServiceError';
    }
}
