/**
 * @file PlanUsageSection.test.tsx
 * @description RTL tests for the PlanUsageSection React island.
 *
 * Covers:
 *  - Renders one row per granted limit with the "N de M" figure
 *  - Limits the plan does not grant (`maxAllowed: 0`) are filtered out
 *  - Unlimited limits (`maxAllowed: -1`) show the consumption + "Ilimitado"
 *    and render NO progress bar
 *  - The progress bar caps at 100% while the figure keeps reporting the truth
 *  - The label comes from i18n keyed by limitKey, never the API's English
 *    `displayName`
 *  - A failed usage read renders nothing at all (no error box)
 *  - The requested product domain is forwarded to the API
 */

import { render, screen, waitFor } from '@testing-library/react';
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
    'account.subscription.usage.limits.max_favorites': 'Favoritos guardados'
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
        render(<PlanUsageSection locale="es" />);

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
        render(<PlanUsageSection locale="es" />);

        // Assert
        expect(await screen.findByText('Alojamientos publicados')).toBeInTheDocument();
        expect(screen.queryByText('Maximum accommodations')).not.toBeInTheDocument();
    });

    it('should hide limits the plan does not grant (maxAllowed 0)', async () => {
        // Arrange — the endpoint returns EVERY LimitKey; ungranted ones come
        // back as 0 and must never render as a "0 de 0" row.
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
        render(<PlanUsageSection locale="es" />);

        // Assert
        expect(await screen.findByText('Alojamientos publicados')).toBeInTheDocument();
        expect(screen.queryByText('Favoritos guardados')).not.toBeInTheDocument();
        expect(screen.queryByText('0 de 0')).not.toBeInTheDocument();
    });

    it('should hide limits whose usage the server does not actually measure', async () => {
        // Arrange — most LimitKeys have no counter and report a placeholder 0.
        // Rendering one would tell a user who HAS used the feature that they
        // have used none of it.
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({ limitKey: 'max_accommodations', currentUsage: 2, maxAllowed: 5 }),
                buildLimit({
                    limitKey: 'max_favorites',
                    currentUsage: 0,
                    maxAllowed: 200,
                    planBaseLimit: 200,
                    isMeasured: false
                })
            ])
        );

        // Act
        render(<PlanUsageSection locale="es" />);

        // Assert
        expect(await screen.findByText('Alojamientos publicados')).toBeInTheDocument();
        expect(screen.queryByText('Favoritos guardados')).not.toBeInTheDocument();
        expect(screen.queryByText('0 de 200')).not.toBeInTheDocument();
    });

    it('should render nothing when every limit is unmeasured', async () => {
        // Arrange
        mockGetUsage.mockResolvedValue(
            okUsage([
                buildLimit({ limitKey: 'max_accommodations', maxAllowed: 5, isMeasured: false })
            ])
        );

        // Act
        const { container } = render(<PlanUsageSection locale="es" />);

        // Assert
        await waitFor(() => {
            expect(container).toBeEmptyDOMElement();
        });
    });

    it('should render an unlimited limit as consumption + Ilimitado, with no progress bar', async () => {
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
        render(<PlanUsageSection locale="es" />);

        // Assert
        expect(await screen.findByText('12 en uso · Ilimitado')).toBeInTheDocument();
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

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
        render(<PlanUsageSection locale="es" />);

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
        render(<PlanUsageSection locale="es" />);

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
        render(<PlanUsageSection locale="es" />);

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
        render(<PlanUsageSection locale="es" />);

        // Assert — a bare bar with no name tells a screen-reader user nothing.
        const bar = await screen.findByRole('progressbar', { name: 'Alojamientos publicados' });
        expect(bar).toBeInTheDocument();
    });

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
        const { container } = render(<PlanUsageSection locale="es" />);

        // Assert
        await waitFor(() => {
            expect(container).toBeEmptyDOMElement();
        });
    });

    it('should render nothing when the request throws', async () => {
        // Arrange
        mockGetUsage.mockRejectedValue(new Error('network down'));

        // Act
        const { container } = render(<PlanUsageSection locale="es" />);

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
        render(<PlanUsageSection locale="es" />);

        // Assert
        expect(await screen.findByText('Incluye 3 extra por complementos')).toBeInTheDocument();
        expect(screen.getAllByText(/extra por complementos/)).toHaveLength(1);
    });
});
