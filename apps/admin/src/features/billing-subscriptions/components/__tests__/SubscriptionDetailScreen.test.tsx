// @vitest-environment jsdom

import { formatCurrency } from '@repo/i18n';
import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { SubscriptionDetailScreen } from '../SubscriptionDetailScreen';

vi.mock('@tanstack/react-router', () => ({
    Link: ({
        to,
        params,
        children,
        ...rest
    }: {
        to: string;
        params?: Record<string, string>;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => {
        let href = to;
        for (const [name, value] of Object.entries(params ?? {})) {
            href = href.replace(`$${name}`, value);
        }
        return React.createElement('a', { href, ...(rest as Record<string, unknown>) }, children);
    }
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es',
        t: (key: string, params?: Record<string, unknown>) => {
            let value: unknown = es;
            for (const part of key.replace('admin-billing.', '').split('.')) {
                value =
                    typeof value === 'object' && value !== null
                        ? (value as Record<string, unknown>)[part]
                        : undefined;
            }
            return typeof value === 'string'
                ? Object.entries(params ?? {}).reduce(
                      (text, [name, item]) => text.replaceAll(`{${name}}`, String(item)),
                      value
                  )
                : key;
        }
    })
}));

const permissions = vi.hoisted(() => ({ current: [] as PermissionEnum[] }));
vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => permissions.current
}));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));

const detailHook = vi.hoisted(() => ({
    result: { current: {} as Record<string, unknown> }
}));
vi.mock('../../hooks/useAdminSubscriptionDetail', () => ({
    useAdminSubscriptionDetail: () => detailHook.result.current
}));

const ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const baseDetail = {
    id: ID,
    status: 'ACTIVE',
    class: 'PRINCIPAL',
    vertical: 'accommodation',
    owner: {
        id: OWNER_ID,
        email: 'owner@example.test',
        displayName: 'Owner Name',
        deleted: false
    },
    plan: {
        planId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        planName: 'Plan Base',
        planVersionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    },
    cycle: 'monthly',
    paymentMethod: 'CARD',
    nextChargeAt: '2026-12-07T03:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    serviceEndsAt: '2026-12-31T00:00:00.000Z',
    planVersion: {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        current: true,
        sellable: true,
        createdAt: '2026-01-01T00:00:00.000Z'
    },
    price: { amountMinor: 125000, currency: 'ARS', cycle: 'monthly' },
    succeedsId: null,
    succeededById: null,
    pause: {
        reason: 'CUSTOMER_REQUEST',
        startsAt: '2026-02-01T00:00:00.000Z',
        expectedEndAt: '2026-02-15T00:00:00.000Z',
        requestedMonths: 1
    },
    courtesy: {
        courtesyGrantId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        months: 2,
        startsAt: '2026-03-01T00:00:00.000Z',
        endsAt: '2026-05-01T00:00:00.000Z',
        remainingMonths: 1
    }
};

const ACTION_PERMISSIONS = [
    PermissionEnum.BILLING_CANCEL_SUBSCRIPTION,
    PermissionEnum.BILLING_PAUSE_SUBSCRIPTION,
    PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN,
    PermissionEnum.BILLING_GRANT_COMPLIMENTARY
];

function renderScreen() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <SubscriptionDetailScreen subscriptionId={ID} />
        </QueryClientProvider>
    );
}

function actionHrefs(): (string | null)[] {
    const section = screen.getByTestId('subscription-action-links');
    return within(section)
        .queryAllByRole('link')
        .map((link) => link.getAttribute('href'));
}

describe('HOS-2081 CA-2 desde el detalle llega a cada acción para la que tiene permiso; las que no puede ejecutar no se muestran', () => {
    beforeEach(() => {
        detailHook.result.current = {
            isLoading: false,
            isError: false,
            data: baseDetail,
            refetch: vi.fn()
        };
    });

    it('shows the five action links when the user holds every action permission', () => {
        permissions.current = [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT, ...ACTION_PERMISSIONS];
        renderScreen();
        expect(actionHrefs()).toEqual([
            `/billing/subscriptions/${ID}/cancellation`,
            `/billing/subscriptions/${ID}/revocation`,
            `/billing/subscriptions/${ID}/pause`,
            `/billing/subscriptions/${ID}/plan-change`,
            `/billing/subscriptions/${ID}/courtesy`
        ]);
    });

    it('shows only the pause link with the pause permission', () => {
        permissions.current = [
            PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
            PermissionEnum.BILLING_PAUSE_SUBSCRIPTION
        ];
        renderScreen();
        expect(actionHrefs()).toEqual([`/billing/subscriptions/${ID}/pause`]);
    });

    it('shows cancellation and revocation together with the cancel permission', () => {
        permissions.current = [
            PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
            PermissionEnum.BILLING_CANCEL_SUBSCRIPTION
        ];
        renderScreen();
        expect(actionHrefs()).toEqual([
            `/billing/subscriptions/${ID}/cancellation`,
            `/billing/subscriptions/${ID}/revocation`
        ]);
    });

    it('shows only the plan-change link with the plan-change permission', () => {
        permissions.current = [
            PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
            PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN
        ];
        renderScreen();
        expect(actionHrefs()).toEqual([`/billing/subscriptions/${ID}/plan-change`]);
        expect(screen.queryByTestId('subscription-action-cancellation')).toBeNull();
        expect(screen.queryByTestId('subscription-action-revocation')).toBeNull();
        expect(screen.queryByTestId('subscription-action-pause')).toBeNull();
        expect(screen.queryByTestId('subscription-action-courtesy')).toBeNull();
    });

    it('shows only the courtesy link with the courtesy permission', () => {
        permissions.current = [
            PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
            PermissionEnum.BILLING_GRANT_COMPLIMENTARY
        ];
        renderScreen();
        expect(actionHrefs()).toEqual([`/billing/subscriptions/${ID}/courtesy`]);
        expect(screen.queryByTestId('subscription-action-cancellation')).toBeNull();
        expect(screen.queryByTestId('subscription-action-revocation')).toBeNull();
        expect(screen.queryByTestId('subscription-action-pause')).toBeNull();
        expect(screen.queryByTestId('subscription-action-plan-change')).toBeNull();
    });

    it('shows no action links and a notice with inspection only', () => {
        permissions.current = [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT];
        renderScreen();
        expect(actionHrefs()).toHaveLength(0);
        expect(
            screen.getByText('No tenés permisos para operar esta suscripción.')
        ).toBeInTheDocument();
    });

    it('renders the open pause and current courtesy data', () => {
        permissions.current = [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT];
        renderScreen();
        expect(screen.getByTestId('subscription-detail-pause')).toHaveTextContent(
            'Pedido del cliente'
        );
        const courtesy = screen.getByTestId('subscription-detail-courtesy');
        expect(courtesy).toHaveTextContent('Meses otorgados: 2');
        expect(courtesy).toHaveTextContent('Meses restantes: 1');
    });

    it('says there is no pause and no courtesy when both are null', () => {
        permissions.current = [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT];
        detailHook.result.current = {
            isLoading: false,
            isError: false,
            data: { ...baseDetail, pause: null, courtesy: null },
            refetch: vi.fn()
        };
        renderScreen();
        expect(screen.getByTestId('subscription-detail-pause')).toHaveTextContent('Sin pausa');
        expect(screen.getByTestId('subscription-detail-courtesy')).toHaveTextContent(
            'Sin cortesía'
        );
    });

    it('formats the price with the real currency formatter', () => {
        permissions.current = [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT];
        renderScreen();
        const expected = `${formatCurrency({
            value: 1250,
            currency: 'ARS',
            locale: 'es'
        })} · Mensual`.replace(/\s+/g, ' ');
        const content = (screen.getByTestId('subscription-detail').textContent ?? '').replace(
            /\s+/g,
            ' '
        );
        expect(content).toContain(expected);
    });

    it('renders the status label instead of the raw enum', () => {
        permissions.current = [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT];
        renderScreen();
        expect(screen.getAllByText('Activa')).toHaveLength(1);
        expect(screen.queryAllByText('ACTIVE')).toHaveLength(0);
    });
});

describe('HOS-2081 estados del detalle', () => {
    beforeEach(() => {
        permissions.current = [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT];
    });

    it('shows the loading message', () => {
        detailHook.result.current = {
            isLoading: true,
            isError: false,
            data: undefined,
            refetch: vi.fn()
        };
        renderScreen();
        expect(screen.getByText('Cargando la suscripción…')).toBeInTheDocument();
    });

    it('shows the generic error and retries', () => {
        const refetch = vi.fn();
        detailHook.result.current = {
            isLoading: false,
            isError: true,
            error: new Error('boom'),
            data: undefined,
            refetch
        };
        renderScreen();
        expect(
            screen.getByText('No se pudo cargar el detalle de la suscripción.')
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('shows the not-found message without a retry button', () => {
        detailHook.result.current = {
            isLoading: false,
            isError: true,
            error: new ApiError('missing', { status: 404 }),
            data: undefined,
            refetch: vi.fn()
        };
        renderScreen();
        expect(screen.getByText('Esta suscripción no existe.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    });
});
