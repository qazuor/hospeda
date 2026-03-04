import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

/**
 * Props for TrialEndingReminder email template
 */
export interface TrialEndingReminderProps {
    recipientName: string;
    planName: string;
    trialEndDate: string;
    daysRemaining?: number;
    upgradeUrl: string;
}

/**
 * Trial ending reminder email template
 * Sent to remind users when their trial is about to end
 *
 * @param props - Trial ending reminder data
 */
export function TrialEndingReminder({
    recipientName,
    planName,
    trialEndDate,
    daysRemaining,
    upgradeUrl
}: TrialEndingReminderProps) {
    const formattedEndDate = formatDate({ dateString: trialEndDate });
    const daysText = daysRemaining === 1 ? '1 día' : `${daysRemaining} días`;

    return (
        <EmailLayout
            previewText={`Tu período de prueba de ${planName} está por finalizar`}
            showUnsubscribe={true}
        >
            <Heading>Tu período de prueba está por finalizar</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Queremos recordarte que tu período de prueba del plan <strong>{planName}</strong>{' '}
                está próximo a finalizar.
            </Text>

            <Section style={styles.warningBox}>
                <InfoRow
                    label="Plan de prueba"
                    value={planName}
                />
                {daysRemaining !== undefined && (
                    <InfoRow
                        label="Tiempo restante"
                        value={daysText}
                    />
                )}
                <InfoRow
                    label="Fecha de finalización"
                    value={formattedEndDate}
                />
            </Section>

            <Text style={styles.paragraph}>
                Para continuar disfrutando de todas las funcionalidades sin interrupciones,
                suscríbete antes de que finalice tu período de prueba.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={upgradeUrl}>Ver planes y precios</Button>
            </Section>

            <Text style={styles.footerNote}>
                Si no te suscribes, tu acceso a las funcionalidades premium se limitará
                automáticamente al finalizar el período de prueba.
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
    warningBox: {
        backgroundColor: '#fffbeb',
        borderRadius: '8px',
        borderLeft: '4px solid #f59e0b',
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
