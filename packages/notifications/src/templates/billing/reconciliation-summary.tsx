import { Text } from '@react-email/components';
import { Button, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';
import { formatDate } from '../utils/format-helpers.js';
import type { ReconciliationReasonLabelResolver } from './reconciliation-labels.js';
import type { ReconciliationSummaryContext } from './reconciliation-summary-enrichment.js';
import {
    buildMarkItem,
    buildPauseGiftItem,
    buildUnderChargeItem,
    reconciliationAdminHref,
    type SummaryItem,
    SummaryItemBlock
} from './reconciliation-summary-rows.js';

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
    /** Details resolved at render time (HOS-1971). Absent: every line is the bare payload line. */
    readonly context?: ReconciliationSummaryContext;
    /**
     * Resolves a reason code to a Spanish label (HOS-2565 D8). Absent or returning
     * `null`: the package's own copy is used, and the raw code only as a last resort.
     */
    readonly resolveReasonLabel?: ReconciliationReasonLabelResolver;
}

/** Subject of the aggregated billing reconciliation email. */
export const RECONCILIATION_SUMMARY_SUBJECT = 'Resumen de conciliación de billing';

/** One section of the summary: a heading and its items. */
interface SummarySection {
    readonly title: string;
    readonly items: readonly SummaryItem[];
    readonly omitted: number;
}

/** Renders the periodic summary of billing reconciliation events for staff. */
export function ReconciliationSummary(props: ReconciliationSummaryProps) {
    const { totals, windowMinutes, context } = props;
    const resolveLabel = props.resolveReasonLabel;
    const environmentLabel = context?.environmentLabel;
    const title = environmentLabel
        ? `[${environmentLabel}] ${RECONCILIATION_SUMMARY_SUBJECT}`
        : RECONCILIATION_SUMMARY_SUBJECT;
    const sections: readonly SummarySection[] = [
        {
            title: 'Marcas abiertas',
            items: props.marks.map((mark) =>
                buildMarkItem({
                    mark,
                    context,
                    resolveLabel,
                    lead: 'Marca abierta',
                    count: mark.count
                })
            ),
            omitted: props.omitted.marks
        },
        {
            title: 'Marcas que pasaron su plazo sin resolverse',
            items: props.escalations.map((mark) =>
                buildMarkItem({
                    mark,
                    context,
                    resolveLabel,
                    lead: 'Marca sin resolver a tiempo',
                    markId: mark.markId
                })
            ),
            omitted: props.omitted.escalations
        },
        {
            title: 'Cobros por debajo del esperado',
            items: props.underCharges.map((charge) =>
                buildUnderChargeItem({ charge, context, resolveLabel })
            ),
            omitted: props.omitted.underCharges
        },
        {
            title: 'Pausas que regalaron días',
            items: props.pauseGifts.map((pause) =>
                buildPauseGiftItem({ pause, context, resolveLabel })
            ),
            omitted: props.omitted.pauseGifts
        }
    ];
    const listHref = reconciliationAdminHref(context);

    return (
        <EmailLayout
            previewText={`${environmentLabel ? `[${environmentLabel}] ` : ''}${totals.events} novedades de conciliación en los últimos ${windowMinutes} minutos`}
        >
            <Heading>{title}</Heading>
            {environmentLabel ? (
                <Text>Ambiente: {environmentLabel}. Este resumen no viene de producción.</Text>
            ) : null}
            <Text>
                Entre {formatDate({ dateString: props.coversFrom })} y{' '}
                {formatDate({ dateString: props.closesAt })} hubo {totals.events} novedades de
                conciliación de billing. Cada una quedó registrada por separado; este correo las
                agrupa por tipo y sujeto.
            </Text>
            {sections.map((section) =>
                section.items.length > 0 || section.omitted > 0 ? (
                    <div key={section.title}>
                        <Heading>{section.title}</Heading>
                        {section.items.map((item, index) => (
                            <SummaryItemBlock
                                key={`${section.title}-${item.key}`}
                                item={item}
                                first={index === 0}
                            />
                        ))}
                        {section.omitted > 0 ? <Text>… y {section.omitted} más</Text> : null}
                    </div>
                ) : null
            )}
            {listHref ? (
                <Button href={listHref}>Abrir el listado de conciliación</Button>
            ) : (
                <Text>El listado accionable de marcas está en el panel de administración.</Text>
            )}
        </EmailLayout>
    );
}
