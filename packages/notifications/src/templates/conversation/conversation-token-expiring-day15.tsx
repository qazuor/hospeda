import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';

/**
 * Props for ConversationTokenExpiringDay15 email template.
 * Subject key: conversations.email.tokenExpiringDay15.subject
 */
export interface ConversationTokenExpiringDay15Props {
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
 * Gentle reminder sent to an anonymous guest when their conversation access
 * token expires in approximately 15 days.
 *
 * Encourages the guest to renew their link or create an account to avoid
 * losing access to the conversation.
 *
 * @param props - Template data
 */
export function ConversationTokenExpiringDay15({
    accommodationName,
    renewUrl,
    expiryDate
}: ConversationTokenExpiringDay15Props) {
    return (
        <EmailLayout
            previewText={`Tu acceso a la conversación sobre ${accommodationName} vence en 15 días`}
            footerLink="none"
        >
            <Heading>Tu enlace de acceso vence pronto</Heading>

            <Text style={styles.paragraph}>
                Queremos avisarte con tiempo: tu enlace de acceso a la conversación sobre{' '}
                <strong>{accommodationName}</strong> vencerá dentro de aproximadamente{' '}
                <strong>15 días</strong>.
            </Text>

            <Callout tone="info">
                <InfoRow
                    label="Alojamiento"
                    value={accommodationName}
                />
                <InfoRow
                    label="Fecha de vencimiento"
                    value={expiryDate}
                />
            </Callout>

            <Text style={styles.paragraph}>
                Si aún necesitás estar en contacto con el anfitrión, podés renovar tu enlace
                haciendo clic en el botón de abajo.
            </Text>

            <Button href={renewUrl}>Renovar mi acceso</Button>

            {/* Account-creation suggestion */}
            <Callout tone="success">
                <Text style={styles.accountHeading}>¿Querés un acceso permanente?</Text>
                <Text style={styles.accountText}>
                    Creá una cuenta gratuita en Hospeda y nunca más te preocupes por vencimientos.
                    Todas tus conversaciones quedan guardadas en un solo lugar.
                </Text>
            </Callout>

            <Text style={styles.footerNote}>
                Si ya resolviste tu consulta, podés ignorar este recordatorio.
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
    accountHeading: {
        fontSize: '15px',
        fontWeight: '600',
        lineHeight: '22px',
        margin: '0 0 8px',
        textAlign: 'center' as const
    },
    accountText: {
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0',
        textAlign: 'center' as const
    },
    footerNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
