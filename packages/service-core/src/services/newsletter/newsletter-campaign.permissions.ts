/**
 * @module newsletter-campaign.permissions
 *
 * Pure permission-check functions for the NewsletterCampaignService (SPEC-101).
 *
 * Each function either returns void (allowed) or throws
 * `ServiceError(FORBIDDEN, ..., '<REASON_CODE>')` (denied).
 *
 * Design notes:
 * - Write actions (create, update, softDelete) require `NEWSLETTER_CAMPAIGN_WRITE`.
 * - Send/cancel actions require `NEWSLETTER_CAMPAIGN_SEND`.
 * - View actions (computeMetrics, getFailedDeliveries) require `NEWSLETTER_CAMPAIGN_VIEW`.
 * - `closeSentCampaigns` is internal (cron-driven, no actor permission check).
 *
 * NEVER check roles here; only check `PermissionEnum` values.
 *
 * @see {@link NewsletterCampaignService}
 */

import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

// ---------------------------------------------------------------------------
// Write actions (create, update, softDelete)
// ---------------------------------------------------------------------------

/**
 * Checks that the actor has the `NEWSLETTER_CAMPAIGN_WRITE` permission,
 * required for creating, updating, and soft-deleting campaigns.
 *
 * @param actor - The actor performing the action.
 *
 * @throws {ServiceError} FORBIDDEN if the actor lacks the required permission.
 *
 * @example
 * ```ts
 * checkCanWriteCampaign(actor);
 * // Throws if actor doesn't have NEWSLETTER_CAMPAIGN_WRITE
 * ```
 */
export function checkCanWriteCampaign(actor: Actor): void {
    if (actor.permissions.includes(PermissionEnum.NEWSLETTER_CAMPAIGN_WRITE)) {
        return;
    }
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: NEWSLETTER_CAMPAIGN_WRITE required',
        undefined,
        'NEWSLETTER_CAMPAIGN_WRITE_PERMISSION_DENIED'
    );
}

// ---------------------------------------------------------------------------
// Send/cancel actions
// ---------------------------------------------------------------------------

/**
 * Checks that the actor has the `NEWSLETTER_CAMPAIGN_SEND` permission,
 * required for triggering a send, test send, or cancel.
 *
 * @param actor - The actor performing the action.
 *
 * @throws {ServiceError} FORBIDDEN if the actor lacks the required permission.
 *
 * @example
 * ```ts
 * checkCanSendCampaign(actor);
 * // Throws if actor doesn't have NEWSLETTER_CAMPAIGN_SEND
 * ```
 */
export function checkCanSendCampaign(actor: Actor): void {
    if (actor.permissions.includes(PermissionEnum.NEWSLETTER_CAMPAIGN_SEND)) {
        return;
    }
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: NEWSLETTER_CAMPAIGN_SEND required',
        undefined,
        'NEWSLETTER_CAMPAIGN_SEND_PERMISSION_DENIED'
    );
}

// ---------------------------------------------------------------------------
// View actions (metrics, failed deliveries)
// ---------------------------------------------------------------------------

/**
 * Checks that the actor has the `NEWSLETTER_CAMPAIGN_VIEW` permission,
 * required for reading campaign metrics and failed delivery lists.
 *
 * @param actor - The actor performing the action.
 *
 * @throws {ServiceError} FORBIDDEN if the actor lacks the required permission.
 *
 * @example
 * ```ts
 * checkCanViewCampaign(actor);
 * // Throws if actor doesn't have NEWSLETTER_CAMPAIGN_VIEW
 * ```
 */
export function checkCanViewCampaign(actor: Actor): void {
    if (actor.permissions.includes(PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW)) {
        return;
    }
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: NEWSLETTER_CAMPAIGN_VIEW required',
        undefined,
        'NEWSLETTER_CAMPAIGN_VIEW_PERMISSION_DENIED'
    );
}
