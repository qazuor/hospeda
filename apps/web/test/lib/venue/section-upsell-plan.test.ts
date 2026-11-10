import { LISTING_SECTIONS } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { PublicPlanData } from '@/lib/billing/fetch-plans';
import { resolveUnlockingPlanName, resolveVenueUpsellPlans } from '@/lib/venue/section-upsell-plan';

const menuEntitlement = LISTING_SECTIONS.venue.find((section) => section.id === 'menu')!
    .entitlementKey!;
const plan = (slug: string, name: string, entitlements: readonly string[]) =>
    ({
        id: slug,
        vertical: 'venue',
        slug,
        name,
        description: '',
        category: 'owner',
        monthlyPriceArs: 100,
        annualPriceArs: null,
        hasTrial: false,
        trialDays: 0,
        sortOrder: 1,
        isActive: true,
        inheritsTouristVip: false,
        entitlements,
        limits: {}
    }) satisfies PublicPlanData;

describe('venue section upsell plan resolution', () => {
    it('returns the cheapest plan that contains the entitlement', () => {
        const plans = [
            plan('basic', 'Básico', []),
            plan('middle', 'Intermedio', [menuEntitlement]),
            plan('top', 'Superior', [menuEntitlement])
        ];
        expect(
            resolveUnlockingPlanName({
                plans,
                entitlementKey: menuEntitlement,
                t: (key, fallback) => fallback ?? key
            })
        ).toBe('Intermedio');
    });

    it('uses the renamed catalog name and localized translation', () => {
        const plans = [plan('middle', 'Nuevo nombre', [menuEntitlement])];
        expect(
            resolveUnlockingPlanName({
                plans,
                entitlementKey: menuEntitlement,
                t: (key, fallback) =>
                    key === 'billing.plan.middle.name' ? 'Nombre localizado' : (fallback ?? key)
            })
        ).toBe('Nombre localizado');
    });

    it('returns null when no plan or no catalog entry unlocks the entitlement', () => {
        const t = (key: string, fallback?: string) => fallback ?? key;
        expect(
            resolveUnlockingPlanName({
                plans: [plan('basic', 'Básico', [])],
                entitlementKey: menuEntitlement,
                t
            })
        ).toBeNull();
        expect(
            resolveUnlockingPlanName({ plans: [], entitlementKey: menuEntitlement, t })
        ).toBeNull();
    });

    it('resolves all venue editor section and trait plan names', () => {
        const t = (key: string, fallback?: string) => fallback ?? key;
        const plans = [
            plan(
                'all',
                'Plan completo',
                LISTING_SECTIONS.venue.flatMap((section) => [
                    ...('entitlementKey' in section && section.entitlementKey
                        ? [section.entitlementKey]
                        : []),
                    ...('traits' in section
                        ? (section.traits ?? []).map((trait) => trait.entitlementKey)
                        : [])
                ])
            )
        ];
        expect(resolveVenueUpsellPlans({ plans, t })).toEqual({
            menu: 'Plan completo',
            itemPhotos: 'Plan completo',
            translations: 'Plan completo',
            dailySpecials: 'Plan completo',
            venueEvents: 'Plan completo'
        });
    });
});
