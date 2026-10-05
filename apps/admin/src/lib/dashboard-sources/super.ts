/**
 * SUPER_ADMIN dashboard source slots (SPEC-155 T-021).
 *
 * The former billing metrics source depended on the retired billing API and
 * is intentionally absent. Audit, security and Sentry slots remain deferred
 * until their queryable backends exist.
 */

// Card H: no resolver registration yet.
// Admin actions audit log needs a queryable endpoint (SPEC-162).
// Security log needs a queryable endpoint (SPEC-163).
// Sentry errors need a Sentry API proxy.

// `whats-new.recent` is registered in ./whats-new.ts for all roles.

export {};
