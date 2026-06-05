import { Section, Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for AiCostThresholdAlert email template (SPEC-173 T-025).
 *
 * Rendered once per SUPER_ADMIN recipient.  The factory in `apps/api`
 * ensures the email is sent at most once per (scope × feature × thresholdPct ×
 * period) combination.
 */
export interface AiCostThresholdAlertProps {
    /** Admin recipient name shown in the greeting. */
    readonly recipientName: string;
    /** Whether this alert is for the global budget or a specific feature. */
    readonly scope: 'global' | 'feature';
    /**
     * AI feature whose spend crossed the threshold.
     * Only set when `scope === 'feature'`.
     */
    readonly feature?: string;
    /** Cost band that was crossed (50 / 80 / 100 %). */
    readonly thresholdPct: 50 | 80 | 100;
    /** Accumulated spend for the current calendar month in micro-USD (µUSD). */
    readonly spentMicroUsd: number;
    /** Configured ceiling value in micro-USD (µUSD). */
    readonly ceilingMicroUsd: number;
    /**
     * Calendar month identifier in `YYYY-MM` format (UTC).
     *
     * @example `'2026-06'`
     */
    readonly period: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts micro-USD to a human-readable USD string with 4 decimal places.
 *
 * @param microUsd - Amount in micro-USD (1 USD = 1,000,000 µUSD).
 * @returns Formatted string such as `'$1.2500 USD'`.
 */
function formatMicroUsd(microUsd: number): string {
    const usd = microUsd / 1_000_000;
    return `$${usd.toFixed(4)} USD`;
}

/**
 * Returns a human-readable severity label for each threshold band.
 */
function getBandLabel(pct: 50 | 80 | 100): string {
    if (pct === 100) return 'LÍMITE ALCANZADO (100%)';
    if (pct === 80) return 'ADVERTENCIA (80%)';
    return 'AVISO (50%)';
}

/**
 * Determines the severity level based on the threshold band.
 */
function getSeverity(pct: 50 | 80 | 100): 'info' | 'warning' | 'critical' {
    if (pct === 100) return 'critical';
    if (pct === 80) return 'warning';
    return 'info';
}

/**
 * Maps severity to the appropriate badge style.
 */
function getSeverityStyle(severity: 'info' | 'warning' | 'critical'): React.CSSProperties {
    const base: React.CSSProperties = {
        fontSize: '12px',
        fontWeight: '700',
        letterSpacing: '0.5px',
        padding: '8px 16px',
        borderRadius: '4px',
        display: 'inline-block'
    };

    if (severity === 'critical') {
        return { ...base, backgroundColor: '#fee2e2', color: '#991b1b' };
    }
    if (severity === 'warning') {
        return { ...base, backgroundColor: '#fef3c7', color: '#92400e' };
    }
    return { ...base, backgroundColor: '#dbeafe', color: '#1e40af' };
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

/**
 * AI cost threshold alert email template (SPEC-173 T-025).
 *
 * Sent to SUPER_ADMIN recipients when accumulated AI spend for the current
 * calendar month crosses 50 %, 80 %, or 100 % of the configured cost ceiling.
 *
 * @param props - {@link AiCostThresholdAlertProps}
 */
export function AiCostThresholdAlert({
    recipientName,
    scope,
    feature,
    thresholdPct,
    spentMicroUsd,
    ceilingMicroUsd,
    period
}: AiCostThresholdAlertProps) {
    const severity = getSeverity(thresholdPct);
    const bandLabel = getBandLabel(thresholdPct);
    const spentFormatted = formatMicroUsd(spentMicroUsd);
    const ceilingFormatted = formatMicroUsd(ceilingMicroUsd);
    const pctActual = ((spentMicroUsd / ceilingMicroUsd) * 100).toFixed(1);
    const scopeLabel = scope === 'global' ? 'Global' : `Funcionalidad: ${feature ?? 'desconocida'}`;

    return (
        <EmailLayout previewText={`[Admin] Alerta de costo IA — ${thresholdPct}% del presupuesto`}>
            <Section style={styles.adminHeader}>
                <Text style={styles.adminBadge}>NOTIFICACIÓN ADMINISTRATIVA</Text>
                <Text style={getSeverityStyle(severity)}>{bandLabel}</Text>
            </Section>

            <Heading>Alerta de Costo de IA</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                El gasto acumulado de IA para el mes <strong>{period}</strong> ha alcanzado el{' '}
                <strong>{thresholdPct}%</strong> del presupuesto configurado.
            </Text>

            <Section style={styles.detailsBox}>
                <Text style={styles.sectionTitle}>Detalles del Gasto</Text>
                <InfoRow
                    label="Período"
                    value={period}
                />
                <InfoRow
                    label="Alcance"
                    value={scopeLabel}
                />
                <InfoRow
                    label="Umbral cruzado"
                    value={`${thresholdPct}% (actual: ${pctActual}%)`}
                />
                <InfoRow
                    label="Gasto acumulado"
                    value={spentFormatted}
                />
                <InfoRow
                    label="Presupuesto límite"
                    value={ceilingFormatted}
                />
            </Section>

            {thresholdPct === 100 && (
                <Section style={styles.warningBox}>
                    <Text style={styles.warningText}>
                        El presupuesto ha sido <strong>agotado</strong>. Las solicitudes de IA están
                        siendo bloqueadas hasta que el presupuesto sea incrementado o se reinicie el
                        período mensual.
                    </Text>
                </Section>
            )}

            {thresholdPct === 80 && (
                <Section style={styles.warningBox}>
                    <Text style={styles.warningText}>
                        El 80% del presupuesto ha sido consumido. Revisá el panel de administración
                        para ajustar el límite si es necesario.
                    </Text>
                </Section>
            )}

            <Text style={styles.footerNote}>
                Esta es una notificación automática del sistema. Accedé al panel de administración
                para revisar el detalle de uso de IA o ajustar los límites de costo.
            </Text>
        </EmailLayout>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
    warningBox: {
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
    warningText: {
        color: '#1e293b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0'
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
