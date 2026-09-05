import { ProductDomainEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    AI_SUPPORT_ADDON,
    ALL_ADDONS,
    ALL_PRIVATE_GALLERY_ADDONS,
    EXTRA_EXPERIENCES_ADDON,
    EXTRA_GASTRONOMIES_ADDON,
    EXTRA_PHOTOS_ADDON,
    getAddonBySlug,
    PRIVATE_GALLERIES_5_ADDON,
    PRIVATE_GALLERIES_10_ADDON,
    PRIVATE_GALLERIES_20_ADDON,
    productDomainForAddonSlug,
    VISIBILITY_BOOST_30D_ADDON,
    VISIBILITY_BOOST_ADDON
} from '../src/config/addons.config.js';
import { productDomainForLimitKey } from '../src/config/commerce-limits.config.js';
import { EntitlementKey } from '../src/types/entitlement.types.js';
import { LimitKey } from '../src/types/plan.types.js';

describe('Add-on Configuration', () => {
    describe('ALL_ADDONS', () => {
        it('should export 11 add-ons', () => {
            // 6 accommodation-era add-ons, the two per-vertical extra-listing
            // add-ons HOS-688 introduced, and HOS-1060's three private-gallery
            // packs. Recounted rather than incremented: the previous number was
            // 8 and "8 + 3" is only right while nothing else moved.
            expect(ALL_ADDONS).toHaveLength(11);
        });

        it('should have one-time add-ons', () => {
            const oneTimeAddons = ALL_ADDONS.filter((a) => a.billingType === 'one_time');
            expect(oneTimeAddons.length).toBeGreaterThan(0);
        });

        it('should have recurring add-ons', () => {
            const recurringAddons = ALL_ADDONS.filter((a) => a.billingType === 'recurring');
            expect(recurringAddons.length).toBeGreaterThan(0);
        });
    });

    describe('getAddonBySlug', () => {
        it('should return addon for valid slug', () => {
            const addon = getAddonBySlug('visibility-boost-7d');
            expect(addon).toBeDefined();
            expect(addon?.slug).toBe('visibility-boost-7d');
        });

        it('should return undefined for invalid slug', () => {
            const addon = getAddonBySlug('invalid-slug');
            expect(addon).toBeUndefined();
        });
    });

    describe('Visibility Boost Add-on', () => {
        it('should be one-time billing', () => {
            expect(VISIBILITY_BOOST_ADDON.billingType).toBe('one_time');
        });

        it('should have duration in days', () => {
            expect(VISIBILITY_BOOST_ADDON.durationDays).toBe(7);
        });

        it('should grant featured listing entitlement', () => {
            expect(VISIBILITY_BOOST_ADDON.grantsEntitlement).toBe('featured_listing');
        });

        it('should target owner and complex categories', () => {
            expect(VISIBILITY_BOOST_ADDON.targetCategories).toEqual(['owner', 'complex']);
        });

        it('should require an accommodation target on purchase (SPEC-309 OQ-3)', () => {
            // The addon is purchased and applied per-accommodation, not owner-wide
            // like the plan-derived featuring — see the featured_listing_addon_grants
            // link table (T-002).
            expect(VISIBILITY_BOOST_ADDON.requiresAccommodationTarget).toBe(true);
            expect(VISIBILITY_BOOST_30D_ADDON.requiresAccommodationTarget).toBe(true);
        });
    });

    describe('Per-vertical extra-listing add-ons (HOS-688)', () => {
        it('points each add-on at its OWN vertical cap and nothing else', () => {
            // A cross-wired `affectsLimitKey` is the failure that raises the
            // wrong cap: the owner pays for an extra restaurant and receives an
            // extra excursion, with nothing anywhere reporting an error.
            expect(EXTRA_GASTRONOMIES_ADDON.affectsLimitKey).toBe(LimitKey.MAX_GASTRONOMIES);
            expect(EXTRA_EXPERIENCES_ADDON.affectsLimitKey).toBe(LimitKey.MAX_EXPERIENCES);
        });

        it('raises the cap by exactly one listing', () => {
            expect(EXTRA_GASTRONOMIES_ADDON.limitIncrease).toBe(1);
            expect(EXTRA_EXPERIENCES_ADDON.limitIncrease).toBe(1);
        });

        it('is recurring, grants no entitlement, and is purchasable', () => {
            for (const addon of [EXTRA_GASTRONOMIES_ADDON, EXTRA_EXPERIENCES_ADDON]) {
                expect(addon.billingType).toBe('recurring');
                expect(addon.durationDays).toBeNull();
                expect(addon.grantsEntitlement).toBeNull();
                expect(addon.isActive).toBe(true);
            }
        });

        it('is resolvable by slug (the usage panel links it by slug)', () => {
            expect(getAddonBySlug('extra-gastronomies-1')).toBe(EXTRA_GASTRONOMIES_ADDON);
            expect(getAddonBySlug('extra-experiences-1')).toBe(EXTRA_EXPERIENCES_ADDON);
        });
    });

    describe('Extra Photos Add-on', () => {
        it('should be recurring billing', () => {
            expect(EXTRA_PHOTOS_ADDON.billingType).toBe('recurring');
        });

        it('should have null duration for recurring', () => {
            expect(EXTRA_PHOTOS_ADDON.durationDays).toBeNull();
        });

        it('should affect MAX_PHOTOS_PER_ACCOMMODATION limit', () => {
            expect(EXTRA_PHOTOS_ADDON.affectsLimitKey).toBe('max_photos_per_accommodation');
        });

        it('should increase limit by 20', () => {
            expect(EXTRA_PHOTOS_ADDON.limitIncrease).toBe(20);
        });

        it('should not require an accommodation target (unrelated to featuring)', () => {
            expect(EXTRA_PHOTOS_ADDON.requiresAccommodationTarget).toBeFalsy();
        });
    });

    describe('Add-on Pricing', () => {
        it('should have prices in cents', () => {
            expect(VISIBILITY_BOOST_ADDON.priceArs).toBe(500000); // ARS $5,000
            expect(EXTRA_PHOTOS_ADDON.priceArs).toBe(500000); // ARS $5,000
        });

        it('every add-on is active except the ones whose feature does not exist yet', () => {
            // Two deferred families, one reason. `ai-support-monthly`'s feature
            // route is deferred (SPEC-211 §AC-4.2); the three
            // `private-galleries-*` packs are HOS-1060 phase 1, which ships the
            // billing rail and nothing that can create, serve or expire a
            // gallery. An active add-on for a feature that does not exist means
            // the buyer pays and receives nothing.
            //
            // Asserted as an explicit SET rather than "everything else is
            // active", so activating one of them has to be a decision recorded
            // here rather than a silent side effect.
            const inactive = ALL_ADDONS.filter((a) => !a.isActive).map((a) => a.slug);
            expect(new Set(inactive)).toEqual(
                new Set([
                    'ai-support-monthly',
                    'private-galleries-5',
                    'private-galleries-10',
                    'private-galleries-20'
                ])
            );
        });
    });

    describe('AI Support Add-on (AC-4.1)', () => {
        it('should exist in ALL_ADDONS with slug ai-support-monthly', () => {
            const addon = ALL_ADDONS.find((a) => a.slug === 'ai-support-monthly');
            expect(addon).toBeDefined();
        });

        it('should have recurring billing type', () => {
            expect(AI_SUPPORT_ADDON.billingType).toBe('recurring');
        });

        it('should grant AI_SUPPORT entitlement', () => {
            expect(AI_SUPPORT_ADDON.grantsEntitlement).toBe(EntitlementKey.AI_SUPPORT);
        });

        it('should affect MAX_AI_SUPPORT_PER_MONTH limit key', () => {
            expect(AI_SUPPORT_ADDON.affectsLimitKey).toBe(LimitKey.MAX_AI_SUPPORT_PER_MONTH);
        });

        it('should have a finite positive limitIncrease (not -1)', () => {
            const { limitIncrease } = AI_SUPPORT_ADDON;
            expect(limitIncrease).not.toBeNull();
            expect(Number.isFinite(limitIncrease)).toBe(true);
            expect(limitIncrease as number).toBeGreaterThan(0);
            expect(limitIncrease).not.toBe(-1);
        });

        it('should have null durationDays (recurring)', () => {
            expect(AI_SUPPORT_ADDON.durationDays).toBeNull();
        });

        it('should target owner and complex categories', () => {
            expect(AI_SUPPORT_ADDON.targetCategories).toEqual(['owner', 'complex']);
        });

        it('should be inactive until the ai_support feature ships (deferred)', () => {
            // The ai_support feature route + final pricing are deferred to a future
            // spec (SPEC-211 §AC-4.2). Shipping it active at a placeholder price
            // would let a host pay for a feature that does not exist yet.
            expect(AI_SUPPORT_ADDON.isActive).toBe(false);
        });
    });

    describe('productDomain (HOS-1060, closing HOS-974 D-C)', () => {
        /**
         * The domain each slug MUST carry, spelled out one by one.
         *
         * A derived assertion — "every add-on whose `affectsLimitKey` is a
         * commerce key carries a commerce domain" — would have passed on the
         * exact bug this field exists to fix, because before it existed there
         * was nothing to derive from. The table is the decision; the tests
         * below check the catalogue against it.
         */
        const EXPECTED_DOMAIN_BY_SLUG: Readonly<Record<string, string>> = {
            'visibility-boost-7d': ProductDomainEnum.ACCOMMODATION,
            'visibility-boost-30d': ProductDomainEnum.ACCOMMODATION,
            'extra-photos-20': ProductDomainEnum.ACCOMMODATION,
            'extra-accommodations-5': ProductDomainEnum.ACCOMMODATION,
            'extra-properties-5': ProductDomainEnum.ACCOMMODATION,
            'ai-support-monthly': ProductDomainEnum.ACCOMMODATION,
            'extra-gastronomies-1': ProductDomainEnum.GASTRONOMY,
            'extra-experiences-1': ProductDomainEnum.EXPERIENCE,
            'private-galleries-5': ProductDomainEnum.EXPERIENCE,
            'private-galleries-10': ProductDomainEnum.EXPERIENCE,
            'private-galleries-20': ProductDomainEnum.EXPERIENCE
        };

        it('declares a domain on EVERY add-on — none falls through', () => {
            const undeclared = ALL_ADDONS.filter((a) => a.productDomain === undefined).map(
                (a) => a.slug
            );

            expect(undeclared).toEqual([]);
            // Non-vacuity: the catalogue is not empty, so the filter above ran.
            expect(ALL_ADDONS.length).toBeGreaterThan(8);
        });

        it('gives each add-on the domain the owner decided, slug by slug', () => {
            // The failure this catches is the one that was live in production
            // until this field landed: `extra-gastronomies-1` and
            // `extra-experiences-1` were byte-identical on every field anyone
            // could filter by, so a gastronomy owner could buy the experience
            // pack. Asserting per slug (not per group) is what makes a single
            // mis-copied line fail.
            for (const addon of ALL_ADDONS) {
                expect(addon.productDomain, `add-on ${addon.slug}`).toBe(
                    EXPECTED_DOMAIN_BY_SLUG[addon.slug]
                );
            }
            // The table covers the whole catalogue: an add-on added without a
            // row here fails above with `toBe(undefined)`, and a row left
            // behind by a deleted add-on fails here.
            expect(new Set(ALL_ADDONS.map((a) => a.slug))).toEqual(
                new Set(Object.keys(EXPECTED_DOMAIN_BY_SLUG))
            );
        });

        it('agrees with the domain that owns the cap it raises', () => {
            // An add-on raising a cap whose domain differs from its own is the
            // silent version of the same bug: the increase is applied against a
            // subscription that supplies no base for the key, which resolves to
            // -1 one layer down.
            for (const addon of ALL_ADDONS) {
                if (addon.affectsLimitKey === null) {
                    continue;
                }
                expect(addon.productDomain, `add-on ${addon.slug}`).toBe(
                    productDomainForLimitKey(addon.affectsLimitKey)
                );
            }
        });

        it('resolves a domain by slug, and answers undefined for a slug it does not know', () => {
            expect(productDomainForAddonSlug('extra-experiences-1')).toBe(
                ProductDomainEnum.EXPERIENCE
            );
            expect(productDomainForAddonSlug('extra-photos-20')).toBe(
                ProductDomainEnum.ACCOMMODATION
            );

            // The half that matters: an operator-created add-on the catalogue
            // does not know must NOT come back as accommodation — that is the
            // `?? ACCOMMODATION` HOS-1078 deleted one layer down.
            for (const unknown of ['operator-invented', 'extra-experiences-2', '']) {
                const result = productDomainForAddonSlug(unknown);
                expect(result).toBeUndefined();
                expect(result).not.toBe(ProductDomainEnum.ACCOMMODATION);
            }
        });
    });

    describe('Private-gallery packs (HOS-1060)', () => {
        it('sells exactly the three sizes the owner set: +5, +10, +20', () => {
            expect(ALL_PRIVATE_GALLERY_ADDONS.map((a) => a.limitIncrease)).toEqual([5, 10, 20]);
            expect(ALL_PRIVATE_GALLERY_ADDONS.map((a) => a.slug)).toEqual([
                'private-galleries-5',
                'private-galleries-10',
                'private-galleries-20'
            ]);
        });

        it('raises the gallery cap and NOT any other', () => {
            // The cross-wiring failure `EXTRA_GASTRONOMIES_ADDON`'s own test
            // names: a pack pointing at the wrong key sells galleries and
            // delivers listings, with nothing reporting an error.
            for (const addon of ALL_PRIVATE_GALLERY_ADDONS) {
                expect(addon.affectsLimitKey).toBe(LimitKey.MAX_ACTIVE_PRIVATE_GALLERIES);
            }
        });

        it('ALSO grants the capability, which is what makes it usable on básico and pro', () => {
            // Not decoration. `experience-basico` and `experience-pro` grant
            // nothing, so a pack that only raised a cap would sell an owner
            // more of a feature they cannot reach — and the cap, being the
            // second gate, would look correctly configured the whole time.
            for (const addon of ALL_PRIVATE_GALLERY_ADDONS) {
                expect(addon.grantsEntitlement).toBe(
                    EntitlementKey.MANAGE_EXPERIENCE_PRIVATE_GALLERIES
                );
            }
        });

        it('is recurring, experience-domain, and priced as an ascending ladder', () => {
            for (const addon of ALL_PRIVATE_GALLERY_ADDONS) {
                expect(addon.billingType).toBe('recurring');
                expect(addon.durationDays).toBeNull();
                expect(addon.productDomain).toBe(ProductDomainEnum.EXPERIENCE);
                // Ten months, the rule every recurring definition here follows.
                expect(addon.annualPriceArs).toBe(addon.priceArs * 10);
            }

            const prices = ALL_PRIVATE_GALLERY_ADDONS.map((a) => a.priceArs);
            expect(prices).toEqual([...prices].sort((a, b) => a - b));
            expect(new Set(prices).size).toBe(prices.length);
        });

        it('prices a bigger pack cheaper PER GALLERY, strictly', () => {
            // The shape that makes the three a ladder rather than three
            // unrelated products, and the one a digit slip breaks without
            // breaking anything else: a +20 pack costing more per gallery than
            // a +5 would still seed, still be purchasable and still be charged.
            const perGallery = ALL_PRIVATE_GALLERY_ADDONS.map(
                (a) => a.priceArs / (a.limitIncrease as number)
            );
            for (let i = 1; i < perGallery.length; i++) {
                expect(perGallery[i] as number).toBeLessThan(perGallery[i - 1] as number);
            }
        });

        it('is resolvable by slug (the usage panel links a pack from the at-cap row)', () => {
            expect(getAddonBySlug('private-galleries-5')).toBe(PRIVATE_GALLERIES_5_ADDON);
            expect(getAddonBySlug('private-galleries-10')).toBe(PRIVATE_GALLERIES_10_ADDON);
            expect(getAddonBySlug('private-galleries-20')).toBe(PRIVATE_GALLERIES_20_ADDON);
        });

        it('never requires an accommodation target', () => {
            // `requiresAccommodationTarget` scopes an add-on's effect to ONE
            // accommodation (SPEC-309). A gallery pack raises an owner-wide,
            // experience-domain cap; capturing an accommodation would bind it
            // to an entity from the wrong domain entirely.
            for (const addon of ALL_PRIVATE_GALLERY_ADDONS) {
                expect(addon.requiresAccommodationTarget).toBeFalsy();
            }
        });
    });
});
