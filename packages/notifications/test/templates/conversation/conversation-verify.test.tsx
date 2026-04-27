/**
 * ConversationVerify Email Template Tests
 *
 * @module test/templates/conversation/conversation-verify.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    ConversationVerify,
    type ConversationVerifyProps
} from '../../../src/templates/conversation/conversation-verify';

describe('ConversationVerify', () => {
    const validProps: ConversationVerifyProps = {
        accommodationName: 'Hostería del Río',
        verificationUrl: 'https://hospeda.com.ar/verify?token=abc123',
        guestName: 'Laura Gómez',
        locale: 'es'
    };

    it('should render without errors', () => {
        // Arrange & Act
        const render = () => renderToStaticMarkup(ConversationVerify(validProps));

        // Assert
        expect(render).not.toThrow();
    });

    it('should include the verification URL in the rendered HTML', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationVerify(validProps));

        // Assert
        expect(html).toContain('https://hospeda.com.ar/verify?token=abc123');
    });

    it('should include the guest name and accommodation name', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationVerify(validProps));

        // Assert
        expect(html).toContain('Laura Gómez');
        expect(html).toContain('Hostería del Río');
    });

    it('should include the 24-hour expiry mention', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationVerify(validProps));

        // Assert
        expect(html).toContain('24');
    });

    it('should include the verify CTA text', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationVerify(validProps));

        // Assert
        expect(html).toContain('Verificar');
    });

    it('should render correctly with en locale', () => {
        // Arrange
        const props: ConversationVerifyProps = { ...validProps, locale: 'en' };

        // Act
        const render = () => renderToStaticMarkup(ConversationVerify(props));

        // Assert
        expect(render).not.toThrow();
    });
});
