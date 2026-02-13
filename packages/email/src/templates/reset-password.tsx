import { Button, Heading, Text } from '@react-email/components';
import { BaseLayout } from './base-layout.js';

/**
 * Props for the password reset template.
 */
export interface ResetPasswordTemplateProps {
    /**
     * User's display name.
     */
    readonly name: string;

    /**
     * Password reset URL.
     * Should include unique token and redirect to password reset page.
     */
    readonly resetUrl: string;
}

/**
 * Password reset email template.
 *
 * Sent to users when they request a password reset.
 * Includes a reset link that expires in 1 hour.
 *
 * @param props - Template configuration (name, reset URL)
 * @returns Rendered email template
 *
 * @example
 * ```tsx
 * import { sendEmail, ResetPasswordTemplate } from '@repo/email';
 *
 * await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Restablece tu contraseña',
 *   react: ResetPasswordTemplate({
 *     name: 'Juan Pérez',
 *     resetUrl: 'https://hospeda.com.ar/reset-password?token=xyz789'
 *   })
 * });
 * ```
 */
export function ResetPasswordTemplate({ name, resetUrl }: ResetPasswordTemplateProps) {
    return (
        <BaseLayout>
            <Heading style={h1}>Restablece tu contraseña</Heading>

            <Text style={text}>Hola {name},</Text>

            <Text style={text}>
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en Hospeda.
            </Text>

            <Text style={text}>Haz clic en el botón de abajo para crear una nueva contraseña:</Text>

            <Button
                href={resetUrl}
                style={button}
            >
                Restablecer contraseña
            </Button>

            <Text style={text}>
                O copia y pega este enlace en tu navegador:
                <br />
                <a
                    href={resetUrl}
                    style={link}
                >
                    {resetUrl}
                </a>
            </Text>

            <Text style={securityNotice}>
                <strong>¿No solicitaste esto?</strong>
                <br />
                Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma
                segura. Tu contraseña actual seguirá siendo válida y no se realizarán cambios en tu
                cuenta.
            </Text>

            <Text style={notice}>
                Este enlace expira en 1 hora por motivos de seguridad. Si necesitas más tiempo,
                puedes solicitar un nuevo enlace de restablecimiento.
            </Text>
        </BaseLayout>
    );
}

// Styles
const h1 = {
    color: '#1a202c',
    fontSize: '24px',
    fontWeight: 'bold',
    lineHeight: '32px',
    margin: '0 0 24px'
};

const text = {
    color: '#2d3748',
    fontSize: '16px',
    lineHeight: '24px',
    margin: '0 0 16px'
};

const button = {
    backgroundColor: '#3182ce',
    borderRadius: '6px',
    color: '#ffffff',
    display: 'block',
    fontSize: '16px',
    fontWeight: 'bold',
    textAlign: 'center' as const,
    textDecoration: 'none',
    padding: '12px 24px',
    margin: '24px 0'
};

const link = {
    color: '#3182ce',
    textDecoration: 'underline',
    wordBreak: 'break-all' as const
};

const securityNotice = {
    color: '#2d3748',
    fontSize: '14px',
    lineHeight: '20px',
    margin: '24px 0',
    padding: '16px',
    backgroundColor: '#fff5f5',
    borderRadius: '6px',
    borderLeft: '4px solid #e53e3e'
};

const notice = {
    color: '#718096',
    fontSize: '14px',
    lineHeight: '20px',
    margin: '24px 0 0',
    padding: '16px',
    backgroundColor: '#f7fafc',
    borderRadius: '6px',
    borderLeft: '4px solid #3182ce'
};
