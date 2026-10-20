/**
 * The run of S12 (TRANS:B:S12; AC:B8a:5 and AC:B8a:6): the job that cuts the service of every
 * `CANCEL_SCHEDULED` row whose end-of-service date arrived, idempotent, in the order that lets the
 * orphanhood see the complements first.
 *
 * - Phase 1, principals: each due PRINCIPAL in its OWN transaction with `applyS12ToPrincipal` (S12,
 *   S18, coverage loss, orphanhood: A5 → S21). After each commit: the `SUBSCRIPTION` notice, the
 *   `ADDON` notice and A5's provider half.
 * - Phase 2, complements, only after phase 1: each due COMPLEMENTO not owned by a user that still
 *   has a due `CANCEL_SCHEDULED` principal (a failed or unreached principal makes its owner's
 *   complements wait for the next run, so the order never inverts), with `applyS12ToComplement`.
 *
 * A row's error is logged and counted and the run goes on: that row rolled back and is due again
 * on the next run (fails closed). `now` is read once per run (notas I-3).
 */
import type { Clock } from '@repo/billing-verticals-contract';
import { and, asc, type DrizzleClient, eq, getDb, lte, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { notExists } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import {
    type CancelledAddon,
    cancelAddonComplementsAtProvider,
    emitAddonCoverageRemoved
} from '../addon/addon-instance-a5';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports';
import type { CoverageNotices } from '../payment/payment-ports';
import { pauseComplementsS32 } from './complement-pause-s32.js';
import {
    applyS12ToComplement,
    applyS12ToPrincipal,
    emitServiceEndRemoved
} from './service-end-s12';
import type { BeforeCancelNotice } from './start-subscription.service';
import type { CancellationSeenAnnotator, SuccessionCloser } from './subscription-billing-ports';

const logger = createLogger('end-scheduled-services');

/** Ports of {@link endScheduledServices}. */
export interface EndScheduledServicesPorts extends AddonOrphanhoodPorts {
    readonly clock: Clock;
    readonly provider: PaymentProvider;
    /** Our notice before A5's provider call (`ADDON_CANCELLED`). */
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly coverageNotices: CoverageNotices;
    /** S18's interface; defaults to `unimplementedSuccessionCloser` (fails closed). */
    readonly successionCloser?: SuccessionCloser;
    readonly cancellationSeen?: CancellationSeenAnnotator;
}

/** Input of {@link endScheduledServices}. */
export interface EndScheduledServicesInput {
    /** The page size of EACH phase. */
    readonly limit: number;
    /** The client; defaults to `getDb()` at call time. A test passes its own transaction. */
    readonly db?: DrizzleClient;
}

/** The phase a row was handled in. */
export type EndScheduledServicesPhase = 'PRINCIPAL' | 'COMPLEMENTO';

/** One row of the run. */
export interface EndScheduledServicesRow {
    readonly subscriptionId: string;
    readonly phase: EndScheduledServicesPhase;
    /** S12's outcome, or `FAILED` when the row's transaction rolled back. */
    readonly outcome: string;
    /** The instances the orphanhood cancelled (principals only). */
    readonly orphaned: readonly string[];
    /** The instance S12 withdrew (complements only). */
    readonly withdrawn: string | null;
    readonly error?: string;
}

/** What a run did. */
export interface EndScheduledServicesResult {
    readonly principals: { readonly cancelled: number; readonly failed: number };
    readonly complements: { readonly cancelled: number; readonly failed: number };
    readonly rows: readonly EndScheduledServicesRow[];
}

const inputSchema = z.object({ limit: z.int().positive().max(10_000) });

/** The due PRINCIPAL rows, oldest end date first. */
async function duePrincipals(input: {
    readonly db: DrizzleClient;
    readonly now: Date;
    readonly limit: number;
}): Promise<readonly string[]> {
    const rows = await input.db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.class, 'PRINCIPAL'),
                eq(subscriptions.status, 'CANCEL_SCHEDULED'),
                lte(subscriptions.serviceEndsAt, input.now)
            )
        )
        .orderBy(asc(subscriptions.serviceEndsAt), asc(subscriptions.id))
        .limit(input.limit);
    return rows.map(({ id }) => id);
}

/** The due COMPLEMENTO rows whose owner has no due `CANCEL_SCHEDULED` principal left. */
async function dueComplements(input: {
    readonly db: DrizzleClient;
    readonly now: Date;
    readonly limit: number;
}): Promise<readonly string[]> {
    const principal = alias(subscriptions, 'pending_principal');
    const rows = await input.db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.class, 'COMPLEMENTO'),
                eq(subscriptions.status, 'CANCEL_SCHEDULED'),
                lte(subscriptions.serviceEndsAt, input.now),
                notExists(
                    input.db
                        .select({ id: principal.id })
                        .from(principal)
                        .where(
                            and(
                                eq(principal.userId, subscriptions.userId),
                                eq(principal.class, 'PRINCIPAL'),
                                eq(principal.status, 'CANCEL_SCHEDULED'),
                                lte(principal.serviceEndsAt, input.now)
                            )
                        )
                )
            )
        )
        .orderBy(asc(subscriptions.serviceEndsAt), asc(subscriptions.id))
        .limit(input.limit);
    return rows.map(({ id }) => id);
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** The after-commit halves of A5 for what one row's transaction cancelled. */
async function afterA5Commit(
    cancelled: readonly CancelledAddon[],
    ports: EndScheduledServicesPorts
): Promise<void> {
    if (cancelled.length === 0) return;
    await emitAddonCoverageRemoved({ cancelled, coverageNotices: ports.coverageNotices });
    await cancelAddonComplementsAtProvider(
        { cancelled },
        {
            provider: ports.provider,
            clock: ports.clock,
            beforeCancelNotice: ports.beforeCancelNotice,
            cancellationSeen: ports.cancellationSeen
        }
    );
}

/**
 * Runs S12 over the due `CANCEL_SCHEDULED` rows in two phases: principals (and their orphanhood)
 * first, complements after (AC:B8a:6). One transaction per row; the coverage notices and A5's
 * provider half go after each row's commit. A second run over the same rows writes nothing.
 *
 * @param input.limit - The page size of each phase (positive integer up to 10 000)
 * @param input.db - The client; defaults to `getDb()`
 * @param ports - Clock, provider, notices, the orphanhood ports and the optional closer/annotator
 * @returns Counts per phase and the detail per row
 * @throws ServiceError when `limit` is invalid
 */
export async function endScheduledServices(
    input: EndScheduledServicesInput,
    ports: EndScheduledServicesPorts
): Promise<EndScheduledServicesResult> {
    const parsed = inputSchema.safeParse({ limit: input.limit });
    if (!parsed.success)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid end-of-service run input',
            parsed.error.issues,
            'INVALID_END_SCHEDULED_SERVICES_INPUT'
        );
    const { limit } = parsed.data;
    const db = input.db ?? getDb();
    const now = ports.clock.now();
    const orphanhood: AddonOrphanhoodPorts = {
        addonPolicy: ports.addonPolicy,
        listing: ports.listing,
        liveAnchors: ports.liveAnchors,
        payments: ports.payments
    };
    const rows: EndScheduledServicesRow[] = [];
    const principals = { cancelled: 0, failed: 0 };
    const complements = { cancelled: 0, failed: 0 };

    for (const subscriptionId of await duePrincipals({ db, now, limit })) {
        try {
            const result = await db.transaction(async (tx) =>
                applyS12ToPrincipal(
                    { tx, subscriptionId, now },
                    {
                        orphanhood,
                        clock: ports.clock,
                        successionCloser: ports.successionCloser
                    }
                )
            );
            if (result.outcome === 'CANCELLED') {
                principals.cancelled += 1;
                await emitServiceEndRemoved({
                    ended: [result],
                    coverageNotices: ports.coverageNotices
                });
                await afterA5Commit(result.cancelled, ports);
                try {
                    await pauseComplementsS32(
                        {
                            principalSubscriptionId: subscriptionId,
                            trigger: 'PRINCIPAL_LEFT_LIVE_ROWS'
                        },
                        {
                            provider: ports.provider,
                            clock: ports.clock,
                            policy: {
                                addonPolicy: ports.addonPolicy,
                                listing: ports.listing,
                                liveAnchors: ports.liveAnchors
                            }
                        }
                    );
                } catch (error) {
                    logger.error(
                        { subscriptionId, error },
                        'S32 failed after S12 ended a principal'
                    );
                }
            }
            rows.push({
                subscriptionId,
                phase: 'PRINCIPAL',
                outcome: result.outcome,
                orphaned:
                    result.outcome === 'CANCELLED'
                        ? result.cancelled.map(({ instanceId }) => instanceId)
                        : [],
                withdrawn: null
            });
        } catch (error) {
            principals.failed += 1;
            logger.error({ subscriptionId, error }, 'S12 failed on a principal; retried next run');
            rows.push({
                subscriptionId,
                phase: 'PRINCIPAL',
                outcome: 'FAILED',
                orphaned: [],
                withdrawn: null,
                error: errorMessage(error)
            });
        }
    }

    for (const subscriptionId of await dueComplements({ db, now, limit })) {
        try {
            const result = await db.transaction(async (tx) =>
                applyS12ToComplement({ tx, subscriptionId, now }, orphanhood)
            );
            if (result.outcome === 'CANCELLED') complements.cancelled += 1;
            if (result.withdrawn) await afterA5Commit([result.withdrawn], ports);
            rows.push({
                subscriptionId,
                phase: 'COMPLEMENTO',
                outcome: result.outcome,
                orphaned: [],
                withdrawn: result.withdrawn?.instanceId ?? null
            });
        } catch (error) {
            complements.failed += 1;
            logger.error({ subscriptionId, error }, 'S12 failed on a complement; retried next run');
            rows.push({
                subscriptionId,
                phase: 'COMPLEMENTO',
                outcome: 'FAILED',
                orphaned: [],
                withdrawn: null,
                error: errorMessage(error)
            });
        }
    }

    logger.info({ principals, complements }, 'S12 run finished');
    return { principals, complements, rows };
}
