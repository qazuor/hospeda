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
 *  - Kit rows (HOS-2507): validity date, and the «Ver alojamiento» action that
 *    resolves the listing slug from the accommodation id (no new API fields)
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExclusiveDealsList } from '../../../src/components/account/ExclusiveDealsList.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

const { getByIdMock } = vi.hoisted(() => ({
    getByIdMock: vi.fn()
}));

vi.mock('../../../src/lib/api/endpoints', () => ({
    accommodationsApi: { getById: getByIdMock }
}));

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
        vi.clearAllMocks();
    });

    it('shows a skeleton while fetch is in flight', () => {
        vi.mocked(global.fetch).mockImplementationOnce(() => new Promise<Response>(() => {}));
        const { container } = renderComponent();
        expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
        expect(screen.getByText('Cargando…')).toBeInTheDocument();
    });

    it('shows the upgrade CTA on 403 ENTITLEMENT_REQUIRED', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(makeEntitlementRequiredResponse());
        renderComponent();
        await waitFor(() => {
            expect(
                screen.getByText(/las ofertas exclusivas no están incluidas en tu plan actual/i)
            ).toBeInTheDocument();
            expect(screen.getByRole('link', { name: /ver planes/i })).toBeInTheDocument();
        });
    });

    it('shows an error state with a retry that refetches', async () => {
        vi.mocked(global.fetch)
            .mockResolvedValueOnce(makeErrorResponse())
            .mockResolvedValueOnce(makeListResponse([PLUS_DEAL]));
        renderComponent();
        const retry = await screen.findByRole('button', { name: /reintentar/i });
        fireEvent.click(retry);
        expect(await screen.findByText('Descuento fin de semana')).toBeInTheDocument();
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

    it('shows the validity date only when the deal has one', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(
            makeListResponse([
                { ...PLUS_DEAL, validUntil: '2026-12-31T12:00:00.000Z' },
                { ...VIP_DEAL, accommodationId: null }
            ])
        );
        renderComponent();
        expect(await screen.findByText(/Válida hasta el/)).toBeInTheDocument();
        expect(screen.getAllByText(/Válida hasta el/)).toHaveLength(1);
    });

    it('opens the listing the deal belongs to, resolving its slug from the id', async () => {
        const assign = vi.fn();
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...window.location, assign }
        });
        getByIdMock.mockResolvedValue({ ok: true, data: { slug: 'cabanas-del-rio' } });
        vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([PLUS_DEAL]));
        renderComponent();

        fireEvent.click(await screen.findByRole('button', { name: /ver alojamiento/i }));

        await waitFor(() =>
            expect(assign).toHaveBeenCalledWith('/es/alojamientos/cabanas-del-rio/')
        );
        expect(getByIdMock).toHaveBeenCalledWith({ id: 'acc-001' });
    });

    it('says inline, in the row, that a gone listing is no longer available and drops the action', async () => {
        getByIdMock.mockResolvedValue({
            ok: false,
            error: { status: 404, code: 'NOT_FOUND', message: 'Not found' }
        });
        vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([PLUS_DEAL]));
        renderComponent();

        fireEvent.click(await screen.findByRole('button', { name: /ver alojamiento/i }));

        const row = document.querySelector('[data-row="promo-001"]') as HTMLElement;
        await waitFor(() =>
            expect(row).toHaveTextContent('Este alojamiento ya no está disponible.')
        );
        expect(screen.queryByRole('button', { name: /ver alojamiento/i })).not.toBeInTheDocument();
    });

    it('says inline when the listing read fails for another reason, and keeps the action to retry', async () => {
        getByIdMock.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'boom' }
        });
        vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([PLUS_DEAL]));
        renderComponent();

        fireEvent.click(await screen.findByRole('button', { name: /ver alojamiento/i }));

        expect(
            await screen.findByText('No pudimos abrir el alojamiento. Probá de nuevo.')
        ).toBeInTheDocument();
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /ver alojamiento/i })).toBeInTheDocument();
    });

    it('offers no listing action for an owner-wide deal (no accommodation id)', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(
            makeListResponse([{ ...PLUS_DEAL, accommodationId: null }])
        );
        renderComponent();

        expect(await screen.findByText('Descuento fin de semana')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /ver alojamiento/i })).not.toBeInTheDocument();
    });
});
