// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-pages.json';
import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionRecordingCard } from '../SessionRecordingCard';

type FetchApiInput = { readonly path: string; readonly method?: string; readonly body?: unknown };
type FetchApiResponse = { readonly data: { readonly data?: unknown } };
const fetchApi = vi.hoisted(() => vi.fn<(input: FetchApiInput) => Promise<FetchApiResponse>>());
const permissions = vi.hoisted(() => vi.fn<() => PermissionEnum[]>(() => []));
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-user-permissions', () => ({ useUserPermissions: permissions }));
vi.mock('@/hooks/use-translations', () => ({ useTranslations: () => ({ locale: 'es' }) }));

const copy = es.systemSettings.critical.sessionRecording;
const PATH = '/api/v1/admin/platform-settings/analytics.sessionRecording';

const PURGE_PATH = '/api/v1/admin/session-recording/purge';

function row(enabled: boolean, updatedAt = '2026-11-12T10:00:00.000Z', retentionDays?: number) {
    return {
        key: 'analytics.sessionRecording',
        value: retentionDays === undefined ? { enabled } : { enabled, retentionDays },
        updatedAt,
        updatedBy: 'super-admin-1'
    };
}

function renderCard() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <SessionRecordingCard />
        </QueryClientProvider>
    );
}

async function confirmToggle(label: string): Promise<void> {
    const user = userEvent.setup();
    const toggle = await screen.findByTestId('session-recording-toggle');
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    await user.click(
        within(screen.getByTestId('session-recording-confirm')).getByRole('button', {
            name: label
        })
    );
}

// Radix Select needs these DOM APIs, which jsdom lacks.
beforeAll(() => {
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.setPointerCapture ??= () => undefined;
    Element.prototype.releasePointerCapture ??= () => undefined;
    Element.prototype.scrollIntoView ??= () => undefined;
});

describe('SessionRecordingCard (HOS-2347)', () => {
    beforeEach(() => {
        fetchApi.mockReset();
        permissions.mockReset();
        permissions.mockReturnValue([PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE]);
    });

    it('AC-A1: shows OFF and "never changed" when the row is absent', async () => {
        fetchApi.mockResolvedValue({ data: { data: null } });
        renderCard();

        expect(await screen.findByTestId('session-recording-status')).toHaveTextContent(
            copy.statusOff
        );
        expect(screen.getByTestId('session-recording-last-changed')).toHaveTextContent(
            copy.neverChanged
        );
        expect(screen.getByTestId('session-recording-toggle')).toHaveAccessibleName(
            copy.enableAria
        );
    });

    it('AC-A2: confirming sends one PATCH with { enabled: true } and shows ON with the new date', async () => {
        fetchApi
            .mockResolvedValueOnce({ data: { data: null } })
            .mockResolvedValue({ data: { data: row(true, '2026-11-18T09:30:00.000Z') } });
        renderCard();

        await confirmToggle(copy.enable);

        const patches = fetchApi.mock.calls.filter(([call]) => call.method === 'PATCH');
        expect(patches).toHaveLength(1);
        expect(patches[0]?.[0]).toEqual({
            path: PATH,
            method: 'PATCH',
            body: { value: { enabled: true, retentionDays: 30 } }
        });
        await waitFor(() =>
            expect(screen.getByTestId('session-recording-status')).toHaveTextContent(copy.statusOn)
        );
        expect(screen.getByTestId('session-recording-last-changed')).not.toHaveTextContent(
            copy.neverChanged
        );
        expect(screen.getByTestId('session-recording-last-changed')).toHaveTextContent('2026');
    });

    it('turning off states the propagation bound before confirming', async () => {
        fetchApi.mockResolvedValue({ data: { data: row(true) } });
        const user = userEvent.setup();
        renderCard();

        const toggle = await screen.findByTestId('session-recording-toggle');
        await waitFor(() => expect(toggle).toHaveAccessibleName(copy.disableAria));
        await user.click(toggle);

        expect(screen.getByTestId('session-recording-confirm')).toHaveTextContent(
            copy.confirmDisable
        );
    });

    it('AC-A3: cancelling sends no request and keeps the state', async () => {
        fetchApi.mockResolvedValue({ data: { data: null } });
        const user = userEvent.setup();
        renderCard();

        const toggle = await screen.findByTestId('session-recording-toggle');
        await waitFor(() => expect(toggle).toBeEnabled());
        await user.click(toggle);
        expect(screen.getByTestId('session-recording-confirm')).toHaveTextContent(
            copy.confirmEnable
        );
        await user.click(screen.getByRole('button', { name: copy.cancel }));

        expect(fetchApi.mock.calls.filter(([call]) => call.method === 'PATCH')).toHaveLength(0);
        expect(screen.getByTestId('session-recording-status')).toHaveTextContent(copy.statusOff);
    });

    it('AC-A4: renders nothing and reads nothing without the permission', () => {
        permissions.mockReturnValue([PermissionEnum.SYSTEM_MAINTENANCE_MODE]);
        fetchApi.mockResolvedValue({ data: { data: null } });

        const { container } = renderCard();

        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByTestId('session-recording-card')).toBeNull();
        expect(fetchApi).not.toHaveBeenCalled();
    });

    it('AC-A5: a failed write shows an inline error and keeps the previous value', async () => {
        fetchApi
            .mockResolvedValueOnce({ data: { data: null } })
            .mockRejectedValueOnce(new Error('500 private server detail'));
        renderCard();

        await confirmToggle(copy.enable);

        expect(await screen.findByTestId('session-recording-save-error')).toHaveTextContent(
            copy.saveError
        );
        expect(screen.getByTestId('session-recording-status')).toHaveTextContent(copy.statusOff);
        expect(screen.getByTestId('session-recording-save-error')).not.toHaveTextContent(
            'private server detail'
        );
    });

    it('a read error disables the toggle and offers a retry', async () => {
        fetchApi
            .mockRejectedValueOnce(new Error('down'))
            .mockResolvedValue({ data: { data: row(false) } });
        const user = userEvent.setup();
        renderCard();

        expect(await screen.findByText(copy.readError)).toBeInTheDocument();
        expect(screen.getByTestId('session-recording-toggle')).toBeDisabled();

        await user.click(screen.getByTestId('session-recording-retry'));

        expect(await screen.findByTestId('session-recording-status')).toHaveTextContent(
            copy.statusOff
        );
        expect(screen.getByTestId('session-recording-toggle')).toBeEnabled();
    });

    it('ships the copy in es, en and pt with the same keys', async () => {
        const [en, pt] = await Promise.all([
            import('@repo/i18n/locales/en/admin-pages.json'),
            import('@repo/i18n/locales/pt/admin-pages.json')
        ]);
        const keys = Object.keys(copy).sort();
        expect(Object.keys(en.systemSettings.critical.sessionRecording).sort()).toEqual(keys);
        expect(Object.keys(pt.systemSettings.critical.sessionRecording).sort()).toEqual(keys);
    });

    describe('retention and manual purge', () => {
        const patches = () => fetchApi.mock.calls.filter(([call]) => call.method === 'PATCH');
        const purges = () => fetchApi.mock.calls.filter(([call]) => call.path === PURGE_PATH);

        it('shows the default 30 days when the row carries no period', async () => {
            fetchApi.mockResolvedValue({ data: { data: row(true) } });
            renderCard();

            const select = await screen.findByTestId('session-recording-retention');

            expect(select).toHaveTextContent('30');
        });

        it('shows the stored period', async () => {
            fetchApi.mockResolvedValue({ data: { data: row(true, undefined, 60) } });
            renderCard();

            const select = await screen.findByTestId('session-recording-retention');

            await waitFor(() => expect(select).toHaveTextContent('60'));
        });

        it('picking 14 days sends one PATCH with the period AND the current switch', async () => {
            // Arrange
            fetchApi
                .mockResolvedValueOnce({ data: { data: row(true) } })
                .mockResolvedValue({ data: { data: row(true, undefined, 14) } });
            const user = userEvent.setup();
            renderCard();
            const select = await screen.findByTestId('session-recording-retention');
            await waitFor(() => expect(select).toBeEnabled());

            // Act
            await user.click(select);
            await user.click(await screen.findByRole('option', { name: '14 días' }));

            // Assert
            await waitFor(() => expect(patches()).toHaveLength(1));
            expect(patches()[0]?.[0]).toEqual({
                path: PATH,
                method: 'PATCH',
                body: { value: { enabled: true, retentionDays: 14 } }
            });
        });

        it('turning the switch off keeps the stored period instead of resetting it', async () => {
            fetchApi
                .mockResolvedValueOnce({ data: { data: row(true, undefined, 60) } })
                .mockResolvedValue({ data: { data: row(false, undefined, 60) } });
            renderCard();

            await confirmToggle(copy.disable);

            expect(patches()[0]?.[0].body).toEqual({
                value: { enabled: false, retentionDays: 60 }
            });
        });

        it('cancelling the purge confirmation sends no request', async () => {
            fetchApi.mockResolvedValue({ data: { data: row(false, undefined, 14) } });
            const user = userEvent.setup();
            renderCard();
            const button = await screen.findByTestId('session-recording-purge');
            await waitFor(() => expect(button).toBeEnabled());

            await user.click(button);
            const dialog = screen.getByTestId('session-recording-purge-confirm');
            expect(dialog).toHaveTextContent('14 días');
            await user.click(within(dialog).getByRole('button', { name: copy.cancel }));

            expect(purges()).toHaveLength(0);
        });

        it('confirming the purge sends one POST and shows the deleted counts', async () => {
            // Arrange
            fetchApi.mockImplementation(async ({ path }) =>
                path === PURGE_PATH
                    ? {
                          data: {
                              data: {
                                  replaysDeleted: 12,
                                  heatmapEventsDeleted: 340,
                                  retentionDays: 30
                              }
                          }
                      }
                    : { data: { data: row(true) } }
            );
            const user = userEvent.setup();
            renderCard();
            const button = await screen.findByTestId('session-recording-purge');
            await waitFor(() => expect(button).toBeEnabled());

            // Act
            await user.click(button);
            await user.click(
                within(screen.getByTestId('session-recording-purge-confirm')).getByRole('button', {
                    name: copy.purgeConfirmAction
                })
            );

            // Assert
            expect(await screen.findByTestId('session-recording-purge-result')).toHaveTextContent(
                '12 grabaciones y 340 eventos'
            );
            expect(purges()).toHaveLength(1);
            expect(purges()[0]?.[0]).toEqual({ path: PURGE_PATH, method: 'POST' });
        });

        it('a 503 from the purge says the cleanup is not configured', async () => {
            fetchApi.mockImplementation(async ({ path }) => {
                if (path === PURGE_PATH) throw Object.assign(new Error('503'), { status: 503 });
                return { data: { data: row(true) } };
            });
            const user = userEvent.setup();
            renderCard();
            const button = await screen.findByTestId('session-recording-purge');
            await waitFor(() => expect(button).toBeEnabled());

            await user.click(button);
            await user.click(
                within(screen.getByTestId('session-recording-purge-confirm')).getByRole('button', {
                    name: copy.purgeConfirmAction
                })
            );

            expect(await screen.findByTestId('session-recording-purge-error')).toHaveTextContent(
                copy.purgeNotConfigured
            );
        });
    });
});
