// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderWatchShapesCard } from '../ProviderWatchShapesCard';

type FetchApiInput = { readonly path: string; readonly method?: string; readonly body?: unknown };
type FetchApiResponse = { readonly data: { readonly data?: unknown } };
const fetchApi = vi.hoisted(() => vi.fn<(input: FetchApiInput) => Promise<FetchApiResponse>>());
const permissions = vi.hoisted(() => vi.fn<() => PermissionEnum[]>(() => []));
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-user-permissions', () => ({ useUserPermissions: permissions }));
vi.mock('@/hooks/use-translations', () => ({ useTranslations: () => ({ locale: 'es' }) }));

const copy = es.settings.providerWatchShapes;
const SHAPES = '/api/v1/admin/provider-watch/shapes';
const RUN_ID = '33333333-3333-4333-8333-333333333333';
const OWNER = '22222222-2222-4222-8222-222222222222';

const review = (overrides: Record<string, unknown> = {}) => ({
    measurementId: 'M4',
    account: 'sandbox',
    runId: RUN_ID,
    observedAt: '2026-11-17T12:00:00.000Z',
    observed: { search: { $: 'object', payer_mail: 'string' } },
    accepted: { search: { $: 'object', payer_email: 'string' } },
    acceptedAt: '2026-11-10T12:00:00.000Z',
    acceptedBy: OWNER,
    inSync: false,
    differences: ['search: removed: payer_email (string)', 'search: added: payer_mail (string)'],
    ...overrides
});

function api(items: unknown[]) {
    fetchApi.mockImplementation(async (input) => {
        if (input.path === SHAPES) return { data: { data: { items } } };
        return { data: { data: { acceptedAt: '2026-11-17T13:00:00.000Z' } } };
    });
}

function renderCard() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <ProviderWatchShapesCard />
        </QueryClientProvider>
    );
}

const posts = () => fetchApi.mock.calls.filter(([call]) => call.method === 'POST');

describe('HOS-1512 the owner reviews and accepts provider response shapes', () => {
    beforeEach(() => {
        fetchApi.mockReset();
        permissions.mockReset();
        permissions.mockReturnValue([PermissionEnum.PROVIDER_WATCH_MANAGE]);
    });

    it('lists what changed per measurement, with the differences', async () => {
        api([review()]);
        renderCard();
        const item = await screen.findByTestId('provider-watch-shape-M4');
        expect(item).toHaveTextContent(copy.pending);
        expect(item).toHaveTextContent('search: removed: payer_email (string)');
        expect(item).toHaveTextContent('search: added: payer_mail (string)');
        expect(screen.getByTestId('provider-watch-accept-M4')).toBeInTheDocument();
    });

    it('marks a shape that equals the accepted baseline and offers no accept button for it', async () => {
        api([review({ measurementId: 'M1', inSync: true, differences: [] })]);
        renderCard();
        const item = await screen.findByTestId('provider-watch-shape-M1');
        expect(item).toHaveTextContent(copy.inSync);
        expect(screen.queryByTestId('provider-watch-accept-M1')).toBeNull();
    });

    it('says so when no baseline was accepted yet', async () => {
        api([review({ accepted: null, acceptedAt: null, acceptedBy: null })]);
        renderCard();
        expect(await screen.findByTestId('provider-watch-shape-M4')).toHaveTextContent(
            copy.noBaseline
        );
    });

    it('shows an empty state when there is no complete run yet', async () => {
        api([]);
        renderCard();
        expect(await screen.findByText(copy.empty)).toBeInTheDocument();
    });

    it('accepts only after confirming, sending the run the owner saw', async () => {
        api([review()]);
        renderCard();
        fireEvent.click(await screen.findByTestId('provider-watch-accept-M4'));
        expect(posts()).toHaveLength(0);
        const dialog = await screen.findByTestId('provider-watch-accept-confirm');
        expect(dialog).toHaveTextContent('M4');
        fireEvent.click(within(dialog).getByRole('button', { name: copy.accept }));
        await waitFor(() => expect(posts()).toHaveLength(1));
        expect(posts()[0]?.[0]).toMatchObject({
            path: `${SHAPES}/M4/accept`,
            method: 'POST',
            body: { account: 'sandbox', runId: RUN_ID }
        });
    });

    it('sends nothing when the confirmation is canceled', async () => {
        api([review()]);
        renderCard();
        fireEvent.click(await screen.findByTestId('provider-watch-accept-M4'));
        fireEvent.click(await screen.findByRole('button', { name: copy.cancel }));
        expect(posts()).toHaveLength(0);
    });

    it('does not read or offer anything without the manage permission', async () => {
        permissions.mockReturnValue([PermissionEnum.BILLING_SETTINGS_WRITE]);
        api([review()]);
        renderCard();
        expect(await screen.findByText(copy.noWritePermission)).toBeInTheDocument();
        expect(fetchApi).not.toHaveBeenCalled();
        expect(screen.queryByTestId('provider-watch-shape-M4')).toBeNull();
    });

    it('shows a translated error when the shapes cannot be read', async () => {
        fetchApi.mockRejectedValue(new Error('private server detail'));
        renderCard();
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(copy.loadError);
        expect(alert).not.toHaveTextContent('private server detail');
    });

    it('shows a translated error, not the server detail, when accepting fails', async () => {
        fetchApi.mockImplementation(async (input) => {
            if (input.path === SHAPES) return { data: { data: { items: [review()] } } };
            throw new Error('private server detail');
        });
        renderCard();
        fireEvent.click(await screen.findByTestId('provider-watch-accept-M4'));
        fireEvent.click(
            within(await screen.findByTestId('provider-watch-accept-confirm')).getByRole('button', {
                name: copy.accept
            })
        );
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(copy.saveError);
        expect(alert).not.toHaveTextContent('private server detail');
    });
});
