/**
 * Cross-layer side-effects for per-user permission mutations (SPEC-170).
 *
 * `PermissionService` lives in `@repo/service-core` and therefore cannot import
 * the API's in-memory permission cache or audit logger — both live in `apps/api`
 * and a package may not depend on an app. Instead the API wires these effects at
 * startup through the setters below, mirroring the `RevalidationService` init
 * pattern (see `revalidation/revalidation-init.ts`).
 *
 * When no handler is wired (e.g. in unit tests, or before API startup), every
 * emitter is a safe no-op — the service stays fully functional without them.
 *
 * @module permission.effects
 */

/** Invalidates the API's in-memory user-permissions cache for one user. */
export type UserPermissionsCacheInvalidator = (params: { readonly userId: string }) => void;

/**
 * Payload for a per-user permission-change audit event. Mirrors the
 * `PermissionChangeEntry` audit contract in `apps/api` (minus `auditEvent`),
 * so the API wiring can forward it straight to `auditLog`.
 */
export interface PermissionChangeAuditPayload {
    readonly actorId: string;
    readonly targetUserId: string;
    readonly changeType: 'permission_grant' | 'permission_revoke';
    /** Prior state of the override, or `'none'` when there was none. */
    readonly oldValue: string;
    /** New state of the override, or `'none'` after a revoke. */
    readonly newValue: string;
}

/** Emits a permission-change audit event. */
export type PermissionChangeAuditEmitter = (payload: PermissionChangeAuditPayload) => void;

let cacheInvalidator: UserPermissionsCacheInvalidator | undefined;
let auditEmitter: PermissionChangeAuditEmitter | undefined;

/**
 * Wire the user-permissions cache invalidator. Call once at API startup with the
 * app's `invalidateUserPermissionsCache`.
 */
export function setUserPermissionsCacheInvalidator(fn: UserPermissionsCacheInvalidator): void {
    cacheInvalidator = fn;
}

/**
 * Wire the permission-change audit emitter. Call once at API startup with a
 * function that forwards to the app's `auditLog`.
 */
export function setPermissionChangeAuditEmitter(fn: PermissionChangeAuditEmitter): void {
    auditEmitter = fn;
}

/**
 * Invalidate the user-permissions cache for a user. No-op if no invalidator is
 * wired (e.g. unit tests).
 */
export function invalidateUserPermissionsOverrides(params: { readonly userId: string }): void {
    cacheInvalidator?.(params);
}

/**
 * Emit a permission-change audit event. No-op if no emitter is wired.
 */
export function emitPermissionChangeAudit(payload: PermissionChangeAuditPayload): void {
    auditEmitter?.(payload);
}

/**
 * Reset both handlers. Test-only — use to isolate cases that assert wiring.
 *
 * @internal
 */
export function _resetPermissionEffects(): void {
    cacheInvalidator = undefined;
    auditEmitter = undefined;
}
