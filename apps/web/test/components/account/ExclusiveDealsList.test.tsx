/**
 * @file ExclusiveDealsList.test.tsx
 * @description RTL tests for the ExclusiveDealsList React island (HOS-21 T-012).
 *
 * Covers:
 *  - Loading state
 *  - Error state (non-403 failure)
 *  - Upgrade (plan-gate) state on 403 ENTITLEMENT_REQUIRED
 *  - Empty state
 *  - Populated list: title + discount label per discountType
 *  - VIP-only badge shown for touristAudience='vip', hidden for 'plus'
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExclusiveDealsList } from '../../../src/components/account/ExclusiveDealsList.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/ExclusiveDealsList.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    return { createTranslations: () => ({ t }) };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const API_URL = 'http://localhost:3001';
const LOCALE = 'es' as const;
const USER_ID = 'user-uuid-001';

const PLUS_DEAL = {
    id: 'promo-001',
    slug: 'descuento-fin-de-semana',
    ownerId: 'owner-001',
    accommodationId: 'acc-001',
    title: 'Descuento fin de semana',
    discountType: 'percentage',
    discountValue: 15,
    lifecycleState: 'ACTIVE',
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: null,
    currentRedemptions: 0,
    maxRedemptions: null,
    touristAudience: 'plus',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

const VIP_DEAL = {
    ...PLUS_DEAL,
    id: 'promo-002',
    slug: 'noche-gratis-vip',
    title: 'Noche gratis VIP',
    discountType: 'free_night',
    discountValue: 0,
    touristAudience: 'vip'
};

function makeListResponse(items = [PLUS_DEAL]) {
    return {
        ok: true,
        json: async () => ({ success: true, data: { items } })
    } as Response;
}

function makeEmptyListResponse() {
    return {
        ok: true,
        json: async () => ({ success: true, data: { items: [] } })
    } as Response;
}

function makeEntitlementRequiredResponse() {
    return {
        ok: false,
        status: 403,
        json: async () => ({ success: false, error: { code: 'ENTITLEMENT_REQUIRED' } })
    } as Response;
}

function makeErrorResponse(status = 500) {
    return {
        ok: false,
        status,
        json: async () => ({ success: false, error: { message: 'Server error' } })
    } as Response;
}

function renderComponent() {
    return render(
        <ExclusiveDealsList
            locale={LOCALE}
            apiUrl={API_URL}
            userId={USER_ID}
        />
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExclusiveDealsList', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    it('shows loading text while fetch is in flight', () => {
        vi.mocked(global.fetch).mockImplementationOnce(() => new Promise<Response>(() => {}));
        renderComponent();
        expect(screen.getByText(/cargando ofertas exclusivas/i)).toBeInTheDocument();
    });

    it('shows the upgrade CTA on 403 ENTITLEMENT_REQUIRED', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(makeEntitlementRequiredResponse());
        renderComponent();
        await waitFor(() => {
            expect(
                screen.getByText(/las ofertas exclusivas están disponibles/i)
            ).toBeInTheDocument();
            expect(screen.getByRole('link', { name: /ver planes/i })).toBeInTheDocument();
        });
    });

    it('shows a generic error state on a non-403 failure', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(makeErrorResponse());
        renderComponent();
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    it('shows the empty state when there are no deals', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(makeEmptyListResponse());
        renderComponent();
        await waitFor(() => {
            expect(screen.getByText(/no hay ofertas activas por ahora/i)).toBeInTheDocument();
        });
    });

    it('renders the deal title and percentage discount label', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([PLUS_DEAL]));
        renderComponent();
        await waitFor(() => {
            expect(screen.getByText('Descuento fin de semana')).toBeInTheDocument();
            expect(screen.getByText(/15%/)).toBeInTheDocument();
        });
    });

    it('does not show the VIP-only badge for a plus-tier deal', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([PLUS_DEAL]));
        renderComponent();
        await waitFor(() => {
            expect(screen.getByText('Descuento fin de semana')).toBeInTheDocument();
        });
        expect(screen.queryByText(/solo vip/i)).not.toBeInTheDocument();
    });

    it('shows the VIP-only badge for a vip-tier deal', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([VIP_DEAL]));
        renderComponent();
        await waitFor(() => {
            expect(screen.getByText('Noche gratis VIP')).toBeInTheDocument();
            expect(screen.getByText(/solo vip/i)).toBeInTheDocument();
        });
    });
});
