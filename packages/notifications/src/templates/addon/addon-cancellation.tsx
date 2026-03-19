import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

/**
 * Props for AddonCancellation email template
 */
export interface AddonCancellationProps {
    recipientName: string;
    addonName: string;
    /** ISO 8601 timestamp of when the add-on was cancelled */
    canceledAt: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    baseUrl: string;
}

/**
 * Addon cancellation confirmation email template.
 * Sent to the user after one of their active add-ons is successfully cancelled.
 * Includes a link to reactivate from the account panel in case of error.
 *
 * @param props - Addon cancellation data
 */
export function AddonCancellation({
    recipientName,
    addonName,
    canceledAt,
    baseUrl
}: AddonCancellationProps) {
    const formattedCanceledAt = formatDate({ dateString: canceledAt });

    return (
        <EmailLayout
            previewText={`Tu complemento ${addonName} ha sido cancelado`}
            showUnsubscribe={false}
        >
            <Heading>Complemento cancelado</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Te confirmamos que tu complemento <strong>{addonName}</strong> ha sido cancelado
                exitosamente.
            </Text>

            <Section style={styles.infoBox}>
                <InfoRow
                    label="Complemento"
                    value={addonName}
                />
                <InfoRow
                    label="Cancelado el"
                    value={formattedCanceledAt}
                />
            </Section>

            <Text style={styles.paragraph}>
                Si esto fue un error, podés reactivarlo desde tu panel de cuenta en cualquier
                momento.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={`${baseUrl}/es/mi-cuenta/suscripcion`}>Ir a mi cuenta</Button>
            </Section>

            <Text style={styles.footerNote}>
                Si no solicitaste esta cancelación, por favor contactanos de inmediato.
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
    infoBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '4px solid #94a3b8',
        padding: '24px',
        margin: '24px 0'
    },
    buttonContainer: {
        margin: '32px 0',
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
