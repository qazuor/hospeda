import { Section, Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { formatCurrency } from '../utils/index.js';

/**
 * Props for AdminPaymentFailure email template
 */
export interface AdminPaymentFailureProps {
    recipientName: string;
    affectedUserEmail?: string;
    affectedUserId?: string;
    severity: 'info' | 'warning' | 'critical';
    eventDetails: Record<string, unknown>;
}

/**
 * Admin payment failure email template
 * Sent to admins when a payment fails
 *
 * @param props - Payment failure notification data
 */
export function AdminPaymentFailure({
    recipientName,
    affectedUserEmail,
    affectedUserId,
    severity,
    eventDetails
}: AdminPaymentFailureProps) {
    const amount = eventDetails.amount as number | undefined;
    const currency = eventDetails.currency as string | undefined;
    const failureReason = eventDetails.failureReason as string | undefined;

    const formattedAmount =
        amount !== undefined && currency !== undefined
            ? formatCurrency({ amount, currency })
            : 'N/A';

    return (
        <EmailLayout previewText="[Admin] Fallo de pago detectado">
            <Section style={styles.adminHeader}>
                <Text style={styles.adminBadge}>NOTIFICACIÓN ADMINISTRATIVA</Text>
                <SeverityBadge severity={severity} />
            </Section>

            <Heading>Fallo de Pago Detectado</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Se ha detectado un fallo en el procesamiento de un pago. A continuación se muestran
                los detalles del incidente.
            </Text>

            <Section style={styles.detailsBox}>
                <Text style={styles.sectionTitle}>Información del Usuario</Text>
                {affectedUserEmail && (
                    <InfoRow
                        label="Email"
                        value={affectedUserEmail}
                    />
                )}
                {affectedUserId && (
                    <InfoRow
                        label="User ID"
                        value={affectedUserId}
                    />
                )}
            </Section>

            <Section style={styles.detailsBox}>
                <Text style={styles.sectionTitle}>Detalles del Pago</Text>
                <InfoRow
                    label="Monto"
                    value={formattedAmount}
                />
                {failureReason && (
                    <InfoRow
                        label="Motivo del fallo"
                        value={failureReason}
                    />
                )}
            </Section>

            {eventDetails && Object.keys(eventDetails).length > 0 && (
                <Section style={styles.detailsBox}>
                    <Text style={styles.sectionTitle}>Información Adicional</Text>
                    <Text style={styles.jsonBlock}>{JSON.stringify(eventDetails, null, 2)}</Text>
                </Section>
            )}

            <Text style={styles.footerNote}>
                Esta es una notificación automática del sistema. Revisa el panel de administración
                para más detalles.
            </Text>
        </EmailLayout>
    );
}

/**
 * Severity badge component
 */
function SeverityBadge({ severity }: { severity: 'info' | 'warning' | 'critical' }) {
    const badgeStyles = {
        info: styles.severityInfo,
        warning: styles.severityWarning,
        critical: styles.severityCritical
    };

    const labels = {
        info: 'INFO',
        warning: 'ADVERTENCIA',
        critical: 'CRÍTICO'
    };

    return <Text style={badgeStyles[severity]}>{labels[severity]}</Text>;
}

const styles = {
    adminHeader: {
        textAlign: 'center' as const,
        marginBottom: '24px'
    },
    adminBadge: {
        backgroundColor: '#1e293b',
        color: '#ffffff',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '1px',
        padding: '6px 12px',
        borderRadius: '4px',
        display: 'inline-block',
        marginBottom: '12px'
    },
    severityInfo: {
        backgroundColor: '#dbeafe',
        color: '#1e40af',
        fontSize: '12px',
        fontWeight: '700',
        letterSpacing: '0.5px',
        padding: '8px 16px',
        borderRadius: '4px',
        display: 'inline-block'
    },
    severityWarning: {
        backgroundColor: '#fef3c7',
        color: '#92400e',
        fontSize: '12px',
        fontWeight: '700',
        letterSpacing: '0.5px',
        padding: '8px 16px',
        borderRadius: '4px',
        display: 'inline-block'
    },
    severityCritical: {
        backgroundColor: '#fee2e2',
        color: '#991b1b',
        fontSize: '12px',
        fontWeight: '700',
        letterSpacing: '0.5px',
        padding: '8px 16px',
        borderRadius: '4px',
        display: 'inline-block'
    },
    greeting: {
        color: '#1e293b',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px'
    },
    paragraph: {
        color: '#475569',
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0 0 16px'
    },
    detailsBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '6px',
        padding: '20px',
        margin: '16px 0'
    },
    sectionTitle: {
        color: '#1e293b',
        fontSize: '14px',
        fontWeight: '700',
        margin: '0 0 12px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px'
    },
    jsonBlock: {
        backgroundColor: '#1e293b',
        color: '#e2e8f0',
        fontSize: '12px',
        fontFamily: 'monospace',
        padding: '16px',
        borderRadius: '4px',
        whiteSpace: 'pre-wrap' as const,
        wordBreak: 'break-all' as const,
        margin: '8px 0 0'
    },
    footerNote: {
        color: '#64748b',
        fontSize: '13px',
        lineHeight: '18px',
        margin: '24px 0 0',
        textAlign: 'center' as const,
        fontStyle: 'italic'
    }
};
