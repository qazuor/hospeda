import type { EmailOutboxRow } from '@repo/db';
import {
    DUPLICATE_CHARGE_DETECTED_SUBJECT,
    DuplicateChargeDetected,
    MARK_ESCALATED_SUBJECT,
    MarkEscalated,
    RECONCILIATION_SUMMARY_SUBJECT,
    REVOCATION_REFUND_FAILED_SUBJECT,
    type ReconciliationReasonLabelResolver,
    ReconciliationSummary,
    type ReconciliationSummaryContext,
    RevocationRefundFailed
} from '../../templates/billing/index.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';
import { readSubjectContext, type SubjectEnrichment } from './reconciliation-context.js';

const REQUIRED = 'Faltan datos requeridos del aviso de conciliación';
type Data = Record<string, unknown>;

function payloadOf(row: EmailOutboxRow): Data {
    const payload: unknown = row.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
        throw new TypeError(REQUIRED);
    return payload as Data;
}

function isIso(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
        Number.isFinite(Date.parse(value))
    );
}
function isString(value: unknown): value is string {
    return typeof value === 'string';
}
function isInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value);
}
function isSubject(value: unknown): value is 'subscription' | 'addon_instance' {
    return value === 'subscription' || value === 'addon_instance';
}
function isArray(value: unknown): value is Data[] {
    return (
        Array.isArray(value) &&
        value.every((item) => !!item && typeof item === 'object' && !Array.isArray(item))
    );
}
function stringFields(data: Data, fields: readonly string[]): boolean {
    return fields.every((field) => isString(data[field]));
}
function validMark(value: Data): boolean {
    return (
        stringFields(value, ['reason', 'subjectId']) &&
        isSubject(value.subjectType) &&
        isInteger(value.count) &&
        value.count > 0
    );
}
function validEscalation(value: Data): boolean {
    return stringFields(value, ['reason', 'subjectId', 'markId']) && isSubject(value.subjectType);
}
function validUnderCharge(value: Data): boolean {
    return (
        stringFields(value, ['subscriptionId', 'paymentId', 'currency']) &&
        ['expectedMinor', 'chargedMinor', 'differenceMinor'].every((field) =>
            isInteger(value[field])
        )
    );
}
function validPauseGift(value: Data): boolean {
    return (
        stringFields(value, ['subscriptionId', 'pauseId']) &&
        ['pauseStartedAt', 'pauseEndedAt', 'skippedChargeAt', 'nextChargeAfterReturnAt'].every(
            (field) => isIso(value[field])
        ) &&
        isInteger(value.giftDays)
    );
}
function validOmitted(value: unknown): value is Data {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const omitted = value as Data;
    return ['marks', 'escalations', 'underCharges', 'pauseGifts'].every((field) => {
        const count = omitted[field];
        return isInteger(count) && count >= 0;
    });
}

/** Render-time collaborators of the summary mail and the immediate notices (HOS-1971, HOS-2565). */
interface SummaryEnrichment extends SubjectEnrichment {
    /** Spanish label of a reason code, injected by `apps/api` (HOS-2565 D8). */
    readonly resolveReasonLabel?: ReconciliationReasonLabelResolver;
}

/** The ids a summary payload names, for ONE batched read. */
function summaryLookup(data: Data) {
    const subscriptionIds = new Set<string>();
    const addonInstanceIds = new Set<string>();
    for (const mark of [...(data.marks as Data[]), ...(data.escalations as Data[])]) {
        (mark.subjectType === 'subscription' ? subscriptionIds : addonInstanceIds).add(
            mark.subjectId as string
        );
    }
    for (const row of [...(data.underCharges as Data[]), ...(data.pauseGifts as Data[])]) {
        subscriptionIds.add(row.subscriptionId as string);
    }
    return { subscriptionIds: [...subscriptionIds], addonInstanceIds: [...addonInstanceIds] };
}

/** Resolves the holder and plan of the ONE subject an immediate notice names. */
function noticeContext(
    subject: { readonly subjectType: string; readonly subjectId: string },
    enrichment: SummaryEnrichment
): Promise<ReconciliationSummaryContext> {
    const isSubscription = subject.subjectType === 'subscription';
    return readSubjectContext({
        enrichment,
        lookup: {
            subscriptionIds: isSubscription ? [subject.subjectId] : [],
            addonInstanceIds: isSubscription ? [] : [subject.subjectId]
        }
    });
}

function reconciliationSummary(row: EmailOutboxRow, enrichment: SummaryEnrichment) {
    const data = payloadOf(row);
    const totals = data.totals;
    const totalEvents = totals && typeof totals === 'object' ? (totals as Data).events : undefined;
    if (
        !stringFields(data, ['windowId']) ||
        !isIso(data.coversFrom) ||
        !isIso(data.closesAt) ||
        !isInteger(data.windowMinutes) ||
        data.windowMinutes <= 0 ||
        !isInteger(totalEvents) ||
        totalEvents < 0 ||
        !isArray(data.marks) ||
        !data.marks.every(validMark) ||
        !isArray(data.escalations) ||
        !data.escalations.every(validEscalation) ||
        !isArray(data.underCharges) ||
        !data.underCharges.every(validUnderCharge) ||
        !isArray(data.pauseGifts) ||
        !data.pauseGifts.every(validPauseGift) ||
        !validOmitted(data.omitted)
    )
        throw new TypeError(REQUIRED);
    // Validation stays synchronous (a bad payload throws at once); only the lookup is awaited.
    return renderSummary(data, enrichment);
}

async function renderSummary(data: Data, enrichment: SummaryEnrichment) {
    const context = await readSubjectContext({ lookup: summaryLookup(data), enrichment });
    // TYPE-WORKAROUND: The manually validated outbox payload is the template props contract.
    const props = data as unknown as Parameters<typeof ReconciliationSummary>[0];
    return {
        subject: RECONCILIATION_SUMMARY_SUBJECT,
        react: (
            <ReconciliationSummary
                {...props}
                context={context}
                {...(enrichment.resolveReasonLabel
                    ? { resolveReasonLabel: enrichment.resolveReasonLabel }
                    : {})}
            />
        )
    };
}

/** Props the immediate notices share: the admin link and the injected reason labels. */
function noticeExtras(enrichment: SummaryEnrichment) {
    return {
        ...(enrichment.adminUrl ? { adminUrl: enrichment.adminUrl } : {}),
        ...(enrichment.resolveReasonLabel
            ? { resolveReasonLabel: enrichment.resolveReasonLabel }
            : {})
    };
}

function duplicateChargeDetected(row: EmailOutboxRow, enrichment: SummaryEnrichment) {
    const data = payloadOf(row);
    if (
        !stringFields(data, ['markId', 'subjectId', 'reason']) ||
        !isSubject(data.subjectType) ||
        data.reason !== 'COBRO_DUPLICADO' ||
        !isIso(data.openedAt) ||
        !(data.paymentId === null || isString(data.paymentId))
    )
        throw new TypeError(REQUIRED);
    // Validation stays synchronous (a bad payload throws at once); only the lookup is awaited.
    return renderDuplicateCharge(data, enrichment);
}

async function renderDuplicateCharge(data: Data, enrichment: SummaryEnrichment) {
    const context = await noticeContext(
        { subjectType: data.subjectType as string, subjectId: data.subjectId as string },
        enrichment
    );
    // TYPE-WORKAROUND: The manually validated outbox payload is the template props contract.
    return {
        subject: DUPLICATE_CHARGE_DETECTED_SUBJECT,
        react: (
            <DuplicateChargeDetected
                {...(data as unknown as Parameters<typeof DuplicateChargeDetected>[0])}
                context={context}
                {...noticeExtras(enrichment)}
            />
        )
    };
}

function markEscalated(row: EmailOutboxRow, enrichment: SummaryEnrichment) {
    const data = payloadOf(row);
    if (
        !stringFields(data, ['markId', 'subjectId', 'reason']) ||
        !isSubject(data.subjectType) ||
        !isIso(data.placedAt) ||
        !isIso(data.escalatedAt) ||
        !isInteger(data.escalationDays) ||
        (data.escalationDays as number) <= 0
    )
        throw new TypeError(REQUIRED);
    // Validation stays synchronous (a bad payload throws at once); only the lookup is awaited.
    return renderMarkEscalated(data, enrichment);
}

async function renderMarkEscalated(data: Data, enrichment: SummaryEnrichment) {
    const context = await noticeContext(
        { subjectType: data.subjectType as string, subjectId: data.subjectId as string },
        enrichment
    );
    // TYPE-WORKAROUND: The manually validated outbox payload is the template props contract.
    return {
        subject: MARK_ESCALATED_SUBJECT,
        react: (
            <MarkEscalated
                {...(data as unknown as Parameters<typeof MarkEscalated>[0])}
                context={context}
                {...noticeExtras(enrichment)}
            />
        )
    };
}

function revocationRefundFailed(row: EmailOutboxRow, enrichment: SummaryEnrichment) {
    const data = payloadOf(row);
    const subjectValid =
        (data.subjectType === null && data.subjectId === null) ||
        (isSubject(data.subjectType) && isString(data.subjectId));
    if (
        !stringFields(data, ['refundId', 'sourceId']) ||
        !['REVOCATION', 'ADDON_ORPHAN', 'ONE_TIME_ADDON_REVOCATION'].includes(
            data.refundReason as string
        ) ||
        !['payment', 'manual_payment'].includes(data.sourceKind as string) ||
        !subjectValid ||
        !isInteger(data.amountMinor) ||
        data.amountMinor <= 0 ||
        !(data.currency === null || isString(data.currency)) ||
        !isIso(data.failedAt)
    )
        throw new TypeError(REQUIRED);
    // TYPE-WORKAROUND: The manually validated outbox payload is the template props contract.
    return {
        subject: REVOCATION_REFUND_FAILED_SUBJECT,
        react: (
            <RevocationRefundFailed
                {...(data as unknown as Parameters<typeof RevocationRefundFailed>[0])}
                {...(enrichment.adminUrl ? { adminUrl: enrichment.adminUrl } : {})}
            />
        )
    };
}

/**
 * Creates production renderers for the aggregated reconciliation and three immediate billing notices.
 *
 * The summary renderer resolves holders, plans and listings through `readSubjects`
 * (one batched call per mail) and marks the environment; both are optional, and a
 * failing reader never blocks the send (HOS-1971). The duplicate-charge and
 * escalated-mark notices use the same reader for their holder and plan rows, and all
 * three notices link to the admin panel through `adminUrl` (HOS-2565 D9, §7.7).
 * `resolveReasonLabel` supplies the Spanish label of a reason code (D8).
 */
export function createBillingReconciliationRenderers(
    input: {
        readonly siteUrl: string;
    } & SummaryEnrichment
): Readonly<Record<string, OutboxMailRenderer>> {
    const adminUrl = input.adminUrl?.replace(/\/$/, '');
    const enrichment: SummaryEnrichment = {
        ...input,
        ...(adminUrl ? { adminUrl } : {})
    };
    return {
        'billing.reconciliation-summary': ({ row }) => reconciliationSummary(row, enrichment),
        'billing.duplicate-charge-detected': ({ row }) => duplicateChargeDetected(row, enrichment),
        'billing.mark-escalated': ({ row }) => markEscalated(row, enrichment),
        'billing.revocation-refund-failed': ({ row }) => revocationRefundFailed(row, enrichment)
    };
}
