/**
 * @file CalendarSyncPanel.test.tsx
 * @description Tests for the multi-provider external calendar sync panel
 * (HOS-157 Phase 2 — Google Calendar; widened HOS-162 Phase 3 — Layer F — to
 * Airbnb / Booking.com / generic iCal feeds).
 *
 * Covers:
 * - Renders one row per provider from the `{ connections }` array response.
 * - Google: disconnected shows a "Connect" button; clicking it calls
 *   connectGoogle with the current path as returnTo.
 * - iCal providers: disconnected shows a feed URL form; submitting it calls
 *   connectIcal with the right body; a 400 error surfaces next to that row.
 * - Connected + OK state renders sync status, "Sync now" and "Disconnect" for
 *   the connected provider only — other providers stay in their own state.
 * - "Sync now" / "Disconnect" call the right endpoint with the right provider
 *   token and surface a result message scoped to that row.
 * - Per-provider busy state: one provider's in-flight action never disables
 *   another provider's controls.
 * - A terminal Google sync error surfaces a reconnect banner.
 * - The ?calendarSync=connected callback flag shows a top banner on mount.
 * - A broken iCal feed (connected + lastSyncStatus ERROR) renders the
 *   specific lastErrorMessage plus an in-place re-paste form; resubmitting
 *   calls connectIcal with the corrected URL (judgment-day fix A3/#3).
 * - The panel root carries id="calendar-sync" and scrolls into view when the
 *   URL already has that hash on mount (judgment-day fix #2, anchor half).
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarSyncPanel } from '@/components/host/editor/CalendarSyncPanel.client';

const { mockConnectGoogle, mockConnectIcal, mockStatus, mockSync, mockDisconnect } = vi.hoisted(
    () => ({
        mockConnectGoogle: vi.fn(),
        mockConnectIcal: vi.fn(),
        mockStatus: vi.fn(),
        mockSync: vi.fn(),
        mockDisconnect: vi.fn()
    })
);

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
        connectIcal: mockConnectIcal,
        status: mockStatus,
        sync: mockSync,
        disconnect: mockDisconnect
    }
}));

const ACC_ID = 'acc-uuid-123';

const emptyStatus = () => ({
    ok: true as const,
    data: { connections: [] }
});

const connectionRow = ({
    provider,
    lastSyncStatus = 'OK' as 'OK' | 'ERROR' | 'PENDING'
}: {
    readonly provider: 'GOOGLE_CALENDAR' | 'AIRBNB' | 'BOOKING' | 'OTHER';
    readonly lastSyncStatus?: 'OK' | 'ERROR' | 'PENDING';
}) => ({
    provider,
    connected: true,
    lastSyncAt: '2026-07-15T13:00:00.000Z',
    lastSyncStatus,
    lastErrorMessage: lastSyncStatus === 'ERROR' ? 'reconnect needed' : null
});

describe('CalendarSyncPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState(null, '', '/es/mi-cuenta/propiedades/acc-uuid-123/editar/');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders a row per provider, all disconnected by default', async () => {
        mockStatus.mockResolvedValue(emptyStatus());

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );

        expect(await screen.findByText('Conectar Google Calendar')).toBeInTheDocument();
        expect(screen.getByTestId('calendar-provider-row-AIRBNB')).toBeInTheDocument();
        expect(screen.getByTestId('calendar-provider-row-BOOKING')).toBeInTheDocument();
        expect(screen.getByTestId('calendar-provider-row-OTHER')).toBeInTheDocument();
        // Every non-Google row shows a feed URL form when disconnected.
        expect(screen.getAllByPlaceholderText('https://ejemplo.com/calendario.ics')).toHaveLength(
            3
        );
    });

    it('fetches connection status exactly once on mount (no render/fetch loop — HOS-157 regression)', async () => {
        mockStatus.mockResolvedValue(emptyStatus());

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        await screen.findByText('Conectar Google Calendar');
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(mockStatus).toHaveBeenCalledTimes(1);
    });

    it('renders no nested <form> and uses type="button" connect controls (HOS-162 nested-form regression)', async () => {
        // The whole panel mounts INSIDE the accommodation editor's <form>.
        // A nested <form> is invalid HTML — the browser drops it and the inner
        // submit falls through to a native GET on the outer form, reloading the
        // page without ever connecting. This asserts the panel never introduces
        // a <form> and that every connect control is type="button".
        mockStatus.mockResolvedValue(emptyStatus());

        const { container } = render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        await screen.findByText('Conectar Google Calendar');

        expect(container.querySelectorAll('form')).toHaveLength(0);
        const connectButtons = screen.getAllByRole('button', { name: 'Conectar' });
        expect(connectButtons.length).toBeGreaterThan(0);
        for (const button of connectButtons) {
            expect(button).toHaveAttribute('type', 'button');
        }
    });

    it('calls connectGoogle with the current path as returnTo when connecting', async () => {
        mockStatus.mockResolvedValue(emptyStatus());
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

    it('submits an iCal feed URL and calls connectIcal with the right body', async () => {
        mockStatus.mockResolvedValue(emptyStatus());
        mockConnectIcal.mockResolvedValue({
            ok: true,
            data: { connected: true, status: null }
        });
        const user = userEvent.setup();

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        const airbnbRow = within(await screen.findByTestId('calendar-provider-row-AIRBNB'));
        const input = airbnbRow.getByPlaceholderText('https://ejemplo.com/calendario.ics');
        await user.type(input, 'https://airbnb.com/calendar/ical/123.ics');
        await user.click(airbnbRow.getByRole('button', { name: 'Conectar' }));

        await waitFor(() => {
            expect(mockConnectIcal).toHaveBeenCalledWith({
                id: ACC_ID,
                provider: 'airbnb',
                feedUrl: 'https://airbnb.com/calendar/ical/123.ics'
            });
        });
        // A successful connect re-fetches status for every row.
        expect(mockStatus).toHaveBeenCalledTimes(2);
    });

    // HOS-190 form 25: client-side validation via ConnectIcalBodySchema
    // (feedUrl must be HTTPS, ≤2048 chars) — blocks the call to onConnectIcal
    // before the network round-trip, showing a FieldError under the input.
    // Asserts on the error element's id + non-empty text (not a literal
    // translated string): the test's i18n mock is a 2-arg `(key, fallback?)`
    // stub, so a message resolved through `resolveValidationMessage` (which
    // calls `t` with a 3rd `params` arg the mock ignores) surfaces as the raw
    // `validation.*` key rather than the real Spanish copy — matching the
    // established pattern in ProfileCompletion.client.test.tsx.
    it('blocks connectIcal and shows a field error for a non-HTTPS feed URL', async () => {
        mockStatus.mockResolvedValue(emptyStatus());
        const user = userEvent.setup();

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        const airbnbRow = within(await screen.findByTestId('calendar-provider-row-AIRBNB'));
        const input = airbnbRow.getByPlaceholderText('https://ejemplo.com/calendario.ics');
        await user.type(input, 'http://airbnb.com/calendar/ical/123.ics');
        await user.click(airbnbRow.getByRole('button', { name: 'Conectar' }));

        await waitFor(() => {
            expect(document.getElementById('ical-feed-url-AIRBNB-error')?.textContent).toBeTruthy();
        });
        expect(mockConnectIcal).not.toHaveBeenCalled();
    });

    it('clears the feedUrl field error once the value is edited again', async () => {
        mockStatus.mockResolvedValue(emptyStatus());
        const user = userEvent.setup();

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        const airbnbRow = within(await screen.findByTestId('calendar-provider-row-AIRBNB'));
        const input = airbnbRow.getByPlaceholderText('https://ejemplo.com/calendario.ics');
        await user.type(input, 'not-a-url');
        await user.click(airbnbRow.getByRole('button', { name: 'Conectar' }));
        await waitFor(() => {
            expect(document.getElementById('ical-feed-url-AIRBNB-error')?.textContent).toBeTruthy();
        });

        await user.type(input, 's');
        expect(document.getElementById('ical-feed-url-AIRBNB-error')).not.toBeInTheDocument();
    });

    it('surfaces a 400 connect-ical error next to that provider row only', async () => {
        mockStatus.mockResolvedValue(emptyStatus());
        mockConnectIcal.mockResolvedValue({
            ok: false,
            error: {
                status: 400,
                code: 'VALIDATION_ERROR',
                message: 'We could not read that calendar feed. Double-check the URL and try again.'
            }
        });
        const user = userEvent.setup();

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        const bookingRow = within(await screen.findByTestId('calendar-provider-row-BOOKING'));
        const input = bookingRow.getByPlaceholderText('https://ejemplo.com/calendario.ics');
        await user.type(input, 'https://booking.com/calendar/ical/bad.ics');
        await user.click(bookingRow.getByRole('button', { name: 'Conectar' }));

        expect(
            await bookingRow.findByText(
                'We could not read that calendar feed. Double-check the URL and try again.'
            )
        ).toBeInTheDocument();
        // The Airbnb/Other rows are unaffected.
        const airbnbRow = within(screen.getByTestId('calendar-provider-row-AIRBNB'));
        expect(
            airbnbRow.queryByText(
                'We could not read that calendar feed. Double-check the URL and try again.'
            )
        ).not.toBeInTheDocument();
    });

    it('renders sync + disconnect actions only for the connected provider', async () => {
        mockStatus.mockResolvedValue({
            ok: true,
            data: { connections: [connectionRow({ provider: 'GOOGLE_CALENDAR' })] }
        });

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );

        const googleRow = within(
            await screen.findByTestId('calendar-provider-row-GOOGLE_CALENDAR')
        );
        expect(googleRow.getByText('Conectado y sincronizado')).toBeInTheDocument();
        expect(googleRow.getByText('Sincronizar ahora')).toBeInTheDocument();
        expect(googleRow.getByText('Desconectar')).toBeInTheDocument();

        // Airbnb is still disconnected — its own form is shown, not sync/disconnect actions.
        const airbnbRow = within(screen.getByTestId('calendar-provider-row-AIRBNB'));
        expect(
            airbnbRow.getByPlaceholderText('https://ejemplo.com/calendario.ics')
        ).toBeInTheDocument();
    });

    it('calls sync with the right provider token and shows the row-scoped success message', async () => {
        mockStatus.mockResolvedValue({
            ok: true,
            data: { connections: [connectionRow({ provider: 'AIRBNB' })] }
        });
        mockSync.mockResolvedValue({
            ok: true,
            data: { status: 'ok', removed: 1, inserted: 2 }
        });
        const user = userEvent.setup();

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        const airbnbRow = within(await screen.findByTestId('calendar-provider-row-AIRBNB'));
        await user.click(airbnbRow.getByText('Sincronizar ahora'));

        await waitFor(() =>
            expect(mockSync).toHaveBeenCalledWith({ id: ACC_ID, provider: 'airbnb' })
        );
        expect(
            await airbnbRow.findByText('Sincronización completa. Actualizamos tus fechas ocupadas.')
        ).toBeInTheDocument();
    });

    it('surfaces a reconnect message when a Google sync returns a terminal error', async () => {
        mockStatus.mockResolvedValue({
            ok: true,
            data: { connections: [connectionRow({ provider: 'GOOGLE_CALENDAR' })] }
        });
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
        const googleRow = within(
            await screen.findByTestId('calendar-provider-row-GOOGLE_CALENDAR')
        );
        await user.click(googleRow.getByText('Sincronizar ahora'));

        expect(
            await googleRow.findByText(
                'Se perdió el acceso a tu Google Calendar. Reconectá para seguir sincronizando.'
            )
        ).toBeInTheDocument();
    });

    it('calls disconnect with the right provider token', async () => {
        mockStatus.mockResolvedValue({
            ok: true,
            data: { connections: [connectionRow({ provider: 'BOOKING' })] }
        });
        mockDisconnect.mockResolvedValue({ ok: true, data: { disconnected: true } });
        const user = userEvent.setup();

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        const bookingRow = within(await screen.findByTestId('calendar-provider-row-BOOKING'));
        await user.click(bookingRow.getByText('Desconectar'));

        await waitFor(() =>
            expect(mockDisconnect).toHaveBeenCalledWith({ id: ACC_ID, provider: 'booking' })
        );
    });

    it('keeps other providers usable while one provider is busy syncing (per-row busy state)', async () => {
        mockStatus.mockResolvedValue({
            ok: true,
            data: { connections: [connectionRow({ provider: 'GOOGLE_CALENDAR' })] }
        });
        let resolveSync: (value: unknown) => void = () => undefined;
        mockSync.mockReturnValue(
            new Promise((resolve) => {
                resolveSync = resolve;
            })
        );
        const user = userEvent.setup();

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        const googleRow = within(
            await screen.findByTestId('calendar-provider-row-GOOGLE_CALENDAR')
        );
        await user.click(googleRow.getByText('Sincronizar ahora'));

        // Google's own sync button is now disabled (busy), but Airbnb's connect
        // button (a different row) must stay enabled.
        const airbnbRow = within(screen.getByTestId('calendar-provider-row-AIRBNB'));
        const airbnbConnectButton = airbnbRow.getByRole('button', { name: 'Conectar' });
        expect(airbnbConnectButton).not.toBeDisabled();

        resolveSync({ ok: true, data: { status: 'ok' } });
    });

    it('shows the specific error and an in-place re-paste form for a broken iCal feed', async () => {
        mockStatus.mockResolvedValue({
            ok: true,
            data: {
                connections: [connectionRow({ provider: 'AIRBNB', lastSyncStatus: 'ERROR' })]
            }
        });

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );

        const airbnbRow = within(await screen.findByTestId('calendar-provider-row-AIRBNB'));
        // Specific error from lastErrorMessage, not just the generic pill label.
        expect(
            airbnbRow.getByText('No pudimos leer el calendario: reconnect needed')
        ).toBeInTheDocument();
        // Re-paste form is available in place, alongside Sync now / Disconnect.
        expect(
            airbnbRow.getByPlaceholderText('https://ejemplo.com/calendario.ics')
        ).toBeInTheDocument();
        expect(airbnbRow.getByRole('button', { name: 'Reconectar' })).toBeInTheDocument();
        expect(airbnbRow.getByText('Sincronizar ahora')).toBeInTheDocument();
        expect(airbnbRow.getByText('Desconectar')).toBeInTheDocument();
    });

    it('re-submits the corrected feed URL from the broken-feed re-paste form', async () => {
        mockStatus.mockResolvedValue({
            ok: true,
            data: {
                connections: [connectionRow({ provider: 'AIRBNB', lastSyncStatus: 'ERROR' })]
            }
        });
        mockConnectIcal.mockResolvedValue({
            ok: true,
            data: { connected: true, status: null }
        });
        const user = userEvent.setup();

        render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );

        const airbnbRow = within(await screen.findByTestId('calendar-provider-row-AIRBNB'));
        const input = airbnbRow.getByPlaceholderText('https://ejemplo.com/calendario.ics');
        await user.type(input, 'https://airbnb.com/calendar/ical/fixed.ics');
        await user.click(airbnbRow.getByRole('button', { name: 'Reconectar' }));

        await waitFor(() => {
            expect(mockConnectIcal).toHaveBeenCalledWith({
                id: ACC_ID,
                provider: 'airbnb',
                feedUrl: 'https://airbnb.com/calendar/ical/fixed.ics'
            });
        });
    });

    it('carries id="calendar-sync" as the scroll anchor target', async () => {
        mockStatus.mockResolvedValue(emptyStatus());

        const { container } = render(
            <CalendarSyncPanel
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        await screen.findByText('Conectar Google Calendar');

        expect(container.querySelector('#calendar-sync')).toBeInTheDocument();
    });

    it('scrolls the panel into view on mount when the URL already has #calendar-sync', async () => {
        window.history.replaceState(
            null,
            '',
            '/es/mi-cuenta/propiedades/acc-uuid-123/editar/#calendar-sync'
        );
        mockStatus.mockResolvedValue(emptyStatus());
        const scrollIntoViewSpy = vi.fn();
        // jsdom does not implement scrollIntoView — install a spy so the
        // component's optional-chained call can be observed, then remove it
        // so the stub doesn't leak into other tests.
        HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;

        try {
            render(
                <CalendarSyncPanel
                    locale="es"
                    accommodationId={ACC_ID}
                />
            );
            await screen.findByText('Conectar Google Calendar');

            expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
        } finally {
            // Test-only cleanup of the jsdom stub so it doesn't leak into other tests.
            delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
        }
    });

    it('shows a top banner when returning from the OAuth callback with ?calendarSync=connected', async () => {
        window.history.replaceState(
            null,
            '',
            '/es/mi-cuenta/propiedades/acc-uuid-123/editar/?calendarSync=connected&accommodationId=acc-uuid-123'
        );
        mockStatus.mockResolvedValue({
            ok: true,
            data: {
                connections: [
                    connectionRow({ provider: 'GOOGLE_CALENDAR', lastSyncStatus: 'PENDING' })
                ]
            }
        });

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
