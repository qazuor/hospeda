// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-pages.json';
import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

function row(enabled: boolean, updatedAt = '2026-11-12T10:00:00.000Z') {
    return {
        key: 'analytics.sessionRecording',
        value: { enabled },
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
            body: { value: { enabled: true } }
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
});
