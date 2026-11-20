import { trans } from '@repo/i18n/web';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddonOfferList } from '@/components/billing/addon-purchase/AddonOfferList';
import { RecurringAddonWithdrawal } from '@/components/billing/recurring-addons/RecurringAddonWithdrawal.client';
import { createTranslations } from '@/lib/i18n';
import { buildI18nAssetBody } from '@/lib/i18n-asset';

const { listRecurringAddons, withdrawAddon } = vi.hoisted(() => ({
    listRecurringAddons: vi.fn(),
    withdrawAddon: vi.fn()
}));
vi.mock('@/lib/api/endpoints-protected-addons', () => ({
    billingAddonApi: {
        listRecurringAddons,
        withdrawAddon
    }
}));

const offers = [
    {
        productId: '2f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11',
        addonVersionId: '3f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11',
        slug: 'extra-photos-20',
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
        freeUnderGrantVerticals: []
    }
];

const recurringAddons = {
    ok: true,
    data: {
        items: [
            {
                addonInstanceId: '4f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11',
                slug: 'extra-experiences-1',
                name: 'Extra Experience Listing (+1)',
                chargeKind: 'PERIODICO',
                cycle: 'monthly',
                price: 120000,
                currency: 'ARS',
                status: 'ACTIVE',
                targetId: null,
                targetName: null
            }
        ]
    }
};

beforeEach(() => {
    vi.clearAllMocks();
    window.__HOSPEDA_I18N__ = {};
    new Function('window', buildI18nAssetBody({ locale: 'pt', messages: trans.pt }))(window);
    listRecurringAddons.mockResolvedValue(recurringAddons);
});

describe('HOS-2298 Portuguese addon store dictionary', () => {
    it('uses the production pt browser asset for offers and recurring addon controls', async () => {
        // The recurring list arrives a moment after the offers render, as on a loaded CI runner:
        // the controls must be awaited, not read right after the offer appears.
        listRecurringAddons.mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve(recurringAddons), 50))
        );
        const { t } = createTranslations('pt');
        render(
            <>
                <AddonOfferList
                    offers={offers}
                    onSelect={() => undefined}
                    t={t}
                />
                <RecurringAddonWithdrawal
                    locale="pt"
                    listingId={null}
                />
            </>
        );

        expect(await screen.findByText('Pacote de fotos extras (+20 fotos)')).toBeInTheDocument();
        expect(screen.getByText('Escolha um complemento')).toBeInTheDocument();
        expect(await screen.findByText('Sem anúncio associado')).toBeInTheDocument();
        expect(document.body).toHaveTextContent('Mensal');
        expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/billing\./);
    });
});
