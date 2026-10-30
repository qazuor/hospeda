import { Link, Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatCurrency, formatDate } from '../utils/format-helpers.js';
import {
    openMarkKey,
    type ReconciliationAddonDetail,
    type ReconciliationSubscriptionDetail,
    type ReconciliationSummaryContext,
    reconciliationReasonCopy,
    shortId
} from './reconciliation-summary-enrichment.js';

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
}

/** Subject of the aggregated billing reconciliation email. */
export const RECONCILIATION_SUMMARY_SUBJECT = 'Resumen de conciliación de billing';

const RECONCILIATION_PATH = '/billing/reconciliation/';

const VERTICAL_LABELS: Readonly<Record<string, string>> = {
    accommodation: 'Alojamientos',
    venue: 'Comer y salir',
    experience: 'Experiencias',
    tourist: 'Turistas',
    partner: 'Aliados'
};
const CYCLE_LABELS: Readonly<Record<string, string>> = {
    monthly: 'mensual',
    quarterly: 'trimestral',
    semiannual: 'semestral',
    annual: 'anual'
};
const STATUS_LABELS: Readonly<Record<string, string>> = {
    PENDING_AUTHORIZATION: 'pendiente de autorización',
    ABANDONED: 'abandonada',
    ACTIVE: 'activa',
    GRACE_PERIOD: 'en gracia',
    PAUSED: 'pausada',
    SUSPENDED: 'suspendida',
    CANCEL_SCHEDULED: 'baja programada',
    CANCELLED: 'cancelada',
    CHARGE_DECLINED: 'cobro rechazado'
};
const MAX_LISTING_NAMES = 3;

/** One rendered line. `text` is the whole line when there is nothing to add. */
interface SummaryLine {
    readonly key: string;
    readonly text: string;
    readonly action?: string;
    readonly href?: string;
}

function plural(count: number, singular: string, pluralForm: string): string {
    return count === 1 ? singular : pluralForm;
}

function omittedLine(count: number): SummaryLine | null {
    return count > 0 ? { key: 'omitted', text: `… y ${count} más` } : null;
}

function holderText(detail: {
    readonly holderName: string | null;
    readonly holderEmail: string | null;
}): string | null {
    if (detail.holderName && detail.holderEmail)
        return `${detail.holderName} <${detail.holderEmail}>`;
    return detail.holderName ?? detail.holderEmail;
}

function listingsText(names: readonly string[]): string | null {
    if (names.length === 0) return null;
    const shown = names.slice(0, MAX_LISTING_NAMES).join(', ');
    const rest = names.length - MAX_LISTING_NAMES;
    return `fichas: ${rest > 0 ? `${shown} y ${rest} más` : shown}`;
}

function planText(detail: ReconciliationSubscriptionDetail): string | null {
    const parts = [
        detail.vertical ? (VERTICAL_LABELS[detail.vertical] ?? detail.vertical) : null,
        detail.planName,
        detail.cycle ? (CYCLE_LABELS[detail.cycle] ?? detail.cycle) : null,
        detail.amountMinor !== null && detail.currency
            ? formatCurrency({ amount: detail.amountMinor, currency: detail.currency })
            : null
    ].filter((part): part is string => part !== null);
    return parts.length ? parts.join(' ') : null;
}

function joinParts(parts: readonly (string | null)[]): string {
    return parts.filter((part): part is string => part !== null && part !== '').join(' · ');
}

function adminHref(
    context: ReconciliationSummaryContext | undefined,
    markId?: string
): string | undefined {
    if (!context?.adminUrl) return undefined;
    return markId
        ? `${context.adminUrl}${RECONCILIATION_PATH}${markId}/events`
        : `${context.adminUrl}${RECONCILIATION_PATH}`;
}

function subscriptionDetail(
    context: ReconciliationSummaryContext | undefined,
    id: string
): ReconciliationSubscriptionDetail | undefined {
    return context?.subscriptions.get(id);
}

function subjectDetail(
    context: ReconciliationSummaryContext | undefined,
    subjectType: 'subscription' | 'addon_instance',
    id: string
): { who: string | null; what: string | null; status: string } | null {
    if (subjectType === 'subscription') {
        const detail = subscriptionDetail(context, id);
        if (!detail) return null;
        return {
            who: joinParts([holderText(detail), listingsText(detail.listingNames)]) || null,
            what: planText(detail),
            status: detail.status
        };
    }
    const addon: ReconciliationAddonDetail | undefined = context?.addonInstances.get(id);
    if (!addon) return null;
    return {
        who: holderText(addon),
        what: addon.addonName ? `Complemento ${addon.addonName}` : 'Complemento',
        status: addon.status
    };
}

function markLine(input: {
    readonly mark: {
        readonly reason: string;
        readonly subjectType: 'subscription' | 'addon_instance';
        readonly subjectId: string;
    };
    readonly suffix: string;
    readonly fallback: string;
    readonly markId?: string;
    readonly context: ReconciliationSummaryContext | undefined;
}): SummaryLine {
    const { mark, context } = input;
    const subject = subjectDetail(context, mark.subjectType, mark.subjectId);
    const key = `${mark.reason}|${mark.subjectId}|${input.markId ?? ''}`;
    if (!subject) return { key, text: input.fallback };
    const copy = reconciliationReasonCopy(mark.reason);
    const open = context?.openMarks.get(
        openMarkKey({ subjectId: mark.subjectId, reason: mark.reason })
    );
    const placedAt = open ? formatDate({ dateString: open.placedAt }) : null;
    return {
        key,
        text: joinParts([
            copy?.label ?? mark.reason,
            subject.who,
            subject.what,
            `estado: ${STATUS_LABELS[subject.status] ?? subject.status}`,
            placedAt ? `marca abierta el ${placedAt}` : null,
            input.suffix,
            `ref. ${shortId(mark.subjectId)}`
        ]),
        ...(copy ? { action: copy.action } : {}),
        ...(adminHref(context, input.markId ?? open?.markId)
            ? { href: adminHref(context, input.markId ?? open?.markId) }
            : {})
    };
}

function subscriptionEventLine(input: {
    readonly key: string;
    readonly subscriptionId: string;
    readonly fallback: string;
    readonly lead: string;
    readonly tail: string;
    readonly context: ReconciliationSummaryContext | undefined;
}): SummaryLine {
    const subject = subjectDetail(input.context, 'subscription', input.subscriptionId);
    if (!subject) return { key: input.key, text: input.fallback };
    return {
        key: input.key,
        text: joinParts([
            input.lead,
            subject.who,
            subject.what,
            `estado: ${STATUS_LABELS[subject.status] ?? subject.status}`,
            input.tail,
            `ref. ${shortId(input.subscriptionId)}`
        ]),
        ...(adminHref(input.context) ? { href: adminHref(input.context) } : {})
    };
}

/** Renders the periodic summary of billing reconciliation events for staff. */
export function ReconciliationSummary(props: ReconciliationSummaryProps) {
    const { totals, windowMinutes, context } = props;
    const environmentLabel = context?.environmentLabel;
    const title = environmentLabel
        ? `[${environmentLabel}] ${RECONCILIATION_SUMMARY_SUBJECT}`
        : RECONCILIATION_SUMMARY_SUBJECT;
    const sections: readonly {
        readonly title: string;
        readonly lines: readonly (SummaryLine | null)[];
    }[] = [
        {
            title: 'Marcas abiertas',
            lines: [
                ...props.marks.map((mark) =>
                    markLine({
                        mark,
                        context,
                        suffix: `${mark.count} ${plural(mark.count, 'vez', 'veces')}`,
                        fallback: `${mark.reason} · ${mark.subjectType} ${mark.subjectId} · ${mark.count} ${plural(mark.count, 'vez', 'veces')}`
                    })
                ),
                omittedLine(props.omitted.marks)
            ]
        },
        {
            title: 'Marcas que pasaron su plazo sin resolverse',
            lines: [
                ...props.escalations.map((mark) =>
                    markLine({
                        mark,
                        context,
                        markId: mark.markId,
                        suffix: `marca ${shortId(mark.markId)}`,
                        fallback: `${mark.reason} · ${mark.subjectType} ${mark.subjectId} · marca ${mark.markId}`
                    })
                ),
                omittedLine(props.omitted.escalations)
            ]
        },
        {
            title: 'Cobros por debajo del esperado',
            lines: [
                ...props.underCharges.map((charge) => {
                    const money = (amount: number) =>
                        formatCurrency({ amount, currency: charge.currency });
                    return subscriptionEventLine({
                        key: `${charge.subscriptionId}|${charge.paymentId}`,
                        subscriptionId: charge.subscriptionId,
                        context,
                        lead: 'Cobro por debajo del esperado',
                        tail: `esperado ${money(charge.expectedMinor)} · cobrado ${money(charge.chargedMinor)} · diferencia ${money(charge.differenceMinor)} · pago ${shortId(charge.paymentId)}`,
                        fallback: `suscripción ${charge.subscriptionId} · pago ${charge.paymentId} · esperado ${money(charge.expectedMinor)} · cobrado ${money(charge.chargedMinor)} · diferencia ${money(charge.differenceMinor)}`
                    });
                }),
                omittedLine(props.omitted.underCharges)
            ]
        },
        {
            title: 'Pausas que regalaron días',
            lines: [
                ...props.pauseGifts.map((pause) => {
                    const period = `del ${formatDate({ dateString: pause.pauseStartedAt })} al ${formatDate({ dateString: pause.pauseEndedAt })}`;
                    return subscriptionEventLine({
                        key: `${pause.subscriptionId}|${pause.pauseId}`,
                        subscriptionId: pause.subscriptionId,
                        context,
                        lead: 'Pausa que regaló días',
                        tail: `${period} · fecha de cobro salteada ${formatDate({ dateString: pause.skippedChargeAt })} · próximo cobro ${formatDate({ dateString: pause.nextChargeAfterReturnAt })} · ${pause.giftDays} días de regalo`,
                        fallback: `suscripción ${pause.subscriptionId} · pausa ${pause.pauseId} · ${period} · fecha de cobro salteada ${formatDate({ dateString: pause.skippedChargeAt })} · próximo cobro ${formatDate({ dateString: pause.nextChargeAfterReturnAt })} · ${pause.giftDays} días de regalo`
                    });
                }),
                omittedLine(props.omitted.pauseGifts)
            ]
        }
    ];
    const listHref = adminHref(context);

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
            {sections.map((section) => {
                const lines = section.lines.filter((line): line is SummaryLine => line !== null);
                return lines.length ? (
                    <div key={section.title}>
                        <Heading>{section.title}</Heading>
                        {lines.map((line) => (
                            <Text key={`${section.title}-${line.key}`}>
                                {line.text}
                                {line.action ? (
                                    <>
                                        <br />
                                        Qué hacer: {line.action}
                                    </>
                                ) : null}
                                {line.href ? (
                                    <>
                                        <br />
                                        <Link href={line.href}>Abrir en el panel</Link>
                                    </>
                                ) : null}
                            </Text>
                        ))}
                    </div>
                ) : null;
            })}
            {listHref ? (
                <Text>
                    El listado accionable de marcas está en el panel de administración:{' '}
                    <Link href={listHref}>{listHref}</Link>
                </Text>
            ) : (
                <Text>El listado accionable de marcas está en el panel de administración.</Text>
            )}
        </EmailLayout>
    );
}
