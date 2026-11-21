import { render } from '@react-email/render';
import { describe, expect, it } from 'vitest';
import { ResetPasswordTemplate } from '../../src/templates/reset-password.js';

/**
 * Unit tests for ResetPasswordTemplate email template component.
 */
describe('ResetPasswordTemplate', () => {
    const defaultProps = {
        name: 'María García',
        resetUrl: 'https://hospeda.com.ar/reset-password?token=xyz789'
    } as const;

    it('should render greeting with user name', async () => {
        // Arrange & Act
        const html = await render(<ResetPasswordTemplate {...defaultProps} />);

        // Assert
        // React inserts <!-- --> comment nodes between interpolated values
        expect(html).toMatch(/Hola\s*(?:<!--\s*-->)?\s*María García\s*(?:<!--\s*-->)?\s*,/);
    });

    it('should render the reset password heading', async () => {
        // Arrange & Act
        const html = await render(<ResetPasswordTemplate {...defaultProps} />);

        // Assert
        expect(html).toContain('Restablece tu contraseña');
    });

    it('should render the request description text', async () => {
        // Arrange & Act
        const html = await render(<ResetPasswordTemplate {...defaultProps} />);

        // Assert
        expect(html).toContain(
            'Recibimos una solicitud para restablecer la contraseña de tu cuenta en Hospeda.'
        );
    });

    it('should render reset button with correct URL', async () => {
        // Arrange & Act
        const html = await render(<ResetPasswordTemplate {...defaultProps} />);

        // Assert
        expect(html).toContain('Restablecer contraseña');
        expect(html).toContain(defaultProps.resetUrl);
        expect(html).toContain('href="https://hospeda.com.ar/reset-password?token=xyz789"');
    });

    it('should render expiration notice with security reason', async () => {
        // Arrange & Act
        const html = await render(<ResetPasswordTemplate {...defaultProps} />);

        // Assert
        expect(html).toContain(
            'Este enlace expira en 1 hora por motivos de seguridad. Si necesitas más tiempo, puedes solicitar un nuevo enlace de restablecimiento.'
        );
    });

    it('should render CTA instruction text', async () => {
        // Arrange & Act
        const html = await render(<ResetPasswordTemplate {...defaultProps} />);

        // Assert
        expect(html).toContain('Haz clic en el botón de abajo para crear una nueva contraseña:');
    });

    it('should render bold security question and explanation', async () => {
        // Arrange & Act
        const html = await render(<ResetPasswordTemplate {...defaultProps} />);

        // Assert
        expect(html).toContain('¿No solicitaste esto?');
        expect(html).toContain(
            'Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura'
        );
        expect(html).toContain('Tu contraseña actual seguirá siendo válida');
    });

    it('should render fallback URL text', async () => {
        // Arrange & Act
        const html = await render(<ResetPasswordTemplate {...defaultProps} />);

        // Assert
        expect(html).toContain('O copia y pega este enlace en tu navegador:');
    });

    it('should render inside EmailLayout with footerLink none (HOS-2519 AC-1.3)', async () => {
        // Arrange & Act
        const html = await render(<ResetPasswordTemplate {...defaultProps} />);

        // Assert
        expect(html.match(/<html[^>]*lang="es"/g)).toHaveLength(1);
        expect(html).toContain('alt="Hospeda"');
        expect(html).toContain('Hospeda - Turismo en el Litoral');
        expect(html).not.toContain('Administrar preferencias de notificaciones');
    });

    it('should not crash when name is empty string', async () => {
        // Arrange
        const props = { name: '', resetUrl: defaultProps.resetUrl };

        // Act
        const html = await render(<ResetPasswordTemplate {...props} />);

        // Assert
        // React inserts <!-- --> comment nodes between interpolated values
        expect(html).toMatch(/Hola\s*(?:<!--\s*-->)?\s*,/);
    });

    describe('transactional mail signals (HOS-1965)', () => {
        const url = 'https://hospeda.com.ar/reset-password?token=xyz789';

        it('should not render the unsubscribe footer', async () => {
            // Arrange & Act
            const html = await render(
                <ResetPasswordTemplate
                    name="Juan"
                    resetUrl={url}
                />
            );

            // Assert
            expect(html).not.toContain('darte de baja');
            expect(html).not.toContain('/unsubscribe');
        });

        it('should greet with a generic "Hola," when there is no name', async () => {
            // Arrange & Act
            const html = await render(<ResetPasswordTemplate resetUrl={url} />);

            // Assert
            expect(html).toMatch(/Hola,/);
            expect(html).not.toMatch(/Hola\s+(?:<!--\s*-->)?\s*undefined/);
        });

        it('should never greet with the email address', async () => {
            // Arrange & Act
            const html = await render(
                <ResetPasswordTemplate
                    name="a@b.com"
                    resetUrl={url}
                />
            );

            // Assert
            expect(html).not.toContain('a@b.com');
            expect(html).toMatch(/Hola,/);
        });

        it('should keep the raw URL out of any link text (only the button is an anchor)', async () => {
            // Arrange & Act
            const html = await render(
                <ResetPasswordTemplate
                    name="Juan"
                    resetUrl={url}
                />
            );

            // Assert
            // The layout footer adds its own site-home link (HOS-2519), marked
            // data-layout-link="home"; it is the only anchor excluded.
            const anchors = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) ?? [];
            const layoutAnchors = anchors.filter((anchor) =>
                anchor.includes('data-layout-link="home"')
            );
            const bodyAnchors = anchors.filter((anchor) => !layoutAnchors.includes(anchor));
            expect(layoutAnchors).toHaveLength(1);
            expect(bodyAnchors).toHaveLength(1);
            expect(bodyAnchors[0]).toContain(`href="${url}"`);
            expect(bodyAnchors[0]).not.toContain(`>${url}`);
            expect(html).toContain(url);
        });
    });
    it('should render a readable plain-text alternative carrying the greeting and the reset link (HOS-2107)', async () => {
        // Arrange & Act
        const text = await render(<ResetPasswordTemplate {...defaultProps} />, { plainText: true });

        // Assert
        expect(text).not.toContain('<');
        expect(text).toContain('María García');
        expect(text).toContain(defaultProps.resetUrl);
    });
});
