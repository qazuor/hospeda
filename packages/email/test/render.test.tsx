import { Html, Text } from '@react-email/components';
import { describe, expect, it } from 'vitest';
import { renderEmailBodies } from '../src/render.js';

describe('renderEmailBodies', () => {
    it('renders the HTML document and the plain-text alternative from one element', async () => {
        // Arrange
        const react = (
            <Html lang="es">
                <Text>Hola desde Hospeda</Text>
            </Html>
        );

        // Act
        const { html, text } = await renderEmailBodies({ react });

        // Assert
        expect(html).toContain('lang="es"');
        expect(html).toContain('Hola desde Hospeda');
        expect(text).toContain('Hola desde Hospeda');
        expect(text).not.toContain('<');
    });
});
