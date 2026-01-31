import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for AddonExpired email template
 */
export interface AddonExpiredProps {
    recipientName: string;
    addonName: string;
    expirationDate?: string;
}

/**
 * Addon expired email template
 * Sent when an addon has expired
 *
 * @param props - Addon expiration data
 */
export function AddonExpired({ recipientName, addonName, expirationDate }: AddonExpiredProps) {
    const formattedExpirationDate = expirationDate ? formatDate(expirationDate) : undefined;

    return (
        <EmailLayout previewText={`Tu complemento ${addonName} ha vencido`}>
            <Heading>Tu complemento ha vencido</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Tu complemento <strong>{addonName}</strong> ha vencido y ya no tienes acceso a sus
                funcionalidades.
            </Text>

            <Section style={styles.alertBox}>
                <InfoRow
                    label="Complemento"
                    value={addonName}
                />
                {formattedExpirationDate && (
                    <InfoRow
                        label="Fecha de vencimiento"
                        value={formattedExpirationDate}
                    />
                )}
            </Section>

            <Text style={styles.paragraph}>
                Si deseas recuperar el acceso a las funcionalidades de este complemento, puedes
                adquirirlo nuevamente en cualquier momento.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href="{{base_url}}/mi-cuenta/addons">Comprar de nuevo</Button>
            </Section>

            <Text style={styles.footerNote}>
                Tus datos y configuraciones se mantendrán guardados por si decides volver a activar
                este complemento.
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
