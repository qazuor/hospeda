import { and, eq, getDb, payments, providerLinks, subscriptions } from '@repo/db';
import {
    actStartInstant,
    assertFreshForAct,
    type ChargeSnapshot,
    PaymentProviderError,
    type ProviderRead
} from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { type Actor, ServiceError } from '../../../types';
import { isSystemActor } from '../../../utils/system-actor';
import type { CancellationCrossingResult } from '../subscription/cancellation-crossing-charge';
import type { ExitGraceResult } from '../subscription/exit-grace.service';
import type { ReactivateSuspendedResult } from '../subscription/reactivate-suspended.service';
import { type RecordChargeFactPorts, recordChargeFact } from './record-charge-fact.service';

const ACTION = 'ACC_14' as const;

/**
 * Administrative action 14 settles motive 19's unrecorded approved charge (ACC:14, AC:B5:11, HOS-1550).
 * The reception rule is `recordChargeFact`, so this service calls it once and does not rewrite its branches (H-5).
 * It neither requires nor lifts reconciliation mark 19; lifting is S15 in HOS-1697 (H-4).
 * S2 for `PENDING_AUTHORIZATION` is outside the reception rule (H-6). Reading the subscription owner
 * before P1's transaction creates no TOCTOU: a subscription's owner does not change (H-8).
 */
export const SETTLE_EXTERNAL_CHARGE_REJECTIONS = [
    'CHARGE_NOT_FOUND',
    'CHARGE_NOT_LINKED',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'CHARGE_NOT_SETTLEABLE',
    'CHARGE_NOT_APPROVED',
    'CHARGE_ALREADY_RECORDED'
] as const;

/** A rejection reason returned when an external charge cannot be settled. */
export type SettleExternalChargeRejection = (typeof SETTLE_EXTERNAL_CHARGE_REJECTIONS)[number];

/** Reception outcome of the row's applicable billing rule. */
export type ChargeReception =
    | 'P1'
    | 'S5'
    | 'S7'
    | 'S19_RETAINED'
    | 'CONDITION_FAILED'
    | 'EXTENDED'
    | 'NOT_EXTENDED'
    | 'CROSSING_MARKED';

/** Successful administrative settlement of one external provider charge. */
export interface SettleExternalChargeResult {
    readonly paymentId: string;
    readonly subjectId: string | null;
    readonly credit: 'CREDITED';
    readonly coverage: 'WRITTEN' | 'DUPLICATE_MARKED' | 'NOT_APPLICABLE';
    readonly reception: ChargeReception;
}

function reject(
    code: ServiceErrorCode,
    message: string,
    reason: SettleExternalChargeRejection
): ServiceError {
    return new ServiceError(code, message, undefined, reason);
}

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
        throw reject(
            ServiceErrorCode.FORBIDDEN,
            'Administrative action is forbidden',
            'ADMINISTRATIVE_ACTION_FORBIDDEN'
        );
}

function receptionFrom(input: {
    readonly exit?: ExitGraceResult;
    readonly reactivation?: ReactivateSuspendedResult;
    readonly crossing?: CancellationCrossingResult;
}): ChargeReception {
    if (input.exit) {
        const result = input.exit;
        switch (result.outcome) {
            case 'REACTIVATED':
                return 'S5';
            case 'RETAINED_FOR_S19':
                return 'S19_RETAINED';
            case 'CONDITION_FAILED':
                return 'CONDITION_FAILED';
            case 'NOT_APPLICABLE':
                break;
        }
    }
    if (input.reactivation) {
        const result = input.reactivation;
        switch (result.outcome) {
            case 'REACTIVATED':
                return 'S7';
            case 'RETAINED_FOR_S19':
                return 'S19_RETAINED';
            case 'CONDITION_FAILED':
                return 'CONDITION_FAILED';
            case 'NOT_APPLICABLE':
                break;
        }
    }
    if (input.crossing) {
        switch (input.crossing.outcome) {
            case 'EXTENDED':
                return 'EXTENDED';
            case 'NOT_EXTENDED':
                return 'NOT_EXTENDED';
            case 'MARKED':
            case 'ALREADY_MARKED':
                return 'CROSSING_MARKED';
            case 'NOT_APPLICABLE':
                break;
        }
    }
    return 'P1';
}

/** Settles one approved, linked external provider charge through administrative action 14. */
export async function settleExternalCharge(
    input: { readonly actor: Actor; readonly chargeId: string },
    ports: RecordChargeFactPorts
): Promise<SettleExternalChargeResult> {
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    let read: ProviderRead<ChargeSnapshot>;
    try {
        read = await ports.provider.readCharge({ chargeId: input.chargeId });
    } catch (error) {
        if (
            error instanceof PaymentProviderError &&
            error.code === 'NOT_FOUND' &&
            error.capability === 'read'
        )
            throw reject(
                ServiceErrorCode.NOT_FOUND,
                'Provider charge not found',
                'CHARGE_NOT_FOUND'
            );
        throw error;
    }
    const { snapshot: charge } = assertFreshForAct({ read, act });
    if (
        charge.purpose === 'cardValidation' ||
        charge.chargedBack ||
        (charge.amount.amountMinor > 0 &&
            charge.refundedAmount.amountMinor >= charge.amount.amountMinor)
    )
        throw reject(
            ServiceErrorCode.VALIDATION_ERROR,
            'Provider charge cannot be settled',
            'CHARGE_NOT_SETTLEABLE'
        );
    if (charge.status !== 'approved')
        throw reject(
            ServiceErrorCode.ALREADY_EXISTS,
            'Provider charge is not approved',
            'CHARGE_NOT_APPROVED'
        );
    if (charge.authorizationId === null)
        throw reject(
            ServiceErrorCode.NOT_FOUND,
            'Provider charge is not linked',
            'CHARGE_NOT_LINKED'
        );

    const [linked] = await getDb()
        .select({ userId: subscriptions.userId, provider: providerLinks.provider })
        .from(providerLinks)
        .innerJoin(subscriptions, eq(subscriptions.id, providerLinks.subscriptionId))
        .where(eq(providerLinks.providerId, charge.authorizationId))
        .limit(1);
    if (!linked)
        throw reject(
            ServiceErrorCode.NOT_FOUND,
            'Provider charge is not linked',
            'CHARGE_NOT_LINKED'
        );
    authorize(input.actor, linked.userId);

    const [existing] = await getDb()
        .select({ status: payments.status })
        .from(payments)
        .where(
            and(eq(payments.provider, linked.provider), eq(payments.providerFactId, input.chargeId))
        )
        .limit(1);
    if (existing && existing.status !== 'PENDING')
        throw reject(
            ServiceErrorCode.ALREADY_EXISTS,
            'Provider charge is already recorded',
            'CHARGE_ALREADY_RECORDED'
        );

    const reception = await recordChargeFact({ chargeId: input.chargeId }, ports);
    if (reception.outcome === 'CREDITED') {
        if (reception.credit.outcome === 'ALREADY_CREDITED')
            throw reject(
                ServiceErrorCode.ALREADY_EXISTS,
                'Provider charge is already recorded',
                'CHARGE_ALREADY_RECORDED'
            );
        if (reception.credit.outcome !== 'CREDITED')
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Approved charge did not credit its payment',
                undefined,
                'SETTLED_CHARGE_NOT_CREDITED'
            );
        return {
            paymentId: reception.paymentId,
            subjectId: linked.userId,
            credit: 'CREDITED',
            coverage: reception.credit.coverage,
            reception: receptionFrom(reception)
        };
    }
    throw new ServiceError(
        ServiceErrorCode.INTERNAL_ERROR,
        'Approved linked charge did not reach payment credit',
        undefined,
        'SETTLED_CHARGE_RECEPTION_INVARIANT_BROKEN'
    );
}
