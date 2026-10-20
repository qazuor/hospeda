// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { RevocationOpenRefunds } from '../RevocationOpenRefunds';

const state = vi.hoisted(() => ({ permissions: [] as PermissionEnum[], fetchApi: vi.fn() }));
type TranslationTree = string | { readonly [key: string]: TranslationTree };
const readTranslation = (root: TranslationTree, path: string): TranslationTree | undefined =>
    path
        .split('.')
        .reduce<TranslationTree | undefined>(
            (node, part) =>
                node === undefined || typeof node === 'string' ? undefined : node[part],
            root
        );

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => state.permissions,
    useHasPermission: (permission: PermissionEnum) => state.permissions.includes(permission),
    useHasAllPermissions: (required: PermissionEnum[]) =>
        required.every((permission) => state.permissions.includes(permission))
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es',
        t: (key: string, values?: Record<string, string>) => {
            const value = readTranslation(es, key.replace(/^admin-billing\./, ''));
            return typeof value === 'string'
                ? value.replace(
                      /\{\{?(\w+)\}?\}/g,
                      (_match, name: string) => values?.[name] ?? `{${name}}`
                  )
                : key;
        }
    })
}));
vi.mock('@/lib/api/client', () => ({ fetchApi: state.fetchApi }));

const SUBSCRIPTION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAYMENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REFUND_IDS = ['cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'];
const items = REFUND_IDS.map((refundId) => ({
    refundId,
    refundAmount: 1800000,
    reason: 'REVOCATION',
    requestedAt: '2026-10-05T12:00:00.000Z',
    payment: { source: 'PAYMENT' as const, id: PAYMENT_ID }
}));
const readResult = (listedItems: typeof items) => ({
    data: { data: { items: listedItems } },
    status: 200
});
const settlementResult = {
    data: {
        data: {
            refundId: REFUND_IDS[1],
            status: 'EXECUTED',
            closedRequestedRefund: true,
            paymentOutcome: 'P3',
            coverageReleased: true
        }
    },
    status: 200
};
const getPath = `/api/v1/admin/billing-subscription/${SUBSCRIPTION_ID}/open-refunds`;
const renderList = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return render(
        <QueryClientProvider client={client}>
            <RevocationOpenRefunds subscriptionId={SUBSCRIPTION_ID} />
        </QueryClientProvider>
    );
};
const copy = (path: string): string => {
    const value = readTranslation(es.subscriptionRevocation.openRefunds, path);
    return typeof value === 'string' ? value : path;
};
const closedSuccess = (refundId: string) =>
    (readTranslation(es.subscriptionRevocation.settlement.success, 'closed') as string)
        .replaceAll('{{refundId}}', refundId)
        .replaceAll('{{status}}', 'EXECUTED');
const requiredPermissions = [
    PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
    PermissionEnum.BILLING_SETTLE_EXTERNAL
];

beforeEach(() => {
    state.permissions = [...requiredPermissions];
    state.fetchApi.mockReset();
});

describe('TEST:1711:11 AC:1711:11 RevocationOpenRefunds', () => {
    it('TEST:1711:11 AC:1711:11 loads each request and retains the second request success without refetching the list', async () => {
        let listReads = 0;
        state.fetchApi.mockImplementation((input: { path: string; method?: string }) => {
            if (input.method === 'POST') return Promise.resolve(settlementResult);
            listReads += 1;
            return Promise.resolve(readResult(listReads === 1 ? items : []));
        });
        renderList();
        expect(
            await screen.findByTestId('subscription-revocation-open-refunds')
        ).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.getAllByTestId('subscription-revocation-open-refund')).toHaveLength(2)
        );
        expect(state.fetchApi.mock.calls.filter(([input]) => input.method !== 'POST')).toHaveLength(
            1
        );

        for (const [index, refundId] of REFUND_IDS.entries()) {
            const row = screen.getAllByTestId('subscription-revocation-open-refund')[index];
            expect(row).toHaveAttribute('data-refund-id', refundId);
            const settlement = within(row as HTMLElement).getByTestId(
                'subscription-revocation-settlement'
            );
            expect(within(settlement).getByLabelText('Monto en pesos')).toHaveValue(18000);
        }

        const secondRow = screen.getAllByTestId(
            'subscription-revocation-open-refund'
        )[1] as HTMLElement;
        const second = within(secondRow).getByTestId('subscription-revocation-settlement');
        fireEvent.change(within(second).getByLabelText('Comprobante o referencia'), {
            target: { value: 'provider-ref-2' }
        });
        fireEvent.click(within(second).getByRole('button', { name: 'Revisar asiento' }));
        fireEvent.click(within(second).getByRole('button', { name: 'Asentar ahora' }));
        await waitFor(() =>
            expect(within(secondRow).getByRole('status')).toHaveTextContent(
                closedSuccess(REFUND_IDS[1])
            )
        );
        expect(state.fetchApi.mock.calls).toEqual([
            [{ path: getPath }],
            [
                {
                    path: '/api/v1/admin/billing-refunds/external',
                    method: 'POST',
                    body: {
                        paymentId: PAYMENT_ID,
                        amount: 1800000,
                        channel: 'PROVIDER_PANEL',
                        reference: 'provider-ref-2',
                        reason: 'OUT_OF_FLOW_REFUND',
                        refundId: REFUND_IDS[1]
                    }
                }
            ]
        ]);
        await waitFor(() => expect(within(secondRow).getByRole('status')).toBeInTheDocument());
        expect(state.fetchApi.mock.calls.filter(([input]) => input.method !== 'POST')).toHaveLength(
            1
        );
    });

    it('TEST:1711:11 AC:1711:11 shows an empty list', async () => {
        state.fetchApi.mockResolvedValue(readResult([]));
        renderList();
        expect(
            await screen.findByTestId('subscription-revocation-open-refunds-empty')
        ).toHaveTextContent(copy('empty'));
    });

    it('TEST:1711:11 AC:1711:11 shows a failed read without retrying', async () => {
        state.fetchApi.mockRejectedValue(new ApiError('failed', { status: 500, body: {} }));
        renderList();
        expect(await screen.findByRole('alert')).toHaveTextContent(copy('loadError'));
        expect(state.fetchApi).toHaveBeenCalledTimes(1);
    });

    it.each([
        [PermissionEnum.BILLING_SETTLE_EXTERNAL, PermissionEnum.BILLING_CANCEL_SUBSCRIPTION],
        [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]
    ])('TEST:1711:11 AC:1711:11 does not read when both required permissions are not present', async (...permissions) => {
        state.permissions = permissions;
        renderList();
        expect(
            screen.getByTestId('subscription-revocation-open-refunds-forbidden')
        ).toHaveTextContent(copy('noPermission'));
        expect(state.fetchApi).not.toHaveBeenCalled();
    });
});
