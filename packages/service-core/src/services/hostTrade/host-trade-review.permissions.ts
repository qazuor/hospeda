import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * @file host-trade-review.permissions.ts
 * @description Permission gates for host-trade reviews (HOS-376 §6.3).
 */

/**
 * Gate 1 of the eligibility chain: the actor may write reviews at all.
 *
 * The seed grants `HOST_TRADE_REVIEW_CREATE` to `HOST`, `ADMIN` and
 * `SUPER_ADMIN` — never to a bare `USER`. That is what makes AC-15 work: an
 * account that is only a provider owns a listing but has no accommodations, so
 * it never received the HOST role and cannot review anyone.
 */
export function checkCanCreateHostTradeReview(actor: Actor): void {
    if (!actor || !actor.id) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    }
    if (!hasPermission(actor, PermissionEnum.HOST_TRADE_REVIEW_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to review a host trade'
        );
    }
}

/** Admin read of every review, whatever its moderation state. */
export function checkCanViewAllHostTradeReviews(actor: Actor): void {
    if (!actor || !actor.id || !hasPermission(actor, PermissionEnum.HOST_TRADE_REVIEW_VIEW_ALL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: HOST_TRADE_REVIEW_VIEW_ALL required for admin list'
        );
    }
}

/** Admin moderation of a review or a provider reply. */
export function checkCanModerateHostTradeReviews(actor: Actor): void {
    if (!actor || !actor.id || !hasPermission(actor, PermissionEnum.HOST_TRADE_REVIEW_MODERATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: HOST_TRADE_REVIEW_MODERATE required'
        );
    }
}
