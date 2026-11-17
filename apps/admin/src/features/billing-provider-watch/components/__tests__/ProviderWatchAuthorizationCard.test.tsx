// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderWatchAuthorizationCard } from '../ProviderWatchAuthorizationCard';

type FetchApiInput = { readonly path: string; readonly method?: string; readonly body?: unknown };
type FetchApiResponse = { readonly data: { readonly data?: unknown } };
const fetchApi = vi.hoisted(() => vi.fn<(input: FetchApiInput) => Promise<FetchApiResponse>>());
const permissions = vi.hoisted(() => vi.fn<() => PermissionEnum[]>(() => []));
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-user-permissions', () => ({ useUserPermissions: permissions }));
vi.mock('@/hooks/use-translations', () => ({ useTranslations: () => ({ locale: 'es' }) }));

const copy = es.settings.providerWatchAuthorization;
const PATH = '/api/v1/admin/platform-settings/billing.providerWatchAuthorization';

function monthNow(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit'
    }).formatToParts(new Date());
    return `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}`;
}

function row(value: { month: string; maxChargeMinor: number }) {
    return {
        key: 'billing.providerWatchAuthorization',
        value,
        updatedAt: '2026-11-01T00:00:00.000Z',
        updatedBy: 'owner'
    };
}

function renderCard() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <ProviderWatchAuthorizationCard />
        </QueryClientProvider>
    );
}

const patches = () => fetchApi.mock.calls.filter(([call]) => call.method === 'PATCH');

describe('HOS-1512 the billing settings card authorizes the provider watch battery', () => {
    beforeEach(() => {
        fetchApi.mockReset();
        permissions.mockReset();
        permissions.mockReturnValue([]);
    });

    it('shows "not authorized" when the setting row is absent', async () => {
        fetchApi.mockResolvedValue({ data: { data: null } });
        renderCard();
        expect(await screen.findByTestId('provider-watch-authorization-status')).toHaveTextContent(
            copy.statusNone
        );
    });

    it('shows the month and the exact maximum charge of the stored authorization', async () => {
        fetchApi.mockResolvedValue({
            data: { data: row({ month: monthNow(), maxChargeMinor: 150000 }) }
        });
        renderCard();
        await waitFor(() =>
            expect(screen.getByTestId('provider-watch-authorization-status')).toHaveTextContent(
                copy.statusActive.replace('{month}', monthNow())
            )
        );
        const current = screen.getByTestId('provider-watch-authorization-current');
        expect(current).toHaveTextContent('150000 centavos');
        expect(screen.getByTestId<HTMLInputElement>('provider-watch-max-charge').value).toBe(
            '150000'
        );
    });

    it('shows an authorization of another month as expired', async () => {
        fetchApi.mockResolvedValue({
            data: { data: row({ month: '2020-01', maxChargeMinor: 100 }) }
        });
        renderCard();
        await waitFor(() =>
            expect(screen.getByTestId('provider-watch-authorization-status')).toHaveTextContent(
                copy.statusStale.replace('{month}', '2020-01')
            )
        );
    });

    it('confirms and sends one PATCH with the month and the integer maximum charge', async () => {
        permissions.mockReturnValue([PermissionEnum.MAINTENANCE_MODE_WRITE]);
        fetchApi.mockResolvedValueOnce({ data: { data: null } }).mockResolvedValueOnce({
            data: { data: row({ month: '2026-11', maxChargeMinor: 150000 }) }
        });
        const user = userEvent.setup();
        renderCard();

        const month = await screen.findByTestId('provider-watch-month');
        await user.clear(month);
        await user.type(month, '2026-11');
        await user.type(screen.getByTestId('provider-watch-max-charge'), '150000');
        fireEvent.click(screen.getByTestId('provider-watch-save'));
        expect(patches()).toHaveLength(0);
        await user.click(
            within(await screen.findByTestId('provider-watch-confirm')).getByRole('button', {
                name: copy.save
            })
        );

        await waitFor(() => expect(patches()).toHaveLength(1));
        expect(patches()[0]?.[0]).toMatchObject({
            path: PATH,
            method: 'PATCH',
            body: { value: { month: '2026-11', maxChargeMinor: 150000 } }
        });
    });

    it.each([
        ['a decimal amount', '2026-11', '1500.5'],
        ['an exponent amount', '2026-11', '1e3'],
        ['an empty amount', '2026-11', ''],
        ['a bad month', '2026-13', '100']
    ])('refuses %s without opening the confirmation or sending anything', async (_name, month, amount) => {
        permissions.mockReturnValue([PermissionEnum.MAINTENANCE_MODE_WRITE]);
        fetchApi.mockResolvedValue({ data: { data: null } });
        const user = userEvent.setup();
        renderCard();

        const monthInput = await screen.findByTestId('provider-watch-month');
        await user.clear(monthInput);
        await user.type(monthInput, month);
        if (amount) await user.type(screen.getByTestId('provider-watch-max-charge'), amount);
        fireEvent.click(screen.getByTestId('provider-watch-save'));

        expect(await screen.findByRole('alert')).toHaveTextContent(copy.invalidValue);
        expect(screen.queryByTestId('provider-watch-confirm')).toBeNull();
        expect(patches()).toHaveLength(0);
    });

    it('does not send a PATCH when the confirmation is canceled', async () => {
        permissions.mockReturnValue([PermissionEnum.MAINTENANCE_MODE_WRITE]);
        fetchApi.mockResolvedValue({ data: { data: null } });
        const user = userEvent.setup();
        renderCard();
        await user.type(await screen.findByTestId('provider-watch-max-charge'), '100');
        fireEvent.click(screen.getByTestId('provider-watch-save'));
        await user.click(await screen.findByRole('button', { name: copy.cancel }));
        expect(patches()).toHaveLength(0);
    });

    it('disables the form and explains it when the actor is not a SUPER_ADMIN', async () => {
        permissions.mockReturnValue([PermissionEnum.BILLING_SETTINGS_WRITE]);
        fetchApi.mockResolvedValue({ data: { data: null } });
        renderCard();
        expect(await screen.findByTestId('provider-watch-save')).toBeDisabled();
        expect(screen.getByTestId('provider-watch-max-charge')).toBeDisabled();
        expect(screen.getByText(copy.noWritePermission)).toBeInTheDocument();
    });

    it('shows a translated error, not the server detail, when the PATCH fails', async () => {
        permissions.mockReturnValue([PermissionEnum.MAINTENANCE_MODE_WRITE]);
        fetchApi
            .mockResolvedValueOnce({ data: { data: null } })
            .mockRejectedValueOnce(new Error('private server detail'));
        const user = userEvent.setup();
        renderCard();
        await user.type(await screen.findByTestId('provider-watch-max-charge'), '100');
        fireEvent.click(screen.getByTestId('provider-watch-save'));
        await user.click(
            within(await screen.findByTestId('provider-watch-confirm')).getByRole('button', {
                name: copy.save
            })
        );
        expect(await screen.findByRole('alert')).toHaveTextContent(copy.saveError);
        expect(screen.getByRole('alert')).not.toHaveTextContent('private server detail');
    });
});
