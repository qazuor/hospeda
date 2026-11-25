import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';
import { buildInquiryExcerpt, formatInquiryDates, maskPhone } from './inquiry-excerpt.js';

/**
 * Props for ConversationVerify email template.
 * Subject key: conversations.email.verify.subject
 */
export interface ConversationVerifyProps {
    /** Name of the accommodation the guest is inquiring about */
    accommodationName: string;
    /** URL the guest must visit to verify their email address */
    verificationUrl: string;
    /** Display name of the guest */
    guestName: string;
    /** Email locale — does not alter content (copy is in Spanish) but included for caller parity */
    locale: 'es' | 'en' | 'pt';
    /**
     * The inquiry text this link will deliver (HOS-2568). Never rendered in full: the email
     * goes to an unverified address, so only a short excerpt with links, emails and phone
     * numbers neutralized is shown (see `buildInquiryExcerpt`).
     */
    message?: string;
    /** Phone the guest declared. Rendered masked, last three digits only. */
    guestPhone?: string | null;
    /** Declared check-in date (`YYYY-MM-DD`). */
    checkIn?: string | null;
    /** Declared check-out date (`YYYY-MM-DD`). */
    checkOut?: string | null;
    /** Declared guest count. */
    guests?: number | null;
}

/**
 * Email sent to an anonymous guest to verify their email address before
 * their inquiry can be delivered to the property owner.
 *
 * The verification link expires after 24 hours.
 *
 * @param props - Template data
 */
export function ConversationVerify({
    accommodationName,
    verificationUrl,
    guestName,
    message,
    guestPhone,
    checkIn,
    checkOut,
    guests
}: ConversationVerifyProps) {
    const { excerpt } = buildInquiryExcerpt({ message: message ?? '' });
    const { masked: maskedPhone } = maskPhone({ phone: guestPhone ?? '' });
    // The name is typed by an unverified guest too: same neutralization as the excerpt.
    const datesLabel = formatInquiryDates({ checkIn, checkOut });
    const safeName = buildInquiryExcerpt({ message: guestName }).excerpt;

    return (
        <EmailLayout
            footerLink="none"
            previewText="Verificá tu email para continuar la conversación — Hospeda"
        >
            <Heading>Verificá tu dirección de email</Heading>

            <Text style={styles.greeting}>Hola {safeName},</Text>

            <Text style={styles.paragraph}>
                Recibimos tu consulta sobre <strong>{accommodationName}</strong>. Para poder
                enviarla al anfitrión, necesitamos confirmar que el email es tuyo. Hasta que lo
                confirmes, el anfitrión no recibe tu mensaje.
            </Text>

            {excerpt ? (
                <Callout tone="info">
                    <Text style={styles.messageLabel}>Resumen de tu consulta</Text>
                    <Text style={styles.messageText}>Alojamiento: {accommodationName}</Text>
                    <Text style={styles.messageText}>Nombre: {safeName}</Text>
                    {maskedPhone ? (
                        <Text style={styles.messageText}>Teléfono: {maskedPhone}</Text>
                    ) : null}
                    {datesLabel ? (
                        <Text style={styles.messageText}>Fechas: {datesLabel}</Text>
                    ) : null}
                    {guests ? <Text style={styles.messageText}>Huéspedes: {guests}</Text> : null}
                    <Text style={styles.messageText}>Mensaje: {excerpt}</Text>
                </Callout>
            ) : null}

            <Text style={styles.paragraph}>
                Hospeda es la plataforma de turismo del Litoral argentino que conecta viajeros con
                alojamientos en Concepción del Uruguay y la región. Tus datos están seguros y solo
                se usan para gestionar esta conversación.
            </Text>

            <Button href={verificationUrl}>Verificar mi email</Button>

            <Callout tone="info">
                <Text style={styles.expiryText}>
                    Este enlace es válido por <strong>24 horas</strong>. Si no lo usás dentro de ese
                    plazo, podés volver a enviar tu consulta desde la página del alojamiento.
                </Text>
            </Callout>

            <Text style={styles.footerNote}>
                Si no enviaste esta consulta, podés ignorar este mensaje con tranquilidad.
            </Text>
        </EmailLayout>
    );
}

const styles = {
    greeting: {
        color: '#1e293b',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px'
    },
    paragraph: {
        color: '#475569',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px'
    },
    messageLabel: {
        fontSize: '12px',
        lineHeight: '16px',
        margin: '0 0 4px',
        textTransform: 'uppercase' as const
    },
    messageText: {
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0 0 4px'
    },
    expiryText: {
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0'
    },
    footerNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
