/**
 * @module direct-email.permissions
 *
 * Pure permission checks of the direct email services (HOS-2685).
 *
 * Each function returns void (allowed) or throws
 * `ServiceError(FORBIDDEN, ..., '<REASON_CODE>')` (denied). Only
 * `PermissionEnum` values are checked, never roles.
 *
 * - View: history, previews, recipient checks, templates and suppression list reads.
 * - Send: test and real sends, and writes to the suppression list.
 * - Template write: create, edit and delete templates.
 */

import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

/** Throws FORBIDDEN unless the actor holds `permission`. */
function requirePermission(actor: Actor, permission: PermissionEnum): void {
    if (actor.permissions.includes(permission)) return;
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        `Permission denied: ${permission} required`,
        undefined,
        'DIRECT_EMAIL_PERMISSION_DENIED'
    );
}

/**
 * Requires `DIRECT_EMAIL_VIEW`.
 *
 * @param actor - The actor performing the action
 * @throws {ServiceError} FORBIDDEN when the actor lacks the permission
 */
export function checkCanViewDirectEmail(actor: Actor): void {
    requirePermission(actor, PermissionEnum.DIRECT_EMAIL_VIEW);
}

/**
 * Requires `DIRECT_EMAIL_SEND`.
 *
 * @param actor - The actor performing the action
 * @throws {ServiceError} FORBIDDEN when the actor lacks the permission
 */
export function checkCanSendDirectEmail(actor: Actor): void {
    requirePermission(actor, PermissionEnum.DIRECT_EMAIL_SEND);
}

/**
 * Requires `DIRECT_EMAIL_TEMPLATE_WRITE`.
 *
 * @param actor - The actor performing the action
 * @throws {ServiceError} FORBIDDEN when the actor lacks the permission
 */
export function checkCanWriteDirectEmailTemplate(actor: Actor): void {
    requirePermission(actor, PermissionEnum.DIRECT_EMAIL_TEMPLATE_WRITE);
}
