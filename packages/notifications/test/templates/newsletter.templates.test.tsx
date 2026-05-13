/**
 * Newsletter Email Templates Test Suite (SPEC-101)
 *
 * Validates that each newsletter template:
 * - Renders without errors
 * - Includes the required props in the output
 * - Renders Spanish copy
 * - Handles optional props (firstName, waChannelUrl, preheaderText) gracefully
 * - Toggles the test banner via isTest prop
 *
 * @module test/templates/newsletter.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    NewsletterCampaign,
    type NewsletterCampaignProps
} from '../../src/templates/newsletter/newsletter-campaign.js';
import {
    NewsletterVerifyEmail,
    type NewsletterVerifyEmailProps
} from '../../src/templates/newsletter/newsletter-verify-email.js';
import {
    NewsletterWelcomeEmail,
    type NewsletterWelcomeEmailProps
} from '../../src/templates/newsletter/newsletter-welcome-email.js';

describe('Newsletter Email Templates (SPEC-101)', () => {
    describe('NewsletterVerifyEmail', () => {
        const validProps: NewsletterVerifyEmailProps = {
            firstName: 'María',
            verifyUrl: 'https://hospeda.com.ar/api/v1/public/newsletter/verify?token=abc.123'
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(NewsletterVerifyEmail(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include personalized greeting when firstName is provided', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(NewsletterVerifyEmail(validProps));

            // Assert
            expect(html).toContain('Hola María');
        });

        it('should fall back to generic greeting when firstName is missing', () => {
            // Arrange
            const propsWithoutName: NewsletterVerifyEmailProps = {
                verifyUrl: validProps.verifyUrl
            };

            // Act
            const html = renderToStaticMarkup(NewsletterVerifyEmail(propsWithoutName));

            // Assert
            expect(html).toContain('Hola');
            expect(html).not.toContain('Hola María');
        });

        it('should render the verify URL in both the CTA and the fallback link', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(NewsletterVerifyEmail(validProps));

            // Assert — URL appears at least twice (button + plain-text fallback)
            const occurrences = html.split(validProps.verifyUrl).length - 1;
            expect(occurrences).toBeGreaterThanOrEqual(2);
        });

        it('should include the Spanish CTA label and ignore-note', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(NewsletterVerifyEmail(validProps));

            // Assert
            expect(html).toContain('Confirmar mi suscripción');
            expect(html).toContain('Si no fuiste vos');
            expect(html).toContain('No te suscribiremos sin tu confirmación');
        });

        it('should not show the test banner by default', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(NewsletterVerifyEmail(validProps));

            // Assert
            expect(html).not.toContain('[PRUEBA]');
        });

        it('should prefix the preview text and show a banner when isTest is true', () => {
            // Arrange
            const testProps: NewsletterVerifyEmailProps = { ...validProps, isTest: true };

            // Act
            const html = renderToStaticMarkup(NewsletterVerifyEmail(testProps));

            // Assert
            expect(html).toContain('[PRUEBA]');
            expect(html).toContain('envío de prueba');
        });
    });

    describe('NewsletterWelcomeEmail', () => {
        const validProps: NewsletterWelcomeEmailProps = {
            firstName: 'Diego',
            baseUrl: 'https://hospeda.com.ar'
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(NewsletterWelcomeEmail(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include personalized greeting and welcome heading', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(NewsletterWelcomeEmail(validProps));

            // Assert
            expect(html).toContain('Hola Diego');
            expect(html).toContain('ya estás suscripto');
        });

        it('should render the account-preferences CTA pointing at baseUrl', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(NewsletterWelcomeEmail(validProps));

            // Assert
            expect(html).toContain('https://hospeda.com.ar/es/mi-cuenta/newsletter');
            expect(html).toContain('Ver mis preferencias');
        });

        it('should NOT render the WhatsApp CTA when waChannelUrl is missing', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(NewsletterWelcomeEmail(validProps));

            // Assert
            expect(html).not.toContain('canal de WhatsApp');
            expect(html).not.toContain('Unirme al canal');
        });

        it('should render the WhatsApp CTA when waChannelUrl is provided', () => {
            // Arrange
            const propsWithWa: NewsletterWelcomeEmailProps = {
                ...validProps,
                waChannelUrl: 'https://whatsapp.com/channel/0029Va6S3oP'
            };

            // Act
            const html = renderToStaticMarkup(NewsletterWelcomeEmail(propsWithWa));

            // Assert
            expect(html).toContain('https://whatsapp.com/channel/0029Va6S3oP');
            expect(html).toContain('Unirme al canal de WhatsApp');
            expect(html).toContain('canal de WhatsApp');
        });

        it('should toggle the test banner when isTest is true', () => {
            // Arrange
            const testProps: NewsletterWelcomeEmailProps = { ...validProps, isTest: true };

            // Act
            const html = renderToStaticMarkup(NewsletterWelcomeEmail(testProps));

            // Assert
            expect(html).toContain('[PRUEBA]');
            expect(html).toContain('La suscripción no fue activada');
        });
    });

    describe('NewsletterCampaign', () => {
        const validProps: NewsletterCampaignProps = {
            subject: 'Novedades de febrero en el Litoral',
            bodyHtml:
                '<p style="margin:0 0 16px">Hola, esto es <strong>una novedad</strong> importante.</p>',
            unsubscribeUrl:
                'https://hospeda.com.ar/api/v1/public/newsletter/unsubscribe?token=xyz.789'
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(NewsletterCampaign(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should render the campaign subject as heading', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(NewsletterCampaign(validProps));

            // Assert
            expect(html).toContain('Novedades de febrero en el Litoral');
        });

        it('should inject the pre-rendered bodyHtml verbatim', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(NewsletterCampaign(validProps));

            // Assert — strong tag from bodyHtml must survive
            expect(html).toContain('<strong>una novedad</strong>');
            expect(html).toContain('importante');
        });

        it('should render the unsubscribe CTA with the stable HMAC URL', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(NewsletterCampaign(validProps));

            // Assert
            expect(html).toContain(validProps.unsubscribeUrl);
            expect(html).toContain('Darme de baja');
        });

        it('should use the subject as preview text when preheaderText is not provided', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(NewsletterCampaign(validProps));

            // Assert — preview text is the first occurrence inside the hidden Preview block
            expect(html).toContain(validProps.subject);
        });

        it('should use preheaderText for the preview text when provided', () => {
            // Arrange
            const propsWithPreheader: NewsletterCampaignProps = {
                ...validProps,
                preheaderText: 'Tu resumen mensual está acá'
            };

            // Act
            const html = renderToStaticMarkup(NewsletterCampaign(propsWithPreheader));

            // Assert
            expect(html).toContain('Tu resumen mensual está acá');
        });

        it('should prefix the subject with [PRUEBA] when isTest is true', () => {
            // Arrange
            const testProps: NewsletterCampaignProps = { ...validProps, isTest: true };

            // Act
            const html = renderToStaticMarkup(NewsletterCampaign(testProps));

            // Assert
            expect(html).toContain('[PRUEBA] Novedades de febrero en el Litoral');
            expect(html).toContain('No fue enviado a la lista real');
        });
    });
});
