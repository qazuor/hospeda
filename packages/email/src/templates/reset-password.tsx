import { Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Callout } from '../components/callout.js';
import { EmailTitle } from '../components/email-title.js';
import { EmailLayout } from './email-layout.js';
import { resolveGreeting } from './greeting.js';

/**
 * Props for the password reset template.
 */
export interface ResetPasswordTemplateProps {
    /**
     * User's display name. Optional: when absent (or when it is just the
     * email address) the greeting is a generic "Hola,".
     */
    readonly name?: string | null;

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
        <EmailLayout footerLink="none">
            <EmailTitle style={h1}>Restablece tu contraseña</EmailTitle>

            <Text style={text}>{resolveGreeting({ name }).text}</Text>

            <Text style={text}>
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en Hospeda.
            </Text>

            <Text style={text}>Haz clic en el botón de abajo para crear una nueva contraseña:</Text>

            {/* Keeps the pre-HOS-2565 attribution slot, so the text part stays byte-identical (AC-2.8). */}
            <Button
                href={resetUrl}
                utmContent="body-link"
            >
                Restablecer contraseña
            </Button>

            <Text style={text}>
                O copia y pega este enlace en tu navegador:
                <br />
                <span style={link}>{resetUrl}</span>
            </Text>

            <Callout tone="danger">
                <strong>¿No solicitaste esto?</strong>
                <br />
                Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma
                segura. Tu contraseña actual seguirá siendo válida y no se realizarán cambios en tu
                cuenta.
            </Callout>

            <Callout tone="info">
                Este enlace expira en 1 hora por motivos de seguridad. Si necesitas más tiempo,
                puedes solicitar un nuevo enlace de restablecimiento.
            </Callout>
        </EmailLayout>
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

const link = {
    color: '#3182ce',
    textDecoration: 'underline',
    wordBreak: 'break-all' as const
};
