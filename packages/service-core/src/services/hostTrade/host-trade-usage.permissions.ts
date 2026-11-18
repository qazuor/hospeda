import { HostTradeUsageDeclaredByEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
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

/** Arguments for {@link isUsageCounterpart}. RO-RO. */
export interface IsUsageCounterpartArgs {
    /** Which side opened the row (`HostTradeUsageDeclaredByEnum`). */
    readonly declaredBy: string;
    /** The host named on the row. */
    readonly hostUserId: string;
    /**
     * The owner of the row's provider listing. Only read when the HOST declared
     * the row, so a caller may pass `null` for a provider-declared row.
     */
    readonly providerOwnerUserId: string | null | undefined;
    /** The account asking. */
    readonly actorId: string;
}

/**
 * Whether `actorId` is the party expected to answer a usage — THE counterpart
 * rule of HOS-376 §6.2, shared by the service's transitions and by every reader
 * that tells a caller whether a row awaits them (the MCP `list_benefit_usages`).
 *
 * `declaredBy` decides, never a role: a provider-declared usage is answered by
 * the host named on the row, a host-declared one by the listing's owner. So the
 * declarant is never the counterpart of their own declaration (AC-6), and an
 * account that is both host and provider answers each row from the side the row
 * names.
 *
 * @param args - The row's `declaredBy` and parties, and the asking account
 * @returns `true` only for the counterpart
 */
export function isUsageCounterpart({
    declaredBy,
    hostUserId,
    providerOwnerUserId,
    actorId
}: IsUsageCounterpartArgs): boolean {
    const counterpartId =
        declaredBy === HostTradeUsageDeclaredByEnum.PROVIDER
            ? hostUserId
            : (providerOwnerUserId ?? null);
    return Boolean(counterpartId) && counterpartId === actorId;
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
