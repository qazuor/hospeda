import { PermissionEnum } from '../enums/permission.enum.js';

/**
 * Business verticals and the «real client» rule (HOS-2551, HOS-2562).
 *
 * A real client is a person with at least one business vertical:
 * accommodation, venue («comer y salir»), experience, editorial, partner or
 * provider. This module is the ONE definition of that rule. The web reads it
 * to build the header user menu and to gate «Asistentes de IA»; the API reads
 * it to refuse the MCP OAuth flow and every MCP request to anybody else. The
 * two sides therefore cannot disagree.
 *
 * A vertical is granted in one of two ways, never by a role:
 *
 * - by an effective permission (`PermissionEnum`), for the verticals that
 *   have one;
 * - by ROW OWNERSHIP, for partner and provider. An approved partner or
 *   provider is an ordinary account with no permission and no role change
 *   (HOS-278 AC-7), so only the owned row can tell.
 *
 * Pure: the caller supplies the permissions and the ownership facts.
 */

/** Stable ids of the business verticals, in display order. */
export const BUSINESS_VERTICAL_IDS = [
    'accommodations',
    'venues',
    'experiences',
    'editorial',
    'partner',
    'provider'
] as const;

/** One business vertical id. */
export type BusinessVerticalId = (typeof BUSINESS_VERTICAL_IDS)[number];

/** Row ownership that grants a business vertical without a permission. */
export type BusinessVerticalOwnership = 'hostTradeListing' | 'partner';

/** How one business vertical is granted. Exactly one of the two fields is set. */
export interface BusinessVerticalGate {
    /** Stable id. */
    readonly id: BusinessVerticalId;
    /** Granted when the person holds ANY of these effective permissions. */
    readonly anyPermission?: readonly PermissionEnum[];
    /** Granted when the person owns this kind of row. */
    readonly ownership?: BusinessVerticalOwnership;
}

/**
 * The gate of every business vertical, in {@link BUSINESS_VERTICAL_IDS} order.
 *
 * - Accommodations: `ACCOMMODATION_CREATE` (the `anfitrion` area).
 * - Venues / experiences: `VENUE_EDIT_OWN` / `EXPERIENCE_EDIT_OWN` (the
 *   `comercio` area).
 * - Editorial: `POST_CREATE` or `EVENT_CREATE`.
 * - Partner: owns a LIVE partner row (not revoked, not soft-deleted).
 * - Provider: owns a host-trade directory listing.
 */
export const BUSINESS_VERTICAL_GATES: readonly BusinessVerticalGate[] = [
    { id: 'accommodations', anyPermission: [PermissionEnum.ACCOMMODATION_CREATE] },
    { id: 'venues', anyPermission: [PermissionEnum.VENUE_EDIT_OWN] },
    { id: 'experiences', anyPermission: [PermissionEnum.EXPERIENCE_EDIT_OWN] },
    {
        id: 'editorial',
        anyPermission: [PermissionEnum.POST_CREATE, PermissionEnum.EVENT_CREATE]
    },
    { id: 'partner', ownership: 'partner' },
    { id: 'provider', ownership: 'hostTradeListing' }
] as const;

/** Row-ownership facts that grant a vertical. */
export interface BusinessOwnershipFacts {
    /** The person owns a host-trade directory listing (provider). */
    readonly ownsHostTradeListing: boolean;
    /** The person owns a live partner row. */
    readonly ownsPartner: boolean;
}

/** Input of {@link resolveBusinessVerticals} and {@link isRealClient}. */
export interface ResolveBusinessVerticalsInput extends BusinessOwnershipFacts {
    /** The person's EFFECTIVE permissions (role ∪ grants, minus denies). */
    readonly permissions: readonly string[];
}

/** Output of {@link resolveBusinessVerticals}. */
export interface ResolveBusinessVerticalsOutput {
    /** The verticals the person has, in {@link BUSINESS_VERTICAL_IDS} order. */
    readonly verticals: readonly BusinessVerticalId[];
}

/**
 * Whether one gate grants its vertical to a person.
 *
 * @param input.gate - The vertical's gate.
 * @param input.permissions - Effective permissions.
 * @param input.ownsHostTradeListing - Provider ownership fact.
 * @param input.ownsPartner - Partner ownership fact.
 * @returns `true` when the vertical is granted.
 */
export function isBusinessVerticalGranted({
    gate,
    permissions,
    ownsHostTradeListing,
    ownsPartner
}: ResolveBusinessVerticalsInput & { readonly gate: BusinessVerticalGate }): boolean {
    if (gate.ownership === 'partner') return ownsPartner;
    if (gate.ownership === 'hostTradeListing') return ownsHostTradeListing;
    return (gate.anyPermission ?? []).some((permission) => permissions.includes(permission));
}

/**
 * Lists the business verticals a person has.
 *
 * @param input - See {@link ResolveBusinessVerticalsInput}.
 * @returns The granted verticals; empty for a pure tourist.
 */
export function resolveBusinessVerticals(
    input: ResolveBusinessVerticalsInput
): ResolveBusinessVerticalsOutput {
    return {
        verticals: BUSINESS_VERTICAL_GATES.filter((gate) =>
            isBusinessVerticalGranted({ ...input, gate })
        ).map((gate) => gate.id)
    };
}

/**
 * Whether the person is a real client: at least one business vertical.
 *
 * @param input - See {@link ResolveBusinessVerticalsInput}.
 * @returns `true` when {@link resolveBusinessVerticals} lists anything.
 */
export function isRealClient(input: ResolveBusinessVerticalsInput): boolean {
    return resolveBusinessVerticals(input).verticals.length > 0;
}

/**
 * Whether the permissions ALONE already make the person a real client, so a
 * caller can skip the ownership lookups (they cost a database read each).
 *
 * @param input.permissions - Effective permissions.
 * @returns `true` when a permission-gated vertical is granted.
 */
export function isRealClientByPermissions({
    permissions
}: {
    readonly permissions: readonly string[];
}): boolean {
    return isRealClient({ permissions, ownsHostTradeListing: false, ownsPartner: false });
}
