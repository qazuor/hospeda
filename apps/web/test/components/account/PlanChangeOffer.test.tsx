import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanChangeOffer } from '@/components/account/PlanChangeOffer.client';

const subscriptionId = '123e4567-e89b-42d3-a456-426614174000';
const currentId = '123e4567-e89b-42d3-a456-426614174001';
const higherId = '123e4567-e89b-42d3-a456-426614174002';
const lowerId = '123e4567-e89b-42d3-a456-426614174003';
const catalog = {
    vertical: 'accommodation',
    floor: null,
    trialOffer: null,
    plans: [
        {
            planId: '123e4567-e89b-42d3-a456-426614174011',
            planVersionId: '123e4567-e89b-42d3-a456-426614174012',
            slug: 'owner-basico',
            name: 'Básico',
            description: null,
            pricingOrder: 1,
            rank: 1,
            trialDays: 0,
            inheritsTouristVip: false,
            entitlements: [],
            limits: {},
            billingOptions: [{ id: currentId, cycle: 'monthly', amount: 250000, currency: 'ARS' }]
        },
        {
            planId: '123e4567-e89b-42d3-a456-426614174021',
            planVersionId: '123e4567-e89b-42d3-a456-426614174022',
            slug: 'owner-pro',
            name: 'Pro',
            description: null,
            pricingOrder: 2,
            rank: 2,
            trialDays: 0,
            inheritsTouristVip: false,
            entitlements: [],
            limits: {},
            billingOptions: [
                { id: higherId, cycle: 'monthly', amount: 350050, currency: 'ARS' },
                { id: lowerId, cycle: 'annual', amount: 3500000, currency: 'ARS' }
            ]
        }
    ]
};
const response = (body: unknown, status = 200) => ({
    ok: status < 400,
    status,
    json: async () => body
});
let fetchMock: ReturnType<typeof vi.fn>;
let assigned: ReturnType<typeof vi.fn>;

beforeEach(() => {
    assigned = vi.fn();
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            pathname: '/es/mi-cuenta/suscripcion/',
            assign: assigned
        }
    });
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/api/v1/public/plan-catalog'))
            return response({ success: true, data: catalog });
        if (init?.method === 'GET')
            return response({
                success: true,
                data: {
                    status: 'ACTIVE',
                    billingOptionId: currentId,
                    declaredPayerEmail: null
                }
            });
        return response({
            success: true,
            data: {
                outcome: 'DOWNGRADE',
                effectiveAt: '2026-12-05T03:00:00.000Z',
                amountMinor: 250000,
                surplus: { applicable: false }
            }
        });
    });
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function choose(id: string) {
    render(
        <PlanChangeOffer
            subscriptionId={subscriptionId}
            vertical="accommodation"
            locale="es"
        />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de plan' }));
    const list = await screen.findByTestId('plan-change-options');
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.getAttribute('data-billing-option-id'))).toEqual([
        higherId,
        lowerId
    ]);
    expect(items[0]).toHaveTextContent(/Pro.*por mes.*3[.]500,50/u);
    expect(items[1]).toHaveTextContent(/Pro.*por año.*35[.]000/u);
    fireEvent.click(
        within(items.find((item) => item.getAttribute('data-billing-option-id') === id)!).getByRole(
            'button'
        )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));
    return list;
}

describe('TEST:B8b:14 PlanChangeOffer', () => {
    it('TEST:B8b:25 shows the complete promo loss before confirming', async () => {
        render(
            <PlanChangeOffer
                subscriptionId={subscriptionId}
                vertical="accommodation"
                locale="es"
                promo
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Cambiar de plan' }));
        const list = await screen.findByTestId('plan-change-options');
        fireEvent.click(within(list).getAllByRole('button')[0]);
        expect(screen.getByTestId('plan-change-promo-warning').textContent).toBe(
            'Si cambiás de plan, perdés tu promo: el importe nuevo no lleva el descuento y el código no se puede volver a canjear.'
        );
    });
    it('TEST:B8b:25 discloses deferred courtesy months for a nonmonthly destination', async () => {
        render(
            <PlanChangeOffer
                subscriptionId={subscriptionId}
                vertical="accommodation"
                locale="es"
                courtesyMonths={2}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Cambiar de plan' }));
        const list = await screen.findByTestId('plan-change-options');
        fireEvent.click(within(list).getAllByRole('button')[1]);
        expect(screen.getByTestId('plan-change-courtesy-warning').textContent).toBe(
            'Perdés 2 meses de cortesía; podés seguir en mensual y conservarlos.'
        );
    });
    it('TEST:B8b:25 reads quarterly choices from the catalog and discloses courtesy loss', async () => {
        const quarterly = '123e4567-e89b-42d3-a456-426614174004';
        const expanded = structuredClone(catalog);
        expanded.plans[1].billingOptions.push({
            id: quarterly,
            cycle: 'quarterly',
            amount: 900000,
            currency: 'ARS'
        });
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (url.includes('/api/v1/public/plan-catalog'))
                return response({ success: true, data: expanded });
            if (init?.method === 'GET')
                return response({
                    success: true,
                    data: { status: 'ACTIVE', billingOptionId: currentId }
                });
            return response({
                success: true,
                data: {
                    outcome: 'DOWNGRADE',
                    effectiveAt: '2026-12-05T03:00:00.000Z',
                    amountMinor: 250000,
                    surplus: { applicable: false }
                }
            });
        });
        render(
            <PlanChangeOffer
                subscriptionId={subscriptionId}
                vertical="accommodation"
                locale="es"
                courtesyMonths={1}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Cambiar de plan' }));
        const list = await screen.findByTestId('plan-change-options');
        const choice = within(list).getByText(/Pro.*por trimestre/u);
        fireEvent.click(choice);
        expect(screen.getByTestId('plan-change-courtesy-warning').textContent).toBe(
            'Perdés 1 mes de cortesía; podés seguir en mensual y conservarlo.'
        );
    });
    it.each([
        [
            'SUCCESSION_IN_PROGRESS',
            'Terminá o cancelá el checkout que tenés abierto para cambiar de plan.'
        ],
        [
            'LAST_CHARGE_NOT_ENTERED',
            'Tu último cobro no entró. Actualizá tu tarjeta en Mercado Pago para poder cambiar de plan.'
        ],
        [
            'PREAPPROVAL_NOT_AUTHORIZED',
            'Tu último cobro no entró. Actualizá tu tarjeta en Mercado Pago para poder cambiar de plan.'
        ]
    ])('TEST:B8b:25 explains %s', async (reason, message) => {
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (url.includes('/api/v1/public/plan-catalog'))
                return response({ success: true, data: catalog });
            if (init?.method === 'GET')
                return response({
                    success: true,
                    data: { status: 'ACTIVE', billingOptionId: currentId }
                });
            return response(
                {
                    success: false,
                    error: { code: 'CONFLICT', message: 'Rejected', details: { reason } }
                },
                409
            );
        });
        await choose(higherId);
        await waitFor(() =>
            expect(screen.getByTestId('plan-change-result').textContent).toBe(message)
        );
    });
    it('posts the selected option and shows the client-local downgrade date', async () => {
        await choose(lowerId);
        await waitFor(() =>
            expect(screen.getByTestId('plan-change-result')).toHaveTextContent(
                '5 de diciembre de 2026'
            )
        );
        const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
        expect(post?.[0]).toContain(
            `/api/v1/protected/billing-subscription/${subscriptionId}/plan-change`
        );
        expect(JSON.parse(post?.[1]?.body as string)).toEqual({ billingOptionId: lowerId });
    });
    it('redirects a succession to the checkout returned by the route', async () => {
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (url.includes('/api/v1/public/plan-catalog'))
                return response({ success: true, data: catalog });
            if (init?.method === 'GET')
                return response({
                    success: true,
                    data: { status: 'ACTIVE', billingOptionId: currentId }
                });
            return response({
                success: true,
                data: {
                    outcome: 'SUCCESSION',
                    subscriptionId: '123e4567-e89b-42d3-a456-426614174099',
                    checkoutUrl: 'https://payments-fake.invalid/checkout/successor',
                    firstChargeAt: '2026-12-05T03:00:00.000Z',
                    creditDays: 10
                }
            });
        });
        await choose(higherId);
        await waitFor(() =>
            expect(assigned).toHaveBeenCalledWith(
                'https://payments-fake.invalid/checkout/successor'
            )
        );
    });
    it('shows the reason from error.details.reason for a 409 grace rejection', async () => {
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (url.includes('/api/v1/public/plan-catalog'))
                return response({ success: true, data: catalog });
            if (init?.method === 'GET')
                return response({
                    success: true,
                    data: { status: 'ACTIVE', billingOptionId: currentId }
                });
            return response(
                {
                    success: false,
                    error: {
                        code: 'CONFLICT',
                        message: 'Rejected',
                        details: { reason: 'GRACE_PERIOD' }
                    }
                },
                409
            );
        });
        await choose(higherId);
        await waitFor(() =>
            expect(screen.getByTestId('plan-change-result')).toHaveTextContent(
                'Tenés un pago pendiente'
            )
        );
    });
    it('shows the pending next charge date copy for a 409 rejection', async () => {
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (url.includes('/api/v1/public/plan-catalog'))
                return response({ success: true, data: catalog });
            if (init?.method === 'GET')
                return response({
                    success: true,
                    data: { status: 'ACTIVE', billingOptionId: currentId }
                });
            return response(
                {
                    success: false,
                    error: {
                        code: 'CONFLICT',
                        message: 'Plan change rejected',
                        details: { reason: 'CYCLE_END_PENDING' }
                    }
                },
                409
            );
        });
        await choose(higherId);
        await waitFor(() =>
            expect(screen.getByTestId('plan-change-result')).toHaveTextContent(
                'La fecha del próximo cobro todavía se está confirmando. Intentá cambiar de plan más tarde.'
            )
        );
    });
    it('shows the localized provider rejection when creation was not applied', async () => {
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (url.includes('/api/v1/public/plan-catalog'))
                return response({ success: true, data: catalog });
            if (init?.method === 'GET')
                return response({
                    success: true,
                    data: { status: 'ACTIVE', billingOptionId: currentId }
                });
            return response(
                {
                    success: false,
                    error: {
                        code: 'PROVIDER_ERROR',
                        reason: 'CREATION_NOT_APPLIED',
                        message: 'Payment provider did not apply the requested authorization',
                        details: { reason: 'CREATION_NOT_APPLIED' }
                    }
                },
                502
            );
        });
        await choose(higherId);
        await waitFor(() =>
            expect(screen.getByTestId('plan-change-result')).toHaveTextContent(
                'Mercado Pago no pudo aplicar el cambio. Tu plan actual sigue vigente.'
            )
        );
        expect(assigned).not.toHaveBeenCalled();
    });
    it('shows a useful error when the plan-change POST returns 500', async () => {
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (url.includes('/api/v1/public/plan-catalog'))
                return response({ success: true, data: catalog });
            if (init?.method === 'GET')
                return response({
                    success: true,
                    data: { status: 'ACTIVE', billingOptionId: currentId }
                });
            return response(
                { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } },
                500
            );
        });
        await choose(lowerId);
        await waitFor(() =>
            expect(screen.getByTestId('plan-change-result')).toHaveTextContent(
                'No pudimos cambiar el plan. Intentá de nuevo.'
            )
        );
        expect(assigned).not.toHaveBeenCalled();
    });
    it('shows the client-local available date from a 409 change-window rejection', async () => {
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (url.includes('/api/v1/public/plan-catalog'))
                return response({ success: true, data: catalog });
            if (init?.method === 'GET')
                return response({
                    success: true,
                    data: { status: 'ACTIVE', billingOptionId: currentId }
                });
            return response(
                {
                    success: false,
                    error: {
                        code: 'CONFLICT',
                        message: 'Rejected',
                        details: {
                            reason: 'CHANGE_WINDOW_TOO_SHORT',
                            availableFrom: '2026-12-05T03:00:00.000Z'
                        }
                    }
                },
                409
            );
        });
        await choose(higherId);
        await waitFor(() =>
            expect(screen.getByTestId('plan-change-result')).toHaveTextContent(
                '5 de diciembre de 2026'
            )
        );
    });
});
