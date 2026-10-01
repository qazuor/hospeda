/**
 * @file AddonsPurchasePanel.signups-paused.test.tsx
 * @description Admin-paused new paid signups (`newPaidSignupsFrozen`) on the
 * add-ons purchase panel: ONE paused notice above the catalog, no buy button
 * and no target picker on any card, the catalog itself still readable.
 *
 * `@/lib/i18n` is left UNMOCKED (the test setup seeds the real catalog). Note
 * the component's inline fallback is the same Spanish sentence, so this file
 * does NOT prove the key exists — `check:i18n-keys` does that.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AddonCardData } from '../../../src/components/account/AddonsPurchasePanel.client';
import { AddonsPurchasePanel } from '../../../src/components/account/AddonsPurchasePanel.client';

vi.mock('../../../src/components/account/AddonsPurchasePanel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/components/billing/PaidSignupsPausedNotice.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    billingApi: { purchaseAddon: vi.fn() }
}));

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

function addon({
    slug,
    requiresAccommodationTarget
}: {
    readonly slug: string;
    readonly requiresAccommodationTarget: boolean;
}): AddonCardData {
    return {
        slug,
        name: `Addon ${slug}`,
        description: 'Probe add-on.',
        billingType: 'one_time',
        priceArs: 500000,
        durationDays: 7,
        affectsLimitKey: null,
        limitIncrease: null,
        grantsEntitlement: null,
        targetCategories: ['owner'],
        isActive: true,
        sortOrder: 1,
        requiresAccommodationTarget,
        productDomain: 'accommodation',
        recurringChargingEnabled: false
    } as AddonCardData;
}

const ADDONS = [
    addon({ slug: 'extra-photos', requiresAccommodationTarget: false }),
    addon({ slug: 'visibility-boost-7d', requiresAccommodationTarget: true })
];

const TARGETS = {
    accommodation: [{ id: 'acc-1', name: 'Cabaña del Río' }],
    gastronomy: [],
    experience: []
};

/** The shipped Spanish copy (packages/i18n/src/locales/es/billing.json). */
const ES_PAUSED_BODY =
    'Por el momento pausamos las suscripciones y compras nuevas. Si ya tenés una suscripción, sigue funcionando con normalidad.';

describe('AddonsPurchasePanel — admin-paused new paid signups', () => {
    it('shows one paused notice and no buy button or target picker on any card', () => {
        // Arrange / Act
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={ADDONS}
                ownedAddonSlugs={[]}
                targetListingsByDomain={TARGETS as never}
                newPaidSignupsFrozen
            />
        );

        // Assert
        const notices = screen.getAllByTestId('addons-signups-paused-notice');
        expect(notices).toHaveLength(1);
        expect(notices[0]).toHaveTextContent(ES_PAUSED_BODY);
        expect(screen.queryByTestId('addon-buy-button-extra-photos')).not.toBeInTheDocument();
        expect(
            screen.queryByTestId('addon-buy-button-visibility-boost-7d')
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId('addon-accommodation-select-visibility-boost-7d')
        ).not.toBeInTheDocument();
        // The catalog stays readable.
        expect(screen.getByTestId('addon-card-extra-photos')).toBeInTheDocument();
    });

    it('offers the buy buttons when signups are not paused', () => {
        // Arrange / Act
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={ADDONS}
                ownedAddonSlugs={[]}
                targetListingsByDomain={TARGETS as never}
            />
        );

        // Assert
        expect(screen.queryByTestId('addons-signups-paused-notice')).not.toBeInTheDocument();
        expect(screen.getByTestId('addon-buy-button-extra-photos')).toBeInTheDocument();
    });
});
