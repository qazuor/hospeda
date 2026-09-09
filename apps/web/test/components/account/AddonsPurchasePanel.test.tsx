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
 *  - HOS-1293: the subscription-gate CTA is resolved PER add-on from its own
 *    `productDomain`, not hardcoded to the host plans page
 */

import { render, screen, waitFor, within } from '@testing-library/react';
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
/**
 * Sentinel value the mock resolves `account.addons.recurringNotice` to
 * (HOS-847). Deliberately NOT the component's inline Spanish fallback: an
 * assertion on the fallback passes even when the component asks for a key that
 * does not exist, which is exactly the bug that ships untranslated copy to
 * `en` and `pt`.
 */
const RECURRING_NOTICE_TEXT = 'Aviso de renovacion (localizado)';

const CATALOG_TRANSLATIONS: Record<string, string> = {
    'account.addons.recurringNotice': RECURRING_NOTICE_TEXT,
    'account.addons.catalog.extra-photos-20.name': 'Pack de fotos extra (localizado)',
    'account.addons.catalog.extra-photos-20.description': 'Descripción localizada de fotos.',
    'account.addons.catalog.visibility-boost-7d.name': 'Impulso de visibilidad (localizado)',
    'account.addons.duration_one': '{{count}} día',
    'account.addons.duration_other': '{{count}} días'
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
    const tPlural = (key: string, count: number, params?: Record<string, unknown>): string =>
        t(`${key}_${count === 1 ? 'one' : 'other'}`, undefined, { ...params, count });
    return { createT: () => t, createTranslations: () => ({ t, tPlural }) };
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
    requiresAccommodationTarget: false,
    recurringChargingEnabled: false
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
    requiresAccommodationTarget: true,
    recurringChargingEnabled: false
};

/**
 * A `recurring` add-on the SERVER says will actually be charged monthly
 * (HOS-847). Mirrors the real `extra-accommodations-5` catalog entry: monthly,
 * account-scoped, and with `durationDays: null` — a recurring add-on has no
 * fixed window, which is precisely why the buyer needs to be told it keeps
 * charging.
 *
 * `recurringChargingEnabled` is the gate, NOT `billingType`. See
 * {@link RECURRING_LABEL_ONLY_ADDON} for why the two are different facts.
 */
const RECURRING_ADDON: AddonCardData = {
    slug: 'extra-accommodations-5',
    name: 'Extra Accommodations Pack (+5)',
    description: 'Add 5 more accommodations to your plan.',
    billingType: 'recurring',
    priceArs: 1300000,
    durationDays: null,
    affectsLimitKey: 'maxAccommodations',
    limitIncrease: 5,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 3,
    requiresAccommodationTarget: false,
    recurringChargingEnabled: true
};

/**
 * The SAME add-on as the catalog labels it, with the recurring charging path
 * OFF — which is how production ships.
 *
 * `billingType` still reads `'recurring'` (it is derived from the catalog row),
 * but `shouldUseRecurringAddonCheckout` refuses, the purchase falls to the
 * one-time branch, it is charged ONCE and the benefit never expires. A notice
 * here would promise a subscription nobody sold.
 */
const RECURRING_LABEL_ONLY_ADDON: AddonCardData = {
    ...RECURRING_ADDON,
    recurringChargingEnabled: false
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

    it('shows the subscription-gate banner (not a toast) when purchase fails with reason NO_ACTIVE_SUBSCRIPTION (HOS-602)', async () => {
        // ARRANGE — this mirrors the real wire shape after the HOS-602 API
        // fix: a 422 whose status-derived `code` collapses to the generic
        // VALIDATION_ERROR, but whose `reason` still carries the specific
        // service error code via `entitlement-cause.ts`.
        mockPurchaseAddon.mockResolvedValue({
            ok: false,
            error: {
                status: 422,
                code: 'VALIDATION_ERROR',
                reason: 'NO_ACTIVE_SUBSCRIPTION',
                message: 'You must have an active subscription to purchase add-ons'
            }
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

        const banner = await screen.findByTestId(`addon-subscription-gate-${ACCOUNT_ADDON.slug}`);
        expect(banner).toHaveTextContent('Necesitás una suscripción activa');
        expect(banner).toHaveTextContent(
            'Los complementos están disponibles para cuentas con una suscripción activa o en período de prueba.'
        );
        const cta = screen.getByRole('link', { name: 'Ver planes' });
        expect(cta).toHaveAttribute('href', expect.stringContaining('/es/'));

        // The generic toast path must NOT fire for this specific rejection —
        // the reason is now visible next to the card instead.
        expect(mockAddToast).not.toHaveBeenCalled();
        expect(window.location.href).toBe('');
    });

    it('shows the subscription-gate banner when purchase fails with reason NO_SUBSCRIPTION (HOS-602)', async () => {
        mockPurchaseAddon.mockResolvedValue({
            ok: false,
            error: {
                status: 422,
                code: 'VALIDATION_ERROR',
                reason: 'NO_SUBSCRIPTION',
                message: 'You must have an active subscription to purchase add-ons'
            }
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

        expect(
            await screen.findByTestId(`addon-subscription-gate-${ACCOUNT_ADDON.slug}`)
        ).toBeInTheDocument();
        expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('clears a stale subscription-gate banner on a fresh purchase attempt (HOS-602)', async () => {
        mockPurchaseAddon
            .mockResolvedValueOnce({
                ok: false,
                error: {
                    status: 422,
                    code: 'VALIDATION_ERROR',
                    reason: 'NO_ACTIVE_SUBSCRIPTION',
                    message: 'You must have an active subscription to purchase add-ons'
                }
            })
            .mockResolvedValueOnce({
                ok: true,
                data: { checkoutUrl: 'https://mp.example/checkout/retry' }
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
        expect(
            await screen.findByTestId(`addon-subscription-gate-${ACCOUNT_ADDON.slug}`)
        ).toBeInTheDocument();

        // Simulates the user having upgraded in another tab, then retrying.
        await user.click(screen.getByTestId(`addon-buy-button-${ACCOUNT_ADDON.slug}`));

        await waitFor(() => {
            expect(
                screen.queryByTestId(`addon-subscription-gate-${ACCOUNT_ADDON.slug}`)
            ).not.toBeInTheDocument();
        });
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

/**
 * HOS-847: an add-on the server says will be charged again every month must say
 * so BEFORE the buy button. A `one_time` card's copy stays exactly as it was.
 *
 * The gate is `recurringChargingEnabled`, NOT `billingType`. Those are two
 * different facts: the catalog label is a property of the row, while the charge
 * depends on a flag this app cannot read — and with that flag off, which is how
 * production ships, a `recurring`-labelled add-on is charged ONCE and its
 * benefit never expires. The last case in this block is the one that separates
 * them.
 *
 * The assertions key on RECURRING_NOTICE_TEXT — the value the i18n mock
 * resolves `account.addons.recurringNotice` to — and not on the component's
 * inline Spanish fallback. That is deliberate: the mock returns the fallback
 * for any key it does not know, so asserting the fallback would still pass if
 * the component asked for the wrong key, and the string would then ship
 * untranslated in `en` and `pt`.
 */
describe('AddonsPurchasePanel — recurring-charge notice (HOS-847)', () => {
    it('warns that a recurring addon renews and is charged again', () => {
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={[RECURRING_ADDON]}
                ownedAddonSlugs={[]}
                accommodations={[]}
            />
        );

        expect(screen.getByText(RECURRING_NOTICE_TEXT)).toBeInTheDocument();
    });

    it('leaves a one-time addon card without the recurring notice', () => {
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={[PER_ACCOMMODATION_ADDON]}
                ownedAddonSlugs={[]}
                accommodations={ACCOMMODATIONS}
            />
        );

        expect(screen.queryByText(RECURRING_NOTICE_TEXT)).not.toBeInTheDocument();
        // The one-time copy is untouched: price pill, "Pago único" and the
        // duration badge all still render.
        expect(screen.getByText('Pago único')).toBeInTheDocument();
        expect(screen.getByText('7 días')).toBeInTheDocument();
    });

    it('shows the notice on the recurring card only when both types are listed', () => {
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={[RECURRING_ADDON, PER_ACCOMMODATION_ADDON]}
                ownedAddonSlugs={[]}
                accommodations={ACCOMMODATIONS}
            />
        );

        // Exactly one notice on the page, and it lives inside the recurring
        // add-on's own card — not merely somewhere in the document.
        const notices = screen.getAllByText(RECURRING_NOTICE_TEXT);
        expect(notices).toHaveLength(1);
        expect(screen.getByTestId(`addon-card-${RECURRING_ADDON.slug}`)).toContainElement(
            notices[0] as HTMLElement
        );
    });

    it('still warns when the recurring addon is already owned', () => {
        // An owned card has no buy button, but the buyer is still being
        // charged monthly — hiding the notice there would remove the only
        // place the ongoing charge is stated.
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={[RECURRING_ADDON]}
                ownedAddonSlugs={[RECURRING_ADDON.slug]}
                accommodations={[]}
            />
        );

        expect(screen.getByText(RECURRING_NOTICE_TEXT)).toBeInTheDocument();
    });

    it('stays SILENT on a recurring-labelled addon the server will charge once', () => {
        // The case the old `billingType === 'recurring'` gate got wrong, and the
        // state every environment is in today: the label says recurring, the
        // checkout does not. Announcing a subscription here is a promise the
        // purchase does not keep — one charge, and a benefit with no expiry.
        render(
            <AddonsPurchasePanel
                locale="es"
                addons={[RECURRING_LABEL_ONLY_ADDON]}
                ownedAddonSlugs={[]}
                accommodations={[]}
            />
        );

        expect(screen.queryByText(RECURRING_NOTICE_TEXT)).not.toBeInTheDocument();
        // The card itself still renders in full — this hides the NOTICE, not the
        // add-on, and its billing-type pill is untouched.
        expect(
            screen.getByTestId(`addon-card-${RECURRING_LABEL_ONLY_ADDON.slug}`)
        ).toBeInTheDocument();
        expect(RECURRING_LABEL_ONLY_ADDON.billingType).toBe('recurring');
    });
});

// ─── HOS-1293: subscription-gate CTA audience, resolved per add-on ────────────

/**
 * Real gastronomy-domain add-on, mirroring `extra-gastronomies-1` from
 * `packages/billing/src/config/addons.config.ts`.
 */
const GASTRONOMY_ADDON: AddonCardData = {
    ...ACCOUNT_ADDON,
    slug: 'extra-gastronomies-1',
    name: 'Extra Gastronomy Listing (+1)',
    affectsLimitKey: 'maxGastronomies',
    productDomain: 'gastronomy'
};

/** Real experience-domain twin of {@link GASTRONOMY_ADDON}. */
const EXPERIENCE_ADDON: AddonCardData = {
    ...ACCOUNT_ADDON,
    slug: 'extra-experiences-1',
    name: 'Extra Experience Listing (+1)',
    affectsLimitKey: 'maxExperiences',
    productDomain: 'experience'
};

/** Triggers the subscription-gate banner on the given add-on's card. */
async function triggerSubscriptionGate(addon: AddonCardData): Promise<HTMLElement> {
    mockPurchaseAddon.mockResolvedValue({
        ok: false,
        error: {
            status: 422,
            code: 'VALIDATION_ERROR',
            reason: 'NO_ACTIVE_SUBSCRIPTION',
            message: 'You must have an active subscription to purchase add-ons'
        }
    });
    const user = userEvent.setup();
    render(
        <AddonsPurchasePanel
            locale="es"
            addons={[addon]}
            ownedAddonSlugs={[]}
            accommodations={[]}
        />
    );

    await user.click(screen.getByTestId(`addon-buy-button-${addon.slug}`));

    return screen.findByTestId(`addon-subscription-gate-${addon.slug}`);
}

describe('AddonsPurchasePanel — subscription-gate CTA audience (HOS-1293)', () => {
    it("a gastronomy add-on's gate CTA points at the gastronomy plans page, not the host plans", async () => {
        // HOS-1293 regression: before this fix EVERY card's gate CTA was
        // hardcoded to `resolveSubscriptionPlansPathForAudience({ audience: 'host' })`
        // (`/es/planes/anfitriones/precios/`), so a gastronomy-only owner who
        // hit this exact banner on their OWN add-on was offered an
        // accommodation plan instead of the gastronomy one they actually need.
        const banner = await triggerSubscriptionGate(GASTRONOMY_ADDON);

        const cta = within(banner).getByRole('link', { name: 'Ver planes' });
        expect(cta).toHaveAttribute('href', '/es/planes/gastronomia/precios/');
    });

    it("an experience add-on's gate CTA points at the experience plans page", async () => {
        const banner = await triggerSubscriptionGate(EXPERIENCE_ADDON);

        const cta = within(banner).getByRole('link', { name: 'Ver planes' });
        expect(cta).toHaveAttribute('href', '/es/planes/experiencias/precios/');
    });

    it("preserves the pre-fix behaviour: an accommodation add-on's gate CTA still points at the owner plans page", async () => {
        // Non-vacuity for the two cases above: if the per-addon resolution were
        // broken in the OTHER direction (e.g. always resolving to gastronomy),
        // this case would catch it — the accommodation majority must be
        // untouched by the fix.
        const banner = await triggerSubscriptionGate(ACCOUNT_ADDON);

        const cta = within(banner).getByRole('link', { name: 'Ver planes' });
        expect(cta).toHaveAttribute('href', '/es/planes/anfitriones/precios/');
    });
});
