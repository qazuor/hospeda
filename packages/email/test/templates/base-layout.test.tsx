import { render } from '@react-email/render';
import { describe, expect, it } from 'vitest';
import { BaseLayout } from '../../src/templates/base-layout.js';

/**
 * Unit tests for BaseLayout email template component.
 */
describe('BaseLayout', () => {
    it('should render children correctly', async () => {
        // Arrange
        const childText = 'Contenido de prueba del email';

        // Act
        const html = await render(
            <BaseLayout>
                <p>{childText}</p>
            </BaseLayout>
        );

        // Assert
        expect(html).toContain(childText);
    });

    it('should include unsubscribe text by default (showUnsubscribe=true)', async () => {
        // Arrange & Act
        const html = await render(
            <BaseLayout>
                <p>Contenido</p>
            </BaseLayout>
        );

        // Assert
        expect(html).toContain('Si no deseas recibir estos correos, puedes');
        expect(html).toContain('darte de baja aquí');
        expect(html).toContain('https://hospeda.com.ar/unsubscribe');
    });

    it('should NOT include unsubscribe text when showUnsubscribe=false', async () => {
        // Arrange & Act
        const html = await render(
            <BaseLayout showUnsubscribe={false}>
                <p>Contenido</p>
            </BaseLayout>
        );

        // Assert
        expect(html).not.toContain('Si no deseas recibir estos correos, puedes');
        expect(html).not.toContain('darte de baja aquí');
    });

    it('should contain Hospeda in the header', async () => {
        // Arrange & Act
        const html = await render(
            <BaseLayout>
                <p>Contenido</p>
            </BaseLayout>
        );

        // Assert
        expect(html).toContain('Hospeda');
    });

    it('should contain footer text with location description', async () => {
        // Arrange & Act
        const html = await render(
            <BaseLayout>
                <p>Contenido</p>
            </BaseLayout>
        );

        // Assert
        expect(html).toContain(
            'Hospeda - Alojamientos turísticos en Concepción del Uruguay y el Litoral'
        );
    });
});
