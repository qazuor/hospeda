import {
    type DomainEventActorType,
    type DrizzleClient,
    domainEventModel,
    getDb,
    RECONCILIATION_MARK_REASONS,
    type ReconciliationMarkReason,
    reconciliationMarkModel
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils';
import {
    type HangablePayment,
    type ReconciliationMarkPayments,
    unimplementedReconciliationMarkPayments
} from './reconciliation-mark-payments.port';

type Subject =
    | { readonly kind: 'SUBSCRIPTION'; readonly subscriptionId: string }
    | { readonly kind: 'ADDON_INSTANCE'; readonly addonInstanceId: string };

export interface OpenReconciliationMarkInput {
    readonly subject: Subject;
    readonly reason: ReconciliationMarkReason;
    readonly payment?: HangablePayment;
    readonly actor: { readonly type: DomainEventActorType; readonly id?: string | null };
    readonly correlationId: string;
    readonly tx?: DrizzleClient;
}
export interface OpenReconciliationMarkPorts {
    readonly markPayments?: ReconciliationMarkPayments;
}
export interface OpenReconciliationMarkResult {
    readonly mark: NonNullable<Awaited<ReturnType<typeof reconciliationMarkModel.findById>>>;
    readonly outcome: 'OPENED' | 'ACCUMULATED';
    readonly paymentHung: boolean;
}

const inputSchema = z.object({
    subject: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('SUBSCRIPTION'), subscriptionId: z.uuid() }),
        z.object({ kind: z.literal('ADDON_INSTANCE'), addonInstanceId: z.uuid() })
    ]),
    reason: z.string(),
    payment: z.object({ source: z.enum(['PAYMENT', 'MANUAL_PAYMENT']), id: z.uuid() }).optional(),
    actor: z.object({
        type: z.enum(['owner', 'admin', 'job', 'provider']),
        id: z.uuid().nullable().optional()
    }),
    correlationId: z.uuid()
});

function fail(code: ServiceErrorCode, message: string, reason: string): ServiceError {
    return new ServiceError(code, message, undefined, reason);
}

/** S14 opens (or accumulates) one reason without changing the subject row; its event is emitted on every call. */
export async function openReconciliationMark(
    input: OpenReconciliationMarkInput,
    ports: OpenReconciliationMarkPorts = {}
): Promise<OpenReconciliationMarkResult> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success)
        throw fail(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid reconciliation mark input',
            'MARK_INPUT_INVALID'
        );
    if (!(RECONCILIATION_MARK_REASONS as readonly string[]).includes(input.reason))
        throw fail(
            ServiceErrorCode.VALIDATION_ERROR,
            'Reconciliation mark reason is not in the catalog',
            'MARK_REASON_NOT_IN_CATALOG'
        );
    if (
        (input.reason === 'ORDEN_PAGADA_SIN_INSTANCIA') !==
        (input.subject.kind === 'ADDON_INSTANCE')
    )
        throw fail(
            ServiceErrorCode.VALIDATION_ERROR,
            'Reconciliation mark subject does not match its reason',
            'MARK_SUBJECT_REASON_MISMATCH'
        );

    const db = input.tx ?? getDb();
    return db.transaction(async (tx) => {
        let mark = await reconciliationMarkModel.findOpen({
            subject: input.subject,
            reason: input.reason,
            tx
        });
        let outcome: 'OPENED' | 'ACCUMULATED' = mark ? 'ACCUMULATED' : 'OPENED';
        if (!mark) {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    mark = await tx.transaction((sp) =>
                        reconciliationMarkModel.insertOpen({
                            subject: input.subject,
                            reason: input.reason,
                            tx: sp
                        })
                    );
                    outcome = 'OPENED';
                    break;
                } catch (error) {
                    const cause = extractPostgresErrorCause(error);
                    if (cause?.code === '23503')
                        throw fail(
                            ServiceErrorCode.NOT_FOUND,
                            'Reconciliation mark subject not found',
                            'MARK_SUBJECT_NOT_FOUND'
                        );
                    if (
                        cause?.code !== '23505' ||
                        !cause.constraint?.startsWith('uq_reconciliation_mark_open_')
                    )
                        throw error;
                    mark = await reconciliationMarkModel.findOpen({
                        subject: input.subject,
                        reason: input.reason,
                        tx
                    });
                    if (mark) {
                        outcome = 'ACCUMULATED';
                        break;
                    }
                }
            }
            if (!mark)
                throw fail(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Could not open a reconciliation mark after repeated contention',
                    'MARK_OPEN_CONTENDED'
                );
        }

        let paymentHung = false;
        if (input.payment) {
            if (outcome === 'ACCUMULATED') {
                const bumped = await reconciliationMarkModel.bumpOpenVersion({
                    markId: mark.id,
                    tx
                });
                if (!bumped) {
                    mark = null;
                    for (let attempt = 0; attempt < 3 && !mark; attempt++) {
                        try {
                            mark = await tx.transaction((sp) =>
                                reconciliationMarkModel.insertOpen({
                                    subject: input.subject,
                                    reason: input.reason,
                                    tx: sp
                                })
                            );
                            outcome = 'OPENED';
                        } catch (error) {
                            const cause = extractPostgresErrorCause(error);
                            if (cause?.code === '23503')
                                throw fail(
                                    ServiceErrorCode.NOT_FOUND,
                                    'Reconciliation mark subject not found',
                                    'MARK_SUBJECT_NOT_FOUND'
                                );
                            if (
                                cause?.code !== '23505' ||
                                !cause.constraint?.startsWith('uq_reconciliation_mark_open_')
                            )
                                throw error;
                            mark = await reconciliationMarkModel.findOpen({
                                subject: input.subject,
                                reason: input.reason,
                                tx
                            });
                            if (mark) outcome = 'ACCUMULATED';
                        }
                    }
                    if (!mark)
                        throw fail(
                            ServiceErrorCode.INTERNAL_ERROR,
                            'Could not open a reconciliation mark after repeated contention',
                            'MARK_OPEN_CONTENDED'
                        );
                }
                mark = await reconciliationMarkModel.findById({ markId: mark.id, tx });
                if (!mark)
                    throw fail(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Reconciliation mark disappeared',
                        'MARK_OPEN_CONTENDED'
                    );
            }
            await (ports.markPayments ?? unimplementedReconciliationMarkPayments).hang({
                markId: mark.id,
                payment: input.payment,
                tx
            });
            paymentHung = true;
        }

        const subjectId =
            input.subject.kind === 'SUBSCRIPTION'
                ? input.subject.subscriptionId
                : input.subject.addonInstanceId;
        await domainEventModel.insert({
            eventType: 'reconciliation.mark_opened',
            entityType: input.subject.kind === 'SUBSCRIPTION' ? 'subscription' : 'addon_instance',
            entityId: subjectId,
            actorType: input.actor.type,
            actorId: input.actor.id,
            correlationId: input.correlationId,
            changes: [
                { field: 'reconciliation_mark.id', new: mark.id },
                { field: 'reconciliation_mark.reason', new: input.reason },
                { field: 'reconciliation_mark.outcome', new: outcome }
            ],
            reason: null,
            tx
        });
        return { mark, outcome, paymentHung };
    });
}
