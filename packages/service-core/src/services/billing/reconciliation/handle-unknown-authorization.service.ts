import type { Clock } from '@repo/billing-verticals-contract';
import { getDb, type ReconciliationMarkReason, reconciliationInventoryModel } from '@repo/db';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils';
import { openReconciliationMark } from './open-reconciliation-mark.service.js';
import type {
    HangablePayment,
    ReconciliationMarkPayments
} from './reconciliation-mark-payments.port.js';

/** Provider identity used by start-subscription.service.ts for Mercado Pago. */
const RECONCILIATION_PROVIDER = 'MERCADO_PAGO' as const;

export type UnknownAuthorizationArrival =
    | { readonly kind: 'AUTHORIZATION' }
    | { readonly kind: 'CHARGE'; readonly payment: HangablePayment };

export interface HandleUnknownAuthorizationInput {
    readonly authorizationId: string;
    readonly arrival: UnknownAuthorizationArrival;
    readonly correlationId: string;
}

export interface HandleUnknownAuthorizationPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly markPayments?: ReconciliationMarkPayments;
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
      };

const inputSchema = z.object({
    authorizationId: z.string().min(1),
    arrival: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('AUTHORIZATION') }),
        z.object({
            kind: z.literal('CHARGE'),
            payment: z.object({ source: z.enum(['PAYMENT', 'MANUAL_PAYMENT']), id: z.uuid() })
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
    const result = await openReconciliationMark(
        {
            subject: { kind: 'SUBSCRIPTION', subscriptionId: input.subscriptionId },
            reason: input.reason,
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

async function createTombstone(
    input: HandleUnknownAuthorizationInput,
    ports: HandleUnknownAuthorizationPorts
): Promise<HandleUnknownAuthorizationResult> {
    if (input.arrival.kind === 'CHARGE')
        throw fail(
            ServiceErrorCode.INTERNAL_ERROR,
            'An unowned charge requires the receipt tombstone flow from HOS-1603',
            'UNOWNED_CHARGE_NEEDS_RECEIPT_TOMBSTONE'
        );

    try {
        return await getDb().transaction(async (tx) => {
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
                    arrival: input.arrival,
                    tx
                },
                ports.markPayments
            );
            // HOS-1603: cancel the preapproval here (AC:B11:3)
            return { ...result, tombstone: true };
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
                arrival: input.arrival
            },
            ports.markPayments
        );
    }
}
