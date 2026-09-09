/**
 * Resolving and authorising the LISTING a targeted add-on applies to
 * (HOS-1286).
 *
 * A `requiresAccommodationTarget` add-on applies its effect to exactly one
 * listing rather than owner-wide. Until HOS-1286 that listing could only be an
 * accommodation, because `featured_listing_addon_grants` had a foreign key to
 * `accommodations.id` and `createAddonCheckout` looked the target up in
 * `AccommodationModel` unconditionally.
 *
 * Both are now polymorphic, and this module is the single place that decides
 * WHICH table a target id belongs to.
 *
 * ## The vertical comes from the ADD-ON, never from the request
 *
 * The caller supplies an id and nothing else. The table it is looked up in is
 * derived from `addon.productDomain` via `resolveFeaturableEntityType`. That
 * ordering is deliberate: if the request could name its own entity type, a
 * gastronomy owner could pass `'accommodation'` alongside a gastronomy add-on
 * and have the grant written against a table the add-on has no business in.
 * With the domain as the only source, "which vertical" and "which add-on" cannot
 * disagree.
 *
 * ## Fails closed on an add-on with no domain
 *
 * `AddonDefinition.productDomain` is `undefined` for a slug the catalogue does
 * not know — one an operator created through the SPEC-168 admin UI. Such an
 * add-on cannot be targeted at anything, so this refuses it rather than
 * defaulting to accommodation, which is the `??` HOS-1078 removed one layer
 * down and which here would write a grant against the wrong table.
 *
 * @module services/addon-target-listing
 */

import { AccommodationModel, ExperienceModel, GastronomyModel } from '@repo/db';
import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import { type FeaturableEntityType, resolveFeaturableEntityType } from '@repo/service-core';

/** Lazily-constructed models, mirroring the module-level singletons in `addon.checkout.ts`. */
const accommodationModel = new AccommodationModel();
const gastronomyModel = new GastronomyModel();
const experienceModel = new ExperienceModel();

/** The minimal shape every listing table shares for this check. */
interface OwnedListingRow {
    readonly ownerId?: string | null;
    readonly deletedAt?: Date | string | null;
}

/**
 * Which model answers for each vertical, and the human word for its listings.
 *
 * A record rather than a `switch`, so adding a vertical is one line and an
 * unhandled one is a missing key rather than a silent `else`.
 */
const TARGET_LISTING_LOOKUP: Readonly<
    Record<
        FeaturableEntityType,
        { readonly noun: string; readonly findById: (id: string) => Promise<unknown> }
    >
> = {
    [ProductDomainEnum.ACCOMMODATION]: {
        noun: 'Accommodation',
        findById: (id) => accommodationModel.findById(id)
    },
    [ProductDomainEnum.GASTRONOMY]: {
        noun: 'Gastronomy listing',
        findById: (id) => gastronomyModel.findById(id)
    },
    [ProductDomainEnum.EXPERIENCE]: {
        noun: 'Experience listing',
        findById: (id) => experienceModel.findById(id)
    }
};

/** A refusal, shaped like the error half of `createAddonCheckout`'s `ServiceResult`. */
export interface AddonTargetListingError {
    readonly code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'FORBIDDEN' | 'ADDON_DOMAIN_UNKNOWN';
    readonly message: string;
}

/** Success: the vertical the grant must be stamped with, and the listing id. */
export interface AddonTargetListing {
    readonly entityType: FeaturableEntityType;
    readonly entityId: string;
}

/**
 * Reads the target listing id out of the two field names that carry it.
 *
 * `entityId` is the canonical name (HOS-1286); `accommodationId` is the
 * deprecated one kept for a release so a MercadoPago checkout created before the
 * deploy — whose stored metadata only has the old key — still resolves its
 * target when the payer comes back. `entityId` wins when both are present.
 *
 * One helper rather than `a ?? b` at each site: there are four (checkout create,
 * checkout confirm, the recurring activation path, and the webhook border), and
 * a site that forgets the fallback silently drops the target rather than
 * failing — the precise shape of HOS-675.
 *
 * @param input - A bag that may carry either name.
 * @returns The target listing id, or `undefined` when neither is set.
 */
export function resolveAddonTargetId(input: {
    readonly entityId?: string | undefined;
    readonly accommodationId?: string | undefined;
}): string | undefined {
    return input.entityId ?? input.accommodationId;
}

/** Input for {@link resolveAddonTargetListing}. */
export interface ResolveAddonTargetListingInput {
    /** The add-on being purchased — only its slug and declared domain are read. */
    readonly addon: {
        readonly slug: string;
        readonly productDomain: ProductDomainValue | undefined;
    };
    /** The listing id the buyer chose, if any. */
    readonly entityId: string | undefined;
    /** `users.id` of the buyer, checked against the listing's owner. */
    readonly userId: string;
}

/**
 * Validates that `entityId` names a live listing of the add-on's vertical that
 * the buyer owns.
 *
 * Refusals follow the repo's error contract order: input shape (400) before
 * existence (404) before ownership. Ownership answers **FORBIDDEN rather than
 * NOT_FOUND**, which is the pre-HOS-1286 behaviour of this check preserved
 * deliberately: the buyer is authenticated and picked from a list of their own
 * listings, so there is no id to conceal from them, and turning it into a 404
 * would be a silent behaviour change to the accommodation flow this issue was
 * not asked to make.
 *
 * @param input - The add-on, the chosen listing id, and the buyer.
 * @returns The resolved `(entityType, entityId)`, or the refusal to return.
 */
export async function resolveAddonTargetListing(
    input: ResolveAddonTargetListingInput
): Promise<
    { ok: true; target: AddonTargetListing } | { ok: false; error: AddonTargetListingError }
> {
    const entityType = resolveFeaturableEntityType({
        productDomain: input.addon.productDomain
    });

    if (!entityType) {
        return {
            ok: false,
            error: {
                code: 'ADDON_DOMAIN_UNKNOWN',
                message: `Add-on '${input.addon.slug}' targets a single listing but declares no vertical that owns one`
            }
        };
    }

    if (!input.entityId) {
        return {
            ok: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: `A target listing is required to purchase '${input.addon.slug}'`
            }
        };
    }

    const lookup = TARGET_LISTING_LOOKUP[entityType];
    const row = (await lookup.findById(input.entityId)) as OwnedListingRow | null;

    // `findById` does not filter soft-deleted rows (see base.model.ts), so a
    // deleted listing must be treated the same as a missing one.
    if (!row || row.deletedAt) {
        return {
            ok: false,
            error: {
                code: 'NOT_FOUND',
                message: `${lookup.noun} '${input.entityId}' not found`
            }
        };
    }

    if (row.ownerId !== input.userId) {
        return {
            ok: false,
            error: { code: 'FORBIDDEN', message: 'You do not own this listing' }
        };
    }

    return { ok: true, target: { entityType, entityId: input.entityId } };
}
