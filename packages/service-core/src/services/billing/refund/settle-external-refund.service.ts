import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient, SelectRefund } from '@repo/db';
import {
    addonInstances,
    and,
    coveredPeriods,
    eq,
    getDb,
    refundCalls,
    refunds,
    sql,
    subscriptions
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { type Actor, ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import { isSystemActor } from '../../../utils/system-actor';
import {
    type ApplyExecutedRefundResult,
    applyExecutedRefund
} from '../payment/apply-executed-refund.service';
import { resolveHungPaymentsBySettlement } from '../reconciliation/hung-payment-resolution.js';
import { canRefundTransition, type RefundStatus, type Rf4Reason } from './refund-machine';
import {
    assertRefundAmount,
    assertRefundable,
    assertRetainedPaymentRefundable,
    assertWithinBalance,
    type LockedRefundSource,
    lockRefundSource,
    type RefundSource,
    refundSourceColumns
} from './refund-source';

/** The administrative action this service executes: one constant for the helper and the step (Coord-178). */
const ACTION = 'ACC_14' as const;

/** The partial unique index that keeps a provider panel reference on one row (notes H3). */
const PANEL_REFERENCE_CONSTRAINT = 'uq_refund_provider_panel_reference';

/** Where an out-of-flow refund was settled (notes H2). */
export type ExternalRefundChannel = 'BANK_TRANSFER' | 'PROVIDER_PANEL';

/** Input of RF4, admin action 14 settling a refund that already happened outside our flow. */
export type SettleExternalRefundInput = {
    readonly actor: Actor;
    readonly source: RefundSource;
    /** Amount in cents, a positive integer. */
    readonly amount: number;
    readonly channel: ExternalRefundChannel;
    /** Transfer receipt or provider panel reference; non-empty, ≤ 255, already trimmed. */
    readonly reference: string;
    readonly reason: Rf4Reason;
    /** The open `REQUESTED` this settlement closes (AC:B5:41). */
    readonly refundId?: string;
    /** What to do when the settled amount differs from the open request (notes H5). */
    readonly onAmountMismatch?: 'CLOSE_WITH_SETTLED_AMOUNT' | 'SETTLE_SEPARATELY';
    /** Whether a manual payment refund is total; required for, and only for, a manual payment (notes H9). */
    readonly manualPaymentScope?: 'TOTAL' | 'PARTIAL';
};

/** Result of RF4. */
export type SettleExternalRefundResult = {
    readonly refundId: string;
    readonly subjectId: string | null;
    readonly closedRequestedRefundId: string | null;
    readonly paymentOutcome: ApplyExecutedRefundResult['outcome'] | null;
    readonly coverageReleased: boolean;
};

/** Every `reason` a rejection of `settleExternalRefund` carries, for an exhaustive HTTP mapping. */
export const SETTLE_EXTERNAL_REFUND_REJECTIONS = [
    'REFUND_AMOUNT_INVALID',
    'EXTERNAL_REFERENCE_INVALID',
    'REFUND_SOURCE_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'PAYMENT_NOT_REFUNDABLE',
    'MANUAL_PAYMENT_SCOPE_REQUIRED',
    'MANUAL_PAYMENT_SCOPE_NOT_ALLOWED',
    'EXTERNAL_REFERENCE_ALREADY_SETTLED',
    'REFUND_NOT_FOUND',
    'REFUND_NOT_OPEN',
    'OPEN_REQUESTS_AMBIGUOUS',
    'REQUESTED_AMOUNT_MISMATCH',
    'REFUND_EXCEEDS_BALANCE',
    'REFUND_STATE_CHANGED',
    // Thrown by assertRetainedPaymentRefundable (GUARD:G-R1-D, AC:B7:17, HOS-1561).
    'RETAINED_PAYMENT_SUCCESSION_OPEN'
] as const;

/** A rejection reason of `settleExternalRefund`. */
export type SettleExternalRefundRejection = (typeof SETTLE_EXTERNAL_REFUND_REJECTIONS)[number];

function reject(
    code: ServiceErrorCode,
    message: string,
    reason: SettleExternalRefundRejection
): ServiceError {
    return new ServiceError(code, message, undefined, reason);
}

/** Step b: the subject is the owner of the payment's subscription or add-on instance; `null` on a tombstone. */
async function readSubject(tx: DrizzleClient, locked: LockedRefundSource): Promise<string | null> {
    const subscriptionId =
        locked.kind === 'PAYMENT'
            ? locked.payment.subscriptionId
            : locked.manualPayment.subscriptionId;
    if (subscriptionId) {
        const [subscription] = await tx
            .select({ userId: subscriptions.userId })
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId))
            .limit(1)
            .for('share');
        return subscription?.userId ?? null;
    }
    const addonInstanceId = locked.kind === 'PAYMENT' ? locked.payment.addonInstanceId : null;
    if (!addonInstanceId) return null;
    const [instance] = await tx
        .select({ ownerId: addonInstances.ownerId })
        .from(addonInstances)
        .where(eq(addonInstances.id, addonInstanceId))
        .limit(1)
        .for('share');
    return instance?.ownerId ?? null;
}

/** Step c: step 3 of the administrative action, derived only from ACC_14's own permission. */
function authorize(actor: Actor, subjectId: string | null): void {
    const permitted = isAdministrativeActionPermitted({
        action: ACTION,
        actorPermissions: actor.permissions
    });
    const step = resolveAdministrativeActionStep({
        action: ACTION,
        actorId: actor.id,
        subjectId,
        permitted,
        isSystemActor: isSystemActor(actor)
    });
    if (!step.allowed)
        throw reject(ServiceErrorCode.FORBIDDEN, 'Forbidden', 'ADMINISTRATIVE_ACTION_FORBIDDEN');
}

/** Step d: the manual scope (H9) and the uniqueness of a provider panel reference (H3). */
async function validateSettlement(
    tx: DrizzleClient,
    input: SettleExternalRefundInput
): Promise<void> {
    if (input.source.kind === 'MANUAL_PAYMENT' && !input.manualPaymentScope)
        throw reject(
            ServiceErrorCode.VALIDATION_ERROR,
            'A manual payment refund must say whether it is total or partial',
            'MANUAL_PAYMENT_SCOPE_REQUIRED'
        );
    if (input.source.kind === 'PAYMENT' && input.manualPaymentScope)
        throw reject(
            ServiceErrorCode.VALIDATION_ERROR,
            'A provider payment refund takes no manual payment scope',
            'MANUAL_PAYMENT_SCOPE_NOT_ALLOWED'
        );
    if (input.channel !== 'PROVIDER_PANEL') return;
    const [settled] = await tx
        .select({ id: refunds.id })
        .from(refunds)
        .where(
            and(
                eq(refunds.externalRef, input.reference),
                eq(refunds.externalChannel, 'PROVIDER_PANEL')
            )
        )
        .limit(1);
    const [called] = await tx
        .select({ id: refundCalls.id })
        .from(refundCalls)
        .where(eq(refundCalls.providerRefundId, input.reference))
        .limit(1);
    if (settled || called) throw alreadySettled();
}

function alreadySettled(): ServiceError {
    return reject(
        ServiceErrorCode.ALREADY_EXISTS,
        'This provider panel reference is already settled',
        'EXTERNAL_REFERENCE_ALREADY_SETTLED'
    );
}

/** Step e: the open `REQUESTED` to close, locked `FOR UPDATE` (H5). */
async function findOpenRequest(
    tx: DrizzleClient,
    input: SettleExternalRefundInput
): Promise<SelectRefund | null> {
    const sourceColumn =
        input.source.kind === 'PAYMENT' ? refunds.paymentId : refunds.manualPaymentId;
    if (input.refundId) {
        const [row] = await tx
            .select()
            .from(refunds)
            .where(and(eq(refunds.id, input.refundId), eq(sourceColumn, input.source.id)))
            .limit(1)
            .for('update');
        if (!row) throw reject(ServiceErrorCode.NOT_FOUND, 'Refund not found', 'REFUND_NOT_FOUND');
        if (row.status !== 'REQUESTED')
            throw reject(
                ServiceErrorCode.ALREADY_EXISTS,
                'Refund is no longer open',
                'REFUND_NOT_OPEN'
            );
        return row;
    }
    const open = await tx
        .select()
        .from(refunds)
        .where(and(eq(sourceColumn, input.source.id), eq(refunds.status, 'REQUESTED')))
        .for('update');
    if (open.length > 1)
        throw reject(
            ServiceErrorCode.ALREADY_EXISTS,
            'More than one open refund request on this payment; name the one to close',
            'OPEN_REQUESTS_AMBIGUOUS'
        );
    return open[0] ?? null;
}

/** Step f: which open request, if any, this settlement closes (H5). */
function requestToClose(
    input: SettleExternalRefundInput,
    requested: SelectRefund | null
): SelectRefund | null {
    if (!requested || requested.amount === input.amount) return requested;
    switch (input.onAmountMismatch) {
        case 'CLOSE_WITH_SETTLED_AMOUNT':
            return requested;
        case 'SETTLE_SEPARATELY':
            return null;
        case undefined:
            throw reject(
                ServiceErrorCode.ALREADY_EXISTS,
                `Settled amount ${input.amount} differs from the requested ${requested.amount}`,
                'REQUESTED_AMOUNT_MISMATCH'
            );
    }
}

/** Step h: close the open request or give birth to an EXECUTED row, guarded by the machine. */
async function writeExecuted(
    tx: DrizzleClient,
    input: SettleExternalRefundInput,
    closing: SelectRefund | null,
    now: Date
): Promise<string> {
    const from: RefundStatus | 'NO_ROW' = closing ? (closing.status as RefundStatus) : 'NO_ROW';
    if (!canRefundTransition({ transition: 'RF4', from }).allowed)
        throw reject(
            ServiceErrorCode.ALREADY_EXISTS,
            'Refund is no longer open',
            'REFUND_NOT_OPEN'
        );
    const settlement = {
        status: 'EXECUTED',
        executedVia: 'EXTERNAL',
        externalChannel: input.channel,
        externalRef: input.reference,
        settledBy: input.actor.id,
        amount: input.amount,
        updatedAt: now
    } as const;
    if (closing) {
        const [closed] = await tx
            .update(refunds)
            .set({ ...settlement, version: closing.version + 1 })
            .where(
                and(
                    eq(refunds.id, closing.id),
                    eq(refunds.status, 'REQUESTED'),
                    eq(refunds.version, closing.version)
                )
            )
            .returning({ id: refunds.id });
        if (!closed)
            throw reject(
                ServiceErrorCode.ALREADY_EXISTS,
                'Refund changed while it was being settled',
                'REFUND_STATE_CHANGED'
            );
        return closed.id;
    }
    const [born] = await tx
        .insert(refunds)
        .values({
            ...refundSourceColumns({ source: input.source }),
            ...settlement,
            reason: input.reason,
            createdAt: now
        })
        .returning({ id: refunds.id });
    if (!born)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Refund settlement insert returned no row',
            undefined,
            'REFUND_INSERT_FAILED'
        );
    return born.id;
}

/** Step i: P3/P4/P5 on a provider payment; the manual payment's coverage on a total refund. */
async function applyEffects(
    tx: DrizzleClient,
    input: SettleExternalRefundInput,
    refundId: string,
    clock: Clock
): Promise<Pick<SettleExternalRefundResult, 'paymentOutcome' | 'coverageReleased'>> {
    if (input.source.kind === 'PAYMENT') {
        const applied = await applyExecutedRefund({ refundId }, { clock, tx });
        return {
            paymentOutcome: applied.outcome,
            coverageReleased: 'coverageReleased' in applied ? applied.coverageReleased : false
        };
    }
    if (input.manualPaymentScope !== 'TOTAL')
        return { paymentOutcome: null, coverageReleased: false };
    const released = await tx
        .update(coveredPeriods)
        .set({ releasedAt: clock.now() })
        .where(
            and(
                eq(coveredPeriods.manualPaymentId, input.source.id),
                sql`${coveredPeriods.releasedAt} IS NULL`
            )
        )
        .returning({ id: coveredPeriods.id });
    return { paymentOutcome: null, coverageReleased: released.length > 0 };
}

/**
 * RF4 — admin action 14 settles a refund that already happened outside our
 * flow (TRANS:B:RF4; ACC:14; AC:B5:10, AC:B5:41, AC:B5:12): reason 18, a
 * `manual_payment`, a charge older than the provider's window, or a refund
 * made by hand from the provider panel. The row is EXECUTED with who settled
 * it (`settled_by`), where (`executed_via = 'EXTERNAL'` + `external_channel`)
 * and the transfer receipt or panel reference (`external_ref`); `confirmed_by`
 * stays NULL (H11). If an RF1 `REQUESTED` is open on the payment, the
 * settlement closes THAT row instead of creating another (AC:B5:41).
 *
 * The amount must fit in the same refundable balance RF1 uses (every non-`FAILED`
 * refund of the payment is discounted; HOS-1680, D-1), except the `REQUESTED` row
 * this settlement closes, which never counts against itself. Settling separately
 * (`SETTLE_SEPARATELY`) therefore counts the request that stays open.
 *
 * Everything runs in ONE transaction of its own (a person's action, never
 * nested): the payment is locked `FOR UPDATE`, the subject is read in the same
 * transaction, step 3 authorizes from ACC_14's own permission (never roles),
 * the open request is locked `FOR UPDATE`, and the close is a versioned
 * `UPDATE ... WHERE status = 'REQUESTED' AND version = <read>`.
 *
 * Side effects: on a `payment`, `applyExecutedRefund` (P3/P4/P5; releases
 * `covered_period` on a full refund; it emits no notice, revalidation or
 * email). On a `manual_payment` with `TOTAL` scope, its open `covered_period`
 * is released. Every unresolved payment hung on a reconciliation mark for
 * this source is resolved with this refund (`resolved_at`, `refund_id`; HOS-1697).
 *
 * @param input - The settlement.
 * @param ports - The clock.
 * @returns The settled row and its effects.
 * @throws ServiceError with a `reason` from `SETTLE_EXTERNAL_REFUND_REJECTIONS`; never INTERNAL_ERROR for a rejection.
 * @throws ServiceError ALREADY_EXISTS `RETAINED_PAYMENT_SUCCESSION_OPEN` (GUARD:G-R1-D, AC:B7:17):
 *   the payment S19 retained is not settled as refunded while its succession is open.
 */
export async function settleExternalRefund(
    input: SettleExternalRefundInput,
    ports: { readonly clock: Clock }
): Promise<SettleExternalRefundResult> {
    assertRefundAmount({ amount: input.amount });
    if (input.reference.length === 0 || input.reference.length > 255)
        throw reject(
            ServiceErrorCode.VALIDATION_ERROR,
            'The external reference must be 1 to 255 characters',
            'EXTERNAL_REFERENCE_INVALID'
        );
    try {
        return await getDb().transaction(async (tx: DrizzleClient) => {
            const locked = await lockRefundSource({ tx, source: input.source });
            const subjectId = await readSubject(tx, locked);
            authorize(input.actor, subjectId);
            assertRefundable({ locked });
            await assertRetainedPaymentRefundable({ tx, locked });
            await validateSettlement(tx, input);
            const requested = await findOpenRequest(tx, input);
            const closing = requestToClose(input, requested);
            await assertWithinBalance({
                tx,
                locked,
                amount: input.amount,
                excludeRefundId: closing?.id
            });
            const refundId = await writeExecuted(tx, input, closing, ports.clock.now());
            await resolveHungPaymentsBySettlement({
                tx,
                payment: { source: input.source.kind, id: input.source.id },
                refundId,
                at: ports.clock.now()
            });
            const effects = await applyEffects(tx, input, refundId, ports.clock);
            return {
                refundId,
                subjectId,
                closedRequestedRefundId: closing?.id ?? null,
                ...effects
            };
        });
    } catch (error) {
        const cause = extractPostgresErrorCause(error);
        if (cause?.code === '23505' && cause.constraint === PANEL_REFERENCE_CONSTRAINT)
            throw alreadySettled();
        throw error;
    }
}
