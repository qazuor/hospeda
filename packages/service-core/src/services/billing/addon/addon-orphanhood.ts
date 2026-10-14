/**
 * The addon orphanhood (B/16 §4.2 and §4.3; AC:B5:25): WHICH instances a principal that just
 * left the live rows puts in question, and WHETHER one of them is effectively orphaned. The
 * condition is written once, here, and nothing in this module writes: `A5` (addon-instance-a5)
 * is the writer. Every read runs in the caller's transaction, so it sees what the caller (and
 * `S18`, if it ran before in the same act) already wrote. A read error throws: the predicate
 * fails closed, never answering «orphaned» or «not orphaned» by default.
 */
import type { AddonPolicyResponse } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    addonProducts,
    and,
    type DrizzleClient,
    eq,
    inArray,
    LIVE_SUBSCRIPTION_STATUSES,
    or,
    subscriptions
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { creditedPaymentsFromLedger } from '../payment/payment-ledger';
import { isLiveSuccessionPredecessor } from '../subscription/late-payment-conditions';
import type { SubscriptionPayments } from '../subscription/subscription-billing-ports';
import {
    type AddonOrphanhoodPorts,
    type LiveAnchorReader,
    noLiveAnchors
} from './addon-orphanhood-ports';

/** The scope type of an anchored addon version (contract §4.1). */
export type AddonScopeType = AddonPolicyResponse['scopeType'];

/** The principal that just left the live rows (the event of B/16 §4.3). */
export interface OrphanhoodLeftRow {
    readonly id: string;
    readonly userId: string | null;
    readonly vertical: string | null;
    /** `sucede_a`: when the row was a successor, its predecessor (group 2). */
    readonly predecessorId: string | null;
}

/** The instance the predicate evaluates, with what its scope needs. */
export interface OrphanhoodInstance {
    readonly id: string;
    readonly ownerId: string;
    readonly targetId: string | null;
    /** `addon_product.compatible_verticals` (USER/GLOBAL). */
    readonly compatibleVerticals: readonly string[];
}

/** One candidate of B/16 §4.3, with the scope of its anchored version. */
export interface OrphanhoodCandidate extends OrphanhoodInstance {
    readonly status: 'PENDING_AUTHORIZATION' | 'ACTIVE';
    readonly addonVersionId: string;
    readonly complementSubscriptionId: string | null;
    readonly scopeType: AddonScopeType;
}

function inconsistent(message: string): never {
    throw new ServiceError(
        ServiceErrorCode.INTERNAL_ERROR,
        message,
        undefined,
        'ADDON_ORPHANHOOD_INCONSISTENT'
    );
}

const leftRowSchema = z.object({
    id: z.uuid(),
    userId: z.uuid().nullable(),
    vertical: z.string().min(1).nullable(),
    predecessorId: z.uuid().nullable()
});

const instanceSchema = z.object({
    id: z.uuid(),
    ownerId: z.uuid(),
    targetId: z.uuid().nullable(),
    compatibleVerticals: z.array(z.string().min(1))
});

function invalid(issues: unknown): never {
    throw new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        'Invalid orphanhood input',
        issues,
        'INVALID_ADDON_ORPHANHOOD_INPUT'
    );
}

function anchorsOf(ports: AddonOrphanhoodPorts): LiveAnchorReader {
    return ports.liveAnchors ?? noLiveAnchors;
}

function paymentsOf(ports: AddonOrphanhoodPorts): SubscriptionPayments {
    return ports.payments ?? creditedPaymentsFromLedger;
}

/**
 * The candidates of B/16 §4.3 for a principal that left the live rows: the instances in
 * `PENDING_AUTHORIZATION` or `ACTIVE` (the `desde` of `A5`), without duplicates, of the four
 * groups: (1) `VERTICAL_SUBSCRIPTION` targeting the row; (2) if it was a successor,
 * `VERTICAL_SUBSCRIPTION` targeting its predecessor; (3) `LISTING` of the same owner whose
 * listing (read through `ficha`) is of the row's vertical and of that owner; (4) `USER`/`GLOBAL`
 * of the same owner whose product declares the row's vertical compatible. The scope always
 * comes from the ANCHORED version through `políticaDeAddon`, never from the product.
 *
 * @param input.tx - The caller's transaction
 * @param input.leftRow - The principal that just left the live rows
 * @param ports - `políticaDeAddon` and `ficha`
 * @returns `{ candidates }`; writes nothing
 */
export async function findOrphanhoodCandidates(
    input: { readonly tx: DrizzleClient; readonly leftRow: OrphanhoodLeftRow },
    ports: AddonOrphanhoodPorts
): Promise<{ readonly candidates: readonly OrphanhoodCandidate[] }> {
    const parsed = leftRowSchema.safeParse(input.leftRow);
    if (!parsed.success) invalid(parsed.error.issues);
    const { tx, leftRow } = input;
    const targets = leftRow.predecessorId ? [leftRow.id, leftRow.predecessorId] : [leftRow.id];
    const reach = leftRow.userId
        ? or(inArray(addonInstances.targetId, targets), eq(addonInstances.ownerId, leftRow.userId))
        : inArray(addonInstances.targetId, targets);
    const rows = await tx
        .select({
            id: addonInstances.id,
            ownerId: addonInstances.ownerId,
            targetId: addonInstances.targetId,
            status: addonInstances.status,
            addonVersionId: addonInstances.addonVersionId,
            complementSubscriptionId: addonInstances.complementSubscriptionId,
            compatibleVerticals: addonProducts.compatibleVerticals
        })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
        .where(and(inArray(addonInstances.status, ['PENDING_AUTHORIZATION', 'ACTIVE']), reach));

    const candidates: OrphanhoodCandidate[] = [];
    for (const row of rows) {
        const { scopeType } = await ports.addonPolicy({ addonVersionId: row.addonVersionId });
        let reached: boolean;
        switch (scopeType) {
            case 'VERTICAL_SUBSCRIPTION':
                reached = row.targetId !== null && targets.includes(row.targetId);
                break;
            case 'LISTING': {
                if (!row.targetId || !leftRow.userId || row.ownerId !== leftRow.userId) {
                    reached = false;
                    break;
                }
                const listing = await ports.listing({ listingId: row.targetId });
                reached =
                    listing.vertical === leftRow.vertical && listing.ownerId === leftRow.userId;
                break;
            }
            case 'USER':
            case 'GLOBAL':
                reached =
                    leftRow.userId !== null &&
                    row.ownerId === leftRow.userId &&
                    leftRow.vertical !== null &&
                    row.compatibleVerticals.includes(leftRow.vertical);
                break;
            default: {
                const exhaustive: never = scopeType;
                reached = exhaustive;
            }
        }
        if (!reached) continue;
        candidates.push({
            id: row.id,
            ownerId: row.ownerId,
            targetId: row.targetId,
            status: asInstanceLiveStatus(row.status),
            addonVersionId: row.addonVersionId,
            complementSubscriptionId: row.complementSubscriptionId,
            compatibleVerticals: row.compatibleVerticals,
            scopeType
        });
    }
    return { candidates };
}

/** The two live states of an instance (glossary row 18); the query already filtered them. */
function asInstanceLiveStatus(status: string): OrphanhoodCandidate['status'] {
    if (status === 'PENDING_AUTHORIZATION' || status === 'ACTIVE') return status;
    return inconsistent(`Addon instance status ${status} is not a live instance status`);
}

/** Whether a subscription status is one of the six live ones (glossary «fila viva»). */
function isLiveStatus(status: string): boolean {
    return (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

/** The live principals of `(userId, vertical)`: the whole set, never «the latest» (4c). */
async function livePrincipals(input: {
    readonly tx: DrizzleClient;
    readonly userId: string;
    readonly vertical: string;
}): Promise<readonly { readonly id: string; readonly predecessorId: string | null }[]> {
    return input.tx
        .select({ id: subscriptions.id, predecessorId: subscriptions.succeedsId })
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.userId, input.userId),
                eq(subscriptions.vertical, input.vertical),
                eq(subscriptions.class, 'PRINCIPAL'),
                inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES)
            )
        );
}

/** First half of the VERTICAL_SUBSCRIPTION row (glossary row 5) plus its second and third. */
async function verticalSubscriptionOrphaned(input: {
    readonly tx: DrizzleClient;
    readonly targetId: string;
    readonly anchors: LiveAnchorReader;
}): Promise<boolean> {
    const [target] = await input.tx
        .select({
            id: subscriptions.id,
            status: subscriptions.status,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical,
            succeededById: subscriptions.succeededById
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, input.targetId))
        .limit(1);
    if (!target) return inconsistent(`Addon target subscription ${input.targetId} not found`);
    if (isLiveStatus(target.status)) return false;
    // A closed succession relieves it (`sucedida_por` is never cleared).
    if (target.succeededById !== null) return false;
    // A succession in progress relieves it only while its successor is a live row (row 11).
    if (await isLiveSuccessionPredecessor({ subscriptionId: target.id, tx: input.tx }))
        return false;
    if (target.userId && target.vertical) {
        const anchored = await input.anchors.hasLiveAnchor({
            userId: target.userId,
            vertical: target.vertical,
            tx: input.tx
        });
        if (anchored) return false;
    }
    return true;
}

/**
 * The condition of B/16 §4.2, written once: whether an instance is effectively orphaned.
 *
 * - `VERTICAL_SUBSCRIPTION`: its target is not a live row, `sucedida_por` is null, no live
 *   successor points at it, and no live anchor holds in its `(user, vertical)`.
 * - `LISTING`: no principal of the listing's `user + vertical` is a live row (the SET, 4c),
 *   and no live anchor holds there.
 * - `USER`/`GLOBAL`: in NO compatible vertical of its product is there a live principal that
 *   is paying (I-3: a credited payment of its own or of its `sucede_a`), nor a live anchor.
 *
 * @param input.tx - The caller's transaction
 * @param input.instance - The instance, with its target and its product's compatible verticals
 * @param input.scopeType - The scope of its anchored version
 * @param ports - `ficha`, live anchors and payments
 * @returns True when orphaned; a read error throws (fails closed); writes nothing
 */
export async function isAddonInstanceOrphaned(
    input: {
        readonly tx: DrizzleClient;
        readonly instance: OrphanhoodInstance;
        readonly scopeType: AddonScopeType;
    },
    ports: AddonOrphanhoodPorts
): Promise<boolean> {
    const parsed = instanceSchema.safeParse(input.instance);
    if (!parsed.success) invalid(parsed.error.issues);
    const { tx, instance } = input;
    const anchors = anchorsOf(ports);
    switch (input.scopeType) {
        case 'VERTICAL_SUBSCRIPTION': {
            if (!instance.targetId)
                return inconsistent(`Addon instance ${instance.id} has no target subscription`);
            return verticalSubscriptionOrphaned({ tx, targetId: instance.targetId, anchors });
        }
        case 'LISTING': {
            if (!instance.targetId)
                return inconsistent(`Addon instance ${instance.id} has no target listing`);
            const listing = await ports.listing({ listingId: instance.targetId });
            const live = await livePrincipals({
                tx,
                userId: listing.ownerId,
                vertical: listing.vertical
            });
            if (live.length > 0) return false;
            return !(await anchors.hasLiveAnchor({
                userId: listing.ownerId,
                vertical: listing.vertical,
                tx
            }));
        }
        case 'USER':
        case 'GLOBAL': {
            const payments = paymentsOf(ports);
            for (const vertical of instance.compatibleVerticals) {
                const live = await livePrincipals({ tx, userId: instance.ownerId, vertical });
                for (const principal of live) {
                    if (await payments.hasCreditedPayment({ subscriptionId: principal.id, tx }))
                        return false;
                    if (
                        principal.predecessorId &&
                        (await payments.hasCreditedPayment({
                            subscriptionId: principal.predecessorId,
                            tx
                        }))
                    )
                        return false;
                }
                if (await anchors.hasLiveAnchor({ userId: instance.ownerId, vertical, tx }))
                    return false;
            }
            return true;
        }
        default: {
            const exhaustive: never = input.scopeType;
            return exhaustive;
        }
    }
}
