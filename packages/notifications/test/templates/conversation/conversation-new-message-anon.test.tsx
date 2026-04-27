/**
 * ConversationNewMessageAnon Email Template Tests
 *
 * @module test/templates/conversation/conversation-new-message-anon.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    ConversationNewMessageAnon,
    type ConversationNewMessageAnonProps
} from '../../../src/templates/conversation/conversation-new-message-anon';

describe('ConversationNewMessageAnon', () => {
    const validProps: ConversationNewMessageAnonProps = {
        accommodationName: 'Cabañas del Litoral',
        guestIdentity: 'Sofia Fernández',
        messages: [
            {
                excerpt: 'Hola, consulto por disponibilidad para el finde largo.',
                timestamp: '9:00'
            },
            { excerpt: 'También me interesa saber si tienen estacionamiento.', timestamp: '9:05' }
        ],
        ctaUrl: 'https://hospeda.com.ar/guest/messages/token-xyz789',
        locale: 'es'
    };

    it('should render without errors', () => {
        // Arrange & Act
        const render = () => renderToStaticMarkup(ConversationNewMessageAnon(validProps));

        // Assert
        expect(render).not.toThrow();
    });

    it('should include the token-based CTA URL', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationNewMessageAnon(validProps));

        // Assert
        expect(html).toContain('https://hospeda.com.ar/guest/messages/token-xyz789');
    });

    it('should include accommodation name and sender identity', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationNewMessageAnon(validProps));

        // Assert
        expect(html).toContain('Cabañas del Litoral');
        expect(html).toContain('Sofia Fernández');
    });

    it('should include the account-creation suggestion section', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationNewMessageAnon(validProps));

        // Assert
        expect(html).toContain('cuenta gratuita');
    });

    it('should render only the first 3 messages when 5 are provided', () => {
        // Arrange
        const fiveMessages = [
            { excerpt: 'Primero visible.', timestamp: '8:00' },
            { excerpt: 'Segundo visible.', timestamp: '8:01' },
            { excerpt: 'Tercero visible.', timestamp: '8:02' },
            { excerpt: 'Cuarto NO visible.', timestamp: '8:03' },
            { excerpt: 'Quinto NO visible.', timestamp: '8:04' }
        ];
        const props: ConversationNewMessageAnonProps = { ...validProps, messages: fiveMessages };

        // Act
        const html = renderToStaticMarkup(ConversationNewMessageAnon(props));

        // Assert
        expect(html).toContain('Primero visible');
        expect(html).toContain('Segundo visible');
        expect(html).toContain('Tercero visible');
        expect(html).not.toContain('Cuarto NO visible');
        expect(html).not.toContain('Quinto NO visible');
    });

    it('should truncate excerpts longer than 200 characters', () => {
        // Arrange
        const longText = 'C'.repeat(250);
        const props: ConversationNewMessageAnonProps = {
            ...validProps,
            messages: [{ excerpt: longText, timestamp: '10:00' }]
        };

        // Act
        const html = renderToStaticMarkup(ConversationNewMessageAnon(props));

        // Assert
        expect(html).toContain('…');
        expect(html).not.toContain('C'.repeat(201));
    });
});
