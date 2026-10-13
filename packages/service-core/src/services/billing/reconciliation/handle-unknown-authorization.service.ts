import type { Clock } from '@repo/billing-verticals-contract';
import { getDb, type ReconciliationMarkReason, reconciliationInventoryModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    actStartInstant,
    assertFreshForAct,
    isProbeSubject,
    type PaymentProvider,
    PROBE_MANIFEST,
    type ProbeManifest
} from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils';
import type { CreditPaymentResult } from '../payment/credit-payment.service.js';
import type { CoverageNotices } from '../payment/payment-ports.js';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service.js';
import {
    type CancelOurAuthorizationOutcome,
    cancelOurAuthorization
} from './cancel-our-authorization.js';
import { openReconciliationMark } from './open-reconciliation-mark.service.js';
import { readUnknownCharge, writeChargeTombstone } from './receipt-tombstone.service.js';
import type {
    HangablePayment,
    ReconciliationMarkPayments
} from './reconciliation-mark-payments.port.js';

const logger = createLogger('handle-unknown-authorization');

/** Provider identity used by start-subscription.service.ts for Mercado Pago. */
const RECONCILIATION_PROVIDER = 'MERCADO_PAGO' as const;

/**
 * What arrived for the unknown authorization. A charge carries its provider id
 * (I1); `payment` is hung only on the branch of a named row that already has a
 * link, where the payment may already exist.
 */
export type UnknownAuthorizationArrival =
    | { readonly kind: 'AUTHORIZATION' }
    | { readonly kind: 'CHARGE'; readonly chargeId: string; readonly payment?: HangablePayment };

/** What happened to a receipt tombstone's authorization: a probe is never cancelled (AC:B11:4). */
export type TombstoneCancellation = 'PROBE_SKIPPED' | CancelOurAuthorizationOutcome;

export interface HandleUnknownAuthorizationInput {
    readonly authorizationId: string;
    readonly arrival: UnknownAuthorizationArrival;
    readonly correlationId: string;
}

export interface HandleUnknownAuthorizationPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly markPayments?: ReconciliationMarkPayments;
    /** The notice before cancelling; a receipt tombstone has no recipient, so it is never asked there. */
    readonly beforeCancelNotice?: BeforeCancelNotice;
    /** The probes the handler never cancels; defaults to the versioned module (AC:B11:4, I3). */
    readonly probeManifest?: ProbeManifest;
    /** The coverage notices consumer handed to P1 when a tombstone's charge is settled. */
    readonly coverageNotices?: CoverageNotices;
}

export type HandleUnknownAuthorizationResult =
    | { readonly outcome: 'KNOWN'; readonly subscriptionId: string }
    | { readonly outcome: 'RELINKED'; readonly subscriptionId: string }
    | {
          readonly outcome: 'MARKED';
          readonly subscriptionId: string;
          readonly reason: ReconciliationMarkReason;
          readonly markId: string;
          readonly markOutcome: 'OPENED' | 'ACCUMULATED';
          readonly tombstone?: true;
          /** The tombstone's payment, when the arrival was a charge. */
          readonly paymentId?: string;
          /** P1's outcome on the tombstone's payment, when it ran. */
          readonly credit?: CreditPaymentResult | 'CREDIT_FAILED';
          /** The cancellation sent in the same act as the tombstone (AC:B11:3, AC:B11:4). */
          readonly cancellation?: TombstoneCancellation;
      };

const inputSchema = z.object({
    authorizationId: z.string().min(1),
    arrival: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('AUTHORIZATION') }),
        z.object({
            kind: z.literal('CHARGE'),
            chargeId: z.string().min(1),
            payment: z
                .object({ source: z.enum(['PAYMENT', 'MANUAL_PAYMENT']), id: z.uuid() })
                .optional()
        })
    ]),
    correlationId: z.uuid()
});

function fail(code: ServiceErrorCode, message: string, reason: string): ServiceError {
    return new ServiceError(code, message, undefined, reason);
}

async function mark(
    input: {
        readonly subscriptionId: string;
        readonly reason: ReconciliationMarkReason;
        readonly correlationId: string;
        readonly actor: 'provider';
        readonly arrival: UnknownAuthorizationArrival;
        readonly tx?: Parameters<typeof openReconciliationMark>[0]['tx'];
    },
    markPayments?: ReconciliationMarkPayments
) {
    const reason: ReconciliationMarkReason = input.reason;
    const result = await openReconciliationMark(
        {
            subject: { kind: 'SUBSCRIPTION', subscriptionId: input.subscriptionId },
            reason,
            payment: input.arrival.kind === 'CHARGE' ? input.arrival.payment : undefined,
            actor: { type: input.actor },
            correlationId: input.correlationId,
            tx: input.tx
        },
        markPayments ? { markPayments } : {}
    );
    return {
        outcome: 'MARKED' as const,
        subscriptionId: input.subscriptionId,
        reason: input.reason,
        markId: result.mark.id,
        markOutcome: result.outcome
    };
}

function isUnique(error: unknown, constraint: string): boolean {
    const cause = extractPostgresErrorCause(error);
    return cause?.code === '23505' && cause.constraint === constraint;
}

export async function handleUnknownAuthorization(
    input: HandleUnknownAuthorizationInput,
    ports: HandleUnknownAuthorizationPorts
): Promise<HandleUnknownAuthorizationResult> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success)
        throw fail(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid unknown authorization input',
            'UNKNOWN_AUTHORIZATION_INPUT_INVALID'
        );

    const known = await reconciliationInventoryModel.findLinkByProviderId({
        provider: RECONCILIATION_PROVIDER,
        providerId: input.authorizationId
    });
    if (known) return { outcome: 'KNOWN', subscriptionId: known.subscriptionId };

    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readAuthorization({ authorizationId: input.authorizationId });
    const { snapshot } = assertFreshForAct({ read, act });
    const reference = snapshot.reference;

    if (z.uuid().safeParse(reference).success) {
        const subscriptionId = reference;
        const row = await getDb().transaction(async (tx) => {
            const locked = await reconciliationInventoryModel.lockSubscriptionForLink({
                subscriptionId,
                tx
            });
            if (!locked) return { kind: 'MISSING' as const };
            if (locked.providerLink) {
                if (locked.providerLink.providerId === input.authorizationId)
                    return { kind: 'KNOWN' as const, subscriptionId };
                return { kind: 'MARK' as const, subscriptionId };
            }
            try {
                await tx.transaction(async (sp) => {
                    await reconciliationInventoryModel.insertProviderLink({
                        subscriptionId,
                        provider: RECONCILIATION_PROVIDER,
                        providerId: input.authorizationId,
                        tx: sp
                    });
                });
                return { kind: 'RELINKED' as const, subscriptionId };
            } catch (error) {
                if (isUnique(error, 'uq_provider_link_provider_id')) {
                    const winner = await reconciliationInventoryModel.findLinkByProviderId({
                        provider: RECONCILIATION_PROVIDER,
                        providerId: input.authorizationId,
                        tx
                    });
                    return winner
                        ? { kind: 'KNOWN' as const, subscriptionId: winner.subscriptionId }
                        : { kind: 'MISSING' as const };
                }
                if (isUnique(error, 'uq_provider_link_subscription'))
                    return { kind: 'MARK' as const, subscriptionId };
                throw error;
            }
        });
        if (row.kind === 'RELINKED') return { outcome: 'RELINKED', subscriptionId };
        if (row.kind === 'KNOWN') return { outcome: 'KNOWN', subscriptionId };
        if (row.kind === 'MARK')
            return mark(
                {
                    subscriptionId,
                    reason:
                        input.arrival.kind === 'CHARGE'
                            ? 'PAGO_TARDIO_RECHAZADO'
                            : 'TRANSICION_NO_DECLARADA',
                    correlationId: input.correlationId,
                    actor: 'provider',
                    arrival: input.arrival
                },
                ports.markPayments
            );
        return createTombstone(input, ports);
    }
    return createTombstone(input, ports);
}

/**
 * Sends the cancellation of a receipt tombstone's authorization in the same act
 * that wrote it (AC:B11:3), unless the id is a probe of the manifest (AC:B11:4).
 * The tombstone stays `CANCELLED` whatever happens; a call that did not apply is
 * retried by the sweep.
 */
async function cancelTombstoneAuthorization(
    input: { readonly subscriptionId: string; readonly authorizationId: string },
    ports: HandleUnknownAuthorizationPorts
): Promise<TombstoneCancellation> {
    const { isProbe } = isProbeSubject({
        id: input.authorizationId,
        manifest: ports.probeManifest ?? PROBE_MANIFEST
    });
    if (isProbe) {
        logger.info(
            { subscriptionId: input.subscriptionId, authorizationId: input.authorizationId },
            'Receipt tombstone of a manifest probe: its authorization is not cancelled'
        );
        return 'PROBE_SKIPPED';
    }
    const { outcome } = await cancelOurAuthorization(
        {
            subscriptionId: input.subscriptionId,
            userId: null,
            authorizationId: input.authorizationId
        },
        ports
    );
    return outcome;
}

async function createTombstone(
    input: HandleUnknownAuthorizationInput,
    ports: HandleUnknownAuthorizationPorts
): Promise<HandleUnknownAuthorizationResult> {
    if (input.arrival.kind === 'CHARGE') {
        const charge = await readUnknownCharge(
            { authorizationId: input.authorizationId, chargeId: input.arrival.chargeId },
            ports
        );
        if (charge.kind === 'CHARGE') {
            const written = await writeChargeTombstone(
                {
                    authorizationId: input.authorizationId,
                    charge,
                    correlationId: input.correlationId
                },
                ports
            );
            if (written.outcome === 'KNOWN') return written;
            const cancellation = await cancelTombstoneAuthorization(
                { subscriptionId: written.subscriptionId, authorizationId: input.authorizationId },
                ports
            );
            return {
                outcome: 'MARKED',
                subscriptionId: written.subscriptionId,
                reason: 'PAGO_TARDIO_RECHAZADO',
                markId: written.markId,
                markOutcome: written.markOutcome,
                tombstone: true,
                paymentId: written.paymentId,
                ...(written.credit === undefined ? {} : { credit: written.credit }),
                cancellation
            };
        }
    }
    const arrival: UnknownAuthorizationArrival = { kind: 'AUTHORIZATION' };

    let created: HandleUnknownAuthorizationResult;
    try {
        created = await getDb().transaction(async (tx) => {
            const tombstone = await reconciliationInventoryModel.insertReceiptTombstone({ tx });
            await reconciliationInventoryModel.insertProviderLink({
                subscriptionId: tombstone.id,
                provider: RECONCILIATION_PROVIDER,
                providerId: input.authorizationId,
                tx
            });
            const result = await mark(
                {
                    subscriptionId: tombstone.id,
                    reason: 'TRANSICION_NO_DECLARADA',
                    correlationId: input.correlationId,
                    actor: 'provider',
                    arrival,
                    tx
                },
                ports.markPayments
            );
            return { ...result, tombstone: true as const };
        });
    } catch (error) {
        if (!isUnique(error, 'uq_provider_link_provider_id')) throw error;
        const winner = await reconciliationInventoryModel.findLinkByProviderId({
            provider: RECONCILIATION_PROVIDER,
            providerId: input.authorizationId
        });
        if (!winner) throw error;
        return mark(
            {
                subscriptionId: winner.subscriptionId,
                reason: 'TRANSICION_NO_DECLARADA',
                correlationId: input.correlationId,
                actor: 'provider',
                arrival
            },
            ports.markPayments
        );
    }
    const cancellation = await cancelTombstoneAuthorization(
        { subscriptionId: created.subscriptionId, authorizationId: input.authorizationId },
        ports
    );
    return { ...created, cancellation };
}
