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

function menuTraitEntitlement(traitId: string): string {
    const menu = LISTING_SECTIONS.venue.find((candidate) => candidate.id === 'menu');
    const trait =
        menu && 'traits' in menu
            ? menu.traits?.find((candidate) => candidate.id === traitId)
            : undefined;
    if (!trait) throw new Error(`Missing entitlement for venue menu trait: ${traitId}`);
    return trait.entitlementKey;
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
        venueEvents: resolve(sectionEntitlement('venueEvents'))
    };
}
