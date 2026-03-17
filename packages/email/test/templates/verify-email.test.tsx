import { render } from '@react-email/render';
import { describe, expect, it } from 'vitest';
import { VerifyEmailTemplate } from '../../src/templates/verify-email.js';

/**
 * Unit tests for VerifyEmailTemplate email template component.
 */
describe('VerifyEmailTemplate', () => {
    const defaultProps = {
        name: 'Juan Pérez',
        verificationUrl: 'https://hospeda.com.ar/verify?token=abc123'
    } as const;

    it('should render greeting with user name', async () => {
        // Arrange & Act
        const html = await render(<VerifyEmailTemplate {...defaultProps} />);

        // Assert
        // React inserts <!-- --> comment nodes between interpolated values
        expect(html).toMatch(/Hola\s*(?:<!--\s*-->)?\s*Juan Pérez\s*(?:<!--\s*-->)?\s*,/);
    });

    it('should render the verification heading', async () => {
        // Arrange & Act
        const html = await render(<VerifyEmailTemplate {...defaultProps} />);

        // Assert
        expect(html).toContain('Verifica tu dirección de correo electrónico');
    });

    it('should render the registration thank you text', async () => {
        // Arrange & Act
        const html = await render(<VerifyEmailTemplate {...defaultProps} />);

        // Assert
        expect(html).toContain(
            'Gracias por registrarte en Hospeda. Para completar tu registro, necesitamos verificar tu dirección de correo electrónico.'
        );
    });

    it('should render the call-to-action instruction text', async () => {
        // Arrange & Act
        const html = await render(<VerifyEmailTemplate {...defaultProps} />);

        // Assert
        expect(html).toContain(
            'Haz clic en el botón de abajo para verificar tu correo electrónico:'
        );
    });

    it('should render verification button with correct URL', async () => {
        // Arrange & Act
        const html = await render(<VerifyEmailTemplate {...defaultProps} />);

        // Assert
        expect(html).toContain('Verificar correo electrónico');
        expect(html).toContain(defaultProps.verificationUrl);
    });

    it('should render expiration notice', async () => {
        // Arrange & Act
        const html = await render(<VerifyEmailTemplate {...defaultProps} />);

        // Assert
        expect(html).toContain('Este enlace expira en 24 horas');
    });

    it('should render security notice', async () => {
        // Arrange & Act
        const html = await render(<VerifyEmailTemplate {...defaultProps} />);

        // Assert
        expect(html).toContain(
            'Si no solicitaste esta verificación, puedes ignorar este correo de forma segura'
        );
    });

    it('should render fallback URL text', async () => {
        // Arrange & Act
        const html = await render(<VerifyEmailTemplate {...defaultProps} />);

        // Assert
        expect(html).toContain('O copia y pega este enlace en tu navegador:');
    });

    it('should use BaseLayout with Hospeda branding', async () => {
        // Arrange & Act
        const html = await render(<VerifyEmailTemplate {...defaultProps} />);

        // Assert
        expect(html).toContain('Hospeda');
        expect(html).toContain(
            'Hospeda - Alojamientos turísticos en Concepción del Uruguay y el Litoral'
        );
    });

    it('should not crash when name is empty string', async () => {
        // Arrange
        const props = { name: '', verificationUrl: defaultProps.verificationUrl };

        // Act
        const html = await render(<VerifyEmailTemplate {...props} />);

        // Assert
        // React inserts <!-- --> comment nodes between interpolated values
        expect(html).toMatch(/Hola\s*(?:<!--\s*-->)?\s*,/);
    });
});
