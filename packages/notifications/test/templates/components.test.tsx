/**
 * Email Template Components Test Suite
 *
 * Tests for shared email template components including:
 * - Button: CTA button with primary/secondary variants
 * - Heading: Section heading with consistent styling
 * - InfoRow: Key-value pair display for receipts
 * - EmailLayout: Shared layout with header, footer, and optional unsubscribe
 *
 * @module test/templates/components.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '../../src/templates/components/button';
import { Heading } from '../../src/templates/components/heading';
import { InfoRow } from '../../src/templates/components/info-row';
import { EmailLayout } from '../../src/templates/components/layout';

describe('Email Template Components', () => {
    describe('Button', () => {
        it('should render without errors', () => {
            // Arrange & Act
            const render = () =>
                renderToStaticMarkup(Button({ href: 'https://hospeda.com.ar', children: 'Click' }));

            // Assert
            expect(render).not.toThrow();
        });

        it('should render button text as children', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                Button({ href: 'https://hospeda.com.ar', children: 'Ir al panel' })
            );

            // Assert
            expect(html).toContain('Ir al panel');
        });

        it('should include the href link', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                Button({ href: 'https://hospeda.com.ar/dashboard', children: 'Dashboard' })
            );

            // Assert
            expect(html).toContain('https://hospeda.com.ar/dashboard');
        });

        it('should render primary variant with blue background by default', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                Button({ href: 'https://hospeda.com.ar', children: 'Primary' })
            );

            // Assert
            expect(html).toContain('#3b82f6');
            expect(html).toContain('#ffffff');
        });

        it('should render primary variant explicitly', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                Button({ href: 'https://hospeda.com.ar', children: 'Primary', variant: 'primary' })
            );

            // Assert
            expect(html).toContain('#3b82f6');
        });

        it('should render secondary variant with transparent background and border', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                Button({
                    href: 'https://hospeda.com.ar',
                    children: 'Secondary',
                    variant: 'secondary'
                })
            );

            // Assert
            expect(html).toContain('transparent');
            expect(html).toContain('#3b82f6');
        });

        it('should include base styling properties', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                Button({ href: 'https://hospeda.com.ar', children: 'Styled' })
            );

            // Assert
            expect(html).toContain('border-radius:6px');
            expect(html).toContain('font-size:16px');
            expect(html).toContain('text-decoration:none');
        });
    });

    describe('Heading', () => {
        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(Heading({ children: 'Test Heading' }));

            // Assert
            expect(render).not.toThrow();
        });

        it('should render heading text as children', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(Heading({ children: 'Confirmación de pago' }));

            // Assert
            expect(html).toContain('Confirmación de pago');
        });

        it('should apply dark text color styling', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(Heading({ children: 'Title' }));

            // Assert
            expect(html).toContain('#1e293b');
        });

        it('should apply heading font size', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(Heading({ children: 'Title' }));

            // Assert
            expect(html).toContain('font-size:24px');
        });

        it('should apply bold font weight', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(Heading({ children: 'Title' }));

            // Assert
            expect(html).toContain('font-weight:700');
        });
    });

    describe('InfoRow', () => {
        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(InfoRow({ label: 'Plan', value: 'Pro' }));

            // Assert
            expect(render).not.toThrow();
        });

        it('should render label text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(InfoRow({ label: 'Monto', value: '$1500' }));

            // Assert
            expect(html).toContain('Monto');
        });

        it('should render value text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(InfoRow({ label: 'Monto', value: '$1500' }));

            // Assert
            expect(html).toContain('$1500');
        });

        it('should apply gray color to label', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(InfoRow({ label: 'Plan', value: 'Pro' }));

            // Assert
            expect(html).toContain('#64748b');
        });

        it('should apply dark color and bold weight to value', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(InfoRow({ label: 'Plan', value: 'Pro' }));

            // Assert
            expect(html).toContain('#1e293b');
            expect(html).toContain('font-weight:600');
        });

        it('should render both label and value in separate columns', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(InfoRow({ label: 'Período', value: 'Mensual' }));

            // Assert
            expect(html).toContain('Período');
            expect(html).toContain('Mensual');
            expect(html).toContain('40%');
            expect(html).toContain('60%');
        });
    });

    describe('EmailLayout', () => {
        it('should render without errors', () => {
            // Arrange & Act
            const render = () =>
                renderToStaticMarkup(
                    EmailLayout({
                        previewText: 'Preview text',
                        children: 'Content'
                    })
                );

            // Assert
            expect(render).not.toThrow();
        });

        it('should include preview text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                EmailLayout({
                    previewText: 'Tu pago fue procesado',
                    children: 'Body content'
                })
            );

            // Assert
            expect(html).toContain('Tu pago fue procesado');
        });

        it('should render children content', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                EmailLayout({
                    previewText: 'Preview',
                    children: 'Email body content here'
                })
            );

            // Assert
            expect(html).toContain('Email body content here');
        });

        it('should include Hospeda branding in header', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                EmailLayout({
                    previewText: 'Preview',
                    children: 'Content'
                })
            );

            // Assert
            expect(html).toContain('Hospeda');
            expect(html).toContain('Turismo en el Litoral');
        });

        it('should include footer text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                EmailLayout({
                    previewText: 'Preview',
                    children: 'Content'
                })
            );

            // Assert
            expect(html).toContain('Hospeda - Turismo en el Litoral');
            expect(html).toContain('Concepción del Uruguay');
        });

        it('should set HTML lang attribute to Spanish', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                EmailLayout({
                    previewText: 'Preview',
                    children: 'Content'
                })
            );

            // Assert
            expect(html).toContain('lang="es"');
        });

        it('should apply dark header background color', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                EmailLayout({
                    previewText: 'Preview',
                    children: 'Content'
                })
            );

            // Assert
            expect(html).toContain('#1e293b');
        });

        it('should not show unsubscribe link by default', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                EmailLayout({
                    previewText: 'Preview',
                    children: 'Content'
                })
            );

            // Assert
            expect(html).not.toContain('Administrar preferencias de notificaciones');
            expect(html).not.toContain('unsubscribe_url');
        });

        it('should show unsubscribe link when showUnsubscribe is true', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                EmailLayout({
                    previewText: 'Preview',
                    children: 'Content',
                    showUnsubscribe: true
                })
            );

            // Assert
            expect(html).toContain('Administrar preferencias de notificaciones');
            expect(html).toContain('unsubscribe_url');
        });

        it('should not show unsubscribe link when showUnsubscribe is false', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                EmailLayout({
                    previewText: 'Preview',
                    children: 'Content',
                    showUnsubscribe: false
                })
            );

            // Assert
            expect(html).not.toContain('Administrar preferencias de notificaciones');
        });

        it('should apply light background to body', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                EmailLayout({
                    previewText: 'Preview',
                    children: 'Content'
                })
            );

            // Assert
            expect(html).toContain('#f6f9fc');
        });

        it('should set max-width on container', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                EmailLayout({
                    previewText: 'Preview',
                    children: 'Content'
                })
            );

            // Assert
            expect(html).toContain('max-width:600px');
        });
    });
});
