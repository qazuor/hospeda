import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddonPurchaseGate } from '@/components/billing/addon-purchase/AddonPurchaseGate.client';

const { listMine } = vi.hoisted(() => ({ listMine: vi.fn() }));
vi.mock('@/lib/api/endpoints-protected', () => ({ billingSubscriptionApi: { listMine } }));
vi.mock('@/components/billing/addon-purchase/AddonPurchase.client', () => ({
    AddonPurchase: ({ accountVerticals }: { accountVerticals: readonly string[] | null }) => (
        <div
            data-testid="addon-purchase-flow"
            data-verticals={JSON.stringify(accountVerticals)}
        />
    )
}));

const mount = (returnOrderRequestId: string | null = null) =>
    render(
        <AddonPurchaseGate
            locale="es"
            returnOrderRequestId={returnOrderRequestId}
            accountEmail="payer@example.test"
            plansPath="planes/comer-y-salir/precios"
        />
    );
const subscriptions = (count: number) => ({
    ok: true,
    data: {
        subscriptions: Array.from({ length: count }, (_, i) => ({ id: `s${i}` })),
        deferredCourtesies: [],
        declinedSignups: []
    }
});

beforeEach(() => vi.clearAllMocks());

describe('AddonPurchaseGate (owner decision 3)', () => {
    it('restricts a subscription section to its vertical and skips the empty-state read', () => {
        render(
            <AddonPurchaseGate
                locale="es"
                returnOrderRequestId={null}
                accountEmail="payer@example.test"
                plansPath="planes"
                onlyVertical="venue"
            />
        );
        expect(screen.getByTestId('addon-purchase-flow')).toHaveAttribute(
            'data-verticals',
            '["venue"]'
        );
        expect(listMine).not.toHaveBeenCalled();
        expect(screen.queryByTestId('addons-no-subscription')).toBeNull();
    });
    it('shows «subscribe first» with the vertical plans CTA when the account has no subscription', async () => {
        // Arrange
        listMine.mockResolvedValue(subscriptions(0));
        // Act
        mount();
        // Assert
        expect(await screen.findByText('Antes tenés que suscribirte a un plan')).toBeTruthy();
        expect(screen.getByTestId('addons-no-subscription-plans').getAttribute('href')).toBe(
            '/es/planes/comer-y-salir/precios/'
        );
        expect(screen.queryByTestId('addon-purchase-flow')).toBeNull();
    });

    it('opens the purchase flow when the account holds a subscription', async () => {
        listMine.mockResolvedValue(subscriptions(1));
        mount();
        expect(await screen.findByTestId('addon-purchase-flow')).toBeTruthy();
        expect(screen.queryByTestId('addons-no-subscription')).toBeNull();
    });

    it('opens the purchase flow when the read fails, never inventing «no subscription»', async () => {
        listMine.mockResolvedValueOnce({ ok: false, error: { status: 500 } });
        mount();
        expect(await screen.findByTestId('addon-purchase-flow')).toBeTruthy();
    });

    it('opens the purchase flow when the read throws', async () => {
        listMine.mockRejectedValueOnce(new Error('network'));
        mount();
        expect(await screen.findByTestId('addon-purchase-flow')).toBeTruthy();
    });

    it('skips the read on a Mercado Pago return and settles the order', () => {
        mount('123e4567-e89b-42d3-a456-426614174004');
        expect(screen.getByTestId('addon-purchase-flow')).toBeTruthy();
        expect(listMine).not.toHaveBeenCalled();
    });
});
