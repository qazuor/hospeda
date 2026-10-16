import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatCurrency, formatDate } from '../utils/format-helpers.js';

/** One event group in the reconciliation summary. */
export interface ReconciliationSummaryMark {
    readonly reason: string;
    readonly subjectType: 'subscription' | 'addon_instance';
    readonly subjectId: string;
    readonly count: number;
}

/** One escalated mark in the reconciliation summary. */
export interface ReconciliationSummaryEscalation {
    readonly reason: string;
    readonly subjectType: 'subscription' | 'addon_instance';
    readonly subjectId: string;
    readonly markId: string;
}

/** One undercharged payment in the reconciliation summary. */
export interface ReconciliationSummaryUnderCharge {
    readonly subscriptionId: string;
    readonly paymentId: string;
    readonly currency: string;
    readonly expectedMinor: number;
    readonly chargedMinor: number;
    readonly differenceMinor: number;
}

/** One pause that produced a positive net gift of days. */
export interface ReconciliationSummaryPauseGift {
    readonly subscriptionId: string;
    readonly pauseId: string;
    readonly pauseStartedAt: string;
    readonly pauseEndedAt: string;
    readonly skippedChargeAt: string;
    readonly nextChargeAfterReturnAt: string;
    readonly giftDays: number;
}

/** Payload rendered for one aggregated reconciliation email. */
export interface ReconciliationSummaryProps {
    readonly windowId: string;
    readonly coversFrom: string;
    readonly closesAt: string;
    readonly windowMinutes: number;
    readonly totals: { readonly events: number };
    readonly marks: readonly ReconciliationSummaryMark[];
    readonly escalations: readonly ReconciliationSummaryEscalation[];
    readonly underCharges: readonly ReconciliationSummaryUnderCharge[];
    readonly pauseGifts: readonly ReconciliationSummaryPauseGift[];
    readonly omitted: {
        readonly marks: number;
        readonly escalations: number;
        readonly underCharges: number;
        readonly pauseGifts: number;
    };
}

/** Subject of the aggregated billing reconciliation email. */
export const RECONCILIATION_SUMMARY_SUBJECT = 'Resumen de conciliación de billing';

function plural(count: number, singular: string, pluralForm: string): string {
    return count === 1 ? singular : pluralForm;
}

function omittedLine(count: number) {
    return count > 0 ? `… y ${count} más` : null;
}

/** Renders the periodic summary of billing reconciliation events for staff. */
export function ReconciliationSummary(props: ReconciliationSummaryProps) {
    const { totals, windowMinutes } = props;
    const sections = [
        {
            title: 'Marcas abiertas',
            lines: [
                ...props.marks.map(
                    (mark) =>
                        `${mark.reason} · ${mark.subjectType} ${mark.subjectId} · ${mark.count} ${plural(mark.count, 'vez', 'veces')}`
                ),
                omittedLine(props.omitted.marks)
            ]
        },
        {
            title: 'Marcas que pasaron su plazo sin resolverse',
            lines: [
                ...props.escalations.map(
                    (mark) =>
                        `${mark.reason} · ${mark.subjectType} ${mark.subjectId} · marca ${mark.markId}`
                ),
                omittedLine(props.omitted.escalations)
            ]
        },
        {
            title: 'Cobros por debajo del esperado',
            lines: [
                ...props.underCharges.map(
                    (charge) =>
                        `suscripción ${charge.subscriptionId} · pago ${charge.paymentId} · esperado ${formatCurrency({ amount: charge.expectedMinor, currency: charge.currency })} · cobrado ${formatCurrency({ amount: charge.chargedMinor, currency: charge.currency })} · diferencia ${formatCurrency({ amount: charge.differenceMinor, currency: charge.currency })}`
                ),
                omittedLine(props.omitted.underCharges)
            ]
        },
        {
            title: 'Pausas que regalaron días',
            lines: [
                ...props.pauseGifts.map(
                    (pause) =>
                        `suscripción ${pause.subscriptionId} · pausa ${pause.pauseId} · del ${formatDate({ dateString: pause.pauseStartedAt })} al ${formatDate({ dateString: pause.pauseEndedAt })} · fecha de cobro salteada ${formatDate({ dateString: pause.skippedChargeAt })} · próximo cobro ${formatDate({ dateString: pause.nextChargeAfterReturnAt })} · ${pause.giftDays} días de regalo`
                ),
                omittedLine(props.omitted.pauseGifts)
            ]
        }
    ];

    return (
        <EmailLayout
            previewText={`${totals.events} novedades de conciliación en los últimos ${windowMinutes} minutos`}
        >
            <Heading>{RECONCILIATION_SUMMARY_SUBJECT}</Heading>
            <Text>
                Entre {formatDate({ dateString: props.coversFrom })} y{' '}
                {formatDate({ dateString: props.closesAt })} hubo {totals.events} novedades de
                conciliación de billing. Cada una quedó registrada por separado; este correo las
                agrupa por tipo y sujeto.
            </Text>
            {sections.map((section) => {
                const lines = section.lines.filter((line): line is string => line !== null);
                return lines.length ? (
                    <div key={section.title}>
                        <Heading>{section.title}</Heading>
                        {lines.map((line) => (
                            <Text key={`${section.title}-${line}`}>{line}</Text>
                        ))}
                    </div>
                ) : null;
            })}
            <Text>El listado accionable de marcas está en el panel de administración.</Text>
        </EmailLayout>
    );
}
