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

    it('should use BaseLayout with Hospeda branding', async () => {
        // Arrange & Act
        const html = await render(<ResetPasswordTemplate {...defaultProps} />);

        // Assert
        expect(html).toContain('Hospeda');
        expect(html).toContain(
            'Hospeda - Alojamientos turísticos en Concepción del Uruguay y el Litoral'
        );
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
});
