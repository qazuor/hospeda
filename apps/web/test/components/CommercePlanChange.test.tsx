/**
 * @file CommercePlanChange.test.tsx
 * @description Tests for the commerce tier-change flow (HOS-1119, downgrades
 * added by HOS-1122).
 *
 * ## The regression this file exists for
 *
 * The component filtered its options to `monthlyPriceArs > current`, so an
 * owner could climb tiers and never come back down — the API accepting a
 * cheaper target changed nothing they could reach. Asserting "the API is
 * called" would not have caught it: the API was never reached because the
 * option was never offered.
 *
 * ## What each assertion defends
 *
 * - **Cheaper tiers are on screen.** The whole point.
 * - **The two directions read differently.** A downgrade is free and deferred;
 *   an upgrade is charged and immediate. Same button, opposite consequences,
 *   so the card has to say which.
 * - **A cheaper pick PREVIEWS before it posts.** If the order inverted, an
 *   owner who abandoned the dialog would have scheduled a downgrade they were
 *   still deciding on.
 * - **The keep set reaches the API.** Otherwise the panel is decoration and
 *   the apply-time default silently decides.
 * - **`scheduled` neither reloads nor redirects, and names the date.** A
 *   reload would show the unchanged current plan and read as a dropped
 *   request; no date and the owner believes it already happened.
 *
 * `window.location` is replaced wholesale because jsdom's own is not
 * assignable — `reload` and `href` are the two side effects the upgrade paths
 * take, and a test that could not observe them could not tell them apart from
 * the downgrade path doing nothing.
 */

import type { CommerceDowngradePreview } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: vi.fn()
    })
}));

// Deterministic, locale-independent: the assertions are about WHETHER a date
// is shown and which one, never about Intl's formatting of it.
vi.mock('@/lib/format-utils', () => ({
    formatDate: ({ date }: { date: string }) => `fecha(${date})`
}));

vi.mock('@/lib/billing/checkout-pending', () => ({
    storePendingCheckoutSubId: vi.fn()
}));

const { mockChangeCommercePlan, mockFetchPreview } = vi.hoisted(() => ({
    mockChangeCommercePlan: vi.fn(),
    mockFetchPreview: vi.fn()
}));
vi.mock('@/lib/commerce/owner-listings', () => ({
    changeCommercePlan: mockChangeCommercePlan,
    fetchCommerceDowngradePreview: mockFetchPreview
}));

import { CommercePlanChange } from '@/components/commerce/CommercePlanChange.client';

const BASICO = {
    slug: 'gastronomy-basico',
    name: 'Gastronomía Básico',
    monthlyPriceArs: 3_000_000,
    entitlements: [],
    sortOrder: 1
};
const PRO = {
    slug: 'gastronomy-pro',
    name: 'Gastronomía Profesional',
    monthlyPriceArs: 6_500_000,
    entitlements: ['manage_gastronomy_menu'],
    sortOrder: 2
};
const PREMIUM = {
    slug: 'gastronomy-premium',
    name: 'Gastronomía Premium',
    monthlyPriceArs: 8_000_000,
    entitlements: ['manage_gastronomy_menu', 'print_pdf'],
    sortOrder: 3
};

const PLANS = [BASICO, PRO, PREMIUM];

function previewWithExcess(): CommerceDowngradePreview {
    return {
        vertical: 'gastronomy',
        cap: 1,
        activeCount: 2,
        excessCount: 1,
        items: [
            {
                id: '00000000-0000-4000-8000-000000000001',
                name: 'Cantina Uno',
                updatedAt: '2026-02-01T00:00:00.000Z',
                viewCount: null,
                keepByDefault: true
            },
            {
                id: '00000000-0000-4000-8000-000000000002',
                name: 'Cantina Dos',
                updatedAt: '2026-01-01T00:00:00.000Z',
                viewCount: null,
                keepByDefault: false
            }
        ],
        hasExcess: true
    };
}

/** Renders the flow with the owner sitting on PRO by default. */
function renderFlow(overrides: Record<string, unknown> = {}) {
    render(
        <CommercePlanChange
            vertical="gastronomy"
            currentPlanSlug={PRO.slug}
            currentPlanName={PRO.name}
            plans={PLANS}
            currentPeriodEnd="2026-10-01T00:00:00.000Z"
            locale="es"
            {...overrides}
        />
    );
}

/** Opens the dialog — every flow assertion starts here. */
function openPicker() {
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de plan' }));
}

let reload: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();
    reload = vi.fn();
    Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: { href: '', reload }
    });
    mockFetchPreview.mockResolvedValue({ ok: true, data: previewWithExcess() });
    mockChangeCommercePlan.mockResolvedValue({
        ok: true,
        data: {
            status: 'scheduled',
            subscriptionId: 'sub-1',
            previousPlanId: 'plan-pro',
            newPlanId: 'plan-basico',
            effectiveAt: '2026-10-01T00:00:00.000Z'
        }
    });
});

describe('CommercePlanChange — offering the downgrade (HOS-1122)', () => {
    it('offers CHEAPER tiers, not only dearer ones', () => {
        renderFlow();
        openPicker();

        // Owner is on PRO: básico is cheaper, premium is dearer. Both listed.
        expect(screen.getByRole('radio', { name: /Gastronomía Básico/ })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /Gastronomía Premium/ })).toBeInTheDocument();
    });

    it('never offers the tier the owner is already on', () => {
        renderFlow();
        openPicker();

        expect(
            screen.queryByRole('radio', { name: /Gastronomía Profesional/ })
        ).not.toBeInTheDocument();
    });

    it('says a downgrade costs nothing and names the day it starts', () => {
        renderFlow();
        openPicker();

        expect(
            screen.getByText('Sin cargo. Empieza a regir el fecha(2026-10-01T00:00:00.000Z).')
        ).toBeInTheDocument();
    });

    it('says an upgrade is charged now — the opposite consequence, said differently', () => {
        renderFlow();
        openPicker();

        expect(
            screen.getByText('Pagás la diferencia proporcional ahora y empieza a regir enseguida.')
        ).toBeInTheDocument();
    });

    it('degrades to date-less downgrade copy when the period end is unknown', () => {
        renderFlow({ currentPeriodEnd: null });
        openPicker();

        expect(
            screen.getByText('Sin cargo. Empieza a regir al final del período que ya pagaste.')
        ).toBeInTheDocument();
    });

    it('renders no CTA at all when every other tier costs the same', () => {
        renderFlow({
            plans: [PRO, { ...BASICO, monthlyPriceArs: PRO.monthlyPriceArs }],
            currentPlanSlug: PRO.slug
        });

        expect(screen.queryByRole('button', { name: 'Cambiar de plan' })).not.toBeInTheDocument();
    });
});

describe('CommercePlanChange — the downgrade flow (HOS-1122)', () => {
    async function pickBasico() {
        openPicker();
        fireEvent.click(screen.getByRole('radio', { name: /Gastronomía Básico/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    }

    it('PREVIEWS before it posts — nothing is scheduled while the owner decides', async () => {
        renderFlow();
        await pickBasico();

        await waitFor(() => {
            expect(mockFetchPreview).toHaveBeenCalledWith({
                vertical: 'gastronomy',
                planSlug: 'gastronomy-basico'
            });
        });
        // The order is the point: a POST here would leave a schedule behind for
        // an owner who then closed the dialog.
        expect(mockChangeCommercePlan).not.toHaveBeenCalled();
    });

    it('opens the keep panel with the listings the cheaper tier stops covering', async () => {
        renderFlow();
        await pickBasico();

        expect(await screen.findByRole('checkbox', { name: 'Cantina Uno' })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Cantina Dos' })).toBeInTheDocument();
    });

    it('sends the owner`s keep set to the API', async () => {
        renderFlow();
        await pickBasico();

        // Swap the suggestion: keep Dos instead of Uno.
        fireEvent.click(await screen.findByRole('checkbox', { name: 'Cantina Uno' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Cantina Dos' }));
        fireEvent.click(screen.getByRole('button', { name: 'Programar el cambio' }));

        await waitFor(() => {
            expect(mockChangeCommercePlan).toHaveBeenCalledWith({
                vertical: 'gastronomy',
                planSlug: 'gastronomy-basico',
                keepSelections: { listingIds: ['00000000-0000-4000-8000-000000000002'] }
            });
        });
    });

    it('skips the keep panel and posts straight through when nothing is over the cap', async () => {
        mockFetchPreview.mockResolvedValue({
            ok: true,
            data: { ...previewWithExcess(), excessCount: 0, hasExcess: false }
        });
        renderFlow();
        await pickBasico();

        await waitFor(() => {
            expect(mockChangeCommercePlan).toHaveBeenCalledWith({
                vertical: 'gastronomy',
                planSlug: 'gastronomy-basico',
                keepSelections: undefined
            });
        });
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('confirms the schedule with its date instead of reloading', async () => {
        renderFlow();
        await pickBasico();
        fireEvent.click(await screen.findByRole('button', { name: 'Programar el cambio' }));

        expect(await screen.findByText('Cambio programado')).toBeInTheDocument();
        expect(screen.getByText(/el fecha\(2026-10-01T00:00:00\.000Z\)/)).toBeInTheDocument();
        // A reload here would re-render the owner's UNCHANGED current plan and
        // read as a request that was dropped.
        expect(reload).not.toHaveBeenCalled();
        expect(window.location.href).toBe('');
    });

    it('surfaces a preview failure instead of falling through to "nothing to lose"', async () => {
        // The 422 the preview raises when the target tier's cap cannot be
        // resolved. Treating it as zero excess would restrict listings by the
        // default order having told the owner nothing was at stake.
        mockFetchPreview.mockResolvedValue({ ok: false, error: { status: 422 } });
        renderFlow();
        await pickBasico();

        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(mockChangeCommercePlan).not.toHaveBeenCalled();
    });
});

describe('CommercePlanChange — the upgrade flow is unchanged (HOS-1119)', () => {
    async function pickPremium() {
        openPicker();
        fireEvent.click(screen.getByRole('radio', { name: /Gastronomía Premium/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    }

    it('posts immediately, with no preview call', async () => {
        mockChangeCommercePlan.mockResolvedValue({
            ok: true,
            data: {
                status: 'pending_payment',
                checkoutUrl: 'https://mp.test/upgrade',
                localSubscriptionId: 'sub-1',
                expiresAt: '2026-10-01T00:00:00.000Z',
                newPlanId: 'plan-premium',
                deltaCentavos: 1_500_000
            }
        });
        renderFlow();
        await pickPremium();

        await waitFor(() => {
            expect(mockChangeCommercePlan).toHaveBeenCalledWith({
                vertical: 'gastronomy',
                planSlug: 'gastronomy-premium',
                keepSelections: undefined
            });
        });
        expect(mockFetchPreview).not.toHaveBeenCalled();
    });

    it('redirects to MercadoPago for the prorated delta', async () => {
        mockChangeCommercePlan.mockResolvedValue({
            ok: true,
            data: {
                status: 'pending_payment',
                checkoutUrl: 'https://mp.test/upgrade',
                localSubscriptionId: 'sub-1',
                expiresAt: '2026-10-01T00:00:00.000Z',
                newPlanId: 'plan-premium',
                deltaCentavos: 1_500_000
            }
        });
        renderFlow();
        await pickPremium();

        await waitFor(() => {
            expect(window.location.href).toBe('https://mp.test/upgrade');
        });
    });

    it('reloads when the tier applied at once during a trial', async () => {
        mockChangeCommercePlan.mockResolvedValue({
            ok: true,
            data: {
                status: 'active',
                subscriptionId: 'sub-1',
                previousPlanId: 'plan-pro',
                newPlanId: 'plan-premium',
                effectiveAt: '2026-09-05T00:00:00.000Z'
            }
        });
        renderFlow();
        await pickPremium();

        await waitFor(() => {
            expect(reload).toHaveBeenCalledOnce();
        });
    });
});
