/**
 * Owner self-service featured toggle (SPEC-309 T-019, G-6).
 *
 * SPEC-292 deliberately stripped `isFeatured` from the owner-facing
 * `AccommodationUpdateHttpSchema` (owner-leak closure) — this module does NOT
 * reopen that schema. It is a narrowly-scoped write path whose gate is a
 * LIVE entitlement check, not just field presence: the owner may flip
 * `isFeatured` freely (uncapped, no rotation/queue — SPEC-309 OQ-4) only
 * while they hold an active FEATURED_LISTING entitlement for this specific
 * accommodation, from either independent source (SPEC-309 OQ-3):
 *
 * - Owner-wide, via their PLAN ({@link resolveOwnerPlanGrantsFeatured}).
 * - Accommodation-scoped, via an active `visibility-boost` ADDON grant
 *   ({@link resolveAccommodationHasActiveFeaturedAddon}).
 *
 * `isFeatured` is distinct from `featuredByEntitlement` (SPEC-292, renamed
 * SPEC-309): the latter is a billing-sync-owned denormalization, never
 * written here. `isFeatured` is the admin-curated column that this toggle
 * now ALSO lets an entitled owner drive — public queries treat both as
 * equivalent for the "featured" filter/sort (see `accommodation.model.ts`).
 *
 * @module services/accommodation/accommodation-featured-toggle
 */

import { AccommodationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { hasPermission } from '../../utils/permission.js';
import {
    resolveAccommodationHasActiveFeaturedAddon,
    resolveOwnerPlanGrantsFeatured
} from './featured-entitlement.resolver.js';

const accommodationModel = new AccommodationModel();

/**
 * Input for {@link setAccommodationFeaturedToggle}.
 */
export interface SetAccommodationFeaturedToggleInput {
    /** The actor performing the toggle (must own the accommodation, or hold ACCOMMODATION_UPDATE_ANY). */
    readonly actor: Actor;
    /** The accommodation to toggle. */
    readonly accommodationId: string;
    /** New value for `accommodations.isFeatured`. */
    readonly isFeatured: boolean;
}

/**
 * Sets `accommodations.isFeatured` for a single accommodation, gated behind
 * ownership and a live FEATURED_LISTING entitlement (plan OR addon).
 *
 * @param input - Actor, accommodation id, and the target `isFeatured` value.
 * @returns The new `isFeatured` value on success.
 * @throws {ServiceError} `NOT_FOUND` when the accommodation does not exist or
 *   is soft-deleted. `FORBIDDEN` when the actor does not own the
 *   accommodation (and lacks `ACCOMMODATION_UPDATE_ANY`), or when neither the
 *   owner's plan nor an accommodation-scoped addon currently grants
 *   FEATURED_LISTING.
 */
export async function setAccommodationFeaturedToggle(
    input: SetAccommodationFeaturedToggleInput
): Promise<{ isFeatured: boolean }> {
    const { actor, accommodationId, isFeatured } = input;

    const accommodation = await accommodationModel.findById(accommodationId);
    if (!accommodation || accommodation.deletedAt !== null) {
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            `Accommodation not found: ${accommodationId}`
        );
    }

    const hasAny = hasPermission(actor, PermissionEnum.ACCOMMODATION_UPDATE_ANY);
    const hasOwn = hasPermission(actor, PermissionEnum.ACCOMMODATION_UPDATE_OWN);
    if (!hasAny && !(hasOwn && actor.id === accommodation.ownerId)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: ACCOMMODATION_UPDATE_OWN or ACCOMMODATION_UPDATE_ANY required, and actor must own the accommodation'
        );
    }

    const [planGrantsFeatured, addonGrantsFeatured] = await Promise.all([
        resolveOwnerPlanGrantsFeatured({ ownerId: accommodation.ownerId }),
        resolveAccommodationHasActiveFeaturedAddon({ accommodationId })
    ]);

    if (!planGrantsFeatured && !addonGrantsFeatured) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'No active FEATURED_LISTING entitlement (plan or addon) for this accommodation'
        );
    }

    await accommodationModel.update({ id: accommodationId }, { isFeatured, updatedById: actor.id });

    return { isFeatured };
}

/**
 * Input for {@link getAccommodationFeaturedEntitlement}.
 */
export interface GetAccommodationFeaturedEntitlementInput {
    /** The actor requesting the entitlement status (must own the accommodation, or hold ACCOMMODATION_UPDATE_ANY). */
    readonly actor: Actor;
    /** The accommodation to check. */
    readonly accommodationId: string;
}

/**
 * Reads the current `isFeatured` value and whether the owner currently holds
 * a live FEATURED_LISTING entitlement (plan OR addon) for a single
 * accommodation — the read-side counterpart to
 * {@link setAccommodationFeaturedToggle}, used by the web owner editor to
 * decide whether to render the self-service toggle at all.
 *
 * @param input - Actor and accommodation id.
 * @returns The current `isFeatured` value and `hasEntitlement` gate status.
 * @throws {ServiceError} `NOT_FOUND` when the accommodation does not exist or
 *   is soft-deleted. `FORBIDDEN` when the actor does not own the
 *   accommodation and lacks `ACCOMMODATION_UPDATE_ANY`.
 */
export async function getAccommodationFeaturedEntitlement(
    input: GetAccommodationFeaturedEntitlementInput
): Promise<{ isFeatured: boolean; hasEntitlement: boolean }> {
    const { actor, accommodationId } = input;

    const accommodation = await accommodationModel.findById(accommodationId);
    if (!accommodation || accommodation.deletedAt !== null) {
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            `Accommodation not found: ${accommodationId}`
        );
    }

    const hasAny = hasPermission(actor, PermissionEnum.ACCOMMODATION_UPDATE_ANY);
    const hasOwn = hasPermission(actor, PermissionEnum.ACCOMMODATION_UPDATE_OWN);
    if (!hasAny && !(hasOwn && actor.id === accommodation.ownerId)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: ACCOMMODATION_UPDATE_OWN or ACCOMMODATION_UPDATE_ANY required, and actor must own the accommodation'
        );
    }

    const [planGrantsFeatured, addonGrantsFeatured] = await Promise.all([
        resolveOwnerPlanGrantsFeatured({ ownerId: accommodation.ownerId }),
        resolveAccommodationHasActiveFeaturedAddon({ accommodationId })
    ]);

    return {
        isFeatured: accommodation.isFeatured,
        hasEntitlement: planGrantsFeatured || addonGrantsFeatured
    };
}
