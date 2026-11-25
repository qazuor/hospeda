import type { AddonOffersResponse } from '@repo/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AddonOfferList } from '@/components/billing/addon-purchase/AddonOfferList';
import { formatPrice } from '@/lib/format-utils';
import { createTranslations } from '@/lib/i18n';

const offer: AddonOffersResponse['items'][number] = {
    productId: '123e4567-e89b-42d3-a456-426614174001',
    addonVersionId: '123e4567-e89b-42d3-a456-426614174002',
    slug: 'test-pack',
    name: 'Catalog pack',
    description: 'Catalog description',
    price: 12345,
    currency: 'ARS',
    chargeKind: 'PERIODICO',
    cycle: 'monthly',
    compatibleVerticals: ['accommodation'],
    grantedKeys: ['max_accommodations'],
    scopeType: 'VERTICAL_SUBSCRIPTION',
    validity: 'WHILE_SUBSCRIPTION_ALIVE',
    validityDays: null,
    freeUnderGrantVerticals: []
};
const { t } = createTranslations('en');

describe('catalog offer cards', () => {
    it('shows catalog price, category, icon, description, and cycle in SSR', () => {
        const html = renderToString(
            <AddonOfferList
                offers={[offer]}
                locale="en"
                t={t}
                onSelect={vi.fn()}
            />
        );
        expect(html).toContain('Catalog pack');
        expect(html).toContain('Catalog description');
        expect(html).toContain('Listings');
        expect(html).toContain('Monthly');
        expect(html).toContain(
            formatPrice({ amount: offer.price / 100, currency: offer.currency, locale: 'en' })
        );
        expect(html).toContain('aria-hidden="true"');
    });

    it('filters categories present in the catalog and restores all, grouping packs and boosts', () => {
        const boost = {
            ...offer,
            productId: 'boost',
            name: 'Catalog boost',
            scopeType: 'LISTING' as const,
            grantedKeys: ['featured_listing']
        };
        render(
            <AddonOfferList
                offers={[offer, boost]}
                locale="en"
                t={t}
                onSelect={vi.fn()}
            />
        );
        expect(screen.getByRole('heading', { name: 'Recurring packs' })).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Listing boosts and extras' })
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Visibility' }));
        expect(screen.queryByTestId(`addon-offer-${offer.productId}`)).toBeNull();
        expect(screen.getByTestId('addon-offer-boost')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Visibility' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        fireEvent.click(screen.getByRole('button', { name: 'All' }));
        expect(screen.getByTestId(`addon-offer-${offer.productId}`)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Photos and media' })).toBeNull();
    });

    it('keeps an active card visually enabled with a header pill but blocks buying again', () => {
        const onSelect = vi.fn();
        render(
            <AddonOfferList
                offers={[offer]}
                locale="en"
                t={t}
                isActive={() => true}
                onSelect={onSelect}
            />
        );
        const card = screen.getByTestId(`addon-offer-${offer.productId}`);
        expect(card).not.toBeDisabled();
        expect(card).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByText('Active').closest('button')).toBe(card);
        fireEvent.click(card);
        expect(onSelect).not.toHaveBeenCalled();
    });
});
