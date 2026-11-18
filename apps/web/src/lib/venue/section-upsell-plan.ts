import { LISTING_SECTIONS } from '@repo/schemas';
import type { PublicPlanData } from '@/lib/billing/fetch-plans';
import { getPlanName } from '@/lib/billing/plan-name';

type Translator = (key: string, fallback?: string) => string;

/** Plan names resolved for the venue editor's section and menu traits. */
export interface VenueUpsellPlans {
    readonly menu: string | null;
    readonly itemPhotos: string | null;
    readonly translations: string | null;
    readonly dailySpecials: string | null;
    readonly venueEvents: string | null;
    /** HOS-2258: the `media.videos` trait. `null` while no plan grants it. */
    readonly videos: string | null;
}

/**
 * Find the first plan that unlocks an entitlement and return its localized name.
 * This trusts the cheapest-to-most-expensive order supplied by `fetchAudiencePlans`.
 */
export function resolveUnlockingPlanName(input: {
    readonly plans: readonly PublicPlanData[];
    readonly entitlementKey: string;
    readonly t: Translator;
}): string | null {
    const plan = input.plans.find((candidate) =>
        candidate.entitlements.includes(input.entitlementKey)
    );
    return plan ? getPlanName({ plan, t: input.t }) : null;
}

function sectionEntitlement(sectionId: string): string {
    const section = LISTING_SECTIONS.venue.find((candidate) => candidate.id === sectionId);
    if (!section || !('entitlementKey' in section)) {
        throw new Error(`Missing entitlement for venue section: ${sectionId}`);
    }
    return section.entitlementKey;
}

function traitEntitlement(sectionId: string, traitId: string): string {
    const section = LISTING_SECTIONS.venue.find((candidate) => candidate.id === sectionId);
    const trait =
        section && 'traits' in section
            ? section.traits?.find((candidate) => candidate.id === traitId)
            : undefined;
    if (!trait) throw new Error(`Missing entitlement for venue ${sectionId} trait: ${traitId}`);
    return trait.entitlementKey;
}

function menuTraitEntitlement(traitId: string): string {
    return traitEntitlement('menu', traitId);
}

/** Resolve each venue editor upsell from the catalog's section and trait definitions. */
export function resolveVenueUpsellPlans(input: {
    readonly plans: readonly PublicPlanData[];
    readonly t: Translator;
}): VenueUpsellPlans {
    const resolve = (entitlementKey: string) =>
        resolveUnlockingPlanName({ ...input, entitlementKey });
    return {
        menu: resolve(sectionEntitlement('menu')),
        itemPhotos: resolve(menuTraitEntitlement('itemPhotos')),
        translations: resolve(menuTraitEntitlement('translations')),
        dailySpecials: resolve(sectionEntitlement('dailySpecials')),
        venueEvents: resolve(sectionEntitlement('venueEvents')),
        videos: resolve(traitEntitlement('media', 'videos'))
    };
}
