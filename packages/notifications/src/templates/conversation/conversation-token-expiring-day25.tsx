import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for ConversationTokenExpiringDay25 email template.
 * Subject key: conversations.email.tokenExpiringDay25.subject
 */
export interface ConversationTokenExpiringDay25Props {
    /** Name of the accommodation the conversation is about */
    accommodationName: string;
    /** URL to renew or extend the guest's access token */
    renewUrl: string;
    /** Human-readable expiry date for the token */
    expiryDate: string;
    /** Email locale — does not alter copy but included for caller parity */
    locale: 'es' | 'en' | 'pt';
}

/**
 * Urgent final reminder sent to an anonymous guest when their conversation
 * access token expires in approximately 5 days (sent on day 25 of the 30-day cycle).
 *
 * This email uses stronger, more urgent copy than ConversationTokenExpiringDay15.
 * The distinguishing text is "últimos 5 días" to differentiate from the day-15 copy.
 *
 * @param props - Template data
 */
export function ConversationTokenExpiringDay25({
    accommodationName,
    renewUrl,
    expiryDate
}: ConversationTokenExpiringDay25Props) {
    return (
        <EmailLayout
            previewText={`¡Último aviso! Tu acceso sobre ${accommodationName} vence en 5 días`}
            showUnsubscribe={true}
        >
            <Heading>¡Tu enlace de acceso vence en 5 días!</Heading>

            <Text style={styles.paragraph}>
                Este es tu <strong>último aviso</strong>: quedan solo <strong>5 días</strong> para
                que tu enlace de acceso a la conversación sobre <strong>{accommodationName}</strong>{' '}
                expire definitivamente.
            </Text>

            <Section style={styles.urgentBox}>
                <InfoRow
                    label="Alojamiento"
                    value={accommodationName}
                />
                <InfoRow
                    label="Vencimiento"
                    value={expiryDate}
                />
                <Text style={styles.urgentNote}>
                    Estás en los últimos 5 días. Después de esta fecha perderás el acceso a la
                    conversación y no podrás recuperarla sin contactar al anfitrión nuevamente.
                </Text>
            </Section>

            <Section style={styles.buttonContainer}>
                <Button href={renewUrl}>Renovar ahora — últimos 5 días</Button>
            </Section>

            {/* Account-creation suggestion with urgency tone */}
            <Section style={styles.accountBox}>
                <Text style={styles.accountHeading}>Evitá perder el acceso para siempre</Text>
                <Text style={styles.accountText}>
                    Con una cuenta gratuita en Hospeda tu historial de conversaciones nunca vence.
                    No dependás de enlaces temporales para hablar con anfitriones.
                </Text>
            </Section>

            <Text style={styles.footerNote}>
                Si ya no necesitás este acceso, podés ignorar este mensaje.
            </Text>
        </EmailLayout>
    );
}

const styles = {
    paragraph: {
        color: '#475569',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px'
    },
    urgentBox: {
        backgroundColor: '#fff7ed',
        borderRadius: '8px',
        borderLeft: '4px solid #f97316',
        padding: '24px',
        margin: '24px 0'
    },
    urgentNote: {
        color: '#c2410c',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '16px 0 0',
        fontWeight: '600'
    },
    buttonContainer: {
        margin: '32px 0',
        textAlign: 'center' as const
    },
    accountBox: {
        backgroundColor: '#fff1f2',
        borderRadius: '8px',
        borderLeft: '4px solid #f43f5e',
        padding: '20px 24px',
        margin: '24px 0'
    },
    accountHeading: {
        color: '#be123c',
        fontSize: '15px',
        fontWeight: '600',
        lineHeight: '22px',
        margin: '0 0 8px'
    },
    accountText: {
        color: '#9f1239',
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
