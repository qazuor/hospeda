import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * @file host-trade-usage.permissions.ts
 * @description Permission gates for benefit usages (HOS-376).
 *
 * Note what is NOT here: declaring, confirming and rejecting a usage carry no
 * permission at all. Those are authorised by ROW OWNERSHIP — the provider owns
 * the listing, the host is named on the row — exactly as HOS-278 AC-7 settled
 * for `/host-trades/mine`. An approved provider never receives a role or a
 * permission, so gating those actions on one would lock out every provider in
 * the directory.
 *
 * The permissions below are the admin surface only.
 */

/**
 * Gate for a host acting inside the directory (the QR declaration).
 *
 * `HOST_TRADE_VIEW` is the directory's only gate, and reusing it here is what
 * makes the weakly-verified `declaredBy = HOST` branch safe: a passer-by who
 * scans the sticker on a van is not a host, so the usage they would declare
 * cannot be created, let alone ripen into a review (spec §6.5).
 */
export function checkCanDeclareUsageAsHost(actor: Actor): void {
    if (!actor || !actor.id) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    }
    if (!hasPermission(actor, PermissionEnum.HOST_TRADE_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to declare a benefit usage'
        );
    }
}

/** Admin read of every usage row. Requires HOST_TRADE_USAGE_VIEW_ALL. */
export function checkCanViewAllUsages(actor: Actor): void {
    if (!actor || !actor.id || !hasPermission(actor, PermissionEnum.HOST_TRADE_USAGE_VIEW_ALL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: HOST_TRADE_USAGE_VIEW_ALL required for admin list'
        );
    }
}

/** Admin mutation of a usage row or a declaration suspension. */
export function checkCanManageUsages(actor: Actor): void {
    if (!actor || !actor.id || !hasPermission(actor, PermissionEnum.HOST_TRADE_USAGE_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: HOST_TRADE_USAGE_MANAGE required'
        );
    }
}
