/**
 * Email outbox sender (HOS-1423, unit U2: AC:U2:4, AC:U2:7, AC:U2:8;
 * HOS-1424: AC:U2:9, AC:U2:11).
 *
 * Every minute: release expired `processing` leases, claim sendable rows with
 * a 5-minute lease, apply the suppression hierarchy, send, and record every
 * attempt in `notification_log`. The work itself lives in
 * `processEmailOutboxBatch` (`@repo/notifications`); this file wires the real
 * dependencies and turns an escalation into a Sentry-captured error plus an
 * `email.undeliverable` row in `domain_event` (HOS-1424), written under the
 * item's correlation (the outbox row's, or one minted for it) by actor `job`.
 * A failed event write is logged with `capture: true` and the run goes on:
 * the queue state is already written and is never rolled back for it.
 *
 * Cadence and lease are code constants, not env vars (the owner's U2 call).
 * Nothing here touches a domain transaction: a mail that cannot be delivered
 * ends as queue state plus a log row, never as an error a domain action waits
 * on (INV:25).
 *
 * @module cron/jobs/email-outbox-sender
 */

import { randomUUID } from 'node:crypto';
import {
    type DomainEventModel,
    domainEventModel,
    emailOutboxModel,
    notificationLogModel,
    userModel
} from '@repo/db';
import {
    BrevoEmailTransport,
    createEmailClient,
    createOutboxMailRenderer,
    createOutboxOptOutReader,
    type EmailOutboxDeliveryDeps,
    type OutboxEscalation,
    PreferenceService,
    processEmailOutboxBatch
} from '@repo/notifications';
import { getEmailSender } from '../../utils/email-sender.js';
import { env } from '../../utils/env.js';
import type { CronJobContext, CronJobDefinition, CronJobResult } from '../types.js';

/** The sender runs every minute. */
export const EMAIL_OUTBOX_SENDER_SCHEDULE = '* * * * *';

/** Lease a claimed row is held for before another run may take it back (5 minutes). */
export const EMAIL_OUTBOX_LEASE_MS = 5 * 60 * 1000;

/** Rows claimed per run. */
export const EMAIL_OUTBOX_BATCH_SIZE = 50;

/** Everything the run needs except the reporting hooks, which are built from the run's logger. */
export type EmailOutboxSenderDeps = Omit<
    EmailOutboxDeliveryDeps,
    'escalate' | 'onRowError' | 'onLeaseLost'
>;

/** Input of {@link createEmailOutboxSenderJob}. */
export interface CreateEmailOutboxSenderJobInput {
    /**
     * Builds the run's dependencies. Returns `null` when mail cannot be sent in
     * this process (no provider key): the run then only releases expired
     * leases and leaves the queue untouched.
     */
    readonly buildDeps: () => EmailOutboxSenderDeps | null;
    /** Releases expired leases when there are no deps. Defaults to the outbox model. */
    readonly recoverExpired?: (input: { readonly now: Date }) => Promise<readonly string[]>;
    /** Writes one domain event. Defaults to the `domain_event` model. */
    readonly recordEvent?: (input: Parameters<DomainEventModel['insert']>[0]) => Promise<unknown>;
}

/** Entity type of an outbox row in `domain_event`. */
export const OUTBOX_DOMAIN_EVENT_ENTITY_TYPE = 'email_outbox';

/**
 * Maps an escalation to its `email.undeliverable` domain event: about the
 * outbox row, caused by a job, under the item's correlation. The recipient
 * address is not copied (a reference, never the content); `changes` records
 * the row moving to `failed`. `occurredAt` is the RUN instant (`ctx.startedAt`),
 * the same instant the batch uses for every lease, window and log record, not
 * the wall-clock moment the insert happens.
 *
 * @param input - The escalation and the run instant.
 * @returns The event to write.
 */
export function buildUndeliverableEvent(input: {
    readonly escalation: OutboxEscalation;
    readonly occurredAt: Date;
}): Parameters<DomainEventModel['insert']>[0] {
    const { escalation } = input;
    return {
        eventType: 'email.undeliverable',
        entityType: OUTBOX_DOMAIN_EVENT_ENTITY_TYPE,
        entityId: escalation.outboxId,
        actorType: 'job',
        actorId: null,
        correlationId: escalation.correlationId,
        occurredAt: input.occurredAt,
        reason: escalation.reason,
        changes: [
            { field: 'status', new: 'failed' },
            { field: 'attempts', new: escalation.attempts }
        ]
    };
}

/**
 * Builds the production dependencies, or `null` without a provider key.
 *
 * Opt-out reads the account's stored preferences through the existing
 * {@link PreferenceService}; the sender never writes them.
 */
function buildDefaultDeps(): EmailOutboxSenderDeps | null {
    if (!env.HOSPEDA_EMAIL_API_KEY) {
        return null;
    }
    const preferenceService = new PreferenceService({
        getUserSettings: async (userId) => {
            const user = await userModel.findById(userId);
            return (user?.settings as Record<string, unknown> | null | undefined) ?? null;
        },
        updateUserSettings: async () => {
            throw new Error('The email outbox sender never writes notification preferences');
        }
    });
    return {
        outbox: emailOutboxModel,
        log: notificationLogModel,
        isOptedOut: createOutboxOptOutReader({ preferenceService }),
        render: createOutboxMailRenderer(),
        transport: new BrevoEmailTransport(
            createEmailClient({ apiKey: env.HOSPEDA_EMAIL_API_KEY }),
            getEmailSender()
        )
    };
}

/** Result helper. */
function result(input: {
    readonly ctx: CronJobContext;
    readonly success: boolean;
    readonly message: string;
    readonly processed: number;
    readonly errors: number;
    readonly details?: Record<string, unknown>;
}): CronJobResult {
    return {
        success: input.success,
        message: input.message,
        processed: input.processed,
        errors: input.errors,
        durationMs: Date.now() - input.ctx.startedAt.getTime(),
        details: input.details
    };
}

/**
 * Builds the sender job. Exported so tests can inject the dependencies.
 *
 * @param input - Dependency factory.
 * @returns The job definition.
 */
export function createEmailOutboxSenderJob(
    input: CreateEmailOutboxSenderJobInput
): CronJobDefinition {
    const recoverExpired =
        input.recoverExpired ??
        ((args: { readonly now: Date }) => emailOutboxModel.recoverExpired(args));
    const recordEvent =
        input.recordEvent ??
        ((event: Parameters<DomainEventModel['insert']>[0]) => domainEventModel.insert(event));

    return {
        name: 'email-outbox-sender',
        description:
            'Send queued email_outbox rows: recover expired leases, apply suppression, send, and log each attempt',
        schedule: EMAIL_OUTBOX_SENDER_SCHEDULE,
        enabled: true,
        timeoutMs: 55_000,
        handler: async (ctx) => {
            const now = ctx.startedAt;

            if (ctx.dryRun) {
                return result({
                    ctx,
                    success: true,
                    message: 'Dry run - no outbox rows claimed',
                    processed: 0,
                    errors: 0,
                    details: { dryRun: true }
                });
            }

            try {
                const deps = input.buildDeps();
                if (!deps) {
                    const recovered = await recoverExpired({ now });
                    ctx.logger.warn(
                        'Email outbox sender has no provider key; queue left untouched',
                        {
                            recovered: recovered.length
                        }
                    );
                    return result({
                        ctx,
                        success: true,
                        message: 'No email provider configured; nothing sent',
                        processed: 0,
                        errors: 0,
                        details: { recovered: recovered.length }
                    });
                }

                const stats = await processEmailOutboxBatch({
                    deps: {
                        ...deps,
                        escalate: async (event) => {
                            ctx.logger.error(
                                'Email outbox: transactional mail is undeliverable and was escalated',
                                { ...event },
                                { capture: true }
                            );
                            try {
                                await recordEvent(
                                    buildUndeliverableEvent({ escalation: event, occurredAt: now })
                                );
                            } catch (error) {
                                ctx.logger.error(
                                    'Email outbox: the undeliverable domain event could not be written',
                                    {
                                        outboxId: event.outboxId,
                                        correlationId: event.correlationId,
                                        error:
                                            error instanceof Error ? error.message : String(error)
                                    },
                                    { capture: true }
                                );
                            }
                        },
                        onRowError: (event) => {
                            ctx.logger.error(
                                'Email outbox: row processing failed; it returns on lease expiry',
                                {
                                    ...event
                                }
                            );
                        },
                        onLeaseLost: (event) => {
                            ctx.logger.warn(
                                'Email outbox: mail sent but the lease was lost before marking it sent',
                                { ...event }
                            );
                        }
                    },
                    owner: `email-outbox-sender:${randomUUID()}`,
                    now,
                    leaseMs: EMAIL_OUTBOX_LEASE_MS,
                    batchSize: EMAIL_OUTBOX_BATCH_SIZE
                });

                ctx.logger.info('Email outbox batch processed', { ...stats });
                return result({
                    ctx,
                    success: true,
                    message: `Claimed ${stats.claimed}: sent ${stats.sent}, retried ${stats.retried}, failed ${stats.failed}, suppressed ${stats.suppressed}`,
                    processed: stats.claimed,
                    errors: stats.errors,
                    details: { ...stats }
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                ctx.logger.error('Email outbox sender failed', { error: message });
                return result({ ctx, success: false, message, processed: 0, errors: 1 });
            }
        }
    };
}

/** The registered sender job. */
export const emailOutboxSenderJob: CronJobDefinition = createEmailOutboxSenderJob({
    buildDeps: buildDefaultDeps
});
