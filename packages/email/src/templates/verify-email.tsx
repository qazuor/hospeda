import { Button, Heading, Text } from '@react-email/components';
import { BaseLayout } from './base-layout.js';

/**
 * Props for the email verification template.
 */
export interface VerifyEmailTemplateProps {
    /**
     * User's display name.
     */
    readonly name: string;

    /**
     * Email verification URL.
     * Should include unique token and redirect to verification page.
     */
    readonly verificationUrl: string;
}

/**
 * Email verification template.
 *
 * Sent to users when they sign up or change their email address.
 * Includes a verification link that expires in 24 hours.
 *
 * @param props - Template configuration (name, verification URL)
 * @returns Rendered email template
 *
 * @example
 * ```tsx
 * import { sendEmail, VerifyEmailTemplate } from '@repo/email';
 *
 * await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Verifica tu dirección de correo electrónico',
 *   react: VerifyEmailTemplate({
 *     name: 'Juan Pérez',
 *     verificationUrl: 'https://hospeda.com.ar/verify?token=abc123'
 *   })
 * });
 * ```
 */
export function VerifyEmailTemplate({ name, verificationUrl }: VerifyEmailTemplateProps) {
    return (
        <BaseLayout>
            <Heading style={h1}>Verifica tu dirección de correo electrónico</Heading>

            <Text style={text}>Hola {name},</Text>

            <Text style={text}>
                Gracias por registrarte en Hospeda. Para completar tu registro, necesitamos
                verificar tu dirección de correo electrónico.
            </Text>

            <Text style={text}>
                Haz clic en el botón de abajo para verificar tu correo electrónico:
            </Text>

            <Button
                href={verificationUrl}
                style={button}
            >
                Verificar correo electrónico
            </Button>

            <Text style={text}>
                O copia y pega este enlace en tu navegador:
                <br />
                <a
                    href={verificationUrl}
                    style={link}
                >
                    {verificationUrl}
                </a>
            </Text>

            <Text style={notice}>
                Este enlace expira en 24 horas. Si no solicitaste esta verificación, puedes ignorar
                este correo de forma segura.
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
