/**
 * @file listing-creation-catalog.ts
 * @description The catalog reads the create wizard shares (HOS-2329, spec
 * HOS-2335 §6.4): `get_listing_creation_guide` shows them, `create_listing`
 * checks its input against them. One reader each, so the guide never offers a
 * value the create would refuse.
 *
 * - type options per vertical, with their Spanish labels (`listing-labels.ts`,
 *   the same translations the public site uses);
 * - experience price units, with labels;
 * - the CITY destinations (`DestinationService.search` as the guest, exactly
 *   what the web create form lists);
 * - venue business lines allowed per type (`BUSINESS_LINE_RULES`);
 * - the publish quota of the owner (`resolvePublishPrecheck`, fail-open). It is
 *   informational: CREATE has no limit step (`OPERATION_STEP6_KEY.CREATE` is
 *   `NONE`), drafts are unlimited, and the cap is enforced at publish as
 *   `LISTING_LIMIT_REACHED` (§11 U-2).
 */

import {
    AccommodationTypeEnum,
    BUSINESS_LINE_RULES,
    DestinationTypeEnum,
    ExperiencePriceUnitEnum,
    ExperienceTypeEnum,
    VenueTypeEnum,
    VerticalEnum
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { DestinationService } from '@repo/service-core';
import {
    accommodationTypeLabel,
    experiencePriceUnitLabel,
    experienceTypeLabel,
    venueTypeLabel
} from '../../../services/ai-context/listing-labels';
import { resolvePublishPrecheck } from '../../../services/publish-precheck.service';
import { createGuestActor } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import type { ListingToolVertical } from './listing-services';

/** A value the user picks, with the label to show. */
export interface CreationOption {
    readonly value: string;
    readonly label: string;
}

/** A destination the listing may belong to. */
export interface CreationDestination {
    readonly id: string;
    readonly name: string;
}

const LOCALE = 'es';

/** Most CITY destinations the guide lists (the public catalog holds ~25). */
const DESTINATIONS_PAGE_SIZE = 100;

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * The type options of a vertical, with Spanish labels.
 *
 * @param args - The vertical
 * @returns One option per enum value, in enum order
 */
export function listingTypeOptions({
    vertical
}: {
    readonly vertical: ListingToolVertical;
}): readonly CreationOption[] {
    if (vertical === VerticalEnum.ACCOMMODATION) {
        return Object.values(AccommodationTypeEnum).map((type) => ({
            value: type,
            label: accommodationTypeLabel({ type, locale: LOCALE }).label
        }));
    }
    if (vertical === VerticalEnum.VENUE) {
        return Object.values(VenueTypeEnum).map((type) => ({
            value: type,
            label: venueTypeLabel({ type, locale: LOCALE }).label
        }));
    }
    return Object.values(ExperienceTypeEnum).map((type) => ({
        value: type,
        label: experienceTypeLabel({ type, locale: LOCALE }).label
    }));
}

/**
 * The Spanish label of a type value of a vertical.
 *
 * @param args - The vertical and the type value
 * @returns The label (a humanized value when it has no translation)
 */
export function listingTypeLabel({
    vertical,
    type
}: {
    readonly vertical: ListingToolVertical;
    readonly type: string;
}): string {
    return listingTypeOptions({ vertical }).find((option) => option.value === type)?.label ?? type;
}

/** The experience price units, with Spanish labels. */
export function experiencePriceUnitOptions(): readonly CreationOption[] {
    return Object.values(ExperiencePriceUnitEnum).map((unit) => ({
        value: unit,
        label: experiencePriceUnitLabel({ unit, locale: LOCALE }).label
    }));
}

/**
 * The business lines a venue type allows, and the ones the portal preselects.
 *
 * @returns One entry per venue type
 */
export function venueBusinessLineOptions(): readonly {
    readonly type: string;
    readonly allowed: readonly string[];
    readonly preselect: readonly string[];
}[] {
    return Object.entries(BUSINESS_LINE_RULES.venue.typeRules).map(([type, rule]) => ({
        type,
        allowed: [...rule.allowed],
        preselect: [...rule.preselect]
    }));
}

/**
 * The CITY destinations, as the web create form lists them.
 *
 * @returns The destinations, or `undefined` when the catalog could not be read
 */
export async function listCreationDestinations(): Promise<
    readonly CreationDestination[] | undefined
> {
    const result = await destinationService.search(createGuestActor(), {
        destinationType: DestinationTypeEnum.CITY,
        page: 1,
        pageSize: DESTINATIONS_PAGE_SIZE
    });
    if (result.error || !result.data) {
        return undefined;
    }
    return result.data.items.map((destination) => ({
        id: destination.id,
        name: destination.name
    }));
}

/**
 * Reads one destination the listing may belong to.
 *
 * Only a CITY qualifies, the same set {@link listCreationDestinations} lists in
 * the guide: a province or region id the model copied from elsewhere is refused
 * as if it did not exist.
 *
 * @param args - The destination id from the input
 * @returns The destination, or `undefined` when it does not exist or is not a city
 */
export async function findCreationDestination({
    id
}: {
    readonly id: string;
}): Promise<CreationDestination | undefined> {
    const result = await destinationService.getById(createGuestActor(), id);
    if (result.error || !result.data || result.data.destinationType !== DestinationTypeEnum.CITY) {
        return undefined;
    }
    return { id: result.data.id, name: result.data.name };
}

/** The informational publish quota of a vertical. Never blocks a create. */
export interface PublishQuotaNote {
    /** Published listings of the vertical. */
    readonly published: number;
    /** The plan's cap; `-1` when there is no cap or it could not be read. */
    readonly maxAllowed: number;
    /** Whether a draft could be published today without freeing a slot. */
    readonly hasFreeSlot: boolean;
    /** The owner's open drafts of the vertical. */
    readonly drafts: readonly { readonly id: string; readonly name: string }[];
    /** Spanish note for the user, when the owner is at the cap. */
    readonly note?: string;
}

/**
 * Reads the owner's publish quota for a vertical through the portal precheck.
 *
 * @param args - The owner and the vertical
 * @returns The note (fail-open: an unreadable quota reads as "free slot")
 */
export async function readPublishQuotaNote({
    actor,
    vertical
}: {
    readonly actor: Actor;
    readonly vertical: ListingToolVertical;
}): Promise<PublishQuotaNote> {
    const precheck = await resolvePublishPrecheck({ actor, vertical });
    return {
        published: precheck.currentCount,
        maxAllowed: precheck.maxAllowed,
        hasFreeSlot: precheck.hasQuota,
        drafts: precheck.drafts.map((draft) => ({ id: draft.id, name: draft.name })),
        ...(precheck.hasQuota
            ? {}
            : {
                  note: 'Ya usás todos los lugares de publicación de tu plan: el borrador se crea igual, pero para publicarlo vas a necesitar liberar un lugar o mejorar el plan.'
              })
    };
}
