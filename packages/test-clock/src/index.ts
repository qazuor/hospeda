/**
 * Entry point of `@repo/test-clock`: the shared test package with the
 * adjustable clock (AC:B1:17). Test-only: never a production dependency.
 */
export { type AdjustableClock, createAdjustableClock } from './adjustable-clock';
