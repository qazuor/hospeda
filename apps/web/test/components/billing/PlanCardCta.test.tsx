import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanCardCta } from '@/components/billing/PlanCardCta.client';
import { resetPricingSituationCacheForTests } from '@/lib/billing/pricing-situation';

const pricingSituation = vi.hoisted(() => vi.fn());
const listingNotices = vi.hoisted(() => vi.fn());
const listMine = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/api/endpoints-protected')>();
    return {
        ...actual,
        billingSubscriptionApi: { ...actual.billingSubscriptionApi, pricingSituation, listMine },
        publishApi: { listingNotices }
    };
});
beforeEach(() => {
    vi.clearAllMocks();
    resetPricingSituationCacheForTests();
});
afterEach(() => vi.unstubAllGlobals());

const componentSource = readFileSync(
    resolve(__dirname, '../../../src/components/billing/PlanCardCta.client.tsx'),
    'utf8'
);
const cssSource = readFileSync(
    resolve(__dirname, '../../../src/components/billing/PlanCardCta.module.css'),
    'utf8'
);

describe('PlanCardCta', () => {
    it('TEST:B8b:14 posts the selected ACTIVE pricing option to the protected route', async () => {
        pricingSituation.mockResolvedValue({
            ok: true,
            data: {
                situation: 'SUBSCRIBED',
                status: 'ACTIVE',
                planVersionId: 'v1',
                billingOptionId: 'm1'
            }
        });
        const subscriptionId = '123e4567-e89b-42d3-a456-426614174000';
        listMine.mockResolvedValue({
            ok: true,
            data: {
                subscriptions: [{ id: subscriptionId, vertical: 'accommodation', status: 'ACTIVE' }]
            }
        });
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 409,
            json: async () => ({
                success: false,
                error: {
                    code: 'CONFLICT',
                    message: 'Rejected',
                    details: { reason: 'GRACE_PERIOD' }
                }
            })
        });
        vi.stubGlobal('fetch', fetchMock);
        render(
            <PlanCardCta
                locale="es"
                vertical="accommodation"
                planVersionId="v2"
                billingOptions={{ monthly: 'm2', annual: null }}
            />
        );
        expect((await screen.findByTestId('pricing-card-cta')).textContent).toBe(
            'Cambiar a este plan · por mes'
        );
        fireEvent.click(await screen.findByRole('button', { name: /Cambiar a este plan/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toContain(
            `/api/v1/protected/billing-subscription/${subscriptionId}/plan-change`
        );
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body as string)).toEqual({ billingOptionId: 'm2' });
    });
    it('TEST:B8b:14 follows the SUCCESSION checkout URL from the pricing card', async () => {
        pricingSituation.mockResolvedValue({
            ok: true,
            data: {
                situation: 'SUBSCRIBED',
                status: 'ACTIVE',
                planVersionId: 'v1',
                billingOptionId: 'm1'
            }
        });
        const subscriptionId = '123e4567-e89b-42d3-a456-426614174000';
        listMine.mockResolvedValue({
            ok: true,
            data: {
                subscriptions: [{ id: subscriptionId, vertical: 'accommodation', status: 'ACTIVE' }]
            }
        });
        const assigned = vi.fn();
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { pathname: '/es/planes/anfitriones/precios/', assign: assigned }
        });
        const checkoutUrl = 'https://payments-fake.invalid/checkout/pricing-successor';
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    outcome: 'SUCCESSION',
                    subscriptionId: '123e4567-e89b-42d3-a456-426614174099',
                    checkoutUrl,
                    firstChargeAt: '2026-12-05T03:00:00.000Z',
                    creditDays: 10
                }
            })
        });
        vi.stubGlobal('fetch', fetchMock);
        render(
            <PlanCardCta
                locale="es"
                vertical="accommodation"
                planVersionId="v2"
                billingOptions={{ monthly: 'm2', annual: null }}
            />
        );
        fireEvent.click(await screen.findByRole('button', { name: /Cambiar a este plan/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));
        await waitFor(() => expect(assigned).toHaveBeenCalledWith(checkoutUrl));
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    it('TEST:1758:4 renders checkout links with stacked button styles', () => {
        expect(componentSource).toContain(
            "className={cycle === 'monthly' ? styles.primary : styles.secondary}"
        );
        expect(cssSource).not.toContain('text-decoration: underline');
        expect(cssSource).toContain('min-height: 44px;');
        expect(cssSource).toContain(':focus-visible');
        expect(cssSource).toContain('flex-direction: column;');
        expect(cssSource).toContain('width: 100%;');
    });
    it('TEST:1735:14 labels only the anchored option as payment continuation', async () => {
        pricingSituation.mockResolvedValue({
            ok: true,
            data: {
                situation: 'SUBSCRIBED',
                status: 'PENDING_AUTHORIZATION',
                planVersionId: 'v1',
                billingOptionId: 'a1'
            }
        });
        render(
            <PlanCardCta
                locale="es"
                vertical="accommodation"
                planVersionId="v1"
                billingOptions={{ monthly: 'm1', annual: 'a1' }}
            />
        );
        expect(
            await screen.findByRole('link', { name: 'Suscribirme con pago mensual' })
        ).toHaveAttribute('href', '/es/suscriptores/checkout/?opcion=m1');
        expect(screen.getByRole('link', { name: 'Continuar el pago' })).toHaveAttribute(
            'href',
            '/es/suscriptores/checkout/?opcion=a1'
        );
    });

    it('renders exact monthly and annual checkout links from the shared situation read', async () => {
        pricingSituation.mockResolvedValue({ ok: true, data: { situation: 'CHECKOUT' } });
        render(
            <PlanCardCta
                locale="es"
                vertical="accommodation"
                planVersionId="v1"
                billingOptions={{ monthly: 'm1', annual: 'a1' }}
            />
        );
        const root = await screen.findByTestId('pricing-card-cta');
        expect(root).toHaveAttribute('data-kind', 'checkout');
        expect(root).toHaveAttribute('data-loaded', 'true');
        expect(screen.getByRole('link', { name: 'Suscribirme con pago mensual' })).toHaveAttribute(
            'href',
            '/es/suscriptores/checkout/?opcion=m1'
        );
        expect(screen.getByRole('link', { name: 'Suscribirme con pago anual' })).toHaveAttribute(
            'href',
            '/es/suscriptores/checkout/?opcion=a1'
        );
        expect(
            screen.getByRole('link', { name: 'Suscribirme con pago mensual' }).className
        ).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Suscribirme con pago anual' }).className
        ).toBeTruthy();
    });

    it('shares one request across two cards in the same vertical', async () => {
        pricingSituation.mockResolvedValue({ ok: true, data: { situation: 'CHECKOUT' } });
        render(
            <>
                <PlanCardCta
                    locale="es"
                    vertical="accommodation"
                    planVersionId="v1"
                    billingOptions={{ monthly: 'm1', annual: null }}
                />
                <PlanCardCta
                    locale="es"
                    vertical="accommodation"
                    planVersionId="v2"
                    billingOptions={{ monthly: 'm2', annual: null }}
                />
            </>
        );
        expect(await screen.findAllByTestId('pricing-card-cta')).toHaveLength(2);
        expect(pricingSituation).toHaveBeenCalledTimes(1);
    });
    it('HOS-1977 shows the republish CTA for FIRST_USE with a billing-unpublished listing', async () => {
        pricingSituation.mockResolvedValue({
            ok: true,
            data: { situation: 'FIRST_USE', trialDays: 30 }
        });
        listingNotices.mockResolvedValue({
            ok: true,
            data: {
                trialRunning: false,
                items: [
                    {
                        listingId: 'l1',
                        publicationStatus: 'UNPUBLISHED_BY_BILLING',
                        notices: [],
                        recurringAddons: 0
                    }
                ]
            }
        });
        render(
            <PlanCardCta
                locale="es"
                vertical="accommodation"
                planVersionId="v1"
                billingOptions={{ monthly: 'm1', annual: null }}
            />
        );
        expect(
            await screen.findByRole('link', { name: 'Publicar de nuevo desde Mi cuenta' })
        ).toHaveAttribute('href', '/es/mi-cuenta/propiedades/');
    });
    it('HOS-1977 shows nothing for FIRST_USE when no listing is billing-unpublished', async () => {
        pricingSituation.mockResolvedValue({
            ok: true,
            data: { situation: 'FIRST_USE', trialDays: 30 }
        });
        listingNotices.mockResolvedValue({ ok: true, data: { trialRunning: false, items: [] } });
        render(
            <PlanCardCta
                locale="es"
                vertical="accommodation"
                planVersionId="v1"
                billingOptions={{ monthly: 'm1', annual: null }}
            />
        );
        await screen.findByTestId('pricing-card-cta');
        await vi.waitFor(() =>
            expect(screen.getByTestId('pricing-card-cta')).toHaveAttribute('data-loaded', 'true')
        );
        expect(screen.getByTestId('pricing-card-cta')).toHaveAttribute('data-kind', 'none');
    });
    it('HOS-1977 keeps the primary CTA and drops a rejected extra read from the cache', async () => {
        pricingSituation.mockResolvedValue({
            ok: true,
            data: { situation: 'FIRST_USE', trialDays: 30 }
        });
        listingNotices.mockRejectedValueOnce(new Error('network'));
        const props = {
            locale: 'es',
            vertical: 'accommodation',
            planVersionId: 'v1',
            billingOptions: { monthly: 'm1', annual: null }
        } as const;
        const first = render(<PlanCardCta {...props} />);
        await vi.waitFor(() =>
            expect(screen.getByTestId('pricing-card-cta')).toHaveAttribute('data-loaded', 'true')
        );
        await vi.waitFor(() => expect(listingNotices).toHaveBeenCalledTimes(1));
        expect(screen.getByTestId('pricing-card-cta')).toHaveAttribute('data-kind', 'none');
        first.unmount();

        listingNotices.mockResolvedValue({
            ok: true,
            data: {
                trialRunning: false,
                items: [
                    {
                        listingId: 'l1',
                        publicationStatus: 'UNPUBLISHED_BY_BILLING',
                        notices: [],
                        recurringAddons: 0
                    }
                ]
            }
        });
        render(<PlanCardCta {...props} />);
        expect(
            await screen.findByRole('link', { name: 'Publicar de nuevo desde Mi cuenta' })
        ).toBeInTheDocument();
        expect(listingNotices).toHaveBeenCalledTimes(2);
    });
    it.each([
        'venue',
        'experience'
    ] as const)('HOS-1998 shows the republish CTA on the %s plans page', async (vertical) => {
        pricingSituation.mockResolvedValue({
            ok: true,
            data: { situation: 'FIRST_USE', trialDays: 30 }
        });
        listingNotices.mockResolvedValue({
            ok: true,
            data: {
                trialRunning: false,
                items: [
                    {
                        listingId: 'l1',
                        publicationStatus: 'UNPUBLISHED_BY_BILLING',
                        notices: [],
                        recurringAddons: 0
                    }
                ]
            }
        });
        render(
            <PlanCardCta
                locale="es"
                vertical={vertical}
                planVersionId="v1"
                billingOptions={{ monthly: 'm1', annual: null }}
            />
        );
        expect(
            await screen.findByRole('link', { name: 'Publicar de nuevo desde Mi cuenta' })
        ).toHaveAttribute('href', '/es/mi-cuenta/comercio/');
        expect(listingNotices).toHaveBeenCalledWith(expect.objectContaining({ vertical }));
    });
});
