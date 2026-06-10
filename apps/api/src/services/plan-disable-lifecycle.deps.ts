/**
 * Plan-disable lifecycle service — external dependencies.
 *
 * Re-exports the audit-log helper so the main service can be unit-tested
 * without touching `@repo/service-core` internals directly.  The test suite
 * mocks this module at the path
 * `../../src/services/plan-disable-lifecycle.deps`.
 *
 * @module services/plan-disable-lifecycle.deps
 */

export { insertPlanAuditLog } from '@repo/service-core';
