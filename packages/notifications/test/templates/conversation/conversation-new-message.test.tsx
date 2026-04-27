/**
 * ConversationNewMessage Email Template Tests
 *
 * @module test/templates/conversation/conversation-new-message.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    ConversationNewMessage,
    type ConversationNewMessageProps
} from '../../../src/templates/conversation/conversation-new-message';

describe('ConversationNewMessage', () => {
    const threeMessages = [
        { excerpt: 'Mensaje uno de prueba sobre disponibilidad.', timestamp: '10:30' },
        { excerpt: 'Mensaje dos sobre el precio por noche.', timestamp: '10:32' },
        { excerpt: 'Mensaje tres consultando sobre desayuno incluido.', timestamp: '10:35' }
    ];

    const validProps: ConversationNewMessageProps = {
        accommodationName: 'Apart Hotel Las Palmas',
        guestIdentity: 'marcos@example.com',
        messages: threeMessages,
        ctaUrl: 'https://hospeda.com.ar/es/conversaciones/thread-1',
        locale: 'es'
    };

    it('should render without errors', () => {
        // Arrange & Act
        const render = () => renderToStaticMarkup(ConversationNewMessage(validProps));

        // Assert
        expect(render).not.toThrow();
    });

    it('should include the CTA URL in the rendered HTML', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationNewMessage(validProps));

        // Assert
        expect(html).toContain('https://hospeda.com.ar/es/conversaciones/thread-1');
    });

    it('should include the sender identity and accommodation name', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationNewMessage(validProps));

        // Assert
        expect(html).toContain('marcos@example.com');
        expect(html).toContain('Apart Hotel Las Palmas');
    });

    it('should render all 3 messages when exactly 3 are provided', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationNewMessage(validProps));

        // Assert
        expect(html).toContain('disponibilidad');
        expect(html).toContain('precio por noche');
        expect(html).toContain('desayuno incluido');
    });

    it('should render only the first 3 messages when 5 are provided', () => {
        // Arrange
        const fiveMessages = [
            { excerpt: 'Mensaje A primer excerpt visible.', timestamp: '10:00' },
            { excerpt: 'Mensaje B segundo excerpt visible.', timestamp: '10:01' },
            { excerpt: 'Mensaje C tercero excerpt visible.', timestamp: '10:02' },
            { excerpt: 'Mensaje D cuarto NO debe aparecer.', timestamp: '10:03' },
            { excerpt: 'Mensaje E quinto NO debe aparecer.', timestamp: '10:04' }
        ];
        const props: ConversationNewMessageProps = { ...validProps, messages: fiveMessages };

        // Act
        const html = renderToStaticMarkup(ConversationNewMessage(props));

        // Assert — first 3 appear
        expect(html).toContain('primer excerpt visible');
        expect(html).toContain('segundo excerpt visible');
        expect(html).toContain('tercero excerpt visible');
        // Last 2 must NOT appear
        expect(html).not.toContain('cuarto NO debe aparecer');
        expect(html).not.toContain('quinto NO debe aparecer');
    });

    it('should truncate excerpts longer than 200 characters', () => {
        // Arrange
        const longText = 'A'.repeat(250);
        const props: ConversationNewMessageProps = {
            ...validProps,
            messages: [{ excerpt: longText, timestamp: '11:00' }]
        };

        // Act
        const html = renderToStaticMarkup(ConversationNewMessage(props));

        // Assert — truncated with ellipsis, full text absent
        expect(html).toContain('…');
        expect(html).not.toContain('A'.repeat(201));
    });

    it('should NOT truncate excerpts of exactly 200 characters', () => {
        // Arrange
        const exactText = 'B'.repeat(200);
        const props: ConversationNewMessageProps = {
            ...validProps,
            messages: [{ excerpt: exactText, timestamp: '11:00' }]
        };

        // Act
        const html = renderToStaticMarkup(ConversationNewMessage(props));

        // Assert — no ellipsis for 200-char excerpt
        expect(html).not.toContain('…');
    });
});
