/**
 * @file AddonsPurchasePanel.test.tsx
 * @description RTL tests for the AddonsPurchasePanel React island (HOS-224).
 *
 * Covers:
 *  - Empty state when there are no purchasable add-ons
 *  - Renders cards grouped by "por alojamiento" vs "de cuenta"
 *  - Already-owned addons render as "Activo" with no buy button
 *  - Per-accommodation addon: buy button disabled until a target is selected
 *  - Per-accommodation addon with zero accommodations: shows the
 *    "necesitás un alojamiento primero" message instead of a select
 *  - Purchase click sends the selected accommodationId and redirects to
 *    the returned checkoutUrl
 *  - Purchase failure shows a toast and does not redirect
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddonCardData } from '../../../src/components/account/AddonsPurchasePanel.client';
import { AddonsPurchasePanel } from '../../../src/components/account/AddonsPurchasePanel.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/AddonsPurchasePanel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// Localized copy for addon name/description lives under
// `account.addons.catalog.<slug>.*` (BETA-198). The mock resolves those keys so
// tests can assert the panel renders the i18n value instead of the raw
// definition string; all other keys fall back to the provided fallback.
const CATALOG_TRANSLATIONS: Record<string, string> = {
    'account.addons.catalog.extra-photos-20.name': 'Pack de fotos extra (localizado)',
    'account.addons.catalog.extra-photos-20.description': 'Descripción localizada de fotos.',
    'account.addons.catalog.visibility-boost-7d.name': 'Impulso de visibilidad (localizado)'
};

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string, params?: Record<string, unknown>): string => {
        const raw = CATALOG_TRANSLATIONS[key] ?? fallback ?? key;
        if (!params) return raw;
        return Object.keys(params).reduce(
            (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
            raw
        );
    };
    return { createT: () => t, createTranslations: () => ({ t }) };
});

const mockPurchaseAddon = vi.fn();

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    billingApi: {
        purchaseAddon: (params: unknown) => mockPurchaseAddon(params)
    }
}));

const mockAddToast = vi.fn();

vi.mock('../../../src/store/toast-store', () => ({
    addToast: (params: unknown) => mockAddToast(params)
}));

vi.mock('../../../src/lib/api-errors', () => ({
    translateApiError: ({ fallback }: { fallback?: string }) => fallback ?? 'error'
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ACCOUNT_ADDON: AddonCardData = {
    slug: 'extra-photos-20',
    name: 'Extra 20 Photos',
    description: 'Add 20 more photo slots to a listing.',
    billingType: 'one_time',
    priceArs: 150000,
    durationDays: null,
    affectsLimitKey: 'maxPhotos',
    limitIncrease: 20,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 1,
    requiresAccommodationTarget: false
};

const PER_ACCOMMODATION_ADDON: AddonCardData = {
    slug: 'visibility-boost-7d',
    name: 'Visibility Boost (7 days)',
    description: 'Feature your accommodation for 7 days.',
    billingType: 'one_time',
    priceArs: 500000,
    durationDays: 7,
    affectsLimitKey: null,
    limitIncrease: null,
    grantsEntitlement: 'featured_listing',
    targetCategories: ['owner', 'complex'],
    isActive: true,
    sortOrder: 2,
    requiresAccommodationTarget: true
};

const ACCOMMODATIONS = [
    { id: 'acc-1', name: 'Cabaña del Río' },
    { id: 'acc-2', name: 'Hostel Central' }
];

beforeEach(() => {
    mockPurchaseAddon.mockReset();
    mockAddToast.mockReset();
    Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true
    });
    // crypto.randomUUID is used to build the idempotency key.
    vi.stubGlobal('crypto', { randomUUID: () => 'fixed-uuid' });
});

describe('AddonsPurchasePanel', () => {
    it('shows the empty state when there are no add-ons', () => {
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={[]}
                ownedAddonSlugs={[]}
                accommodations={[]}
            />
        );

        expect(
            screen.getByText(/no hay complementos disponibles en este momento/i)
        ).toBeInTheDocument();
    });

    it('groups addons into "por alojamiento" and "de cuenta" sections', () => {
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={[ACCOUNT_ADDON, PER_ACCOMMODATION_ADDON]}
                ownedAddonSlugs={[]}
                accommodations={ACCOMMODATIONS}
            />
        );

        expect(screen.getByText('Por alojamiento')).toBeInTheDocument();
        expect(screen.getByText('De cuenta')).toBeInTheDocument();
        expect(
            screen.getByTestId(`addon-card-${PER_ACCOMMODATION_ADDON.slug}`)
        ).toBeInTheDocument();
        expect(screen.getByTestId(`addon-card-${ACCOUNT_ADDON.slug}`)).toBeInTheDocument();
    });

    it('renders an owned addon as "Activo" with no buy button', () => {
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={[ACCOUNT_ADDON]}
                ownedAddonSlugs={[ACCOUNT_ADDON.slug]}
                accommodations={[]}
            />
        );

        expect(screen.getByText('Activo')).toBeInTheDocument();
        expect(
            screen.queryByTestId(`addon-buy-button-${ACCOUNT_ADDON.slug}`)
        ).not.toBeInTheDocument();
    });

    it('disables the buy button for a per-accommodation addon until a target is selected', async () => {
        const user = userEvent.setup();
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={[PER_ACCOMMODATION_ADDON]}
                ownedAddonSlugs={[]}
                accommodations={ACCOMMODATIONS}
            />
        );

        const buyButton = screen.getByTestId(`addon-buy-button-${PER_ACCOMMODATION_ADDON.slug}`);
        expect(buyButton).toBeDisabled();

        await user.selectOptions(
            screen.getByTestId(`addon-accommodation-select-${PER_ACCOMMODATION_ADDON.slug}`),
            'acc-1'
        );

        expect(buyButton).toBeEnabled();
    });

    it('shows "necesitás un alojamiento primero" when there are no accommodations', () => {
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={[PER_ACCOMMODATION_ADDON]}
                ownedAddonSlugs={[]}
                accommodations={[]}
            />
        );

        expect(screen.getByText(/necesitás un alojamiento primero/i)).toBeInTheDocument();
        expect(
            screen.queryByTestId(`addon-accommodation-select-${PER_ACCOMMODATION_ADDON.slug}`)
        ).not.toBeInTheDocument();
        expect(
            screen.getByTestId(`addon-buy-button-${PER_ACCOMMODATION_ADDON.slug}`)
        ).toBeDisabled();
    });

    it('purchases with the selected accommodationId and redirects to the checkout URL', async () => {
        mockPurchaseAddon.mockResolvedValue({
            ok: true,
            data: { checkoutUrl: 'https://mp.example/checkout/xyz' }
        });
        const user = userEvent.setup();
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={[PER_ACCOMMODATION_ADDON]}
                ownedAddonSlugs={[]}
                accommodations={ACCOMMODATIONS}
            />
        );

        await user.selectOptions(
            screen.getByTestId(`addon-accommodation-select-${PER_ACCOMMODATION_ADDON.slug}`),
            'acc-2'
        );
        await user.click(screen.getByTestId(`addon-buy-button-${PER_ACCOMMODATION_ADDON.slug}`));

        await waitFor(() => {
            expect(mockPurchaseAddon).toHaveBeenCalledWith({
                slug: 'visibility-boost-7d',
                body: { accommodationId: 'acc-2' },
                idempotencyKey: 'fixed-uuid'
            });
        });
        await waitFor(() => {
            expect(window.location.href).toBe('https://mp.example/checkout/xyz');
        });
    });

    it('purchases an account-level addon without an accommodationId', async () => {
        mockPurchaseAddon.mockResolvedValue({
            ok: true,
            data: { checkoutUrl: 'https://mp.example/checkout/abc' }
        });
        const user = userEvent.setup();
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={[ACCOUNT_ADDON]}
                ownedAddonSlugs={[]}
                accommodations={[]}
            />
        );

        await user.click(screen.getByTestId(`addon-buy-button-${ACCOUNT_ADDON.slug}`));

        await waitFor(() => {
            expect(mockPurchaseAddon).toHaveBeenCalledWith({
                slug: 'extra-photos-20',
                body: undefined,
                idempotencyKey: 'fixed-uuid'
            });
        });
        await waitFor(() => {
            expect(window.location.href).toBe('https://mp.example/checkout/abc');
        });
    });

    it('shows an error toast and does not redirect on purchase failure', async () => {
        mockPurchaseAddon.mockResolvedValue({
            ok: false,
            error: { status: 500, message: 'boom' }
        });
        const user = userEvent.setup();
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={[ACCOUNT_ADDON]}
                ownedAddonSlugs={[]}
                accommodations={[]}
            />
        );

        await user.click(screen.getByTestId(`addon-buy-button-${ACCOUNT_ADDON.slug}`));

        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
        });
        expect(window.location.href).toBe('');
    });

    it('renders the localized addon name/description from i18n, not the raw definition string (BETA-198)', () => {
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={[ACCOUNT_ADDON]}
                ownedAddonSlugs={[]}
                accommodations={[]}
            />
        );

        // The i18n value wins over the English definition string.
        expect(screen.getByText('Pack de fotos extra (localizado)')).toBeInTheDocument();
        expect(screen.getByText('Descripción localizada de fotos.')).toBeInTheDocument();
        expect(screen.queryByText(ACCOUNT_ADDON.name)).not.toBeInTheDocument();
        expect(screen.queryByText(ACCOUNT_ADDON.description)).not.toBeInTheDocument();
    });

    it('renders the price and duration for a one-time addon', () => {
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={[PER_ACCOMMODATION_ADDON]}
                ownedAddonSlugs={[]}
                accommodations={ACCOMMODATIONS}
            />
        );

        expect(screen.getByText('7 días')).toBeInTheDocument();
    });
});
