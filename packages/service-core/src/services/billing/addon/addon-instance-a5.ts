/**
 * A5 (TRANS:B:A5; AC:B5:25), its LOCAL half: an addon instance in `PENDING_AUTHORIZATION` or
 * `ACTIVE` goes to `CANCELLED` because it is withdrawn or became orphaned (notas I-8; the third
 * clause, the grant revocation, is Phase 2). In the SAME transaction `S21` closes its complement
 * subscription and, when `S21` wrote it now and it has a card provider link, the decision to
 * cancel its preapproval is recorded as `A5` (notas I-5): that one preapproval is the only call.
 * Order: `closeSuccessionIfPredecessor` → {@link runOrphanhood} (in the act's `tx`) → commit →
 * {@link emitAddonCoverageRemoved} → {@link cancelAddonComplementsAtProvider} (AC:B5:27), the only
 * half that calls the provider or enqueues mail; it holds no transaction.
 */
import type { Clock } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    and,
    type DrizzleClient,
    eq,
    inArray,
    LIVE_SUBSCRIPTION_STATUSES,
    providerLinks,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import type { CoverageNotices } from '../payment/payment-ports';
import {
    type CancelOurAuthorizationOutcome,
    cancelOurAuthorization
} from '../reconciliation/cancel-our-authorization';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision';
import { applyS21 } from '../subscription/complement-s21';
import { S21_CAUSES, type S21Cause } from '../subscription/complement-s21-charge';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service';
import {
    type CancellationSeenAnnotator,
    noCancellationSeenAnnotation,
    recordAuthorizationSeenAlive,
    recordCancellationSeen
} from '../subscription/subscription-billing-ports';
import { compatibleVerticalsOf, coverageVerticalsOf } from './addon-coverage-verticals';
import { findOrphanhoodCandidates, isAddonInstanceOrphaned } from './addon-orphanhood';
import type { AddonOrphanhoodPorts } from './addon-orphanhood-ports';

const logger = createLogger('addon-instance-a5');

/** The clauses of A5 this cut implements (notas I-8): `GRANT_REVOKED` is Phase 2 (AC:B5:26). */
export type A5Clause = 'ORPHANED' | 'WITHDRAWN';

/** The `desde` of A5 (glossary row 18): the two instance states with an authorization that can charge. */
type A5Origin = 'PENDING_AUTHORIZATION' | 'ACTIVE';

/** Whether the instance emitted an `ADDON` coverage source from that origin (addon-sources reads ACTIVE). */
const EMITTED_SOURCE: Readonly<Record<A5Origin, boolean>> = {
    PENDING_AUTHORIZATION: false,
    ACTIVE: true
};

/** The instance A5 cancelled, with what the after-commit halves need. */
export interface CancelledAddon {
    readonly instanceId: string;
    readonly ownerId: string;
    readonly clause: A5Clause;
    /** The verticals where it emitted an `ADDON` source (notas I-7); empty when it emitted none. */
    readonly coverageVerticals: readonly string[];
    readonly complementSubscriptionId: string | null;
    /** Present when the decision to cancel the complement's preapproval was recorded. */
    readonly providerCancellation: {
        readonly subscriptionId: string;
        readonly userId: string;
        readonly authorizationId: string;
    } | null;
}

/** What A5 did. */
export type A5Result =
    | { readonly outcome: 'CANCELLED'; readonly addon: CancelledAddon }
    | { readonly outcome: 'NOT_APPLICABLE' };

/** The ports A5 reads: the anchored scope and the listing, for the coverage verticals. */
export type A5Ports = Pick<AddonOrphanhoodPorts, 'addonPolicy' | 'listing'>;

const applySchema = z.object({
    instanceId: z.uuid(),
    clause: z.enum(['ORPHANED', 'WITHDRAWN']),
    s21Cause: z.enum(S21_CAUSES).optional(),
    now: z.date(),
    tx: z.custom<DrizzleClient>((value) => value !== undefined && value !== null)
});

const runSchema = z.object({
    subscriptionId: z.uuid(),
    s21Cause: z.enum(S21_CAUSES).optional(),
    now: z.date(),
    tx: z.custom<DrizzleClient>((value) => value !== undefined && value !== null)
});

function invalid(issues: unknown): never {
    throw new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        'Invalid A5 input',
        issues,
        'INVALID_A5_INPUT'
    );
}

function isA5Origin(status: string): status is A5Origin {
    return status === 'PENDING_AUTHORIZATION' || status === 'ACTIVE';
}

/**
 * A5 on one instance, inside the caller's transaction. Reads it `FOR UPDATE`; outside its
 * `desde` it is `NOT_APPLICABLE` and writes nothing. Otherwise: `CANCELLED`, guarded by the
 * state read under the lock; `S21` on its complement in the same transaction; and, when `S21`
 * cancelled a card complement with a provider link, the decision `A5` on that complement
 * (notas I-5). An instance without complement is only local (notas I-6).
 *
 * @param input.tx - The caller's transaction
 * @param input.instanceId - The addon instance
 * @param input.clause - `ORPHANED` or `WITHDRAWN`
 * @param input.now - The instant of the act
 * @param ports - `políticaDeAddon` and `ficha`, for the coverage verticals (notas I-7). Part of
 *   the contract (Coord-377): every caller (`runOrphanhood`; `S12` with `WITHDRAWN`, HOS-1569;
 *   HOS-1546, HOS-1547, HOS-1570) passes them; with the production `ficha` a `LISTING`
 *   instance throws and the caller's act rolls back (notas I-12)
 * @returns The cancelled addon, or `NOT_APPLICABLE`
 * @throws ServiceError when the instance does not exist or left its state under the lock
 */
export async function applyA5(
    input: {
        readonly tx: DrizzleClient;
        readonly instanceId: string;
        readonly clause: A5Clause;
        readonly now: Date;
        readonly s21Cause?: S21Cause;
    },
    ports: A5Ports
): Promise<A5Result> {
    const parsed = applySchema.safeParse(input);
    if (!parsed.success) invalid(parsed.error.issues);
    const { tx, now } = input;
    const [instance] = await tx
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.id, input.instanceId))
        .limit(1)
        .for('update');
    if (!instance)
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            `Addon instance ${input.instanceId} not found`,
            undefined,
            'A5_INSTANCE_NOT_FOUND'
        );
    const from = instance.status;
    if (!isA5Origin(from)) return { outcome: 'NOT_APPLICABLE' };

    const [written] = await tx
        .update(addonInstances)
        .set({ status: 'CANCELLED', updatedAt: now })
        .where(
            and(
                eq(addonInstances.id, instance.id),
                inArray(addonInstances.status, ['PENDING_AUTHORIZATION', 'ACTIVE']),
                eq(addonInstances.status, from)
            )
        )
        .returning({ id: addonInstances.id });
    if (!written)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            `Addon instance ${instance.id} left ${from} under the lock`,
            undefined,
            'A5_STATE_CHANGED'
        );

    const providerCancellation = instance.complementSubscriptionId
        ? await closeComplement({
              tx,
              complementSubscriptionId: instance.complementSubscriptionId,
              now,
              s21Cause: input.s21Cause
          })
        : null;

    const coverageVerticals = EMITTED_SOURCE[from]
        ? await coverageVerticalsOf({
              tx,
              scopeType: (await ports.addonPolicy({ addonVersionId: instance.addonVersionId }))
                  .scopeType,
              targetId: instance.targetId,
              compatibleVerticals: await compatibleVerticalsOf({
                  tx,
                  productId: instance.productId
              }),
              ports
          })
        : [];

    return {
        outcome: 'CANCELLED',
        addon: {
            instanceId: instance.id,
            ownerId: instance.ownerId,
            clause: input.clause,
            coverageVerticals,
            complementSubscriptionId: instance.complementSubscriptionId,
            providerCancellation
        }
    };
}

/** S21 on the complement and, when it wrote a card row with a link now, the decision `A5`. */
async function closeComplement(input: {
    readonly tx: DrizzleClient;
    readonly complementSubscriptionId: string;
    readonly now: Date;
    readonly s21Cause?: S21Cause;
}): Promise<CancelledAddon['providerCancellation']> {
    const { tx, complementSubscriptionId, now } = input;
    const s21 = await applyS21({
        tx,
        complementSubscriptionId,
        now,
        cause: input.s21Cause
    });
    if (s21.outcome !== 'CANCELLED') return null;
    const [complement] = await tx
        .select({
            userId: subscriptions.userId,
            paymentMethod: subscriptions.paymentMethod,
            authorizationId: providerLinks.providerId
        })
        .from(subscriptions)
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, complementSubscriptionId))
        .limit(1);
    if (!complement?.authorizationId || complement.paymentMethod !== 'CARD' || !complement.userId)
        return null;
    await recordProviderCancellationDecided({
        subscriptionId: complementSubscriptionId,
        transition: 'A5',
        decidedAt: now,
        actor: { type: 'job' },
        correlationId: crypto.randomUUID(),
        changes: [{ field: 'status', old: s21.from, new: 'CANCELLED' }],
        tx
    });
    return {
        subscriptionId: complementSubscriptionId,
        userId: complement.userId,
        authorizationId: complement.authorizationId
    };
}

/**
 * The orphanhood of B/16 §4.3, local half, for a principal that just left the live rows.
 *
 * CONTRACT (notas §4 and §7): it receives the caller's transaction and NEVER opens one or
 * commits; it NEVER calls the provider, enqueues mail, or calls `S18` /
 * `closeSuccessionIfPredecessor`. It reads `sucede_a`/`sucedida_por` with that transaction, so
 * the caller runs `closeSuccessionIfPredecessor` BEFORE it, in the same transaction, and A5
 * evaluates the final state. After the commit the caller runs {@link emitAddonCoverageRemoved}
 * and then {@link cancelAddonComplementsAtProvider} with the returned `cancelled`.
 *
 * The trigger is leaving the live rows, never a concrete arrival state: a row that is not a
 * PRINCIPAL, or that is still a live row, returns `{ cancelled: [] }` without writing.
 *
 * @param input.tx - The caller's transaction
 * @param input.subscriptionId - The principal the caller's transition touched
 * @param input.now - The instant of the act
 * @param ports - Orphanhood ports
 * @returns `{ cancelled }`: the instances A5 cancelled as `ORPHANED`
 */
export async function runOrphanhood(
    input: {
        readonly tx: DrizzleClient;
        readonly subscriptionId: string;
        readonly now: Date;
        readonly s21Cause?: S21Cause;
    },
    ports: AddonOrphanhoodPorts
): Promise<{ readonly cancelled: readonly CancelledAddon[] }> {
    const parsed = runSchema.safeParse(input);
    if (!parsed.success) invalid(parsed.error.issues);
    const { tx, now } = input;
    const [row] = await tx
        .select({
            id: subscriptions.id,
            class: subscriptions.class,
            status: subscriptions.status,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical,
            predecessorId: subscriptions.succeedsId
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1);
    if (!row)
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            `Subscription ${input.subscriptionId} not found`,
            undefined,
            'A5_SUBSCRIPTION_NOT_FOUND'
        );
    if (row.class !== 'PRINCIPAL' || isStillLive(row.status)) return { cancelled: [] };

    const { candidates } = await findOrphanhoodCandidates(
        {
            tx,
            leftRow: {
                id: row.id,
                userId: row.userId,
                vertical: row.vertical,
                predecessorId: row.predecessorId
            }
        },
        ports
    );
    const cancelled: CancelledAddon[] = [];
    for (const candidate of candidates) {
        const orphaned = await isAddonInstanceOrphaned(
            { tx, instance: candidate, scopeType: candidate.scopeType },
            ports
        );
        if (!orphaned) continue;
        const result = await applyA5(
            { tx, instanceId: candidate.id, clause: 'ORPHANED', now, s21Cause: input.s21Cause },
            ports
        );
        if (result.outcome === 'CANCELLED') cancelled.push(result.addon);
    }
    return { cancelled };
}

/** Whether the subscription is still one of the six live rows (the trigger did not happen). */
function isStillLive(status: string): boolean {
    return (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

/**
 * After the caller's commit: one `REMOVED` `ADDON` coverage notice per `(owner, vertical)` of
 * the cancelled instances (notas I-7), without repeating. A failure is logged and never
 * propagated: the commit already happened and nothing is undone. This call is what makes `A5`
 * a `turns-off` writer `via: notice` for G5.
 *
 * @param input.cancelled - What `runOrphanhood`/`applyA5` cancelled
 * @param input.coverageNotices - The coverage notice port
 */
export async function emitAddonCoverageRemoved(input: {
    readonly cancelled: readonly CancelledAddon[];
    readonly coverageNotices: CoverageNotices;
}): Promise<void> {
    const seen = new Set<string>();
    for (const addon of input.cancelled) {
        for (const raw of addon.coverageVerticals) {
            const key = `${addon.ownerId}|${raw}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const vertical = VerticalEnumSchema.safeParse(raw);
            if (!vertical.success) {
                logger.error(
                    { instanceId: addon.instanceId, vertical: raw },
                    'Cancelled addon has no coverage vertical to notify'
                );
                continue;
            }
            try {
                await input.coverageNotices.emitCoverageChanged({
                    userId: addon.ownerId,
                    vertical: vertical.data,
                    sourceType: 'ADDON',
                    change: 'REMOVED'
                });
            } catch (error) {
                logger.error(
                    { instanceId: addon.instanceId, vertical: raw, error },
                    'Coverage changed notice failed after A5 commit'
                );
            }
        }
    }
}

/** Ports of {@link cancelAddonComplementsAtProvider}; `cancellationSeen` defaults to the no-op. */
export interface AddonProviderCancellationPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly cancellationSeen?: CancellationSeenAnnotator;
}

/** One complement's provider half; `escalated` when our notice is undeliverable and it called. */
export interface AddonProviderCancellationResult {
    readonly subscriptionId: string;
    readonly cancelCall: 'SENT' | 'NOT_NEEDED' | 'NOTICE_PENDING' | 'FAILED';
    readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
}

/** What each outcome of the shared cancellation helper means for A5. Exhaustive. */
const CALL_BY_OUTCOME: Readonly<
    Record<CancelOurAuthorizationOutcome, AddonProviderCancellationResult['cancelCall']>
> = {
    ALREADY_CANCELLED: 'NOT_NEEDED',
    NOTICE_PENDING: 'NOTICE_PENDING',
    CALL_FAILED: 'FAILED',
    CONFIRMED: 'SENT',
    SENT_UNCONFIRMED: 'SENT'
};

/**
 * A5's provider half (AC:B5:27), after the commit, in no transaction: per decided complement, a
 * re-read by id and its annotation, then `cancelOurAuthorization` with `ADDON_CANCELLED` (notice
 * first, ONE call). Never throws nor undoes: the sweep retries the decision, same kind (I-1).
 *
 * @param input.cancelled - What `runOrphanhood`/`applyA5` cancelled
 * @param ports - Provider, clock, our notice and the optional seen-annotator
 * @returns `{ results }`: one per complement with a recorded decision
 */
export async function cancelAddonComplementsAtProvider(
    input: { readonly cancelled: readonly CancelledAddon[] },
    ports: AddonProviderCancellationPorts
): Promise<{ readonly results: readonly AddonProviderCancellationResult[] }> {
    const { provider, clock } = ports;
    const annotator = ports.cancellationSeen ?? noCancellationSeenAnnotation;
    const results: AddonProviderCancellationResult[] = [];
    for (const { providerCancellation: target } of input.cancelled) {
        if (!target) continue;
        const { subscriptionId, authorizationId } = target;
        try {
            const act = { kind: 'decision' as const, startedAt: clock.now() };
            actStartInstant({ act });
            const read = await provider.readAuthorization({ authorizationId });
            const { snapshot, readAt } = assertFreshForAct({ read, act });
            const annotate =
                snapshot.status === 'cancelled'
                    ? recordCancellationSeen
                    : recordAuthorizationSeenAlive;
            await annotate({ annotator, subscriptionId, seenAt: readAt });
            let notice: Awaited<ReturnType<BeforeCancelNotice['beforeCancel']>> | undefined;
            const beforeCancelNotice: BeforeCancelNotice = {
                beforeCancel: async (args) => {
                    notice = await ports.beforeCancelNotice.beforeCancel(args);
                    return notice;
                }
            };
            const { outcome } = await cancelOurAuthorization(
                { ...target, kind: 'ADDON_CANCELLED', prior: { read, act } },
                { provider, clock, beforeCancelNotice }
            );
            if (outcome === 'CONFIRMED')
                await recordCancellationSeen({ annotator, subscriptionId, seenAt: clock.now() });
            const cancelCall = CALL_BY_OUTCOME[outcome];
            const escalated =
                notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED' ? notice : undefined;
            if (escalated)
                logger.warn({ subscriptionId, notice }, 'A5 notice undeliverable; called');
            results.push({ subscriptionId, cancelCall, ...(escalated ? { escalated } : {}) });
        } catch (error) {
            logger.error({ subscriptionId, error }, 'A5 provider cancel failed; the sweep retries');
            results.push({ subscriptionId, cancelCall: 'FAILED' });
        }
    }
    return { results };
}
