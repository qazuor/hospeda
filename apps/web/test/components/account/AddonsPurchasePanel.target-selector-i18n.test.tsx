/**
 * @file AddonsPurchasePanel.target-selector-i18n.test.tsx
 * @description Regression coverage for the HOS-1286 per-vertical target
 * selector translations, exercised against the REAL `@repo/i18n` catalog
 * rather than the synthetic mock `AddonsPurchasePanel.test.tsx` uses.
 *
 * ## Why this needs its own file, not a describe block in the existing one
 *
 * `AddonsPurchasePanel.test.tsx` mocks `@/lib/i18n` wholesale with a tiny
 * `CATALOG_TRANSLATIONS` lookup table. That mock is locale-blind: every `t()`
 * call it doesn't recognize returns the component's OWN inline fallback
 * string, regardless of what locale was rendered or what the real `es`/`en`/
 * `pt` JSON files actually contain. A test built on top of that mock can
 * prove the component asks for the right KEY NAME, but can never prove the
 * real translation files actually carry an entry at that key — which is
 * exactly the class of bug this file exists to catch: `account.addons.
 * accommodationSelect.label`/`placeholder`/`empty` used to be flat strings
 * (one value for every vertical), so `t('...label.gastronomy', FALLBACK)`
 * silently resolved to the component's hardcoded Spanish fallback in every
 * locale, including `en`/`pt` — a host with `locale=en` buying
 * `visibility-boost-7d` saw "Alojamiento" where the page otherwise reads
 * entirely in English.
 *
 * This file therefore leaves `@/lib/i18n` UNMOCKED. `apps/web/test/setup.ts`
 * already seeds `window.__HOSPEDA_I18N__` with the real, full `trans` catalog
 * for every test in this app (mirroring what the hashed `/i18n/<locale>.js`
 * asset does in production), so `createTranslations(locale)` here resolves
 * against the actual `packages/i18n/src/locales/*\/account.json` content.
 * A regression that flattens `accommodationSelect.label` back to one string
 * per locale makes every assertion below fail with the Spanish fallback text
 * instead of the expected localized string.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AddonCardData } from '../../../src/components/account/AddonsPurchasePanel.client';
import { AddonsPurchasePanel } from '../../../src/components/account/AddonsPurchasePanel.client';

vi.mock('../../../src/components/account/AddonsPurchasePanel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    billingApi: { purchaseAddon: vi.fn() }
}));

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

vi.mock('../../../src/lib/api-errors', () => ({
    translateApiError: ({ fallback }: { fallback?: string }) => fallback ?? 'error'
}));

// Deliberately NOT mocking '../../../src/lib/i18n' — see file docblock.

function targetedAddon({
    productDomain
}: {
    readonly productDomain: 'accommodation' | 'gastronomy' | 'experience';
}): AddonCardData {
    return {
        slug: `visibility-boost-${productDomain}-probe`,
        name: 'Visibility Boost (probe)',
        description: 'Feature a listing for 7 days.',
        billingType: 'one_time',
        priceArs: 500000,
        durationDays: 7,
        affectsLimitKey: null,
        limitIncrease: null,
        grantsEntitlement: 'featured_listing',
        targetCategories: ['owner'],
        isActive: true,
        sortOrder: 1,
        requiresAccommodationTarget: true,
        productDomain,
        recurringChargingEnabled: false
    };
}

/**
 * Expected real-catalog copy per locale and vertical noun, mirroring
 * `packages/i18n/src/locales/<locale>/account.json`
 * `account.addons.accommodationSelect.{label,placeholder,empty}.<noun>`.
 */
const EXPECTED = {
    en: {
        accommodation: {
            label: 'Accommodation',
            placeholder: 'Choose an accommodation',
            empty: 'You need an accommodation first'
        },
        gastronomy: {
            label: 'Restaurant',
            placeholder: 'Choose a restaurant',
            empty: 'You need a published restaurant first'
        },
        experience: {
            label: 'Experience',
            placeholder: 'Choose an experience',
            empty: 'You need a published experience first'
        }
    },
    pt: {
        accommodation: {
            label: 'Hospedagem',
            placeholder: 'Escolha uma hospedagem',
            empty: 'Você precisa de uma hospedagem primeiro'
        },
        gastronomy: {
            label: 'Restaurante',
            placeholder: 'Escolha um restaurante',
            empty: 'Você precisa de um restaurante publicado primeiro'
        },
        experience: {
            label: 'Experiência',
            placeholder: 'Escolha uma experiência',
            empty: 'Você precisa de uma experiência publicada primeiro'
        }
    }
} as const;

const NOUNS = ['accommodation', 'gastronomy', 'experience'] as const;
const LOCALES = ['en', 'pt'] as const;

describe('AddonsPurchasePanel target selector — real i18n per locale/vertical (HOS-1286)', () => {
    for (const locale of LOCALES) {
        for (const noun of NOUNS) {
            const copy = EXPECTED[locale][noun];

            it(`renders the ${locale} label/placeholder for a ${noun} target when listings exist`, () => {
                const addon = targetedAddon({ productDomain: noun });
                render(
                    <AddonsPurchasePanel
                        locale={locale}
                        addons={[addon]}
                        ownedAddonSlugs={[]}
                        targetListingsByDomain={{
                            [noun]: [{ id: 'listing-1', name: 'Listing One' }]
                        }}
                    />
                );

                expect(screen.getByText(copy.label)).toBeInTheDocument();
                expect(screen.getByText(copy.placeholder)).toBeInTheDocument();
            });

            it(`renders the ${locale} empty-state copy for a ${noun} target with no listings`, () => {
                const addon = targetedAddon({ productDomain: noun });
                render(
                    <AddonsPurchasePanel
                        locale={locale}
                        addons={[addon]}
                        ownedAddonSlugs={[]}
                        targetListingsByDomain={{ [noun]: [] }}
                    />
                );

                expect(screen.getByText(copy.empty)).toBeInTheDocument();
            });
        }
    }

    it('never falls back to the hardcoded Spanish copy for an en/pt accommodation target (the exact HOS-1286 regression)', () => {
        const addon = targetedAddon({ productDomain: 'accommodation' });
        render(
            <AddonsPurchasePanel
                locale="en"
                addons={[addon]}
                ownedAddonSlugs={[]}
                targetListingsByDomain={{ accommodation: [] }}
            />
        );

        expect(screen.queryByText('Alojamiento')).not.toBeInTheDocument();
        expect(screen.queryByText('Necesitás un alojamiento primero')).not.toBeInTheDocument();
        expect(screen.getByText('You need an accommodation first')).toBeInTheDocument();
    });
});
