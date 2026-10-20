/**
 * S12 (TRANS:B:S12; AC:B8a:5), its first event: the end-of-service date of a `CANCEL_SCHEDULED`
 * row arrived, so the row goes to `CANCELLED` and the service is cut. One act per row, inside the
 * caller's transaction; idempotent: a row already `CANCELLED` is `ALREADY_CANCELLED` and nothing is
 * written. `service_ends_at` is never touched: it is the end date `retention-stopped.ts` and the
 * sweep read.
 *
 * - {@link applyS12ToPrincipal}: `UPDATE … CANCELLED` → `closeSuccessionIfPredecessor` (S18) →
 *   `recordCoverageLossIfUncovered` (`lost_at = service_ends_at`) → `runOrphanhood` (A5 → S21 on
 *   its complements), all in the same transaction. After the commit the caller runs
 *   {@link emitServiceEndRemoved}, `emitAddonCoverageRemoved` and `cancelAddonComplementsAtProvider`.
 * - {@link applyS12ToComplement}: the row is written `CANCELLED` FIRST and only then its instance
 *   is withdrawn by `applyA5` (`WITHDRAWN`), so `S21` finds it `CANCELLED` and no decision is
 *   recorded (the preapproval was cancelled by S11). A complement emits no coverage source.
 *
 * S12 records no cancellation decision of its own (the sweep keeps following S11's), never calls
 * the provider, enqueues mail, opens a mark, creates a refund or writes a domain event.
 */
import type { Clock } from '@repo/billing-verticals-contract';
import { addonInstances, and, type DrizzleClient, eq, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import {
    type A5Ports,
    applyA5,
    type CancelledAddon,
    runOrphanhood
} from '../addon/addon-instance-a5';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports';
import { recordCoverageLossIfUncovered } from '../coverage/coverage-loss';
import type { CoverageNotices } from '../payment/payment-ports';
import { type SuccessionCloser, unimplementedSuccessionCloser } from './subscription-billing-ports';
import { closeSuccessionIfPredecessor } from './succession-end';

const logger = createLogger('service-end-s12');

/** The class S12 acts on, per entry point. Local literals: nothing from `@repo/db` at module level. */
type S12Class = 'PRINCIPAL' | 'COMPLEMENTO';

/** The outcomes of S12 on a row that it did not write. */
export type S12SkippedOutcome = 'ALREADY_CANCELLED' | 'NOT_APPLICABLE' | 'NOT_DUE';

/** The input of both entry points. */
export interface S12Input {
    /** The caller's transaction (S12 never opens one nor commits). */
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    /** The instant of the run (I-3); a row is due when `service_ends_at <= now`. */
    readonly now: Date;
}

/** Ports of {@link applyS12ToPrincipal}. */
export interface S12PrincipalPorts {
    /** The orphanhood ports passed to `runOrphanhood`. */
    readonly orphanhood: AddonOrphanhoodPorts;
    /** The run's clock (the act itself reads `input.now`, I-3). */
    readonly clock: Clock;
    /** S18's interface; defaults to `unimplementedSuccessionCloser` (fails closed). */
    readonly successionCloser?: SuccessionCloser;
}

/** What S12 did on a principal. */
export type S12PrincipalResult =
    | {
          readonly outcome: 'CANCELLED';
          readonly subscriptionId: string;
          readonly userId: string;
          readonly vertical: string;
          readonly successionClosed: boolean;
          /** What `runOrphanhood` cancelled, for the after-commit halves. */
          readonly cancelled: readonly CancelledAddon[];
      }
    | { readonly outcome: S12SkippedOutcome; readonly subscriptionId: string };

/** What S12 did on a complement. */
export interface S12ComplementResult {
    readonly outcome: 'CANCELLED' | S12SkippedOutcome;
    readonly subscriptionId: string;
    /** The instance `applyA5` withdrew, or null. */
    readonly withdrawn: CancelledAddon | null;
}

/** A principal S12 closed, as {@link emitServiceEndRemoved} needs it. */
export interface S12EndedPrincipal {
    readonly subscriptionId: string;
    readonly userId: string;
    readonly vertical: string;
}

const inputSchema = z.object({
    subscriptionId: z.uuid(),
    now: z.date(),
    tx: z.custom<DrizzleClient>((value) => value !== undefined && value !== null)
});

function parseInput(input: S12Input): void {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid S12 input',
            parsed.error.issues,
            'INVALID_S12_INPUT'
        );
}

/** The locked row when S12 applies, or the outcome that says why it does not. */
type DueRow =
    | {
          readonly due: true;
          readonly userId: string | null;
          readonly vertical: string | null;
          readonly serviceEndsAt: Date;
      }
    | { readonly due: false; readonly outcome: S12SkippedOutcome };

/**
 * Reads the row `FOR UPDATE` and applies the guards of S12, in this order: missing → throws; other
 * class → `NOT_APPLICABLE`; `CANCELLED` → `ALREADY_CANCELLED`; not `CANCEL_SCHEDULED` →
 * `NOT_APPLICABLE`; `service_ends_at` null or later than `now` → `NOT_DUE`.
 */
async function lockDueRow(input: S12Input & { readonly expectedClass: S12Class }): Promise<DueRow> {
    const [row] = await input.tx
        .select({
            class: subscriptions.class,
            status: subscriptions.status,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical,
            serviceEndsAt: subscriptions.serviceEndsAt
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1)
        .for('update');
    if (!row)
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            `Subscription ${input.subscriptionId} not found`,
            undefined,
            'S12_SUBSCRIPTION_NOT_FOUND'
        );
    if (row.class !== input.expectedClass) return { due: false, outcome: 'NOT_APPLICABLE' };
    if (row.status === 'CANCELLED') return { due: false, outcome: 'ALREADY_CANCELLED' };
    if (row.status !== 'CANCEL_SCHEDULED') return { due: false, outcome: 'NOT_APPLICABLE' };
    if (!row.serviceEndsAt || row.serviceEndsAt.getTime() > input.now.getTime())
        return { due: false, outcome: 'NOT_DUE' };
    return {
        due: true,
        userId: row.userId,
        vertical: row.vertical,
        serviceEndsAt: row.serviceEndsAt
    };
}

function stateChanged(subscriptionId: string): never {
    throw new ServiceError(
        ServiceErrorCode.INTERNAL_ERROR,
        `Subscription ${subscriptionId} left CANCEL_SCHEDULED under the lock`,
        undefined,
        'S12_STATE_CHANGED'
    );
}

/**
 * S12 on a PRINCIPAL, inside the caller's transaction (AC:B8a:5). When due, ONE write guarded by
 * `CANCEL_SCHEDULED`: `CANCELLED`, the grace clock off, `updated_at = now`, `service_ends_at`
 * untouched. Then, in the same transaction and in this order: S18 through
 * `closeSuccessionIfPredecessor`, the coverage loss at `service_ends_at` (the instant the row
 * stopped emitting), and the orphanhood (AC:B8a:6: A5 → S21 on its complements). A throw rolls
 * the caller's transaction back.
 *
 * @param input.tx - The caller's transaction
 * @param input.subscriptionId - The PRINCIPAL row
 * @param input.now - The instant of the run
 * @param ports - Orphanhood ports, clock and the optional succession closer
 * @returns `CANCELLED` with what the after-commit halves need, or why nothing was written
 * @throws ServiceError when the row does not exist or left its state under the lock
 */
export async function applyS12ToPrincipal(
    input: S12Input,
    ports: S12PrincipalPorts
): Promise<S12PrincipalResult> {
    parseInput(input);
    const { tx, subscriptionId, now } = input;
    const row = await lockDueRow({ ...input, expectedClass: 'PRINCIPAL' });
    if (!row.due) return { outcome: row.outcome, subscriptionId };
    if (!row.userId || !row.vertical)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            `Principal ${subscriptionId} has no user or vertical`,
            undefined,
            'S12_PRINCIPAL_WITHOUT_SUBJECT'
        );

    const [written] = await tx
        .update(subscriptions)
        .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null, updatedAt: now })
        .where(
            and(eq(subscriptions.id, subscriptionId), eq(subscriptions.status, 'CANCEL_SCHEDULED'))
        )
        .returning({ id: subscriptions.id });
    if (!written) stateChanged(subscriptionId);

    const succession = await closeSuccessionIfPredecessor(
        { predecessorSubscriptionId: subscriptionId, tx },
        { successionCloser: ports.successionCloser ?? unimplementedSuccessionCloser }
    );
    // The row stopped emitting at its end date, not at the run (notas H-5).
    await recordCoverageLossIfUncovered({
        tx,
        userId: row.userId,
        vertical: row.vertical,
        lostAt: row.serviceEndsAt,
        clock: { now: () => now }
    });
    const { cancelled } = await runOrphanhood({ tx, subscriptionId, now }, ports.orphanhood);
    logger.info(
        { subscriptionId, orphaned: cancelled.map(({ instanceId }) => instanceId) },
        'S12 ended the service of a principal'
    );
    return {
        outcome: 'CANCELLED',
        subscriptionId,
        userId: row.userId,
        vertical: row.vertical,
        successionClosed: succession.called,
        cancelled
    };
}

/**
 * S12 on a COMPLEMENTO, inside the caller's transaction (AC:B8a:6). The caller runs it only after
 * the principals' phase. When due, the row is written `CANCELLED` FIRST (same columns as the
 * principal, `service_ends_at` untouched) and only then the instance hanging from it, if any, is
 * withdrawn by `applyA5` (`WITHDRAWN`; A5 decides its own `desde`). `S21` then finds the row
 * `CANCELLED` and no decision is recorded: a row that ends by its own S12 never takes S21's branch.
 *
 * @param input.tx - The caller's transaction
 * @param input.subscriptionId - The COMPLEMENTO row
 * @param input.now - The instant of the run
 * @param ports - `políticaDeAddon` and `ficha`, for A5's coverage verticals
 * @returns What S12 did and the instance it withdrew, if any
 * @throws ServiceError when the row does not exist or left its state under the lock
 */
export async function applyS12ToComplement(
    input: S12Input,
    ports: A5Ports
): Promise<S12ComplementResult> {
    parseInput(input);
    const { tx, subscriptionId, now } = input;
    const row = await lockDueRow({ ...input, expectedClass: 'COMPLEMENTO' });
    if (!row.due) return { outcome: row.outcome, subscriptionId, withdrawn: null };

    const [written] = await tx
        .update(subscriptions)
        .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null, updatedAt: now })
        .where(
            and(eq(subscriptions.id, subscriptionId), eq(subscriptions.status, 'CANCEL_SCHEDULED'))
        )
        .returning({ id: subscriptions.id });
    if (!written) stateChanged(subscriptionId);

    const [instance] = await tx
        .select({ id: addonInstances.id })
        .from(addonInstances)
        .where(eq(addonInstances.complementSubscriptionId, subscriptionId))
        .limit(1);
    const a5 = instance
        ? await applyA5({ tx, instanceId: instance.id, clause: 'WITHDRAWN', now }, ports)
        : null;
    const withdrawn = a5?.outcome === 'CANCELLED' ? a5.addon : null;
    logger.info(
        { subscriptionId, withdrawn: withdrawn?.instanceId ?? null },
        'S12 ended the service of a complement'
    );
    return { outcome: 'CANCELLED', subscriptionId, withdrawn };
}

/**
 * After the commit of each principal S12 closed: one `REMOVED` `SUBSCRIPTION` coverage notice per
 * principal. A failure is logged and never propagated: the commit already happened. This call is
 * what makes {@link applyS12ToPrincipal} a `turns-off` writer `via: notice` for G5.
 *
 * @param input.ended - The principals S12 closed
 * @param input.coverageNotices - The coverage notice port
 */
export async function emitServiceEndRemoved(input: {
    readonly ended: readonly S12EndedPrincipal[];
    readonly coverageNotices: CoverageNotices;
}): Promise<void> {
    for (const principal of input.ended) {
        const vertical = VerticalEnumSchema.safeParse(principal.vertical);
        if (!vertical.success) {
            logger.error(
                { subscriptionId: principal.subscriptionId, vertical: principal.vertical },
                'Ended principal has no coverage vertical to notify'
            );
            continue;
        }
        try {
            await input.coverageNotices.emitCoverageChanged({
                userId: principal.userId,
                vertical: vertical.data,
                sourceType: 'SUBSCRIPTION',
                change: 'REMOVED'
            });
        } catch (error) {
            logger.error(
                { subscriptionId: principal.subscriptionId, error },
                'Coverage changed notice failed after S12 commit'
            );
        }
    }
}
