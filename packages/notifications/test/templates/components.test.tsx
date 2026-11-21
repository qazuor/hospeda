/**
 * Email Template Components Test Suite
 *
 * Tests for shared email template components including:
 * - Button: CTA button with primary/secondary variants
 * - Heading: Section heading with consistent styling
 * - InfoRow: Key-value pair display for receipts
 *
 * EmailLayout moved to `@repo/email` (HOS-2519) and is tested there
 * (`packages/email/test/templates/email-layout.test.tsx`).
 *
 * @module test/templates/components.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '../../src/templates/components/button';
import { Heading } from '../../src/templates/components/heading';
import { InfoRow } from '../../src/templates/components/info-row';

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
});
