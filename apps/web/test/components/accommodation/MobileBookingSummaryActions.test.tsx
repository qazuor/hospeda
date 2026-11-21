import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MobileBookingSummaryActions } from '@/components/accommodation/MobileBookingSummaryActions.client';
import { markListingContactPanelReady } from '@/components/listing/contact/listing-contact-readiness';
import { onListingContactPanelOpen } from '@/lib/listing-contact/listing-contact-events';

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/analytics/umami-client', () => ({ trackEvent }));

const props = { listingId: 'acc-1', panelId: 'panel', locale: 'en' } as const;

describe('MobileBookingSummaryActions', () => {
    it('server-renders both actions as plain sidebar anchors', () => {
        const html = renderToString(
            <MobileBookingSummaryActions
                {...props}
                hasWhatsapp
            />
        );

        expect(html.match(/href="#contact"/g)).toHaveLength(2);
        expect(html).not.toContain('aria-haspopup');
    });

    it('provides the sidebar contact anchor and omits WhatsApp when unavailable', () => {
        render(
            <MobileBookingSummaryActions
                {...props}
                hasWhatsapp={false}
            />
        );

        expect(screen.getByRole('link')).toHaveAttribute('href', '#contact');
        expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
    });

    it.each([
        [/WhatsApp/i, 'whatsapp', 'whatsapp'],
        [/Inquire/i, 'form', 'form_open']
    ] as const)('opens the summary action %s and tracks it', (name, focus, channel) => {
        const receive = vi.fn();
        const unsubscribe = onListingContactPanelOpen(receive);
        const clearReady = markListingContactPanelReady({ panelId: props.panelId });

        try {
            render(
                <MobileBookingSummaryActions
                    {...props}
                    hasWhatsapp
                />
            );
            fireEvent.click(screen.getByRole('link', { name }));

            expect(receive).toHaveBeenCalledOnce();
            expect(receive).toHaveBeenCalledWith({ origin: 'summary', focus });
            expect(trackEvent).toHaveBeenLastCalledWith('listing_contact_clicked', {
                listing_id: 'acc-1',
                vertical: 'accommodation',
                locale: 'en',
                origin: 'summary',
                channel
            });
        } finally {
            unsubscribe();
            act(clearReady);
        }
    });
});
