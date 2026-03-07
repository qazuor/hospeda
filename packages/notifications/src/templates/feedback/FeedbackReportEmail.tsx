import { Section, Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Environment data included in the feedback report
 */
export interface FeedbackReportEnvironment {
    /** URL where the feedback was submitted from */
    currentUrl?: string;
    /** Browser name and version */
    browser?: string;
    /** Operating system */
    os?: string;
    /** Viewport dimensions (e.g. "1920x1080") */
    viewport?: string;
    /** ISO 8601 timestamp of when the report was created */
    timestamp: string;
    /** Application source identifier (e.g. "web", "admin") */
    appSource: string;
    /** Deployed application version */
    deployVersion?: string;
    /** Authenticated user ID at the time of the report */
    userId?: string;
    /** Browser console errors captured at submission time */
    consoleErrors?: string[];
    /** JavaScript error that triggered the report */
    errorInfo?: {
        /** Error message */
        message: string;
        /** Stack trace */
        stack?: string;
    };
}

/**
 * Props for FeedbackReportEmail template
 */
export interface FeedbackReportEmailProps {
    /** Report type label (e.g. "Error de JavaScript", "Sugerencia") */
    reportType: string;
    /** Short title describing the feedback */
    title: string;
    /** Full description of the issue or suggestion */
    description: string;
    /** Display name of the person submitting the report */
    reporterName: string;
    /** Email address of the person submitting the report */
    reporterEmail: string;
    /** Severity level label (e.g. "Alta", "Media", "Baja") */
    severity?: string;
    /** Steps to reproduce the issue */
    stepsToReproduce?: string;
    /** What the reporter expected to happen */
    expectedResult?: string;
    /** What actually happened */
    actualResult?: string;
    /** URLs of images uploaded to Linear or as base64 data URIs */
    attachmentUrls?: string[];
    /** Environment context at the time of submission */
    environment: FeedbackReportEnvironment;
}

/**
 * Formats an ISO timestamp for Spanish-language display
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

/**
 * Renders console errors as a single formatted string
 */
function formatConsoleErrors(errors: string[]): string {
    return errors.map((e, i) => `[${i + 1}] ${e}`).join('\n');
}

/**
 * Section title component used within feedback report sections
 */
function SectionTitle({ children }: { children: string }) {
    return <Text style={styles.sectionTitle}>{children}</Text>;
}

/**
 * Feedback report email template
 *
 * Renders a full feedback or bug report as formatted HTML email. Used as a
 * fallback when the Linear API is unavailable so that no report is lost.
 *
 * Sections rendered:
 * - Report type badge + title heading
 * - Reporter info (name, email)
 * - Description
 * - Optional: severity, steps to reproduce, expected/actual result
 * - Environment data (URL, browser, OS, viewport, version, app source, user ID)
 * - Optional: console errors (code block)
 * - Optional: error message + stack trace (code block)
 * - Automated footer note
 *
 * @param props - Feedback report data
 *
 * @example
 * ```tsx
 * <FeedbackReportEmail
 *   reportType="Error de JavaScript"
 *   title="Crash al cargar la página de alojamientos"
 *   description="La página lanza una excepción al intentar renderizar la lista."
 *   reporterName="Juan Pérez"
 *   reporterEmail="juan@example.com"
 *   severity="Alta"
 *   environment={{
 *     currentUrl: "https://hospeda.com.ar/es/alojamientos",
 *     browser: "Chrome 123",
 *     os: "Windows 11",
 *     viewport: "1440x900",
 *     timestamp: "2026-03-06T14:30:00.000Z",
 *     appSource: "web",
 *     deployVersion: "1.4.2",
 *   }}
 * />
 * ```
 */
export function FeedbackReportEmail({
    reportType,
    title,
    description,
    reporterName,
    reporterEmail,
    severity,
    stepsToReproduce,
    expectedResult,
    actualResult,
    attachmentUrls,
    environment
}: FeedbackReportEmailProps) {
    const hasReproSteps = Boolean(stepsToReproduce || expectedResult || actualResult);
    const hasConsoleErrors =
        Array.isArray(environment.consoleErrors) && environment.consoleErrors.length > 0;
    const hasErrorInfo = Boolean(environment.errorInfo);

    return (
        <EmailLayout previewText={`[${reportType}] ${title}`}>
            {/* Report type badge */}
            <Section style={styles.badgeRow}>
                <Text style={styles.typeBadge}>{reportType}</Text>
            </Section>

            <Heading>
                [{reportType}] {title}
            </Heading>

            {/* Reporter info */}
            <Section style={styles.infoBox}>
                <SectionTitle>Información del Reporter</SectionTitle>
                <InfoRow
                    label="Nombre"
                    value={reporterName}
                />
                <InfoRow
                    label="Email"
                    value={reporterEmail}
                />
            </Section>

            {/* Description */}
            <Section style={styles.descriptionBox}>
                <SectionTitle>Descripción</SectionTitle>
                <Text style={styles.descriptionText}>{description}</Text>
            </Section>

            {/* Optional: severity + reproduction steps */}
            {(hasReproSteps || Boolean(severity)) && (
                <Section style={styles.infoBox}>
                    <SectionTitle>Detalles del Problema</SectionTitle>

                    {severity && (
                        <InfoRow
                            label="Severidad"
                            value={severity}
                        />
                    )}

                    {stepsToReproduce && (
                        <>
                            <Text style={styles.fieldLabel}>Pasos para reproducir</Text>
                            <Text style={styles.fieldValue}>{stepsToReproduce}</Text>
                        </>
                    )}

                    {expectedResult && (
                        <>
                            <Text style={styles.fieldLabel}>Resultado esperado</Text>
                            <Text style={styles.fieldValue}>{expectedResult}</Text>
                        </>
                    )}

                    {actualResult && (
                        <>
                            <Text style={styles.fieldLabel}>Resultado actual</Text>
                            <Text style={styles.fieldValue}>{actualResult}</Text>
                        </>
                    )}
                </Section>
            )}

            {/* Optional: attachment URLs */}
            {Array.isArray(attachmentUrls) && attachmentUrls.length > 0 && (
                <Section style={styles.infoBox}>
                    <SectionTitle>Archivos Adjuntos</SectionTitle>
                    {attachmentUrls.map((url, index) => (
                        <Text
                            key={url}
                            style={styles.fieldValue}
                        >
                            {index + 1}. {url}
                        </Text>
                    ))}
                </Section>
            )}

            {/* Environment data */}
            <Section style={styles.infoBox}>
                <SectionTitle>Entorno</SectionTitle>
                <InfoRow
                    label="Fuente"
                    value={environment.appSource}
                />
                <InfoRow
                    label="Fecha/Hora"
                    value={formatTimestamp(environment.timestamp)}
                />
                {environment.currentUrl && (
                    <InfoRow
                        label="URL"
                        value={environment.currentUrl}
                    />
                )}
                {environment.browser && (
                    <InfoRow
                        label="Navegador"
                        value={environment.browser}
                    />
                )}
                {environment.os && (
                    <InfoRow
                        label="Sistema operativo"
                        value={environment.os}
                    />
                )}
                {environment.viewport && (
                    <InfoRow
                        label="Viewport"
                        value={environment.viewport}
                    />
                )}
                {environment.deployVersion && (
                    <InfoRow
                        label="Versión"
                        value={environment.deployVersion}
                    />
                )}
                {environment.userId && (
                    <InfoRow
                        label="Usuario ID"
                        value={environment.userId}
                    />
                )}
            </Section>

            {/* Optional: console errors */}
            {hasConsoleErrors && (
                <Section style={styles.codeSection}>
                    <SectionTitle>Errores de Consola</SectionTitle>
                    <Text style={styles.codeBlock}>
                        {formatConsoleErrors(environment.consoleErrors ?? [])}
                    </Text>
                </Section>
            )}

            {/* Optional: error info */}
            {hasErrorInfo && environment.errorInfo && (
                <Section style={styles.errorSection}>
                    <SectionTitle>Información del Error</SectionTitle>
                    <Text style={styles.fieldLabel}>Mensaje</Text>
                    <Text style={styles.errorMessage}>{environment.errorInfo.message}</Text>
                    {environment.errorInfo.stack && (
                        <>
                            <Text style={styles.fieldLabel}>Stack trace</Text>
                            <Text style={styles.codeBlock}>{environment.errorInfo.stack}</Text>
                        </>
                    )}
                </Section>
            )}

            {/* Automated footer note */}
            <Text style={styles.footerNote}>
                Enviado automaticamente por el sistema de feedback de Hospeda
            </Text>
        </EmailLayout>
    );
}

const styles = {
    badgeRow: {
        marginBottom: '16px'
    },
    typeBadge: {
        backgroundColor: '#1e293b',
        color: '#ffffff',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '1px',
        padding: '6px 12px',
        borderRadius: '4px',
        display: 'inline-block'
    },
    infoBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '6px',
        padding: '20px',
        margin: '16px 0'
    },
    descriptionBox: {
        backgroundColor: '#f0f9ff',
        borderRadius: '6px',
        borderLeft: '4px solid #0ea5e9',
        padding: '20px',
        margin: '16px 0'
    },
    descriptionText: {
        color: '#1e293b',
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0',
        whiteSpace: 'pre-wrap' as const
    },
    sectionTitle: {
        color: '#1e293b',
        fontSize: '14px',
        fontWeight: '700',
        margin: '0 0 12px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px'
    },
    fieldLabel: {
        color: '#64748b',
        fontSize: '13px',
        fontWeight: '600',
        margin: '12px 0 4px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.3px'
    },
    fieldValue: {
        color: '#1e293b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0 0 8px',
        whiteSpace: 'pre-wrap' as const
    },
    codeSection: {
        backgroundColor: '#f8fafc',
        borderRadius: '6px',
        padding: '20px',
        margin: '16px 0'
    },
    errorSection: {
        backgroundColor: '#fef2f2',
        borderRadius: '6px',
        borderLeft: '4px solid #ef4444',
        padding: '20px',
        margin: '16px 0'
    },
    errorMessage: {
        color: '#991b1b',
        fontSize: '14px',
        fontWeight: '600',
        lineHeight: '20px',
        margin: '0 0 12px'
    },
    codeBlock: {
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
        margin: '32px 0 0',
        textAlign: 'center' as const,
        fontStyle: 'italic'
    }
};
