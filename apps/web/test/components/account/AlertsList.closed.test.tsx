/**
 * @file AlertsList.closed.test.tsx
 * @description TEST:V8a:6 (web half, HOS-1492, V8a row 27): an alert whose
 * listing reached `PURGED` is listed as CLOSED. It says only that the listing
 * no longer exists — never why — and drops the active alert's copy. Active
 * alerts render as before, under a list that is no longer called "active" once
 * a closed alert sits next to it.
 *
 * Renders with the real `es` translations (no i18n mock), so the assertions
 * read the copy a visitor reads.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertsList } from '../../../src/components/account/AlertsList.client';

vi.mock('../../../src/components/account/AlertsList.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

const API_URL = 'http://localhost:3001';

const BASE_ALERT = {
    userId: 'user-001',
    accommodationId: 'acc-001',
    basePriceSnapshot: 2500000,
    targetPercentDrop: 10,
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    deletedAt: null
};

const ACTIVE_ALERT = {
    ...BASE_ALERT,
    id: 'alert-active',
    accommodationName: 'Cabaña del Río',
    closedBecauseListingGone: false
};

const CLOSED_ALERT = {
    ...BASE_ALERT,
    id: 'alert-closed',
    accommodationId: 'acc-002',
    accommodationName: 'Casa del Palmar',
    isActive: false,
    closedBecauseListingGone: true
};

function mockList(items: readonly object[]) {
    vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { items } })
    } as Response);
}

async function renderList(items: readonly object[]) {
    mockList(items);
    render(
        <AlertsList
            locale="es"
            apiUrl={API_URL}
            userId="user-001"
        />
    );
    await waitFor(() => {
        expect(screen.queryByText('Cargando alertas...')).not.toBeInTheDocument();
    });
}

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('AlertsList — closed alerts (HOS-1492, V8a row 27)', () => {
    it('TEST:V8a:6 — lists a closed alert as closed because the listing no longer exists', async () => {
        // Arrange + Act
        await renderList([CLOSED_ALERT]);

        // Assert
        const closedList = screen.getByRole('list', { name: 'Tus alertas de precio cerradas' });
        const item = within(closedList).getByRole('listitem');
        expect(item).toHaveAttribute('data-alert-state', 'closed');
        expect(item).toHaveTextContent('Casa del Palmar');
        expect(item).toHaveTextContent('Esta alerta se cerró porque esa ficha ya no existe.');
        expect(screen.getByRole('heading', { name: 'Alertas cerradas' })).toBeInTheDocument();
    });

    it('TEST:V8a:6 — the closed alert drops the active copy and never says why the listing is gone', async () => {
        // Arrange + Act
        await renderList([CLOSED_ALERT]);

        // Assert
        const item = screen.getByRole('listitem');
        expect(item).not.toHaveTextContent('Alertar cuando baje');
        expect(item).not.toHaveTextContent('Precio al suscribirte');
        expect(item.textContent ?? '').not.toMatch(/inactividad|borr[óo] el due[ñn]o|moderad/i);
        expect(
            screen.queryByRole('list', { name: 'Tus alertas de precio activas' })
        ).not.toBeInTheDocument();
    });

    it('TEST:V8a:6 — separates active and closed alerts, each under its own heading', async () => {
        // Arrange + Act
        await renderList([ACTIVE_ALERT, CLOSED_ALERT]);

        // Assert
        const activeList = screen.getByRole('list', { name: 'Tus alertas de precio activas' });
        const closedList = screen.getByRole('list', { name: 'Tus alertas de precio cerradas' });
        expect(within(activeList).getAllByRole('listitem')).toHaveLength(1);
        expect(within(activeList).getByRole('listitem')).toHaveTextContent('Cabaña del Río');
        expect(within(activeList).getByRole('listitem')).toHaveTextContent('Alertar cuando baje');
        expect(within(activeList).queryByText(/ya no existe/)).not.toBeInTheDocument();
        expect(within(closedList).getAllByRole('listitem')).toHaveLength(1);
        expect(within(closedList).getByRole('listitem')).toHaveTextContent('Casa del Palmar');
        expect(screen.getByRole('heading', { name: 'Alertas activas' })).toBeInTheDocument();
    });

    it('renders active alerts as before when none is closed', async () => {
        // Arrange + Act
        await renderList([ACTIVE_ALERT]);

        // Assert
        const item = screen.getByRole('listitem');
        expect(item).toHaveAttribute('data-alert-state', 'active');
        expect(item).toHaveTextContent('Alertar cuando baje: 10% o más');
        expect(item).not.toHaveTextContent('ya no existe');
        expect(screen.queryByRole('heading')).not.toBeInTheDocument();
        expect(
            screen.queryByRole('list', { name: 'Tus alertas de precio cerradas' })
        ).not.toBeInTheDocument();
    });
});
