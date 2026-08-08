import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Every mutation and admin read of the mentions log is gated by
 * `PARTNER_MANAGE` (HOS-377, closes OQ-4).
 *
 * The existing partner-admin permission is reused rather than a narrower
 * `PARTNER_MENTION_MANAGE` being invented: logging a mention is the same job as
 * the rest of partner administration, done by the same people at the same
 * moment, and a permission with a single call site is a permission nobody ever
 * grants correctly.
 *
 * The partner-facing read path is NOT covered here on purpose. An approved
 * partner is an ordinary account holding no partner permission at all, so
 * ownership of the `partners` row is its gate — see `PartnerService.getOwn` and
 * HOS-278 AC-7.
 */
function assertCanManage(actor: Actor, action: string): void {
    if (!actor?.id || !actor.permissions.includes(PermissionEnum.PARTNER_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            `Permission denied: Insufficient permissions to ${action} partner mentions`
        );
    }
}

/** @throws {ServiceError} When the actor cannot log mentions. */
export function checkCanCreateMention(actor: Actor, _data?: unknown): void {
    assertCanManage(actor, 'create');
}

/** @throws {ServiceError} When the actor cannot correct a mention. */
export function checkCanUpdateMention(actor: Actor, _entity?: unknown): void {
    assertCanManage(actor, 'update');
}

/** @throws {ServiceError} When the actor cannot remove a mention. */
export function checkCanDeleteMention(actor: Actor, _entity?: unknown): void {
    assertCanManage(actor, 'delete');
}

/** @throws {ServiceError} When the actor cannot read the admin mention log. */
export function checkCanViewMention(actor: Actor, _entity?: unknown): void {
    assertCanManage(actor, 'view');
}

/** @throws {ServiceError} When the actor cannot list mentions. */
export function checkCanListMentions(actor: Actor): void {
    assertCanManage(actor, 'list');
}
