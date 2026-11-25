import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddonPurchase } from '@/components/billing/addon-purchase/AddonPurchase.client';

const { offers, listMine } = vi.hoisted(() => ({ offers: vi.fn(), listMine: vi.fn() }));
vi.mock('@/lib/api/endpoints-protected-addons', () => ({
    billingAddonApi: { offers, purchase: vi.fn(), chooseFree: vi.fn(), readPurchase: vi.fn() }
}));
vi.mock('@/lib/api/endpoints-protected', () => ({
    publishApi: { listingNotices: vi.fn() },
    billingSubscriptionApi: { listMine }
}));

const offer = (slug: string) => ({
    productId: crypto.randomUUID(),
    addonVersionId: crypto.randomUUID(),
    slug,
    name: 'Extra Photos Pack (+20 photos)',
    description: 'Adds 20 additional photos to each accommodation. Renews monthly.',
    chargeKind: 'PERIODICO',
    cycle: 'monthly',
    price: 500000,
    currency: 'ARS',
    compatibleVerticals: ['accommodation'],
    scopeType: 'VERTICAL_SUBSCRIPTION',
    validity: 'WHILE_SUBSCRIPTION_ALIVE',
    validityDays: null,
    freeUnderGrantVerticals: [],
    grantedKeys: ['featured_listing']
});

function mount(locale: 'es' | 'en' | 'pt') {
    return render(
        <AddonPurchase
            locale={locale}
            returnOrderRequestId={null}
            accountEmail="payer@example.test"
        />
    );
}

beforeEach(() => vi.clearAllMocks());

describe('HOS-2230 addon store copy follows the page locale', () => {
    it('shows Spanish name and description on /es/, never the English catalog text', async () => {
        offers.mockResolvedValue({ ok: true, data: { items: [offer('extra-photos-20')] } });
        mount('es');
        await screen.findByText(/Pack de fotos extra/);
        expect(screen.queryByText(/Extra Photos Pack/)).toBeNull();
        expect(screen.queryByText(/Adds 20 additional photos/)).toBeNull();
    });

    it.each([
        ['en', /Extra Photos Pack/],
        ['pt', /Pacote de fotos extras/]
    ] as const)('shows the %s copy', async (locale, name) => {
        offers.mockResolvedValue({ ok: true, data: { items: [offer('extra-photos-20')] } });
        mount(locale);
        await screen.findByText(name);
    });

    it('falls back to the catalog text for a slug without copy', async () => {
        offers.mockResolvedValue({ ok: true, data: { items: [offer('brand-new-addon')] } });
        mount('es');
        await screen.findByText('Extra Photos Pack (+20 photos)');
    });

    it('styles the confirm button with the primary button class and localizes the summary name', async () => {
        offers.mockResolvedValue({ ok: true, data: { items: [offer('extra-photos-20')] } });
        listMine.mockResolvedValue({
            ok: true,
            data: {
                subscriptions: [
                    {
                        id: crypto.randomUUID(),
                        vertical: 'accommodation',
                        status: 'ACTIVE',
                        plan: { name: 'Pro' }
                    }
                ],
                deferredCourtesies: [],
                declinedSignups: []
            }
        });
        mount('es');
        fireEvent.click(await screen.findByText(/Pack de fotos extra/));
        const button = await screen.findByTestId('addon-purchase-confirm');
        expect(button.className).toMatch(/confirm/);
        expect(screen.queryByText(/Extra Photos Pack/)).toBeNull();
    });
});
