import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for TrialExpired email template
 */
export interface TrialExpiredProps {
    recipientName: string;
    planName: string;
    trialEndDate: string;
    upgradeUrl: string;
}

/**
 * Trial expired email template
 * Sent when a user's trial period has ended
 *
 * @param props - Trial expiration data
 */
export function TrialExpired({
    recipientName,
    planName,
    trialEndDate,
    upgradeUrl
}: TrialExpiredProps) {
    const formattedEndDate = formatDate(trialEndDate);

    return (
        <EmailLayout previewText={`Tu período de prueba de ${planName} ha finalizado`}>
            <Heading>Tu período de prueba ha finalizado</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Tu período de prueba del plan <strong>{planName}</strong> ha finalizado. Tu cuenta
                ha sido actualizada con las funcionalidades del plan gratuito.
            </Text>

            <Section style={styles.alertBox}>
                <InfoRow
                    label="Plan de prueba"
                    value={planName}
                />
                <InfoRow
                    label="Fecha de finalización"
                    value={formattedEndDate}
                />
            </Section>

            <Text style={styles.paragraph}>Funcionalidades que ya no están disponibles:</Text>

            <Section style={styles.featureList}>
                <Text style={styles.featureItem}>• Publicaciones ilimitadas</Text>
                <Text style={styles.featureItem}>• Estadísticas avanzadas</Text>
                <Text style={styles.featureItem}>• Soporte prioritario</Text>
                <Text style={styles.featureItem}>• Destacados en búsquedas</Text>
            </Section>

            <Text style={styles.paragraph}>
                ¿Te gustó la experiencia? Suscríbete ahora para recuperar el acceso completo a todas
                estas funcionalidades.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={upgradeUrl}>Suscribirse ahora</Button>
            </Section>

            <Text style={styles.footerNote}>
                Tus publicaciones y datos están seguros. Puedes recuperar el acceso completo en
                cualquier momento.
            </Text>
        </EmailLayout>
    );
}

/**
 * Format date in Spanish locale
 * @param dateString - ISO date string
 */
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
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
    alertBox: {
        backgroundColor: '#fef2f2',
        borderRadius: '8px',
        borderLeft: '4px solid #ef4444',
        padding: '24px',
        margin: '24px 0'
    },
    featureList: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        padding: '16px 24px',
        margin: '16px 0'
    },
    featureItem: {
        color: '#475569',
        fontSize: '15px',
        lineHeight: '28px',
        margin: '0'
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
