import { Hr, Link, Text } from '@react-email/components';
import { emailPalette } from '@repo/email';
import { InfoRow } from '../components/info-row.js';
import { formatCurrency, formatDate } from '../utils/format-helpers.js';
import {
    type ReconciliationReasonLabelResolver,
    resolveReasonLabel,
    subjectTypeLabel
} from './reconciliation-labels.js';
import { describeSubject } from './reconciliation-subject-detail.js';
import {
    openMarkKey,
    type ReconciliationSummaryContext,
    reconciliationReasonCopy
} from './reconciliation-summary-enrichment.js';

/**
 * Item builders and the item block of the reconciliation summary (HOS-2565 §7.6).
 * Every item is a bold lead line followed by labeled rows, never one line joined
 * with " · ".
 *
 * @module templates/billing/reconciliation-summary-rows
 */

const RECONCILIATION_PATH = '/billing/reconciliation/';

/** One labeled row of an item. */
export interface SummaryRow {
    readonly label: string;
    readonly value: string;
}

/** One item of the summary: a lead line, its labeled rows and what to do. */
export interface SummaryItem {
    readonly key: string;
    readonly lead: string;
    readonly rows: readonly SummaryRow[];
    /** The one-line next step for staff (only for marks of a known reason). */
    readonly action?: string;
    /** Absolute admin URL of the page where the item is handled. */
    readonly href?: string;
}

/** What every builder needs from the render. */
interface BuildInput {
    readonly context: ReconciliationSummaryContext | undefined;
    readonly resolveLabel: ReconciliationReasonLabelResolver | undefined;
}

type Subject = 'subscription' | 'addon_instance';

function plural(count: number, singular: string, pluralForm: string): string {
    return count === 1 ? singular : pluralForm;
}

/** Drops the rows whose value is not available. */
function present(rows: readonly (SummaryRow | null)[]): readonly SummaryRow[] {
    return rows.filter((row): row is SummaryRow => row !== null);
}

function row(label: string, value: string | null | undefined): SummaryRow | null {
    return value ? { label, value } : null;
}

/** Absolute admin URL of the reconciliation list, or of one mark's events. */
export function reconciliationAdminHref(
    context: ReconciliationSummaryContext | undefined,
    markId?: string
): string | undefined {
    if (!context?.adminUrl) return undefined;
    return markId
        ? `${context.adminUrl}${RECONCILIATION_PATH}${markId}/events`
        : `${context.adminUrl}${RECONCILIATION_PATH}`;
}

/** Holder, listings, plan and status rows of a resolved subject. */
function subjectRows(input: {
    readonly context: ReconciliationSummaryContext | undefined;
    readonly subjectType: Subject;
    readonly subjectId: string;
}): readonly (SummaryRow | null)[] {
    const detail = describeSubject(input);
    if (!detail) return [];
    return [
        row('Titular', detail.holder),
        row('Fichas', detail.listings),
        row('Plan', detail.plan),
        row('Estado', detail.status)
    ];
}

/** Builds an item for a mark group or for an escalated mark. */
export function buildMarkItem(
    input: BuildInput & {
        readonly mark: {
            readonly reason: string;
            readonly subjectType: Subject;
            readonly subjectId: string;
        };
        readonly lead: string;
        readonly markId?: string;
        readonly count?: number;
    }
): SummaryItem {
    const { mark, context } = input;
    const copy = reconciliationReasonCopy(mark.reason);
    const open = context?.openMarks.get(
        openMarkKey({ subjectId: mark.subjectId, reason: mark.reason })
    );
    const placedAt = open ? formatDate({ dateString: open.placedAt }) : null;
    const href = reconciliationAdminHref(context, input.markId ?? open?.markId);
    return {
        key: `${mark.reason}|${mark.subjectId}|${input.markId ?? ''}`,
        lead: input.lead,
        rows: present([
            row('Motivo', resolveReasonLabel({ reason: mark.reason, resolve: input.resolveLabel })),
            row(subjectTypeLabel(mark.subjectType), mark.subjectId),
            ...subjectRows({ context, subjectType: mark.subjectType, subjectId: mark.subjectId }),
            row('Marca abierta el', placedAt),
            row(
                'Veces',
                input.count === undefined
                    ? null
                    : `${input.count} ${plural(input.count, 'vez', 'veces')}`
            ),
            row('Marca', input.markId ? input.markId : null)
        ]),
        ...(copy ? { action: copy.action } : {}),
        ...(href ? { href } : {})
    };
}

/** Builds an item for a payment charged below what the plan expects. */
export function buildUnderChargeItem(
    input: BuildInput & {
        readonly charge: {
            readonly subscriptionId: string;
            readonly paymentId: string;
            readonly currency: string;
            readonly expectedMinor: number;
            readonly chargedMinor: number;
            readonly differenceMinor: number;
        };
    }
): SummaryItem {
    const { charge, context } = input;
    const money = (amount: number) => formatCurrency({ amount, currency: charge.currency });
    const href = reconciliationAdminHref(context);
    return {
        key: `${charge.subscriptionId}|${charge.paymentId}`,
        lead: 'Cobro por debajo del esperado',
        rows: present([
            ...subjectRows({
                context,
                subjectType: 'subscription',
                subjectId: charge.subscriptionId
            }),
            row('Suscripción', charge.subscriptionId),
            row('Pago', charge.paymentId),
            row('Esperado', money(charge.expectedMinor)),
            row('Cobrado', money(charge.chargedMinor)),
            row('Diferencia', money(charge.differenceMinor))
        ]),
        ...(href ? { href } : {})
    };
}

/** Builds an item for a pause that gifted days. */
export function buildPauseGiftItem(
    input: BuildInput & {
        readonly pause: {
            readonly subscriptionId: string;
            readonly pauseId: string;
            readonly pauseStartedAt: string;
            readonly pauseEndedAt: string;
            readonly skippedChargeAt: string;
            readonly nextChargeAfterReturnAt: string;
            readonly giftDays: number;
        };
    }
): SummaryItem {
    const { pause, context } = input;
    const href = reconciliationAdminHref(context);
    return {
        key: `${pause.subscriptionId}|${pause.pauseId}`,
        lead: 'Pausa que regaló días',
        rows: present([
            ...subjectRows({
                context,
                subjectType: 'subscription',
                subjectId: pause.subscriptionId
            }),
            row('Suscripción', pause.subscriptionId),
            row(
                'Período',
                `del ${formatDate({ dateString: pause.pauseStartedAt })} al ${formatDate({ dateString: pause.pauseEndedAt })}`
            ),
            row('Cobro salteado', formatDate({ dateString: pause.skippedChargeAt })),
            row('Próximo cobro', formatDate({ dateString: pause.nextChargeAfterReturnAt })),
            row('Días de regalo', String(pause.giftDays))
        ]),
        ...(href ? { href } : {})
    };
}

/**
 * Renders one summary item: lead line, labeled rows, "Qué hacer" and the link.
 * A hairline divider goes before every item but the first of its section.
 */
export function SummaryItemBlock(props: { readonly item: SummaryItem; readonly first: boolean }) {
    const { item } = props;
    return (
        <div>
            {props.first ? null : <Hr style={dividerStyle} />}
            <Text style={leadStyle}>
                <strong>{item.lead}</strong>
            </Text>
            {item.rows.map((itemRow) => (
                <InfoRow
                    key={`${item.key}-${itemRow.label}`}
                    label={itemRow.label}
                    value={itemRow.value}
                />
            ))}
            {item.action ? <Text>Qué hacer: {item.action}</Text> : null}
            {item.href ? (
                <Text>
                    <Link href={item.href}>Abrir en el panel</Link>
                </Text>
            ) : null}
        </div>
    );
}

const dividerStyle = {
    borderColor: emailPalette.border,
    margin: '20px 0'
};

const leadStyle = {
    margin: '0 0 8px'
};
