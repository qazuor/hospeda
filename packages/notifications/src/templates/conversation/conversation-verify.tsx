import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

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
    guestName
}: ConversationVerifyProps) {
    return (
        <EmailLayout previewText="Verificá tu email para continuar la conversación — Hospeda">
            <Heading>Verificá tu dirección de email</Heading>

            <Text style={styles.greeting}>Hola {guestName},</Text>

            <Text style={styles.paragraph}>
                Recibimos tu consulta sobre <strong>{accommodationName}</strong>. Para poder
                enviarla al anfitrión, necesitamos confirmar que el email es tuyo.
            </Text>

            <Text style={styles.paragraph}>
                Hospeda es la plataforma de turismo del Litoral argentino que conecta viajeros con
                alojamientos en Concepción del Uruguay y la región. Tus datos están seguros y solo
                se usan para gestionar esta conversación.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={verificationUrl}>Verificar mi email</Button>
            </Section>

            <Section style={styles.expiryBox}>
                <Text style={styles.expiryText}>
                    Este enlace es válido por <strong>24 horas</strong>. Si no lo usás dentro de ese
                    plazo, podés volver a enviar tu consulta desde la página del alojamiento.
                </Text>
            </Section>

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
    buttonContainer: {
        margin: '32px 0',
        textAlign: 'center' as const
    },
    expiryBox: {
        backgroundColor: '#f0f9ff',
        borderRadius: '8px',
        borderLeft: '4px solid #0ea5e9',
        padding: '16px 20px',
        margin: '24px 0'
    },
    expiryText: {
        color: '#0369a1',
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
