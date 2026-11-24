import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AnalyticsEventSchemas } from '@repo/analytics';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ListingContactBar } from '@/components/listing/contact/ListingContactBar.client';
import { markListingContactPanelReady } from '@/components/listing/contact/listing-contact-readiness';
import { onListingContactPanelOpen } from '@/lib/listing-contact/listing-contact-events';

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/analytics/umami-client', () => ({ trackEvent }));

const props = {
    listingId: 'acc-1',
    vertical: 'accommodation',
    locale: 'es',
    hasWhatsapp: true,
    price: {
        amount: 155500,
        currency: 'ARS',
        unitLabelKey: 'accommodations.detail.listingContact.units.perNight',
        onRequest: false
    },
    panelId: 'listing-panel',
    primaryLabelKey: 'accommodations.detail.listingContact.bar.inquire'
} as const;

describe('ListingContactBar', () => {
    it('server renders ARS for an accommodation with an amount but no currency', () => {
        const html = renderToString(
            <ListingContactBar
                {...props}
                locale="en"
                price={{ ...props.price, currency: null }}
            />
        );

        expect(html).toContain('ARS');
        expect(html).toContain('155,500');
    });

    it('structures the price as a muted prefix, a prominent amount and a muted unit', () => {
        const { container } = render(<ListingContactBar {...props} />);
        const price = container.querySelector('p');

        expect(price).not.toBeNull();
        if (!price) throw new Error('Missing price');
        expect(within(price).getByText('Desde')).toBeInTheDocument();
        expect(price.querySelector('strong')?.textContent).toMatch(/155\.500/);
        expect(within(price).getByText('/noche')).toBeInTheDocument();
    });

    it('omits the prefix when there is no unit (experience without price unit)', () => {
        const { container } = render(
            <ListingContactBar
                {...props}
                vertical="experience"
                price={{ ...props.price, unitLabelKey: null }}
            />
        );

        expect(container.querySelector('p strong')).not.toBeNull();
        expect(screen.queryByText('Desde')).not.toBeInTheDocument();
    });

    it('renders the dock WhatsApp glyph in the channel foreground color', () => {
        render(<ListingContactBar {...props} />);

        expect(screen.getByRole('link', { name: 'WhatsApp' }).querySelector('svg')).toHaveAttribute(
            'fill',
            'currentColor'
        );
    });

    it('server renders the formatted nightly price and portals a measurable item into the contact slot', () => {
        const html = renderToString(<ListingContactBar {...props} />);
        const { container } = render(
            <div data-mobile-dock>
                <div data-mobile-dock-slot="contact" />
                <ListingContactBar {...props} />
            </div>
        );

        expect(html).toContain('155.500');
        const item = container.querySelector<HTMLElement>(
            '[data-mobile-dock-slot="contact"] [data-dock-item]'
        );
        expect(item).not.toBeNull();
        if (!item) throw new Error('Missing dock item');
        expect(within(item).getByText('/noche')).toBeInTheDocument();
        expect(within(item).getByRole('link', { name: 'WhatsApp' })).toBeInTheDocument();
    });

    it.each([
        { amount: null, onRequest: false },
        { amount: 155500, onRequest: true }
    ])('shows a quote CTA for $amount / onRequest=$onRequest', (price) => {
        render(
            <ListingContactBar
                {...props}
                price={{ ...props.price, ...price }}
                hasWhatsapp={false}
            />
        );

        expect(screen.getByText('Consultar precio')).toBeInTheDocument();
        expect(screen.queryByText(/155\.500|\/noche/)).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
    });

    it.each([
        ['Consultar', 'form_open', undefined],
        ['WhatsApp', 'whatsapp', 'whatsapp']
    ] as const)('opens and tracks %s', (name, channel, focus) => {
        const receive = vi.fn();
        const unsubscribe = onListingContactPanelOpen(receive);
        const clearReady = markListingContactPanelReady({ panelId: props.panelId });

        try {
            render(<ListingContactBar {...props} />);
            fireEvent.click(screen.getByRole('link', { name }));

            expect(receive).toHaveBeenCalledWith({ origin: 'bar', focus });
            expect(trackEvent).toHaveBeenLastCalledWith('listing_contact_clicked', {
                listing_id: props.listingId,
                vertical: 'accommodation',
                channel,
                origin: 'bar',
                locale: 'es'
            });
            expect(
                AnalyticsEventSchemas.listing_contact_clicked.safeParse(
                    trackEvent.mock.lastCall?.[1]
                ).success
            ).toBe(true);
        } finally {
            unsubscribe();
            act(clearReady);
        }
    });

    it('rejects invalid island props and only displays the bar inside the mobile dock', () => {
        const css = readFileSync(
            resolve(
                __dirname,
                '../../../src/components/listing/contact/ListingContactBar.module.css'
            ),
            'utf8'
        );
        const html = renderToString(
            <ListingContactBar
                {...props}
                price={{ ...props.price, currency: 'bad currency' }}
            />
        );

        expect(html).toBe('');
        expect(css).toMatch(/\.bar\s*\{\s*display:\s*none/);
        expect(css).toMatch(
            /@media \(max-width: 767px\)\s*\{\s*:global\(\[data-mobile-dock\]\) \.bar\s*\{[^}]*display:\s*flex;\s*position:\s*static/
        );
    });
});
