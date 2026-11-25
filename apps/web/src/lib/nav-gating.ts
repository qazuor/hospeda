/** Shared effective-permission navigation and hub-option evaluation. */
import type { PermissionEnum } from '@repo/schemas';
import { isRealClient } from '@repo/schemas';
import { canAccessPublisherArea } from '@/lib/account/publisher-access';

/** A node is admitted by ANY declared permission; an ungated node is public. */
export interface GatedNavNode {
    readonly requiredPermission?: PermissionEnum;
    readonly requiredPermissions?: readonly PermissionEnum[];
}

/** Evaluates effective permissions; an empty/loading list fails closed for gated nodes. */
export function isVisibleByPermissions(
    node: GatedNavNode,
    permissions: readonly string[]
): boolean {
    if (node.requiredPermissions)
        return node.requiredPermissions.some((permission) => permissions.includes(permission));
    return !node.requiredPermission || permissions.includes(node.requiredPermission);
}

/** Host navigation surface eligibility, not an API action permission. */
export function hasAccommodationsNavAccess({
    permissions
}: {
    readonly permissions: readonly string[];
}): boolean {
    return canAccessPublisherArea({ area: 'host', permissions });
}

/** Venue/experience navigation eligibility. Resource checks remain per vertical. */
export function hasListingNavAccess({
    permissions
}: {
    readonly permissions: readonly string[];
}): boolean {
    return canAccessPublisherArea({ area: 'commerce', permissions });
}

/** Own-post navigation admits independently granted create or update authority. */
export function hasPostsNavAccess({
    permissions
}: {
    readonly permissions: readonly string[];
}): boolean {
    return canAccessPublisherArea({ area: 'posts', permissions });
}

/** Own-event navigation admits independently granted create or update authority. */
export function hasEventsNavAccess({
    permissions
}: {
    readonly permissions: readonly string[];
}): boolean {
    return canAccessPublisherArea({ area: 'events', permissions });
}

/** A hub option can be acquired by permission or an explicit owned-row fact. */
export interface DoorGatingOption {
    readonly id?: string;
    readonly acquiredPermission?: PermissionEnum;
    readonly comingSoon?: boolean;
}

/** Hub option presentation, separate from door navigation eligibility. */
export type DoorOptionState = 'acquired' | 'unacquired' | 'comingSoon';

/** Resolves hub acquisition without changing ownership-only partner/provider semantics. */
export function resolveDoorOptionState({
    option,
    visibility,
    acquiredOptionIds
}: {
    readonly option: DoorGatingOption;
    readonly visibility: (node: GatedNavNode) => boolean;
    readonly acquiredOptionIds?: readonly string[];
}): DoorOptionState {
    if (option.id !== undefined && acquiredOptionIds?.includes(option.id)) return 'acquired';
    if (!option.acquiredPermission) return option.comingSoon ? 'comingSoon' : 'unacquired';
    return visibility({ requiredPermission: option.acquiredPermission })
        ? 'acquired'
        : 'unacquired';
}

/** Shows exactly one door using the unchanged shared business-vertical rule. */
export function isDoorVisible({
    door,
    permissions,
    ownsPartner = false,
    ownsHostTradeListing = false
}: {
    readonly door: { readonly kind: 'listing' | 'partner' };
    readonly permissions: readonly string[];
    readonly ownsPartner?: boolean;
    readonly ownsHostTradeListing?: boolean;
}): boolean {
    const realClient = isRealClient({ permissions, ownsPartner, ownsHostTradeListing });
    return door.kind === 'partner' ? realClient : !realClient;
}
