/**
 * A5 (TRANS:B:A5; AC:B5:25), its LOCAL half: an addon instance in `PENDING_AUTHORIZATION` or
 * `ACTIVE` goes to `CANCELLED` because it is withdrawn, became orphaned (notas I-8), or the grant
 * whose anchor titled it was revoked (third clause, `GRANT_REVOKED`, called by
 * `revokePermanentGrant`; DEC-ADDON-006; HOS-1634, HOS-1630). In the SAME transaction `S21` closes its complement
 * subscription and, when `S21` wrote it now and it has a card provider link, the decision to
 * cancel its preapproval is recorded as `A5` (notas I-5): that one preapproval is the only call.
 * Order: `closeSuccessionIfPredecessor` → {@link runOrphanhood} (in the act's `tx`) → commit →
 * {@link emitAddonCoverageRemoved} → {@link cancelAddonComplementsAtProvider} (AC:B5:27), the only
 * half that calls the provider or enqueues mail; it holds no transaction.
 */
import { randomUUID } from 'node:crypto';
import {
    addonInstances,
    and,
    type DrizzleClient,
    domainEventModel,
    eq,
    inArray,
    LIVE_SUBSCRIPTION_STATUSES,
    providerLinks,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import type { CoverageNotices } from '../payment/payment-ports';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision';
import { applyS21 } from '../subscription/complement-s21';
import { S21_CAUSES, type S21Cause } from '../subscription/complement-s21-charge';
import {
    type AddonEndFact,
    type AddonEnding,
    emitAddonEndingFacts
} from './addon-coverage-removed';
import { compatibleVerticalsOf, coverageVerticalsOf } from './addon-coverage-verticals';
import { findOrphanhoodCandidates, isAddonInstanceOrphaned } from './addon-orphanhood';
import type { AddonOrphanhoodPorts } from './addon-orphanhood-ports';

export type { AddonEndFact, AddonEnding } from './addon-coverage-removed';
export {
    type AddonProviderCancellationPorts,
    type AddonProviderCancellationResult,
    cancelAddonComplementsAtProvider
} from './addon-provider-cancellation';

const logger = createLogger('addon-instance-a5');

/** Grant revocation triggers the third A5 clause (TRANS:B:A5, `grant_anchor_revoked`, DEC-ADDON-006; HOS-1634). TEST:B5:13 covers its scope matrix in `permanent-grant-revoke-scopes.test.ts` (real path) and `addon-instance-a5-grant-revoked.test.ts` (seeded rows). */
export type A5Clause = 'ORPHANED' | 'WITHDRAWN' | 'GRANT_REVOKED';

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
    /** What the act did, for the ending's analytics fact (HOS-1883 §5.3). */
    readonly ending: AddonEnding;
}

/** What A5 did. */
export type A5Result =
    | { readonly outcome: 'CANCELLED'; readonly addon: CancelledAddon }
    | { readonly outcome: 'NOT_APPLICABLE' };

/** The ports A5 reads: the anchored scope and the listing, for the coverage verticals. */
export type A5Ports = Pick<AddonOrphanhoodPorts, 'addonPolicy' | 'listing'>;

const applySchema = z.object({
    instanceId: z.uuid(),
    clause: z.enum(['ORPHANED', 'WITHDRAWN', 'GRANT_REVOKED']),
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
 * @param input.clause - `ORPHANED`, `WITHDRAWN`, or `GRANT_REVOKED`
 * @param input.now - The instant of the act
 * @param ports - `políticaDeAddon` and `ficha`, for the coverage verticals (notas I-7). Part of
 *   the contract (Coord-377): every caller (`runOrphanhood`; `S12` with `WITHDRAWN`, HOS-1569;
 *   HOS-1546, HOS-1547, HOS-1570) passes them. The production `ficha` answers for
 *   an existing listing, including `PURGED`. A missing or soft-deleted listing throws
 *   `ListingNotFoundError` and rolls back the caller's act. `revokePermanentGrant` turns it into
 *   the typed 409 `PERMANENT_GRANT_LISTING_SOFT_DELETED` (HOS-2069).
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
    await domainEventModel.insert({
        eventType: 'addon_instance.status_changed',
        entityType: 'addon_instance',
        entityId: instance.id,
        actorType: 'job',
        actorId: null,
        correlationId: randomUUID(),
        changes: [{ field: 'status', old: from, new: 'CANCELLED' }],
        occurredAt: now,
        tx
    });

    const closed = instance.complementSubscriptionId
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
            providerCancellation: closed?.providerCancellation ?? null,
            ending: {
                origin: from,
                paid: instance.titleAnchorId === null,
                complement: closed?.complement ?? null,
                endedAt: now
            }
        }
    };
}

/** S21 on the complement and, when it wrote a card row with a link now, the decision `A5`. */
async function closeComplement(input: {
    readonly tx: DrizzleClient;
    readonly complementSubscriptionId: string;
    readonly now: Date;
    readonly s21Cause?: S21Cause;
}): Promise<{
    readonly providerCancellation: CancelledAddon['providerCancellation'];
    readonly complement: NonNullable<AddonEnding['complement']>;
}> {
    const { tx, complementSubscriptionId, now } = input;
    const s21 = await applyS21({
        tx,
        complementSubscriptionId,
        now,
        cause: input.s21Cause
    });
    if (s21.outcome !== 'CANCELLED')
        return { providerCancellation: null, complement: { outcome: s21.outcome } };
    const complement = { outcome: 'CANCELLED' as const, from: s21.from };
    const [row] = await tx
        .select({
            userId: subscriptions.userId,
            paymentMethod: subscriptions.paymentMethod,
            authorizationId: providerLinks.providerId
        })
        .from(subscriptions)
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, complementSubscriptionId))
        .limit(1);
    if (!row?.authorizationId || row.paymentMethod !== 'CARD' || !row.userId)
        return { providerCancellation: null, complement };
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
        providerCancellation: {
            subscriptionId: complementSubscriptionId,
            userId: row.userId,
            authorizationId: row.authorizationId
        },
        complement
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
/**
 * After the caller's commit: one `REMOVED` `ADDON` coverage notice per `(owner, vertical)` of the
 * cancelled instances (notas I-7), without repeating, then the analytics fact each ending owes
 * (HOS-1883), after `beforeFacts`. A notice failure is logged and never propagated. This call
 * is what makes `A5` a `turns-off` writer `via: notice` for G5.
 *
 * @param input.cancelled - What `runOrphanhood`/`applyA5`/`applyA6` cancelled
 * @param input.coverageNotices - The coverage notice port
 * @param input.end - The call site's ending path, or `NOT_AN_END` (required, T-5)
 * @param input.beforeFacts - Business work that must run before analytics (the provider call)
 */
export async function emitAddonCoverageRemoved(input: {
    readonly cancelled: readonly CancelledAddon[];
    readonly coverageNotices: CoverageNotices;
    readonly end: AddonEndFact;
    readonly beforeFacts?: () => Promise<void>;
}): Promise<void> {
    const seen = new Set<string>();
    for (const addon of input.cancelled)
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
    await input.beforeFacts?.();
    await emitAddonEndingFacts({ cancelled: input.cancelled, end: input.end });
}

function isStillLive(status: string): boolean {
    return (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}
