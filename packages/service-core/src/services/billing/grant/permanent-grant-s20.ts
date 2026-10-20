/** S20 converts compatible paid addon complements to $0 as part of a permanent-grant act. */
import {
    addonInstances,
    addonProducts,
    and,
    type DrizzleClient,
    eq,
    inArray,
    isNull,
    LIVE_SUBSCRIPTION_STATUSES,
    permanentGrants,
    providerLinks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct } from '@repo/payments';
import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports.js';
import {
    type CancelOurAuthorizationOutcome,
    cancelOurAuthorization
} from '../reconciliation/cancel-our-authorization.js';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision.js';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service.js';
import {
    noCancellationSeenAnnotation,
    recordAuthorizationSeenAlive,
    recordCancellationSeen
} from '../subscription/subscription-billing-ports.js';
import type { S13ProviderPorts } from './permanent-grant-s13.js';

type LiveSubscriptionStatus = (typeof LIVE_SUBSCRIPTION_STATUSES)[number];

/** One permanent-grant anchor available to title a converted addon. */
export interface S20Anchor {
    readonly id: string;
    readonly vertical: string;
}

/** Provider cancellation data retained for a complement row. */
export interface S20ProviderRow {
    readonly subscriptionId: string;
    readonly userId: string;
    readonly authorizationId: string | null;
    readonly cardPayer: boolean;
}

/** Locked addon and complement state selected by S20. */
export interface S20Row extends S20ProviderRow {
    readonly instanceId: string;
    readonly instanceStatus: 'PENDING_AUTHORIZATION' | 'ACTIVE';
    readonly titleAnchorId: string | null;
    readonly origin: LiveSubscriptionStatus;
}

/** Rows processed by the transactional half of S20. */
export interface S20Result {
    readonly rows: readonly S20Row[];
}

/** Outcome of one S20 provider cancellation attempt. */
export type S20CancelCall = 'SENT' | 'NOT_NEEDED' | 'NOTICE_PENDING' | 'FAILED' | 'NOT_APPLICABLE';

/** Provider result for one complement subscription. */
export interface S20ProviderResult {
    readonly subscriptionId: string;
    readonly cancelCall: S20CancelCall;
    readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
}

type S20Instance = {
    readonly id: string;
    readonly productId: string;
    readonly addonVersionId: string;
    readonly targetId: string | null;
    readonly complementSubscriptionId: string | null;
    readonly status: 'PENDING_AUTHORIZATION' | 'ACTIVE';
    readonly titleAnchorId: string | null;
    readonly compatibleVerticals: readonly string[];
};

/** Reads every live complement subscription for one beneficiary under row locks. */
export async function readS20ComplementRows(input: {
    readonly tx: DrizzleClient;
    readonly beneficiaryUserId: string;
}): Promise<readonly (S20ProviderRow & { readonly origin: LiveSubscriptionStatus })[]> {
    const rows = await input.tx
        .select({
            subscriptionId: subscriptions.id,
            userId: subscriptions.userId,
            origin: subscriptions.status,
            authorizationId: providerLinks.providerId,
            cardPayer: subscriptions.paymentMethod
        })
        .from(subscriptions)
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(
            and(
                eq(subscriptions.userId, input.beneficiaryUserId),
                eq(subscriptions.class, 'COMPLEMENTO'),
                inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES)
            )
        )
        .orderBy(subscriptions.id)
        .for('update', { of: subscriptions });
    return rows.map((row) => {
        if (
            !row.userId ||
            !LIVE_SUBSCRIPTION_STATUSES.includes(row.origin as LiveSubscriptionStatus)
        )
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Invalid locked S20 subscription row'
            );
        return {
            subscriptionId: row.subscriptionId,
            userId: row.userId,
            origin: row.origin as LiveSubscriptionStatus,
            authorizationId: row.authorizationId,
            cardPayer: row.cardPayer === 'CARD'
        };
    });
}

/** Reads live addon instances joined to their product compatibility under row locks. */
export async function readS20Instances(input: {
    readonly tx: DrizzleClient;
    readonly beneficiaryUserId: string;
    readonly subscriptionIds: readonly string[];
}): Promise<readonly S20Instance[]> {
    if (input.subscriptionIds.length === 0) return [];
    const rows = await input.tx
        .select({
            id: addonInstances.id,
            productId: addonInstances.productId,
            addonVersionId: addonInstances.addonVersionId,
            targetId: addonInstances.targetId,
            complementSubscriptionId: addonInstances.complementSubscriptionId,
            status: addonInstances.status,
            titleAnchorId: addonInstances.titleAnchorId,
            compatibleVerticals: addonProducts.compatibleVerticals
        })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
        .where(
            and(
                eq(addonInstances.ownerId, input.beneficiaryUserId),
                inArray(addonInstances.complementSubscriptionId, [...input.subscriptionIds]),
                inArray(addonInstances.status, ['PENDING_AUTHORIZATION', 'ACTIVE'])
            )
        )
        .orderBy(addonInstances.id)
        .for('update', { of: addonInstances });
    return rows.map((row) => {
        if (row.status !== 'PENDING_AUTHORIZATION' && row.status !== 'ACTIVE')
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Invalid locked S20 addon instance'
            );
        return { ...row, status: row.status, compatibleVerticals: row.compatibleVerticals };
    });
}

const inputSchema = z
    .strictObject({
        tx: z.custom<DrizzleClient>((value) => value !== undefined && value !== null),
        includesAddons: z.boolean(),
        permanentGrantId: z.uuid(),
        beneficiaryUserId: z.uuid(),
        anchors: z.array(z.strictObject({ id: z.uuid(), vertical: VerticalEnumSchema })),
        now: z.date(),
        actorId: z.uuid()
    })
    .superRefine((value, ctx) => {
        const seen = new Set<string>();
        for (const anchor of value.anchors) {
            if (seen.has(anchor.vertical))
                ctx.addIssue({
                    code: 'custom',
                    message: 'Anchor verticals must be unique',
                    path: ['anchors']
                });
            seen.add(anchor.vertical);
        }
    });

const CLOSES_OPEN_PAUSE: Readonly<Record<LiveSubscriptionStatus, boolean>> = {
    PENDING_AUTHORIZATION: false,
    ACTIVE: false,
    GRACE_PERIOD: false,
    PAUSED: true,
    SUSPENDED: false,
    CANCEL_SCHEDULED: false
};

function changedRowError(): ServiceError {
    return new ServiceError(
        ServiceErrorCode.INTERNAL_ERROR,
        'Permanent grant complement row changed while locked',
        undefined,
        'PERMANENT_GRANT_ROW_CHANGED'
    );
}

/** Writes the grant anchor title for an ACTIVE addon instance without changing its state. */
async function writeS20TitleAnchor(input: {
    readonly tx: DrizzleClient;
    readonly instance: S20Instance;
    readonly anchor: S20Anchor;
    readonly now: Date;
}): Promise<boolean> {
    if (input.instance.titleAnchorId !== null) return false;
    const [changed] = await input.tx
        .update(addonInstances)
        .set({ titleAnchorId: input.anchor.id, updatedAt: input.now })
        .where(
            and(
                eq(addonInstances.id, input.instance.id),
                eq(addonInstances.status, 'ACTIVE'),
                isNull(addonInstances.titleAnchorId)
            )
        )
        .returning({ id: addonInstances.id });
    if (!changed) throw changedRowError();
    return true;
}

/** Cancels one complement row after the addon instance has received its grant title. */
async function writeS20ComplementCancellation(input: {
    readonly tx: DrizzleClient;
    readonly row: S20Row;
    readonly now: Date;
}): Promise<void> {
    const [changed] = await input.tx
        .update(subscriptions)
        .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null, updatedAt: input.now })
        .where(
            and(
                eq(subscriptions.id, input.row.subscriptionId),
                eq(subscriptions.status, input.row.origin)
            )
        )
        .returning({ id: subscriptions.id });
    if (!changed) throw changedRowError();
    if (CLOSES_OPEN_PAUSE[input.row.origin])
        await input.tx
            .update(subscriptionPauses)
            .set({ actualEndAt: input.now })
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, input.row.subscriptionId),
                    isNull(subscriptionPauses.actualEndAt)
                )
            );
}

/** Applies S20's local effects in the grant transaction, without calling the provider. */
export async function runS20InTransaction(
    input: {
        readonly tx: DrizzleClient;
        readonly includesAddons: boolean;
        readonly permanentGrantId: string;
        readonly beneficiaryUserId: string;
        readonly anchors: readonly S20Anchor[];
        readonly now: Date;
        readonly actorId: string;
    },
    ports: { readonly orphanhood: AddonOrphanhoodPorts }
): Promise<S20Result> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid permanent grant input',
            parsed.error.issues,
            'INVALID_PERMANENT_GRANT_INPUT'
        );
    if (!input.includesAddons || input.anchors.length === 0) return { rows: [] };

    const complements = await readS20ComplementRows({
        tx: input.tx,
        beneficiaryUserId: input.beneficiaryUserId
    });
    const instances = await readS20Instances({
        tx: input.tx,
        beneficiaryUserId: input.beneficiaryUserId,
        subscriptionIds: complements.map(({ subscriptionId }) => subscriptionId)
    });
    const bySubscription = new Map(complements.map((row) => [row.subscriptionId, row]));
    const converted: S20Row[] = [];
    for (const instance of instances) {
        if (instance.complementSubscriptionId === null) continue;
        const row = bySubscription.get(instance.complementSubscriptionId);
        if (!row) continue;
        const policy = await ports.orphanhood.addonPolicy({
            addonVersionId: instance.addonVersionId
        });
        let anchor: S20Anchor | undefined;
        switch (policy.scopeType) {
            case 'VERTICAL_SUBSCRIPTION': {
                if (instance.targetId === null)
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'S20 vertical addon has no target'
                    );
                const [target] = await input.tx
                    .select({ vertical: subscriptions.vertical })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, instance.targetId));
                if (!target)
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'S20 vertical addon target is missing'
                    );
                anchor = input.anchors.find(
                    (candidate) =>
                        candidate.vertical === target.vertical &&
                        instance.compatibleVerticals.includes(candidate.vertical)
                );
                break;
            }
            case 'LISTING': {
                if (instance.targetId === null)
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'S20 listing addon has no target'
                    );
                const listing = await ports.orphanhood.listing({ listingId: instance.targetId });
                anchor = input.anchors.find(
                    (candidate) =>
                        candidate.vertical === listing.vertical &&
                        instance.compatibleVerticals.includes(candidate.vertical)
                );
                break;
            }
            case 'USER':
            case 'GLOBAL':
                anchor = input.anchors.find((candidate) =>
                    instance.compatibleVerticals.includes(candidate.vertical)
                );
                break;
            default: {
                const exhaustive: never = policy.scopeType;
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    `Unknown S20 addon scope: ${exhaustive}`
                );
            }
        }
        if (!anchor) continue;
        const fullRow: S20Row = {
            ...row,
            instanceId: instance.id,
            instanceStatus: instance.status,
            titleAnchorId: instance.titleAnchorId
        };
        if (instance.status === 'ACTIVE')
            await writeS20TitleAnchor({ tx: input.tx, instance, anchor, now: input.now });
        await writeS20ComplementCancellation({ tx: input.tx, row: fullRow, now: input.now });
        if (row.cardPayer && row.authorizationId !== null)
            await recordProviderCancellationDecided({
                subscriptionId: row.subscriptionId,
                transition: 'S20',
                decidedAt: input.now,
                actor: { type: 'admin', id: input.actorId },
                correlationId: crypto.randomUUID(),
                changes: [{ field: 'status', old: row.origin, new: 'CANCELLED' }],
                tx: input.tx
            });
        converted.push(fullRow);
    }
    if (converted.length) {
        const [grant] = await input.tx
            .select({ affected: permanentGrants.affectedSubscriptionIds })
            .from(permanentGrants)
            .where(eq(permanentGrants.id, input.permanentGrantId))
            .for('update');
        if (!grant) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Permanent grant not found');
        const ids = converted.map(({ subscriptionId }) => subscriptionId);
        await input.tx
            .update(permanentGrants)
            .set({
                affectedSubscriptionIds: [...new Set([...grant.affected, ...ids])],
                updatedAt: input.now
            })
            .where(eq(permanentGrants.id, input.permanentGrantId));
    }
    return { rows: converted };
}

const logger = createLogger('permanent-grant-s20');
const CANCEL_CALL_BY_OUTCOME: Readonly<Record<CancelOurAuthorizationOutcome, S20CancelCall>> = {
    ALREADY_CANCELLED: 'NOT_NEEDED',
    NOTICE_PENDING: 'NOTICE_PENDING',
    CALL_FAILED: 'FAILED',
    CONFIRMED: 'SENT',
    SENT_UNCONFIRMED: 'SENT'
};

/** Cancels S20 preapprovals after commit; failures are left for the sweep retry. */
export async function cancelS20AtProvider(
    input: { readonly rows: readonly S20ProviderRow[] },
    ports: S13ProviderPorts
): Promise<readonly S20ProviderResult[]> {
    const results: S20ProviderResult[] = [];
    const annotator = ports.cancellationSeen ?? noCancellationSeenAnnotation;
    for (const row of input.rows) {
        if (!row.cardPayer || row.authorizationId === null) {
            results.push({ subscriptionId: row.subscriptionId, cancelCall: 'NOT_APPLICABLE' });
            continue;
        }
        try {
            const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
            actStartInstant({ act });
            const read = await ports.provider.readAuthorization({
                authorizationId: row.authorizationId
            });
            const fresh = assertFreshForAct({ read, act });
            if (fresh.snapshot.status === 'cancelled')
                await recordCancellationSeen({
                    annotator,
                    subscriptionId: row.subscriptionId,
                    seenAt: fresh.readAt
                });
            else
                await recordAuthorizationSeenAlive({
                    annotator,
                    subscriptionId: row.subscriptionId,
                    seenAt: fresh.readAt
                });
            let notice: Awaited<ReturnType<BeforeCancelNotice['beforeCancel']>> | undefined;
            const observedNotice: BeforeCancelNotice = {
                async beforeCancel(args) {
                    notice = await ports.beforeCancelNotice.beforeCancel(args);
                    return notice;
                }
            };
            const { outcome } = await cancelOurAuthorization(
                {
                    subscriptionId: row.subscriptionId,
                    userId: row.userId,
                    authorizationId: row.authorizationId,
                    kind: 'PERMANENT_GRANT_ADDON',
                    prior: { read, act }
                },
                { provider: ports.provider, clock: ports.clock, beforeCancelNotice: observedNotice }
            );
            if (outcome === 'CONFIRMED')
                await recordCancellationSeen({
                    annotator,
                    subscriptionId: row.subscriptionId,
                    seenAt: ports.clock.now()
                });
            const cancelCall = CANCEL_CALL_BY_OUTCOME[outcome];
            const escalated =
                cancelCall !== 'NOTICE_PENDING' &&
                (notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED')
                    ? notice
                    : undefined;
            results.push({
                subscriptionId: row.subscriptionId,
                cancelCall,
                ...(escalated ? { escalated } : {})
            });
        } catch (error) {
            logger.error(
                { subscriptionId: row.subscriptionId, authorizationId: row.authorizationId, error },
                'S20 provider cancellation failed; the sweep retries it'
            );
            results.push({ subscriptionId: row.subscriptionId, cancelCall: 'FAILED' });
        }
    }
    return results;
}
