import { AnalyticsEventSchemas } from '@repo/analytics';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListingContactBar } from '@/components/listing/contact/ListingContactBar.client';
import { markListingContactPanelReady } from '@/components/listing/contact/listing-contact-readiness';
import { onListingContactPanelOpen } from '@/lib/listing-contact/listing-contact-events';
import { initContactLinkTracking } from '@/lib/listing-contact/track-contact-links';

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/analytics/umami-client', () => ({ trackEvent }));

const experience = {
    listingId: 'exp-1',
    vertical: 'experience',
    locale: 'es',
    hasWhatsapp: true,
    price: {
        amount: 15000,
        currency: 'ARS',
        unitLabelKey: 'accommodations.detail.listingContact.units.perPerson',
        onRequest: false
    },
    panelId: 'exp-panel',
    primaryLabelKey: 'accommodations.detail.listingContact.bar.contact',
    fallbackHref: '#experience-contact'
} as const;

describe('ListingContactBar for channel-only verticals', () => {
    it('AC-2.8: shows the price and a Contactar button that never carries WhatsApp', () => {
        render(<ListingContactBar {...experience} />);

        expect(screen.getByText(/15\.000/)).toBeInTheDocument();
        expect(screen.getByText('/persona')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Contactar' })).toHaveAttribute(
            'href',
            '#experience-contact'
        );
        expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
    });

    it('AC-2.8: asks for the price when the experience has none', () => {
        render(
            <ListingContactBar
                {...experience}
                price={{ amount: null, currency: null, unitLabelKey: null, onRequest: true }}
            />
        );

        expect(screen.getByText('Consultar precio')).toBeInTheDocument();
    });

    it('opens the panel without reporting a channel that does not exist', () => {
        const receive = vi.fn();
        const unsubscribe = onListingContactPanelOpen(receive);
        const clearReady = markListingContactPanelReady({ panelId: experience.panelId });
        try {
            render(<ListingContactBar {...experience} />);
            fireEvent.click(screen.getByRole('link', { name: 'Contactar' }));

            expect(receive).toHaveBeenCalledWith({ origin: 'bar', focus: undefined });
            expect(trackEvent).not.toHaveBeenCalled();
        } finally {
            unsubscribe();
            act(clearReady);
        }
    });

    it('AC-2.9: a venue without price links «Ver carta» outward, tagged as the menu channel', () => {
        render(
            <ListingContactBar
                {...experience}
                listingId="ven-1"
                vertical="venue"
                price={null}
                hasWhatsapp={false}
                primaryLabelKey="accommodations.detail.listingContact.bar.viewMenu"
                primaryLink={{ href: 'https://bar.com/carta', channel: 'menu' }}
            />
        );

        const link = screen.getByRole('link', { name: 'Ver carta' });
        expect(link).toHaveAttribute('href', 'https://bar.com/carta');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(screen.queryByText(/\$|Consultar precio/)).not.toBeInTheDocument();

        // The page's delegated listener turns the attributes into a valid event.
        initContactLinkTracking({ document });
        document.documentElement.dataset.locale = 'es';
        fireEvent.click(link);
        const payload = trackEvent.mock.lastCall?.[1];
        expect(payload).toMatchObject({
            listing_id: 'ven-1',
            vertical: 'venue',
            channel: 'menu',
            origin: 'bar'
        });
        expect(AnalyticsEventSchemas.listing_contact_clicked.safeParse(payload).success).toBe(true);
    });

    it('rejects a fallback that is not an in-page anchor', () => {
        const { container } = render(
            <ListingContactBar
                {...experience}
                fallbackHref="https://evil.test"
            />
        );

        expect(container).toBeEmptyDOMElement();
    });
});
