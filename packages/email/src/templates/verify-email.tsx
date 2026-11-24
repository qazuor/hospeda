import { Heading, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Callout } from '../components/callout.js';
import { EmailLayout } from './email-layout.js';
import { resolveGreeting } from './greeting.js';

/**
 * Props for the email verification template.
 */
export interface VerifyEmailTemplateProps {
    /**
     * User's display name. Optional: when absent (or when it is just the
     * email address) the greeting is a generic "Hola,".
     */
    readonly name?: string | null;

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
        <EmailLayout footerLink="none">
            <Heading style={h1}>Verifica tu dirección de correo electrónico</Heading>

            <Text style={text}>{resolveGreeting({ name }).text}</Text>

            <Text style={text}>
                Gracias por registrarte en Hospeda. Para completar tu registro, necesitamos
                verificar tu dirección de correo electrónico.
            </Text>

            <Text style={text}>
                Haz clic en el botón de abajo para verificar tu correo electrónico:
            </Text>

            {/* Keeps the pre-HOS-2565 attribution slot, so the text part stays byte-identical (AC-2.8). */}
            <Button
                href={verificationUrl}
                utmContent="body-link"
            >
                Verificar correo electrónico
            </Button>

            <Text style={text}>
                O copia y pega este enlace en tu navegador:
                <br />
                <span style={link}>{verificationUrl}</span>
            </Text>

            <Callout tone="info">
                Este enlace expira en 24 horas. Si no solicitaste esta verificación, puedes ignorar
                este correo de forma segura.
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
