/**
 * @file HostContactButton.test.tsx
 * @description HOS-2530 / AC-2.5: the host section's «Consultar» opens the contact panel
 * and degrades to the `#contact` anchor while the panel is not hydrated.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HostContactButton } from '@/components/accommodation/HostContactButton.client';
import { markListingContactPanelReady } from '@/components/listing/contact/listing-contact-readiness';
import { onListingContactPanelOpen } from '@/lib/listing-contact/listing-contact-events';

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/analytics/umami-client', () => ({ trackEvent }));

const props = { listingId: 'acc-1', locale: 'es', panelId: 'host-panel' } as const;

describe('HostContactButton', () => {
    it('points at the in-page contact section before the panel is ready', () => {
        render(<HostContactButton {...props} />);

        expect(screen.getByRole('link', { name: 'Consultar' })).toHaveAttribute('href', '#contact');
    });

    it('opens the contact panel and tracks the click once the panel is ready', () => {
        const receive = vi.fn();
        const unsubscribe = onListingContactPanelOpen(receive);
        const clearReady = markListingContactPanelReady({ panelId: props.panelId });
        try {
            render(<HostContactButton {...props} />);
            fireEvent.click(screen.getByRole('link', { name: 'Consultar' }));

            expect(receive).toHaveBeenCalledWith({ origin: 'contact_block', focus: 'form' });
            expect(trackEvent).toHaveBeenLastCalledWith(
                'listing_contact_clicked',
                expect.objectContaining({ listing_id: 'acc-1', channel: 'form_open' })
            );
        } finally {
            unsubscribe();
            clearReady();
        }
    });
});
