/**
 * HOS-2599 (audit findings 1 and 7): the add-on screen offers only the add-ons compatible
 * with the account's verticals (catalog `compatibleVerticals`), tells a paid owner whose
 * subscription is not active why it is not listed instead of «free trial or no plan», shows
 * each listing's state as a pill, keeps «Back» inside the stepper, and confirms with a
 * summary card plus a kit Field for the payer email.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddonPurchase } from '@/components/billing/addon-purchase/AddonPurchase.client';
import { AddonPurchaseGate } from '@/components/billing/addon-purchase/AddonPurchaseGate.client';

const { offers, listMine, listingNotices } = vi.hoisted(() => ({
    offers: vi.fn(),
    listMine: vi.fn(),
    listingNotices: vi.fn()
}));
vi.mock('@/lib/api/endpoints-protected-addons', () => ({
    billingAddonApi: {
        offers,
        purchase: vi.fn(),
        chooseFree: vi.fn(),
        readPurchase: vi.fn(),
        listRecurringAddons: vi.fn().mockResolvedValue({ ok: true, data: { items: [] } })
    }
}));
vi.mock('@/lib/api/endpoints-protected', () => ({
    publishApi: { listingNotices },
    billingSubscriptionApi: { listMine }
}));

const base = {
    addonVersionId: '123e4567-e89b-42d3-a456-426614174002',
    description: null,
    chargeKind: 'PERIODICO',
    cycle: 'monthly',
    price: 1300000,
    currency: 'ARS',
    validity: 'WHILE_SUBSCRIPTION_ALIVE',
    validityDays: null,
    freeUnderGrantVerticals: []
} as const;
const accommodationPack = {
    ...base,
    productId: '123e4567-e89b-42d3-a456-426614174011',
    slug: 'test-accommodation-pack',
    name: 'Pack de alojamientos extra',
    compatibleVerticals: ['accommodation'],
    scopeType: 'VERTICAL_SUBSCRIPTION'
};
const experienceBoost = {
    ...base,
    productId: '123e4567-e89b-42d3-a456-426614174012',
    slug: 'test-experience-boost',
    name: 'Impulso de experiencia',
    compatibleVerticals: ['experience'],
    scopeType: 'LISTING'
};
const venueSlot = {
    ...base,
    productId: '123e4567-e89b-42d3-a456-426614174013',
    slug: 'test-venue-slot',
    name: 'Ficha extra de Comer y salir',
    compatibleVerticals: ['venue'],
    scopeType: 'VERTICAL_SUBSCRIPTION'
};

function subscription(input: { readonly vertical: string; readonly status: string }) {
    return {
        id: `sub-${input.vertical}`,
        vertical: input.vertical,
        status: input.status,
        plan: { name: 'Básico' }
    };
}

function listMineWith(rows: readonly ReturnType<typeof subscription>[]) {
    listMine.mockResolvedValue({
        ok: true,
        data: { subscriptions: rows, deferredCourtesies: [], declinedSignups: [] }
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    offers.mockResolvedValue({
        ok: true,
        data: { items: [accommodationPack, experienceBoost, venueSlot] }
    });
});

describe('HOS-2599 finding 1: add-ons follow the account verticals', () => {
    it('shows an experience owner only the experience add-ons', async () => {
        listMineWith([subscription({ vertical: 'experience', status: 'ACTIVE' })]);
        render(
            <AddonPurchaseGate
                locale="es"
                returnOrderRequestId={null}
                accountEmail="owner@example.test"
                plansPath="planes"
            />
        );
        expect(
            await screen.findByTestId(`addon-offer-${experienceBoost.productId}`)
        ).toBeInTheDocument();
        expect(screen.queryByTestId(`addon-offer-${accommodationPack.productId}`)).toBeNull();
        expect(screen.queryByTestId(`addon-offer-${venueSlot.productId}`)).toBeNull();
    });

    it('shows a host who also owns a venue the add-ons of both verticals', async () => {
        listMineWith([
            subscription({ vertical: 'accommodation', status: 'ACTIVE' }),
            subscription({ vertical: 'venue', status: 'PAUSED' })
        ]);
        render(
            <AddonPurchaseGate
                locale="es"
                returnOrderRequestId={null}
                accountEmail="owner@example.test"
                plansPath="planes"
            />
        );
        expect(
            await screen.findByTestId(`addon-offer-${accommodationPack.productId}`)
        ).toBeInTheDocument();
        expect(screen.getByTestId(`addon-offer-${venueSlot.productId}`)).toBeInTheDocument();
        expect(screen.queryByTestId(`addon-offer-${experienceBoost.productId}`)).toBeNull();
    });

    it('offers every add-on when the account verticals are unknown', async () => {
        render(
            <AddonPurchase
                locale="es"
                returnOrderRequestId={null}
                accountEmail="owner@example.test"
            />
        );
        expect(
            await screen.findByTestId(`addon-offer-${accommodationPack.productId}`)
        ).toBeInTheDocument();
        expect(screen.getByTestId(`addon-offer-${experienceBoost.productId}`)).toBeInTheDocument();
        expect(screen.getByTestId(`addon-offer-${venueSlot.productId}`)).toBeInTheDocument();
    });

    it('does not tell an owner with a paused paid plan that they are in the trial or have no plan', async () => {
        listMineWith([subscription({ vertical: 'accommodation', status: 'PAUSED' })]);
        render(
            <AddonPurchase
                locale="es"
                returnOrderRequestId={null}
                accountEmail="owner@example.test"
                accountVerticals={['accommodation']}
            />
        );
        fireEvent.click(await screen.findByTestId(`addon-offer-${accommodationPack.productId}`));
        const notice = await screen.findByTestId('addon-no-subscriptions');
        expect(notice).toHaveAttribute('data-reason', 'INACTIVE');
        expect(notice.textContent).not.toContain('prueba gratis');
        expect(notice.textContent).toContain('no está activa');
        expect(screen.getByTestId('addon-no-subscriptions-plans')).toHaveAttribute(
            'href',
            '/es/mi-cuenta/suscripcion/'
        );
    });
});

describe('HOS-2599 finding 7: destination and confirmation use the kit', () => {
    it('shows each listing state as a pill and keeps «Volver» inside the stepper', async () => {
        listingNotices.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    { listingId: 'l-1', name: 'Casa Quinta', publicationStatus: 'PUBLISHED' },
                    { listingId: 'l-2', name: 'Borrador', publicationStatus: 'DRAFT' }
                ]
            }
        });
        render(
            <AddonPurchase
                locale="es"
                returnOrderRequestId={null}
                accountEmail="owner@example.test"
                accountVerticals={['experience']}
            />
        );
        fireEvent.click(await screen.findByTestId(`addon-offer-${experienceBoost.productId}`));
        const card = await screen.findByTestId('addon-target-l-1');
        const pill = within(card).getByText('Publicada');
        expect(pill.closest('[data-tone]')).toHaveAttribute('data-tone', 'success');
        const stepper = screen.getByRole('navigation', { name: 'Pasos de la compra' });
        expect(within(stepper).getByTestId('addon-purchase-back')).toHaveTextContent('Volver');
    });

    it('confirms with a summary card, the destination and a kit Field for the payer email', async () => {
        listingNotices.mockResolvedValue({
            ok: true,
            data: {
                items: [{ listingId: 'l-1', name: 'Casa Quinta', publicationStatus: 'PUBLISHED' }]
            }
        });
        render(
            <AddonPurchase
                locale="es"
                returnOrderRequestId={null}
                accountEmail="owner@example.test"
                accountVerticals={['experience']}
            />
        );
        fireEvent.click(await screen.findByTestId(`addon-offer-${experienceBoost.productId}`));
        fireEvent.click(await screen.findByTestId('addon-target-l-1'));
        const summary = await screen.findByTestId('addon-purchase-summary');
        const card = within(summary).getByRole('article');
        expect(card).toHaveTextContent('Impulso de experiencia');
        expect(within(card).getByTestId('addon-summary-destination')).toHaveTextContent(
            'Para: Casa Quinta'
        );
        expect(card).toHaveTextContent('Cada mes');
        const email = within(summary).getByLabelText(/Correo del pagador/);
        expect(email).toHaveValue('owner@example.test');
        expect(email).toHaveAccessibleDescription(/cuenta de Mercado Pago/);
        expect(summary.textContent).not.toContain('el proveedor no lo confirma');
    });
});
