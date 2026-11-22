import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ListingChannelsPanel } from '@/components/listing/contact/ListingChannelsPanel.client';
import { isListingContactPanelReady } from '@/components/listing/contact/listing-contact-readiness';
import { resetDialogHistoryForTests } from '@/lib/dialog-history';
import type { ListingChannel } from '@/lib/listing-contact/listing-channels';
import { openListingContactPanel } from '@/lib/listing-contact/listing-contact-events';

const channels: readonly ListingChannel[] = [
    { kind: 'phone', href: 'tel:+543447412233', text: '+54 3447 412233', external: false },
    { kind: 'email', href: 'mailto:hola@ejemplo.com', text: 'hola@ejemplo.com', external: false },
    { kind: 'website', href: 'https://ejemplo.com', text: 'ejemplo.com', external: true }
];

const base = {
    panelId: 'channels-panel',
    listingId: 'exp-1',
    vertical: 'experience',
    locale: 'es',
    channels
} as const;

afterEach(() => resetDialogHistoryForTests());

describe('ListingChannelsPanel', () => {
    it('stays closed until the contact bus asks for it, and announces readiness', () => {
        const { unmount } = render(<ListingChannelsPanel {...base} />);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(isListingContactPanelReady({ panelId: base.panelId })).toBe(true);
        unmount();
        expect(isListingContactPanelReady({ panelId: base.panelId })).toBe(false);
    });

    it('lists only the published channels as tracked native links, with no form and no WhatsApp', () => {
        render(<ListingChannelsPanel {...base} />);
        act(() => openListingContactPanel({ origin: 'bar' }));

        const dialog = within(screen.getByRole('dialog', { name: 'Contactar' }));
        const links = dialog.getAllByRole('link');

        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            'tel:+543447412233',
            'mailto:hola@ejemplo.com',
            'https://ejemplo.com'
        ]);
        expect(dialog.getByRole('link', { name: /Llamar/ })).toHaveAttribute(
            'data-contact-channel',
            'phone'
        );
        expect(dialog.getByRole('link', { name: /Web/ })).toHaveAttribute(
            'rel',
            'noopener noreferrer'
        );
        for (const link of links) {
            expect(link).toHaveAttribute('data-listing-id', 'exp-1');
            expect(link).toHaveAttribute('data-vertical', 'experience');
            expect(link).toHaveAttribute('data-contact-origin', 'panel');
        }
        expect(dialog.queryByText(/whatsapp/i)).not.toBeInTheDocument();
        expect(dialog.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('shows the experience price above the channels, and none for a venue', () => {
        const { unmount } = render(
            <ListingChannelsPanel
                {...base}
                price={{
                    amount: 15000,
                    currency: 'ARS',
                    unitLabelKey: 'accommodations.detail.listingContact.units.perPerson',
                    onRequest: false
                }}
            />
        );
        act(() => openListingContactPanel({ origin: 'bar' }));
        expect(screen.getByText(/15\.000/)).toBeInTheDocument();
        unmount();
        resetDialogHistoryForTests();

        render(
            <ListingChannelsPanel
                {...base}
                vertical="venue"
                channels={[
                    {
                        kind: 'social',
                        href: 'https://instagram.com/bar',
                        text: 'Instagram',
                        network: 'instagram',
                        external: true
                    }
                ]}
            />
        );
        act(() => openListingContactPanel({ origin: 'bar' }));
        const dialog = within(screen.getByRole('dialog'));
        expect(dialog.getByRole('link', { name: 'Instagram' })).toHaveAttribute(
            'data-contact-channel',
            'social'
        );
        expect(dialog.queryByText(/\$/)).not.toBeInTheDocument();
    });
});
