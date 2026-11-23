import { Body, Html, Link, Text } from '@react-email/components';
import { afterEach, describe, expect, it } from 'vitest';
import { configureEmailAssets, resetEmailAssets } from '../src/email-assets.js';
import { renderEmailBodies } from '../src/render.js';

const TEST_ATTRIBUTION = {
    medium: 'transactional',
    templateKey: 'test.render',
    includePixel: false
} as const;

describe('renderEmailBodies', () => {
    it('renders the HTML document and the plain-text alternative from one element', async () => {
        // Arrange
        const react = (
            <Html lang="es">
                <Text>Hola desde Hospeda</Text>
            </Html>
        );

        // Act
        const { html, text } = await renderEmailBodies({
            attribution: TEST_ATTRIBUTION,
            react
        });

        // Assert
        expect(html).toContain('lang="es"');
        expect(html).toContain('Hola desde Hospeda');
        expect(text).toContain('Hola desde Hospeda');
        expect(text).not.toContain('<');
    });

    describe('attribution (HOS-2359)', () => {
        afterEach(() => {
            resetEmailAssets();
        });

        it('applies UTMs to HTML and text links and inserts the pixel in HTML only', async () => {
            // Arrange
            configureEmailAssets({
                siteUrl: 'https://hospeda.com.ar',
                pixelBaseUrl: 'https://pulso.hospeda.com.ar'
            });
            const react = (
                <Html lang="es">
                    <Body>
                        <Link href="https://hospeda.com.ar/es/alojamientos/">Ver</Link>
                    </Body>
                </Html>
            );

            // Act
            const { html, text } = await renderEmailBodies({
                react,
                attribution: {
                    medium: 'transactional',
                    templateKey: 'notification.payment_success',
                    includePixel: true
                }
            });

            // Assert
            expect(html).toContain(
                'href="https://hospeda.com.ar/es/alojamientos/?utm_source=email&amp;utm_medium=transactional&amp;utm_campaign=notification-payment-success&amp;utm_content=body-link"'
            );
            expect(html).toContain(
                '<img src="https://pulso.hospeda.com.ar/p/email-notification-payment-success"'
            );
            expect(text).toContain(
                'https://hospeda.com.ar/es/alojamientos/?utm_source=email&utm_medium=transactional&utm_campaign=notification-payment-success&utm_content=body-link'
            );
            expect(text).not.toContain('/p/email-');
        });
    });
});
