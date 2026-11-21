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
        expect(html).toContain('href="https://hospeda.com.ar/verify?token=abc123"');
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

    it('should render inside EmailLayout with footerLink none (HOS-2519 AC-1.3)', async () => {
        // Arrange & Act
        const html = await render(<VerifyEmailTemplate {...defaultProps} />);

        // Assert
        expect(html.match(/<html[^>]*lang="es"/g)).toHaveLength(1);
        expect(html).toContain('alt="Hospeda"');
        expect(html).toContain('Hospeda - Turismo en el Litoral');
        expect(html).not.toContain('Administrar preferencias de notificaciones');
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

    describe('transactional mail signals (HOS-1965)', () => {
        const url = 'https://hospeda.com.ar/verify?token=abc123';

        it('should not render the unsubscribe footer', async () => {
            // Arrange & Act
            const html = await render(
                <VerifyEmailTemplate
                    name="Juan"
                    verificationUrl={url}
                />
            );

            // Assert
            expect(html).not.toContain('darte de baja');
            expect(html).not.toContain('/unsubscribe');
        });

        it('should greet with a generic "Hola," when there is no name', async () => {
            // Arrange & Act
            const html = await render(<VerifyEmailTemplate verificationUrl={url} />);

            // Assert
            expect(html).toMatch(/Hola,/);
            expect(html).not.toMatch(/Hola\s+(?:<!--\s*-->)?\s*undefined/);
        });

        it('should never greet with the email address', async () => {
            // Arrange & Act
            const html = await render(
                <VerifyEmailTemplate
                    name="a@b.com"
                    verificationUrl={url}
                />
            );

            // Assert
            expect(html).not.toContain('a@b.com');
            expect(html).toMatch(/Hola,/);
        });

        it('should keep the raw URL out of any link text (only the button is an anchor)', async () => {
            // Arrange & Act
            const html = await render(
                <VerifyEmailTemplate
                    name="Juan"
                    verificationUrl={url}
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
});
