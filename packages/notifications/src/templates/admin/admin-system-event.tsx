import { Section, Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for AdminSystemEvent email template
 */
export interface AdminSystemEventProps {
    recipientName: string;
    severity: 'info' | 'warning' | 'critical';
    eventDetails: Record<string, unknown>;
}

/**
 * Admin system event email template
 * Sent to admins for important system events
 *
 * @param props - System event notification data
 */
export function AdminSystemEvent({ recipientName, severity, eventDetails }: AdminSystemEventProps) {
    const eventType = (eventDetails.eventType as string) || 'System Event';
    const timestamp = eventDetails.timestamp as string | undefined;
    const message = eventDetails.message as string | undefined;

    return (
        <EmailLayout previewText={`[Admin] Evento del sistema: ${eventType}`}>
            <Section style={styles.adminHeader}>
                <Text style={styles.adminBadge}>NOTIFICACIÓN ADMINISTRATIVA</Text>
                <SeverityBadge severity={severity} />
            </Section>

            <Heading>Evento del Sistema</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Se ha registrado un evento en el sistema que requiere tu atención.
            </Text>

            <Section style={styles.detailsBox}>
                <Text style={styles.sectionTitle}>Información del Evento</Text>
                <InfoRow
                    label="Tipo de evento"
                    value={eventType}
                />
                {timestamp && (
                    <InfoRow
                        label="Fecha/Hora"
                        value={formatTimestamp(timestamp)}
                    />
                )}
                <InfoRow
                    label="Severidad"
                    value={getSeverityLabel(severity)}
                />
            </Section>

            {message && (
                <Section style={styles.messageBox}>
                    <Text style={styles.sectionTitle}>Mensaje</Text>
                    <Text style={styles.messageText}>{message}</Text>
                </Section>
            )}

            <Section style={styles.detailsBox}>
                <Text style={styles.sectionTitle}>Detalles Completos</Text>
                <Text style={styles.jsonBlock}>{JSON.stringify(eventDetails, null, 2)}</Text>
            </Section>

            <Text style={styles.footerNote}>
                Esta es una notificación automática del sistema. Revisa el panel de administración o
                los logs para investigar más a fondo.
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

/**
 * Get severity label in Spanish
 */
function getSeverityLabel(severity: 'info' | 'warning' | 'critical'): string {
    const labels = {
        info: 'Informativo',
        warning: 'Advertencia',
        critical: 'Crítico'
    };
    return labels[severity];
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
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
    messageBox: {
        backgroundColor: '#fffbeb',
        borderRadius: '6px',
        borderLeft: '4px solid #f59e0b',
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
    messageText: {
        color: '#1e293b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0'
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
