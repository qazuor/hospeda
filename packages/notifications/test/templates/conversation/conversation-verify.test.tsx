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

describe('ConversationVerify inquiry summary (HOS-2568)', () => {
    const baseProps: ConversationVerifyProps = {
        accommodationName: 'Hostería del Río',
        verificationUrl: 'https://hospeda.com.ar/verify?token=abc123',
        guestName: 'Laura Gómez',
        locale: 'es'
    };

    it('shows listing, name, masked phone and an excerpt of the message', () => {
        const html = renderToStaticMarkup(
            ConversationVerify({
                ...baseProps,
                guestPhone: '+54 3442 123456',
                message: '¿Hay lugar en enero?'
            })
        );

        expect(html).toContain('Resumen de tu consulta');
        expect(html).toContain('Hostería del Río');
        expect(html).toContain('Laura Gómez');
        expect(html).toContain('*** 456');
        expect(html).not.toContain('123456');
        expect(html).toContain('¿Hay lugar en enero?');
    });

    it('never renders the full message: long text is cut with an ellipsis', () => {
        const long = `${'palabra '.repeat(60)}FINAL-SECRETO`;
        const html = renderToStaticMarkup(ConversationVerify({ ...baseProps, message: long }));

        expect(html).not.toContain('FINAL-SECRETO');
        expect(html).toContain('…');
    });

    it('neutralizes links, emails and phone numbers in the message', () => {
        const html = renderToStaticMarkup(
            ConversationVerify({
                ...baseProps,
                message: 'Mirá https://evil.test/x escribime a ana@evil.test o al 3442-123456'
            })
        );

        expect(html).not.toContain('evil.test');
        expect(html).not.toContain('3442-123456');
        expect(html).toContain('[enlace]');
        expect(html).toContain('[email]');
        expect(html).toContain('[teléfono]');
    });

    it('escapes markup in the message', () => {
        const html = renderToStaticMarkup(
            ConversationVerify({ ...baseProps, message: '<script>alert(1)</script> hola' })
        );

        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('neutralizes links typed as the guest name', () => {
        const html = renderToStaticMarkup(
            ConversationVerify({ ...baseProps, guestName: 'Visitá http://evil.test ya' })
        );

        expect(html).not.toContain('evil.test');
    });

    it('omits the summary when there is no message', () => {
        const html = renderToStaticMarkup(ConversationVerify(baseProps));

        expect(html).not.toContain('Resumen de tu consulta');
    });
});
