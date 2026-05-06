import { Column, Link, Row, Section, Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for ContactSubmissionEmail template.
 */
export interface ContactSubmissionEmailProps {
    /** Sender's first name as supplied in the form */
    readonly senderFirstName: string;
    /** Sender's last name as supplied in the form */
    readonly senderLastName: string;
    /** Sender's email address (used as Reply-To target) */
    readonly senderEmail: string;
    /** Sanitized plain-text message body (may contain newlines) */
    readonly message: string;
    /** Inquiry type — "general" or "accommodation" */
    readonly contactType: 'general' | 'accommodation';
    /** Optional accommodation UUID when contactType is "accommodation" */
    readonly accommodationId?: string;
    /** ISO 8601 timestamp of when the form was submitted */
    readonly submittedAt: string;
}

/**
 * Format an ISO timestamp for Spanish-language display.
 */
function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function resolveContactTypeLabel(contactType: 'general' | 'accommodation'): string {
    return contactType === 'accommodation' ? 'Consulta de alojamiento' : 'Consulta general';
}

const styles = {
    badgeRow: {
        marginBottom: '16px'
    },
    typeBadge: {
        display: 'inline-block',
        padding: '4px 12px',
        backgroundColor: '#f1f5f9',
        color: '#1e293b',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '600',
        margin: '0'
    },
    infoBox: {
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px'
    },
    sectionTitle: {
        fontSize: '13px',
        fontWeight: '700',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.04em',
        color: '#475569',
        margin: '0 0 12px'
    },
    messageBlock: {
        whiteSpace: 'pre-wrap' as const,
        fontSize: '14px',
        lineHeight: '22px',
        color: '#1e293b',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        padding: '14px',
        borderRadius: '8px',
        margin: '0'
    },
    link: {
        color: '#2563eb',
        textDecoration: 'underline'
    },
    footnote: {
        fontSize: '12px',
        color: '#64748b',
        margin: '20px 0 0'
    }
};

/**
 * ContactSubmissionEmail
 *
 * Renders a public contact form submission as a formatted HTML email for the
 * support inbox. The recipient is the support team — never the visitor.
 * Reply-To is set to the visitor's email by the transport layer.
 *
 * @example
 * ```tsx
 * <ContactSubmissionEmail
 *   senderFirstName="Juan"
 *   senderLastName="Pérez"
 *   senderEmail="juan@example.com"
 *   message="Quería consultar por la disponibilidad..."
 *   contactType="accommodation"
 *   accommodationId="550e8400-..."
 *   submittedAt="2026-05-06T10:00:00.000Z"
 * />
 * ```
 */
export function ContactSubmissionEmail({
    senderFirstName,
    senderLastName,
    senderEmail,
    message,
    contactType,
    accommodationId,
    submittedAt
}: ContactSubmissionEmailProps) {
    const fullName = `${senderFirstName} ${senderLastName}`.trim();
    const typeLabel = resolveContactTypeLabel(contactType);

    return (
        <EmailLayout previewText={`[Contacto] ${typeLabel} - ${fullName}`}>
            <Section style={styles.badgeRow}>
                <Text style={styles.typeBadge}>{typeLabel}</Text>
            </Section>

            <Heading>Nueva consulta de {fullName}</Heading>

            <Section style={styles.infoBox}>
                <Text style={styles.sectionTitle}>Datos del remitente</Text>
                <InfoRow
                    label="Nombre"
                    value={fullName}
                />
                <Row style={{ marginBottom: '12px' }}>
                    <Column style={{ width: '40%', verticalAlign: 'top' as const }}>
                        <Text
                            style={{
                                color: '#64748b',
                                fontSize: '14px',
                                lineHeight: '20px',
                                margin: '0'
                            }}
                        >
                            Email
                        </Text>
                    </Column>
                    <Column
                        style={{
                            width: '60%',
                            textAlign: 'right' as const,
                            verticalAlign: 'top' as const
                        }}
                    >
                        <Text
                            style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                lineHeight: '20px',
                                margin: '0'
                            }}
                        >
                            <Link
                                href={`mailto:${senderEmail}`}
                                style={styles.link}
                            >
                                {senderEmail}
                            </Link>
                        </Text>
                    </Column>
                </Row>
                <InfoRow
                    label="Fecha"
                    value={formatTimestamp(submittedAt)}
                />
                {accommodationId && (
                    <InfoRow
                        label="Alojamiento"
                        value={accommodationId}
                    />
                )}
            </Section>

            <Section>
                <Text style={styles.sectionTitle}>Mensaje</Text>
                <Text style={styles.messageBlock}>{message}</Text>
            </Section>

            <Text style={styles.footnote}>
                Este mensaje fue enviado desde el formulario público de contacto. Para responder,
                usá el enlace de email del remitente arriba.
            </Text>
        </EmailLayout>
    );
}
