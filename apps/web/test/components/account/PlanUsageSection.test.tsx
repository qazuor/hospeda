/**
 * @file PlanUsageSection.test.tsx
 * @description RTL tests for the PlanUsageSection React island.
 *
 * Covers:
 *  - Rows render per audience group, with the group dropped when empty
 *  - "N de M" for counted limits, cap-only for per-operation ones
 *  - Unmeasured / ungranted / unbuilt limits never reach the DOM
 *  - Unlimited limits show consumption + "Ilimitado" and no bar
 *  - The bar caps at 100% while the figure keeps reporting the truth
 *  - "Llegaste al límite" vs "Límite superado" split on the raw figures
 *  - Per-accommodation breakdown renders one sub-row per accommodation
 *  - Upgrade / add-on links appear only on rows that are running out
 *  - A failed usage read renders nothing at all
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanUsageSection } from '../../../src/components/account/PlanUsageSection.client';
import type { LimitUsage } from '../../../src/lib/api/endpoints-protected';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/PlanUsageSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

/**
 * Only the keys this suite asserts on are resolved; everything else falls
 * through to the caller-supplied fallback, exactly like the real `t`.
 */
const TRANSLATIONS: Record<string, string> = {
    'account.subscription.usage.limits.max_accommodations': 'Alojamientos publicados',
    'account.subscription.usage.limits.max_favorites': 'Favoritos guardados',
    'account.subscription.usage.limits.max_photos_per_accommodation': 'Fotos por alojamiento',
    'account.subscription.usage.limits.max_compare_items': 'Alojamientos en comparación',
    'account.subscription.usage.limits.max_ai_search_per_month': 'Búsquedas con IA (por mes)'
};

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string, params?: Record<string, unknown>): string => {
        const raw = TRANSLATIONS[key] ?? fallback ?? key;
        if (!params) return raw;
        return Object.keys(params).reduce(
            (acc, k) =>
                acc
                    .replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k]))
                    .replace(new RegExp(`\\{${k}\\}`, 'g'), String(params[k])),
            raw
        );
    };
    return { createT: () => t, createTranslations: () => ({ t }) };
});

const mockGetUsage = vi.fn();

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    billingApi: {
        getUsage: (params: unknown) => mockGetUsage(params)
    }
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Builds a `LimitUsage` with sensible defaults so each test only states the
 * field it is actually about.
 */
function buildLimit(overrides: Partial<LimitUsage> & { limitKey: string }): LimitUsage {
    return {
        displayName: 'Maximum accommodations',
        currentUsage: 0,
        maxAllowed: 5,
        usagePercentage: 0,
        threshold: 'ok',
        planBaseLimit: 5,
        addonBonusLimit: 0,
        isMeasured: true,
        usageKind: 'stock',
        ...overrides
    };
}

/** Wraps limits in the endpoint's successful envelope. */
function okUsage(limits: readonly LimitUsage[]) {
    return {
        ok: true as const,
        data: {
            customerId: 'cust_1',
            limits,
            overallThreshold: 'ok' as const,
            upgradeUrl: '/billing/plans'
        }
    };
}

/** Renders the island with the props every test needs. */
function renderSection(props: { roles?: readonly string[] } = {}) {
    return render(
        <PlanUsageSection
            locale="es"
            roles={props.roles ?? ['HOST']}
        />
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlanUsageSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render one row per granted limit with its consumption figure', async () => {
        // Arrange
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({
                    limitKey: 'max_accommodations',
                    currentUsage: 3,
                    maxAllowed: 5,
                    usagePercentage: 60
                })
            ])
        );

        // Act
        renderSection();

        // Assert
        expect(await screen.findByText('Alojamientos publicados')).toBeInTheDocument();
        expect(screen.getByText('3 de 5')).toBeInTheDocument();
    });

    it('should label the limit from i18n rather than the API English displayName', async () => {
        // Arrange
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({
                    limitKey: 'max_accommodations',
                    displayName: 'Maximum accommodations'
                })
            ])
        );

        // Act
        renderSection();

        // Assert
        expect(await screen.findByText('Alojamientos publicados')).toBeInTheDocument();
        expect(screen.queryByText('Maximum accommodations')).not.toBeInTheDocument();
    });

    // ── Grouping ──────────────────────────────────────────────────────────

    it('should group limits by audience', async () => {
        // Arrange
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({ limitKey: 'max_accommodations', currentUsage: 1 }),
                buildLimit({ limitKey: 'max_favorites', currentUsage: 2, maxAllowed: 20 })
            ])
        );

        // Act
        renderSection();

        // Assert
        const hostGroup = await screen.findByRole('region', { name: 'Como anfitrión' });
        const travelerGroup = screen.getByRole('region', { name: 'Como viajero' });

        expect(within(hostGroup).getByText('Alojamientos publicados')).toBeInTheDocument();
        expect(within(travelerGroup).getByText('Favoritos guardados')).toBeInTheDocument();
    });

    it('should not render an audience group that has no visible limits', async () => {
        // Arrange — a traveller-only user: host limits are simply not granted.
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({ limitKey: 'max_accommodations', maxAllowed: 0 }),
                buildLimit({ limitKey: 'max_favorites', currentUsage: 2, maxAllowed: 20 })
            ])
        );

        // Act
        renderSection({ roles: ['USER'] });

        // Assert
        expect(await screen.findByRole('region', { name: 'Como viajero' })).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Como anfitrión' })).not.toBeInTheDocument();
    });

    it('should note the monthly reset only in groups that contain a monthly limit', async () => {
        // Arrange
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({ limitKey: 'max_accommodations', currentUsage: 1 }),
                buildLimit({
                    limitKey: 'max_ai_search_per_month',
                    usageKind: 'monthly',
                    currentUsage: 3,
                    maxAllowed: 200
                })
            ])
        );

        // Act
        renderSection();

        // Assert — the AI meter is traveller-side; the host group has no reset.
        const travelerGroup = await screen.findByRole('region', { name: 'Como viajero' });
        const hostGroup = screen.getByRole('region', { name: 'Como anfitrión' });

        expect(
            within(travelerGroup).getByText('Se reinicia al comenzar cada mes.')
        ).toBeInTheDocument();
        expect(
            within(hostGroup).queryByText('Se reinicia al comenzar cada mes.')
        ).not.toBeInTheDocument();
    });

    // ── Visibility rules ──────────────────────────────────────────────────

    it('should hide limits the plan does not grant (maxAllowed 0)', async () => {
        // Arrange
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({ limitKey: 'max_accommodations', currentUsage: 1, maxAllowed: 5 }),
                buildLimit({
                    limitKey: 'max_favorites',
                    currentUsage: 0,
                    maxAllowed: 0,
                    planBaseLimit: 0
                })
            ])
        );

        // Act
        renderSection();

        // Assert
        expect(await screen.findByText('Alojamientos publicados')).toBeInTheDocument();
        expect(screen.queryByText('Favoritos guardados')).not.toBeInTheDocument();
        expect(screen.queryByText('0 de 0')).not.toBeInTheDocument();
    });

    it('should hide limits whose feature does not exist yet', async () => {
        // Arrange — properties/staff have no table and no UI anywhere.
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({ limitKey: 'max_accommodations', currentUsage: 1 }),
                buildLimit({
                    limitKey: 'max_properties',
                    maxAllowed: 5,
                    usageKind: 'unbuilt',
                    isMeasured: false
                })
            ])
        );

        // Act
        renderSection();

        // Assert
        expect(await screen.findByText('Alojamientos publicados')).toBeInTheDocument();
        expect(screen.queryByText(/propiedades/i)).not.toBeInTheDocument();
    });

    it('should render nothing when every limit is hidden', async () => {
        // Arrange
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({ limitKey: 'max_properties', usageKind: 'unbuilt', maxAllowed: 5 })
            ])
        );

        // Act
        const { container } = renderSection();

        // Assert
        await waitFor(() => {
            expect(container).toBeEmptyDOMElement();
        });
    });

    // ── Per-kind rendering ────────────────────────────────────────────────

    it('should render an unlimited limit as consumption + Ilimitado, with no bar', async () => {
        // Arrange
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({
                    limitKey: 'max_accommodations',
                    currentUsage: 12,
                    maxAllowed: -1,
                    planBaseLimit: -1
                })
            ])
        );

        // Act
        renderSection();

        // Assert
        expect(await screen.findByText('12 en uso · Ilimitado')).toBeInTheDocument();
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('should render a per-operation cap without inventing consumption', async () => {
        // Arrange — the comparison endpoint bounds one request's `ids[]`;
        // nothing is stored, so "0 de 4" would be a fabricated number.
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({
                    limitKey: 'max_compare_items',
                    maxAllowed: 4,
                    currentUsage: 0,
                    usageKind: 'per_operation',
                    isMeasured: false
                })
            ])
        );

        // Act
        renderSection();

        // Assert
        expect(await screen.findByText('Hasta 4')).toBeInTheDocument();
        expect(screen.queryByText('0 de 4')).not.toBeInTheDocument();
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('should render one sub-row per accommodation for a per-accommodation cap', async () => {
        // Arrange
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({
                    limitKey: 'max_photos_per_accommodation',
                    maxAllowed: 50,
                    currentUsage: 0,
                    usageKind: 'per_accommodation',
                    isMeasured: false,
                    perAccommodation: [
                        {
                            accommodationId: 'a1',
                            name: 'Casa El Molino',
                            slug: 'casa-el-molino',
                            currentUsage: 28
                        },
                        {
                            accommodationId: 'a2',
                            name: 'Cabaña del Río',
                            slug: 'cabana-del-rio',
                            currentUsage: 7
                        }
                    ]
                })
            ])
        );

        // Act
        renderSection();

        // Assert — the cap on the parent row, real figures per accommodation.
        expect(await screen.findByText('Hasta 50')).toBeInTheDocument();
        expect(screen.getByText('Casa El Molino')).toBeInTheDocument();
        expect(screen.getByText('28 de 50')).toBeInTheDocument();
        expect(screen.getByText('Cabaña del Río')).toBeInTheDocument();
        expect(screen.getByText('7 de 50')).toBeInTheDocument();
    });

    it('should NOT claim the owner has no accommodations when the breakdown is absent', async () => {
        // Arrange — the server omits `perAccommodation` when it could not build
        // it. Rendering the empty-state message there tells an owner who has
        // listings that they have none. Absent must stay silent; only an
        // explicitly empty array is evidence.
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({
                    limitKey: 'max_photos_per_accommodation',
                    maxAllowed: 15,
                    usageKind: 'per_accommodation',
                    isMeasured: false
                })
            ])
        );

        // Act
        renderSection();

        // Assert
        expect(await screen.findByText('Hasta 15')).toBeInTheDocument();
        expect(
            screen.queryByText('Todavía no publicaste ningún alojamiento.')
        ).not.toBeInTheDocument();
    });

    it('should tell an owner with no accommodations that there is nothing to show', async () => {
        // Arrange
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({
                    limitKey: 'max_photos_per_accommodation',
                    maxAllowed: 50,
                    usageKind: 'per_accommodation',
                    isMeasured: false,
                    perAccommodation: []
                })
            ])
        );

        // Act
        renderSection();

        // Assert
        expect(
            await screen.findByText('Todavía no publicaste ningún alojamiento.')
        ).toBeInTheDocument();
    });

    // ── Threshold wording ─────────────────────────────────────────────────

    it('should cap the bar at 100% while the figure still reports the overage', async () => {
        // Arrange — reachable after a downgrade or an addon expiry.
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({
                    limitKey: 'max_accommodations',
                    currentUsage: 7,
                    maxAllowed: 5,
                    usagePercentage: 140,
                    threshold: 'exceeded'
                })
            ])
        );

        // Act
        renderSection();

        // Assert
        expect(await screen.findByText('7 de 5')).toBeInTheDocument();
        const bar = screen.getByRole('progressbar');
        expect(bar).toHaveAttribute('aria-valuenow', '7');
        expect(bar).toHaveAttribute('aria-valuemax', '5');
        expect((bar.firstElementChild as HTMLElement).style.width).toBe('100%');
    });

    it('should say "reached" — not "exceeded" — when usage sits exactly on the limit', async () => {
        // Arrange — the server classifies 100% as `exceeded`, so the copy
        // cannot be driven by the threshold alone: 1 de 1 has not been
        // exceeded, and telling the user it was is false.
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({
                    limitKey: 'max_accommodations',
                    currentUsage: 1,
                    maxAllowed: 1,
                    usagePercentage: 100,
                    threshold: 'exceeded'
                })
            ])
        );

        // Act
        renderSection();

        // Assert
        expect(await screen.findByText('Llegaste al límite')).toBeInTheDocument();
        expect(screen.queryByText('Límite superado')).not.toBeInTheDocument();
    });

    it('should say "exceeded" only when usage is actually over the limit', async () => {
        // Arrange
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({
                    limitKey: 'max_accommodations',
                    currentUsage: 7,
                    maxAllowed: 5,
                    usagePercentage: 140,
                    threshold: 'exceeded'
                })
            ])
        );

        // Act
        renderSection();

        // Assert
        expect(await screen.findByText('Límite superado')).toBeInTheDocument();
        expect(screen.queryByText('Llegaste al límite')).not.toBeInTheDocument();
    });

    it('should expose the limit name as the progress bar accessible label', async () => {
        // Arrange
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({
                    limitKey: 'max_accommodations',
                    currentUsage: 2,
                    maxAllowed: 5,
                    usagePercentage: 40
                })
            ])
        );

        // Act
        renderSection();

        // Assert — a bare bar with no name tells a screen-reader user nothing.
        expect(
            await screen.findByRole('progressbar', { name: 'Alojamientos publicados' })
        ).toBeInTheDocument();
    });

    // ── Upgrade paths ─────────────────────────────────────────────────────

    it('should offer the add-on and the plan upgrade when a limit is running out', async () => {
        // Arrange
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({
                    limitKey: 'max_accommodations',
                    currentUsage: 5,
                    maxAllowed: 5,
                    usagePercentage: 100,
                    threshold: 'exceeded'
                })
            ])
        );

        // Act
        renderSection();

        // Assert
        const addonLink = await screen.findByRole('link', {
            name: 'Ampliar con un complemento'
        });
        expect(addonLink).toHaveAttribute(
            'href',
            expect.stringContaining('#addon-extra-accommodations-5')
        );
        expect(screen.getByRole('link', { name: 'Mejorar mi plan' })).toBeInTheDocument();
    });

    it('should not offer upgrade links while comfortably under the limit', async () => {
        // Arrange — otherwise the whole section reads as an ad.
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({
                    limitKey: 'max_accommodations',
                    currentUsage: 1,
                    maxAllowed: 10,
                    usagePercentage: 10,
                    threshold: 'ok'
                })
            ])
        );

        // Act
        renderSection();

        // Assert
        expect(await screen.findByText('Alojamientos publicados')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Mejorar mi plan' })).not.toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: 'Ampliar con un complemento' })
        ).not.toBeInTheDocument();
    });

    it('should offer only the plan upgrade when no add-on raises that limit', async () => {
        // Arrange — no purchasable add-on targets AI searches.
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({
                    limitKey: 'max_ai_search_per_month',
                    usageKind: 'monthly',
                    currentUsage: 195,
                    maxAllowed: 200,
                    usagePercentage: 97.5,
                    threshold: 'critical'
                })
            ])
        );

        // Act
        renderSection();

        // Assert
        expect(await screen.findByRole('link', { name: 'Mejorar mi plan' })).toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: 'Ampliar con un complemento' })
        ).not.toBeInTheDocument();
    });

    it('should never offer upgrade links for an unlimited grant', async () => {
        // Arrange — nothing to run out of, whatever bucket the server sent.
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({
                    limitKey: 'max_accommodations',
                    currentUsage: 40,
                    maxAllowed: -1,
                    threshold: 'exceeded'
                })
            ])
        );

        // Act
        renderSection();

        // Assert
        expect(await screen.findByText('40 en uso · Ilimitado')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Mejorar mi plan' })).not.toBeInTheDocument();
    });

    // ── Degradation ───────────────────────────────────────────────────────

    it('should render nothing when the usage read fails', async () => {
        // Arrange — 404 (no subscription) and 503 (billing off) are expected
        // states, not something to show the user an error box for.
        mockGetUsage.mockResolvedValue({
            ok: false,
            error: {
                code: 'NOT_FOUND',
                message: 'Customer has no active accommodation subscription'
            }
        });

        // Act
        const { container } = renderSection();

        // Assert
        await waitFor(() => {
            expect(container).toBeEmptyDOMElement();
        });
    });

    it('should render nothing when the request throws', async () => {
        // Arrange
        mockGetUsage.mockRejectedValue(new Error('network down'));

        // Act
        const { container } = renderSection();

        // Assert
        await waitFor(() => {
            expect(container).toBeEmptyDOMElement();
        });
    });

    it('should forward the requested product domain to the API', async () => {
        // Arrange
        mockGetUsage.mockResolvedValue(okUsage([]));

        // Act
        render(
            <PlanUsageSection
                locale="es"
                roles={['HOST']}
                productDomain="commerce"
            />
        );

        // Assert
        await waitFor(() => {
            expect(mockGetUsage).toHaveBeenCalledWith({ productDomain: 'commerce' });
        });
    });

    it('should show the addon bonus hint only when an addon actually raised the limit', async () => {
        // Arrange
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({
                    limitKey: 'max_accommodations',
                    currentUsage: 1,
                    maxAllowed: 8,
                    planBaseLimit: 5,
                    addonBonusLimit: 3
                }),
                buildLimit({
                    limitKey: 'max_favorites',
                    currentUsage: 1,
                    maxAllowed: 20,
                    planBaseLimit: 20,
                    addonBonusLimit: 0
                })
            ])
        );

        // Act
        renderSection();

        // Assert
        expect(await screen.findByText('Incluye 3 extra por complementos')).toBeInTheDocument();
        expect(screen.getAllByText(/extra por complementos/)).toHaveLength(1);
    });
});
