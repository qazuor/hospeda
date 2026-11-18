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
const SETTING = '/api/v1/admin/platform-settings/billing.providerWatchAuthorization';
const ACCOUNT = '/api/v1/admin/provider-watch/account';
const AUTHORIZE = '/api/v1/admin/provider-watch/authorization';
const PREVIEW = '/api/v1/admin/provider-watch/authorization-preview';
const PREVIEW_OK = {
    expectedMaxChargeMinor: 150000,
    measurements: [
        { id: 'RP1', maxChargeMinor: 100000 },
        { id: 'RP2', maxChargeMinor: 50000 }
    ]
};
const RUN_ID = '33333333-3333-4333-8333-333333333333';
const PROVIDER = { id: '100000001', nickname: 'HOSPEDA', isTestAccount: false };

function monthNow(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit'
    }).formatToParts(new Date());
    return `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}`;
}

function row(value: Record<string, unknown>) {
    return {
        key: 'billing.providerWatchAuthorization',
        value,
        updatedAt: '2026-11-01T00:00:00.000Z',
        updatedBy: 'owner'
    };
}

/** Routes fetchApi by path, like the API would. */
function api(
    args: {
        readonly setting?: unknown;
        readonly account?: unknown | Error;
        readonly preview?: unknown | Error;
    } = {}
): void {
    fetchApi.mockImplementation(async (input) => {
        if (input.path === SETTING) return { data: { data: args.setting ?? null } };
        if (input.path === ACCOUNT) {
            if (args.account instanceof Error) throw args.account;
            return { data: { data: args.account === undefined ? PROVIDER : args.account } };
        }
        if (input.path === PREVIEW) {
            if (args.preview instanceof Error) throw args.preview;
            return { data: { data: args.preview === undefined ? PREVIEW_OK : args.preview } };
        }
        if (input.path === AUTHORIZE) return { data: { data: { ok: true } } };
        throw new Error(`unexpected ${input.path}`);
    });
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

const posts = () => fetchApi.mock.calls.filter(([call]) => call.method === 'POST');
const MANAGER = [PermissionEnum.BILLING_PROVIDER_WATCH_MANAGE];

describe('HOS-1512 the billing settings card authorizes one provider watch run', () => {
    beforeEach(() => {
        fetchApi.mockReset();
        permissions.mockReset();
        permissions.mockReturnValue([]);
    });

    it('shows "not authorized" when the setting row is absent', async () => {
        api();
        renderCard();
        expect(await screen.findByTestId('provider-watch-authorization-status')).toHaveTextContent(
            copy.statusNone
        );
    });

    it('shows an unconsumed authorization of the month with its amount and confirmed account', async () => {
        api({
            setting: row({
                month: monthNow(),
                maxChargeMinor: 150000,
                accountId: '100000001',
                accountNickname: 'HOSPEDA'
            })
        });
        renderCard();
        await waitFor(() =>
            expect(screen.getByTestId('provider-watch-authorization-status')).toHaveTextContent(
                copy.statusActive.replace('{month}', monthNow())
            )
        );
        const current = screen.getByTestId('provider-watch-authorization-current');
        expect(current).toHaveTextContent('150000 centavos');
        expect(current).toHaveTextContent('HOSPEDA, id 100000001');
        expect(screen.queryByTestId('provider-watch-authorization-consumed')).toBeNull();
    });

    it('shows a CONSUMED authorization with the run that consumed it', async () => {
        api({
            setting: row({
                month: monthNow(),
                maxChargeMinor: 150000,
                accountId: '100000001',
                consumedAt: '2026-11-02T10:00:00.000Z',
                consumedByRunId: RUN_ID
            })
        });
        renderCard();
        await waitFor(() =>
            expect(screen.getByTestId('provider-watch-authorization-status')).toHaveTextContent(
                copy.statusConsumed.replace('{runId}', RUN_ID)
            )
        );
        expect(screen.getByTestId('provider-watch-authorization-consumed')).toBeInTheDocument();
    });

    it('shows an authorization of another month as expired', async () => {
        api({ setting: row({ month: '2020-01', maxChargeMinor: 100, accountId: '1' }) });
        renderCard();
        await waitFor(() =>
            expect(screen.getByTestId('provider-watch-authorization-status')).toHaveTextContent(
                copy.statusStale.replace('{month}', '2020-01')
            )
        );
    });

    it('shows the provider account for the owner to confirm, and never asks to type it', async () => {
        permissions.mockReturnValue(MANAGER);
        api();
        renderCard();
        expect(await screen.findByTestId('provider-watch-account')).toHaveTextContent(
            'HOSPEDA, id 100000001'
        );
        expect(screen.queryByLabelText(/id de la cuenta|account id/i)).toBeNull();
    });

    it('does not even ask the API for the account without the permission', async () => {
        permissions.mockReturnValue([PermissionEnum.BILLING_SETTINGS_WRITE]);
        api();
        renderCard();
        expect(await screen.findByTestId('provider-watch-save')).toBeDisabled();
        expect(fetchApi.mock.calls.some(([call]) => call.path === ACCOUNT)).toBe(false);
        expect(screen.getByText(copy.noWritePermission)).toBeInTheDocument();
    });

    it('confirms with the account and sends one POST carrying the account id the owner saw', async () => {
        permissions.mockReturnValue(MANAGER);
        api();
        const user = userEvent.setup();
        renderCard();

        await screen.findByTestId('provider-watch-account');
        const month = await screen.findByTestId('provider-watch-month');
        await user.clear(month);
        await user.type(month, '2026-11');
        await waitFor(() => expect(screen.getByTestId('provider-watch-save')).not.toBeDisabled());
        fireEvent.click(screen.getByTestId('provider-watch-save'));
        expect(posts()).toHaveLength(0);
        const dialog = await screen.findByTestId('provider-watch-confirm');
        expect(dialog).toHaveTextContent('HOSPEDA, id 100000001');
        expect(dialog).toHaveTextContent('2026-11');
        fireEvent.click(within(dialog).getByRole('button', { name: copy.save }));

        await waitFor(() => expect(posts()).toHaveLength(1));
        expect(posts()[0]?.[0]).toMatchObject({
            path: AUTHORIZE,
            method: 'POST',
            body: { month: '2026-11', maxChargeMinor: 150000, confirmedAccountId: '100000001' }
        });
    });

    it('cannot authorize when the provider account cannot be read', async () => {
        permissions.mockReturnValue(MANAGER);
        api({ account: new Error('boom') });
        renderCard();
        expect(await screen.findByTestId('provider-watch-account-error')).toHaveTextContent(
            copy.accountError
        );
        expect(screen.getByTestId('provider-watch-save')).toBeDisabled();
        expect(posts()).toHaveLength(0);
    });

    it('refuses a bad month without opening the confirmation or sending anything', async () => {
        permissions.mockReturnValue(MANAGER);
        api();
        const user = userEvent.setup();
        renderCard();
        await screen.findByTestId('provider-watch-account');
        const monthInput = await screen.findByTestId('provider-watch-month');
        await user.clear(monthInput);
        await user.type(monthInput, '2026-13');
        await waitFor(() => expect(screen.getByTestId('provider-watch-save')).not.toBeDisabled());
        fireEvent.click(screen.getByTestId('provider-watch-save'));
        expect(await screen.findByRole('alert')).toHaveTextContent(copy.invalidValue);
        expect(screen.queryByTestId('provider-watch-confirm')).toBeNull();
        expect(posts()).toHaveLength(0);
    });

    it('shows the exact amount the API computed, with the measurements behind it', async () => {
        permissions.mockReturnValue(MANAGER);
        api();
        renderCard();
        const expected = await screen.findByTestId('provider-watch-expected');
        expect(expected).toHaveTextContent('150000 centavos');
        expect(expected).toHaveTextContent('2 mediciones');
        expect(expected).toHaveTextContent('RP1, RP2');
    });

    it('never lets the owner type the amount: the field is read-only and holds the computed sum', async () => {
        permissions.mockReturnValue(MANAGER);
        api();
        renderCard();
        await screen.findByTestId('provider-watch-expected');
        await waitFor(() =>
            expect(
                (screen.getByTestId('provider-watch-max-charge') as HTMLInputElement).value
            ).toBe('150000')
        );
        expect(screen.getByTestId('provider-watch-max-charge')).toHaveAttribute('readonly');
    });

    it('sends the computed amount, whatever the field held', async () => {
        permissions.mockReturnValue(MANAGER);
        api({
            preview: {
                expectedMaxChargeMinor: 42000,
                measurements: [{ id: 'RP9', maxChargeMinor: 42000 }]
            }
        });
        renderCard();
        await screen.findByTestId('provider-watch-expected');
        await waitFor(() => expect(screen.getByTestId('provider-watch-save')).not.toBeDisabled());
        fireEvent.click(screen.getByTestId('provider-watch-save'));
        fireEvent.click(
            within(await screen.findByTestId('provider-watch-confirm')).getByRole('button', {
                name: copy.save
            })
        );
        await waitFor(() => expect(posts()).toHaveLength(1));
        expect(posts()[0]?.[0]).toMatchObject({ body: { maxChargeMinor: 42000 } });
    });

    it('lets the owner authorize a read-only battery: sum 0, says the run moves no money, sends 0', async () => {
        permissions.mockReturnValue(MANAGER);
        api({ preview: { expectedMaxChargeMinor: 0, measurements: [] } });
        renderCard();
        expect(await screen.findByTestId('provider-watch-no-money')).toHaveTextContent(
            copy.noMoneyCatalog
        );
        await waitFor(() => expect(screen.getByTestId('provider-watch-save')).not.toBeDisabled());
        fireEvent.click(screen.getByTestId('provider-watch-save'));
        const dialog = await screen.findByTestId('provider-watch-confirm');
        expect(dialog).toHaveTextContent(/solo lectura|read-only/i);
        fireEvent.click(within(dialog).getByRole('button', { name: copy.save }));
        await waitFor(() => expect(posts()).toHaveLength(1));
        expect(posts()[0]?.[0]).toMatchObject({ body: { maxChargeMinor: 0 } });
    });

    it('cannot authorize when the amount cannot be computed', async () => {
        permissions.mockReturnValue(MANAGER);
        api({ preview: new Error('boom') });
        renderCard();
        expect(await screen.findByTestId('provider-watch-preview-error')).toHaveTextContent(
            copy.previewError
        );
        expect(screen.getByTestId('provider-watch-save')).toBeDisabled();
    });

    it('does not send anything when the confirmation is canceled', async () => {
        permissions.mockReturnValue(MANAGER);
        api();
        renderCard();
        await screen.findByTestId('provider-watch-account');
        await waitFor(() => expect(screen.getByTestId('provider-watch-save')).not.toBeDisabled());
        fireEvent.click(screen.getByTestId('provider-watch-save'));
        fireEvent.click(await screen.findByRole('button', { name: copy.cancel }));
        expect(posts()).toHaveLength(0);
    });

    it('shows a translated error, not the server detail, when the POST fails', async () => {
        permissions.mockReturnValue(MANAGER);
        fetchApi.mockImplementation(async (input) => {
            if (input.path === SETTING) return { data: { data: null } };
            if (input.path === ACCOUNT) return { data: { data: PROVIDER } };
            if (input.path === PREVIEW) return { data: { data: PREVIEW_OK } };
            throw new Error('private server detail');
        });
        renderCard();
        await screen.findByTestId('provider-watch-account');
        await waitFor(() => expect(screen.getByTestId('provider-watch-save')).not.toBeDisabled());
        fireEvent.click(screen.getByTestId('provider-watch-save'));
        fireEvent.click(
            within(await screen.findByTestId('provider-watch-confirm')).getByRole('button', {
                name: copy.save
            })
        );
        expect(await screen.findByRole('alert')).toHaveTextContent(copy.saveError);
        expect(screen.getByRole('alert')).not.toHaveTextContent('private server detail');
    });
});
