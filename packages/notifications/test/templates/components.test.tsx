/**
 * Email Template Components Test Suite
 *
 * Tests for shared email template components including:
 * - Heading: Section heading with consistent styling
 * - InfoRow: Key-value pair display for receipts
 *
 * Button and Callout moved to `@repo/email` (HOS-2565) and are tested in
 * `packages/email/test/components/`.
 *
 * EmailLayout moved to `@repo/email` (HOS-2519) and is tested there
 * (`packages/email/test/templates/email-layout.test.tsx`).
 *
 * @module test/templates/components.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Heading } from '../../src/templates/components/heading';
import { InfoRow } from '../../src/templates/components/info-row';

describe('Email Template Components', () => {
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

        it('should apply a dark slate color to the label (readable on callout tints)', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(InfoRow({ label: 'Plan', value: 'Pro' }));

            // Assert
            expect(html).toContain('#475569');
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

        it('should not tag a regular value as raw', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(InfoRow({ label: 'Plan', value: 'Pro' }));

            // Assert
            expect(html).not.toContain('data-raw-value');
            expect(html).not.toContain('monospace');
        });

        it('should tag a raw value for the Spanish-only check and show it monospace (HOS-2565 §7.2)', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(
                InfoRow({ label: 'Obtuvo', value: '{"status":"pending"}', raw: true })
            );

            // Assert
            expect(html).toMatch(
                /data-raw-value="true"[^>]*>\{&quot;status&quot;:&quot;pending&quot;\}</
            );
            expect(html).toContain('monospace');
            expect(html).toContain('font-weight:400');
        });
    });
});
