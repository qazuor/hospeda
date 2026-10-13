/**
 * A5 (TRANS:B:A5; AC:B5:25), its LOCAL half: an addon instance in `PENDING_AUTHORIZATION` or
 * `ACTIVE` goes to `CANCELLED` because it is withdrawn or became orphaned (notas I-8; the third
 * clause, the grant revocation, is Phase 2). In the SAME transaction `S21` closes its complement
 * subscription and, when `S21` wrote it now and it has a card provider link, the decision to
 * cancel its preapproval is recorded as `A5` (notas I-5): that one preapproval is the only call.
 * The provider half and the coverage notice run AFTER the caller's commit; this module never
 * opens a transaction, commits, calls the provider or enqueues mail.
 */
import {
    addonInstances,
    addonProducts,
    and,
    type DrizzleClient,
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
import {
    type AddonScopeType,
    findOrphanhoodCandidates,
    isAddonInstanceOrphaned
} from './addon-orphanhood';
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
    now: z.date(),
    tx: z.custom<DrizzleClient>((value) => value !== undefined && value !== null)
});

const runSchema = z.object({
    subscriptionId: z.uuid(),
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

/** Where the instance emitted its source, by the scope of its anchored version (notas I-7). */
async function coverageVerticalsOf(input: {
    readonly tx: DrizzleClient;
    readonly scopeType: AddonScopeType;
    readonly targetId: string | null;
    readonly compatibleVerticals: readonly string[];
    readonly ports: A5Ports;
}): Promise<readonly string[]> {
    switch (input.scopeType) {
        case 'USER':
        case 'GLOBAL':
            return input.compatibleVerticals;
        case 'VERTICAL_SUBSCRIPTION': {
            if (!input.targetId) return [];
            const [target] = await input.tx
                .select({ vertical: subscriptions.vertical })
                .from(subscriptions)
                .where(eq(subscriptions.id, input.targetId))
                .limit(1);
            return target?.vertical ? [target.vertical] : [];
        }
        case 'LISTING': {
            if (!input.targetId) return [];
            const listing = await input.ports.listing({ listingId: input.targetId });
            return [listing.vertical];
        }
        default: {
            const exhaustive: never = input.scopeType;
            return exhaustive;
        }
    }
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
 * @param ports - `políticaDeAddon` and `ficha`, for the coverage verticals
 * @returns The cancelled addon, or `NOT_APPLICABLE`
 * @throws ServiceError when the instance does not exist or left its state under the lock
 */
export async function applyA5(
    input: {
        readonly tx: DrizzleClient;
        readonly instanceId: string;
        readonly clause: A5Clause;
        readonly now: Date;
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
              now
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

/** The compatible verticals of the instance's product (USER/GLOBAL emit only there). */
async function compatibleVerticalsOf(input: {
    readonly tx: DrizzleClient;
    readonly productId: string;
}): Promise<readonly string[]> {
    const [product] = await input.tx
        .select({ compatibleVerticals: addonProducts.compatibleVerticals })
        .from(addonProducts)
        .where(eq(addonProducts.id, input.productId))
        .limit(1);
    return product?.compatibleVerticals ?? [];
}

/** S21 on the complement and, when it wrote a card row with a link now, the decision `A5`. */
async function closeComplement(input: {
    readonly tx: DrizzleClient;
    readonly complementSubscriptionId: string;
    readonly now: Date;
}): Promise<CancelledAddon['providerCancellation']> {
    const { tx, complementSubscriptionId, now } = input;
    const s21 = await applyS21({ tx, complementSubscriptionId, now });
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
 * evaluates the final state. After the commit the caller runs the provider half and
 * {@link emitAddonCoverageRemoved} with the returned `cancelled`.
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
    input: { readonly tx: DrizzleClient; readonly subscriptionId: string; readonly now: Date },
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
            succeedsId: subscriptions.succeedsId
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

    const { candidates } = await findOrphanhoodCandidates({ tx, leftRow: row }, ports);
    const cancelled: CancelledAddon[] = [];
    for (const candidate of candidates) {
        const orphaned = await isAddonInstanceOrphaned(
            { tx, instance: candidate, scopeType: candidate.scopeType },
            ports
        );
        if (!orphaned) continue;
        const result = await applyA5(
            { tx, instanceId: candidate.id, clause: 'ORPHANED', now },
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
