/**
 * @file CalendarSyncPanel.test.tsx
 * @description Tests for the Google Calendar sync panel (HOS-157 Phase 2 — Layer 5).
 *
 * Covers:
 * - Disconnected state renders a "Connect" button; clicking it calls
 *   connectGoogle with the current path as returnTo.
 * - Connected + OK state renders sync status, "Sync now" and "Disconnect".
 * - "Sync now" calls the sync endpoint and surfaces the result banner.
 * - "Disconnect" calls the disconnect endpoint.
 * - A terminal sync error surfaces a reconnect banner.
 * - The ?calendarSync=connected callback flag shows a success banner on mount.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarSyncPanel } from '@/components/host/editor/CalendarSyncPanel.client';

const { mockConnectGoogle, mockStatus, mockSync, mockDisconnect } = vi.hoisted(() => ({
    mockConnectGoogle: vi.fn(),
    mockStatus: vi.fn(),
    mockSync: vi.fn(),
    mockDisconnect: vi.fn()
}));

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? key
    })
}));

vi.mock('@/components/host/editor/CalendarSyncPanel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

vi.mock('@/lib/format-utils', () => ({
    formatDate: () => '15 jul 2026, 10:00'
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationCalendarSyncApi: {
        connectGoogle: mockConnectGoogle,
        status: mockStatus,
        sync: mockSync,
        disconnect: mockDisconnect
    }
}));

const ACC_ID = 'acc-uuid-123';

const disconnectedStatus = () => ({
    ok: true as const,
    data: { connected: false, status: null }
});

const connectedStatus = (lastSyncStatus: 'OK' | 'ERROR' | 'PENDING' = 'OK') => ({
    ok: true as const,
    data: {
        connected: true,
        status: {
            provider: 'GOOGLE_CALENDAR',
            externalCalendarId: 'primary',
            lastSyncAt: '2026-07-15T13:00:00.000Z',
            lastSyncStatus,
            lastErrorMessage: lastSyncStatus === 'ERROR' ? 'reconnect needed' : null,
            isActive: true
        }
    }
});

describe('CalendarSyncPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState(null, '', '/es/mi-cuenta/propiedades/acc-uuid-123/editar/');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders a connect button when there is no active connection', async () => {
        mockStatus.mockResolvedValue(disconnectedStatus());

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );

        expect(await screen.findByText('Conectar Google Calendar')).toBeInTheDocument();
    });

    it('fetches connection status exactly once on mount (no render/fetch loop — HOS-157 regression)', async () => {
        // Regression for the infinite render/fetch loop: the mount effect
        // depended on `t`, and `createTranslations` returns a fresh `t` every
        // render (the mock above mirrors that). Without memoizing `t`, each
        // state update re-ran the effect → re-fetched status → looped, hammering
        // the API into a 429. The panel must call `status` once per mount.
        mockStatus.mockResolvedValue(disconnectedStatus());

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        await screen.findByText('Conectar Google Calendar');
        // Give any erroneous re-render loop time to fire extra fetches.
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(mockStatus).toHaveBeenCalledTimes(1);
    });

    it('calls connectGoogle with the current path as returnTo when connecting', async () => {
        mockStatus.mockResolvedValue(disconnectedStatus());
        mockConnectGoogle.mockResolvedValue({ ok: true, data: { authorizeUrl: '' } });
        const user = userEvent.setup();

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        const button = await screen.findByText('Conectar Google Calendar');
        await user.click(button);

        await waitFor(() => {
            expect(mockConnectGoogle).toHaveBeenCalledWith({
                id: ACC_ID,
                returnTo: '/es/mi-cuenta/propiedades/acc-uuid-123/editar/'
            });
        });
    });

    it('renders sync + disconnect actions when connected and synced', async () => {
        mockStatus.mockResolvedValue(connectedStatus('OK'));

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );

        expect(await screen.findByText('Conectado y sincronizado')).toBeInTheDocument();
        expect(screen.getByText('Sincronizar ahora')).toBeInTheDocument();
        expect(screen.getByText('Desconectar')).toBeInTheDocument();
    });

    it('calls sync and shows the success banner on "Sync now"', async () => {
        mockStatus.mockResolvedValue(connectedStatus('OK'));
        mockSync.mockResolvedValue({
            ok: true,
            data: {
                status: 'ok',
                eventsProcessed: 2,
                datesUpserted: 3,
                datesRemoved: 0,
                fullSync: false
            }
        });
        const user = userEvent.setup();

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        await user.click(await screen.findByText('Sincronizar ahora'));

        await waitFor(() => expect(mockSync).toHaveBeenCalledWith({ id: ACC_ID }));
        expect(
            await screen.findByText('Sincronización completa. Actualizamos tus fechas ocupadas.')
        ).toBeInTheDocument();
    });

    it('surfaces a reconnect banner when the sync returns a terminal error', async () => {
        mockStatus.mockResolvedValue(connectedStatus('OK'));
        mockSync.mockResolvedValue({
            ok: true,
            data: { status: 'error', kind: 'terminal', message: 'gone' }
        });
        const user = userEvent.setup();

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        await user.click(await screen.findByText('Sincronizar ahora'));

        expect(
            await screen.findByText(
                'Se perdió el acceso a tu Google Calendar. Reconectá para seguir sincronizando.'
            )
        ).toBeInTheDocument();
    });

    it('calls disconnect on "Disconnect"', async () => {
        mockStatus.mockResolvedValue(connectedStatus('OK'));
        mockDisconnect.mockResolvedValue({ ok: true, data: { disconnected: true } });
        const user = userEvent.setup();

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        await user.click(await screen.findByText('Desconectar'));

        await waitFor(() => expect(mockDisconnect).toHaveBeenCalledWith({ id: ACC_ID }));
    });

    it('shows a reconnect action when the connection is in ERROR state', async () => {
        mockStatus.mockResolvedValue(connectedStatus('ERROR'));

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );

        expect(await screen.findByText('La última sincronización falló')).toBeInTheDocument();
        expect(screen.getByText('Reconectar')).toBeInTheDocument();
    });

    it('shows a success banner when returning from the OAuth callback with ?calendarSync=connected', async () => {
        window.history.replaceState(
            null,
            '',
            '/es/mi-cuenta/propiedades/acc-uuid-123/editar/?calendarSync=connected&accommodationId=acc-uuid-123'
        );
        mockStatus.mockResolvedValue(connectedStatus('PENDING'));

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );

        expect(
            await screen.findByText(
                'Tu Google Calendar quedó conectado. Ya vamos a sincronizar tus fechas ocupadas.'
            )
        ).toBeInTheDocument();
        // The result flag is stripped from the URL after being read.
        expect(window.location.search).not.toContain('calendarSync');
    });
});
