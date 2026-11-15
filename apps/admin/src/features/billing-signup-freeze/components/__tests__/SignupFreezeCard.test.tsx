// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignupFreezeCard } from '../SignupFreezeCard';

type FetchApiInput = { readonly path: string; readonly method?: string; readonly body?: unknown };
type FetchApiResponse = { readonly data: { readonly data?: unknown } };
const fetchApi = vi.hoisted(() => vi.fn<(input: FetchApiInput) => Promise<FetchApiResponse>>());
const permissions = vi.hoisted(() => vi.fn<() => PermissionEnum[]>(() => []));
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-user-permissions', () => ({ useUserPermissions: permissions }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es'
    })
}));

function renderCard() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const result = render(
        <QueryClientProvider client={queryClient}>
            <SignupFreezeCard />
        </QueryClientProvider>
    );
    return { ...result, queryClient };
}

describe('HOS-1749 the billing settings card pauses and resumes new paid signups', () => {
    beforeEach(() => {
        fetchApi.mockReset();
        permissions.mockReset();
        permissions.mockReturnValue([]);
    });

    it('shows signups open when the setting row is absent', async () => {
        fetchApi.mockResolvedValue({ data: { data: null } });
        renderCard();

        expect(await screen.findByTestId('signup-freeze-status')).toHaveTextContent(
            es.settings.signupFreeze.statusOff
        );
        expect(screen.getByTestId('signup-freeze-toggle')).toHaveTextContent(
            es.settings.signupFreeze.enable
        );
    });

    it('shows the paused status and warning when frozen', async () => {
        fetchApi.mockResolvedValue({
            data: {
                data: {
                    key: 'billing.paidSignupsFreeze',
                    value: { frozen: true },
                    updatedAt: '2026-11-12T00:00:00.000Z',
                    updatedBy: 'admin'
                }
            }
        });
        renderCard();

        await waitFor(() =>
            expect(screen.getByTestId('signup-freeze-status')).toHaveTextContent(
                es.settings.signupFreeze.statusOn
            )
        );
        expect(screen.getByText(es.settings.signupFreeze.activeWarning)).toBeInTheDocument();
    });

    it('confirms enabling and sends one PATCH with the freeze value', async () => {
        permissions.mockReturnValue([PermissionEnum.BILLING_SETTINGS_WRITE]);
        fetchApi.mockResolvedValueOnce({ data: { data: null } }).mockResolvedValueOnce({
            data: { data: { key: 'billing.paidSignupsFreeze', value: { frozen: true } } }
        });
        const user = userEvent.setup();
        renderCard();

        await user.click(await screen.findByTestId('signup-freeze-toggle'));
        await user.click(
            within(screen.getByTestId('signup-freeze-confirm')).getByRole('button', {
                name: es.settings.signupFreeze.enable
            })
        );

        const patchCalls = fetchApi.mock.calls.filter(([call]) => call.method === 'PATCH');
        expect(patchCalls).toHaveLength(1);
        const patchCall = patchCalls[0]?.[0];
        expect(patchCall?.path).toBe('/api/v1/admin/platform-settings/billing.paidSignupsFreeze');
        expect(patchCall?.method).toBe('PATCH');
        expect(patchCall?.body).toEqual({ value: { frozen: true } });
    });

    it('does not send a PATCH when the confirmation is canceled', async () => {
        permissions.mockReturnValue([PermissionEnum.BILLING_SETTINGS_WRITE]);
        const patch = vi
            .fn<(input: FetchApiInput) => Promise<FetchApiResponse>>()
            .mockResolvedValue({
                data: { data: null }
            });
        fetchApi.mockImplementation((input) =>
            input.method === 'PATCH' ? patch(input) : Promise.resolve({ data: { data: null } })
        );
        const user = userEvent.setup();
        renderCard();

        await user.click(await screen.findByTestId('signup-freeze-toggle'));
        await user.click(screen.getByRole('button', { name: es.settings.signupFreeze.cancel }));

        expect(patch).toHaveBeenCalledTimes(0);
    });

    it('disables the toggle and explains missing write permission', async () => {
        fetchApi.mockResolvedValue({ data: { data: null } });
        const { queryClient } = renderCard();
        const toggle = await screen.findByTestId('signup-freeze-toggle');

        await waitFor(() =>
            expect(
                queryClient.getQueryState(['platform-settings', 'billing.paidSignupsFreeze'])
                    ?.status
            ).toBe('success')
        );
        expect(toggle).toBeDisabled();
        expect(screen.getByText(es.settings.signupFreeze.noWritePermission)).toBeInTheDocument();
    });

    it('shows a translated error when the PATCH fails', async () => {
        permissions.mockReturnValue([PermissionEnum.BILLING_SETTINGS_WRITE]);
        fetchApi
            .mockResolvedValueOnce({ data: { data: null } })
            .mockRejectedValueOnce(new Error('private server detail'));
        const user = userEvent.setup();
        renderCard();

        await user.click(await screen.findByTestId('signup-freeze-toggle'));
        await user.click(
            within(screen.getByTestId('signup-freeze-confirm')).getByRole('button', {
                name: es.settings.signupFreeze.enable
            })
        );

        expect(await screen.findByRole('alert')).toHaveTextContent(
            es.settings.signupFreeze.saveError
        );
        expect(screen.getByRole('alert')).not.toHaveTextContent('private server detail');
    });
});
