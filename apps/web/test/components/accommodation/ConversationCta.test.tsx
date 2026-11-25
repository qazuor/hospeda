import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationCta } from '@/components/accommodation/ConversationCta.client';
import { HostContactButton } from '@/components/accommodation/HostContactButton.client';
import { MobileBookingSummaryActions } from '@/components/accommodation/MobileBookingSummaryActions.client';

const conversation = vi.hoisted(() => ({ conversationId: null as string | null }));
vi.mock('@/store/accommodation-conversation-store', () => ({
    useAccommodationConversation: () => conversation
}));

describe('listing conversation CTAs', () => {
    beforeEach(() => {
        conversation.conversationId = null;
    });

    it('server-renders an anonymous contact anchor in the price card', () => {
        const html = renderToString(
            <ConversationCta
                accommodationId="acc-1"
                locale="en"
            />
        );
        expect(html).toContain('href="#contact"');
        expect(html).toContain('Inquire');
        expect(html).toContain('btn-gradient--flat');
    });

    it('links the host CTA directly to the existing thread', () => {
        conversation.conversationId = 'thread-1';
        render(
            <HostContactButton
                listingId="acc-1"
                panelId="panel"
                locale="en"
            />
        );
        const link = screen.getByRole('link', { name: 'View conversation' });
        expect(link).toHaveAttribute('href', '/en/mi-cuenta/consultas/thread-1/');
        expect(link).not.toHaveAttribute('aria-haspopup');
    });

    it.each([
        'price',
        'summary'
    ] as const)('links the %s CTA directly to the existing thread', (surface) => {
        conversation.conversationId = 'thread-1';
        render(
            surface === 'price' ? (
                <ConversationCta
                    accommodationId="acc-1"
                    locale="en"
                />
            ) : (
                <MobileBookingSummaryActions
                    listingId="acc-1"
                    panelId="panel"
                    locale="en"
                    hasWhatsapp={false}
                />
            )
        );
        const link = screen.getByRole('link', { name: 'View conversation' });
        expect(link).toHaveAttribute('href', '/en/mi-cuenta/consultas/thread-1/');
        expect(link).not.toHaveAttribute('aria-haspopup');
        expect(link).toHaveClass('btn-gradient--flat');
    });
});
