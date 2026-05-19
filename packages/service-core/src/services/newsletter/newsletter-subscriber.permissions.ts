/**
 * @module newsletter-subscriber.permissions
 *
 * Pure permission-check functions for the NewsletterSubscriberService (SPEC-101).
 *
 * Each function either returns void (allowed) or throws
 * `ServiceError(FORBIDDEN, ..., '<REASON_CODE>')` (denied).
 *
 * Design notes:
 * - Admin actions (list, stats) require `NEWSLETTER_SUBSCRIBER_VIEW`.
 * - Owner actions (subscribe, unsubscribe, status, resend) require that the
 *   calling actor's id matches the target userId. There is no "manage any"
 *   permission for subscribe/unsubscribe in MVP — even admins cannot forcefully
 *   subscribe someone else on their behalf.
 *
 * NEVER check roles here; only check `PermissionEnum` values.
 *
 * @see {@link NewsletterSubscriberService}
 */

import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

/**
 * Checks that the actor has the `NEWSLETTER_SUBSCRIBER_VIEW` permission,
 * which is required for the admin list and stats endpoints.
 *
 * @param actor - The actor performing the action.
 *
 * @throws {ServiceError} FORBIDDEN if the actor lacks the required permission.
 *
 * @example
 * ```ts
 * checkCanViewSubscribers(actor);
 * // Throws if actor doesn't have NEWSLETTER_SUBSCRIBER_VIEW
 * ```
 */
export function checkCanViewSubscribers(actor: Actor): void {
    if (actor.permissions.includes(PermissionEnum.NEWSLETTER_SUBSCRIBER_VIEW)) {
        return;
    }
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: NEWSLETTER_SUBSCRIBER_VIEW required',
        undefined,
        'NEWSLETTER_SUBSCRIBER_PERMISSION_DENIED'
    );
}

// ---------------------------------------------------------------------------
// Owner-only actions
// ---------------------------------------------------------------------------

/**
 * Checks that the calling actor is the owner of the subscriber record.
 *
 * Used for subscribe, unsubscribe, resend-verification, and status endpoints.
 * The actor's id must equal the `targetUserId` resolved from the subscription.
 *
 * Design decision: admins do NOT bypass this check in MVP. Admin
 * re-subscribe / forced-unsubscribe is out of scope for SPEC-101.
 *
 * @param actor - The actor performing the action.
 * @param targetUserId - The userId that owns the subscription record.
 *
 * @throws {ServiceError} FORBIDDEN if `actor.id !== targetUserId`.
 *
 * @example
 * ```ts
 * requireSelf(actor, subscriber.userId);
 * // Throws FORBIDDEN if actor.id !== subscriber.userId
 * ```
 */
export function requireSelf(actor: Actor, targetUserId: string): void {
    if (actor.id === targetUserId) {
        return;
    }
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: you can only manage your own newsletter subscription',
        undefined,
        'NEWSLETTER_SUBSCRIBER_NOT_SELF'
    );
}
