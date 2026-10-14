/**
 * Permanent grant acts (B9a.1). The caller authorizes ACC_2 (INV:30, AC:B9a:9,
 * HOS-1584); no route exposes this in HOS-1582. The anchor floor is stored as
 * a reference and is not checked against políticaDePlan(v).vigente (AC:B9a:11,
 * HOS-1585); the real GRANT coverage source arrives with HOS-1585.
 */
import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    eq,
    getDb,
    inArray,
    permanentGrants,
    permanentGrantVerticals,
    providerLinks,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import {
    cancelAddonComplementsAtProvider,
    emitAddonCoverageRemoved
} from '../addon/addon-instance-a5.js';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports.js';
import type { CoverageNotices } from '../payment/payment-ports.js';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service.js';
import type { CancellationSeenAnnotator } from '../subscription/subscription-billing-ports.js';
import {
    cancelS13AtProvider,
    emitS13CoverageNotices,
    runS13InTransaction,
    type S13CancelCall
} from './permanent-grant-s13.js';

export interface PermanentGrantPorts {
    readonly clock: Clock;
    readonly coverageNotices: CoverageNotices;
    readonly orphanhood: AddonOrphanhoodPorts;
    readonly provider: PaymentProvider;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly cancellationSeen?: CancellationSeenAnnotator;
}

const anchorSchema = z.strictObject({
    vertical: VerticalEnumSchema,
    planId: z.uuid(),
    floorPlanVersionId: z.uuid()
});
const grantSchema = z
    .strictObject({
        beneficiaryUserId: z.uuid(),
        grantedBy: z.uuid(),
        reason: z.string().refine((value) => value.trim().length > 0),
        includesAddons: z.boolean(),
        anchors: z.array(anchorSchema).min(1)
    })
    .superRefine((value, ctx) => {
        const seen = new Set<string>();
        for (const anchor of value.anchors) {
            if (seen.has(anchor.vertical))
                ctx.addIssue({
                    code: 'custom',
                    message: 'Verticals must be unique',
                    path: ['anchors']
                });
            seen.add(anchor.vertical);
        }
    });
const anchorInputSchema = z.strictObject({
    permanentGrantId: z.uuid(),
    anchoredBy: z.uuid(),
    ...anchorSchema.shape
});

function invalidInput(error: unknown): ServiceError {
    return new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        'Invalid permanent grant input',
        error,
        'INVALID_PERMANENT_GRANT_INPUT'
    );
}

export async function grantPermanentGrant(
    raw: {
        readonly beneficiaryUserId: string;
        readonly grantedBy: string;
        readonly reason: string;
        readonly includesAddons: boolean;
        readonly anchors: readonly {
            readonly vertical: string;
            readonly planId: string;
            readonly floorPlanVersionId: string;
        }[];
    },
    ports: PermanentGrantPorts
): Promise<{
    readonly permanentGrantId: string;
    readonly anchorIds: readonly string[];
    readonly cancelledSubscriptionIds: readonly string[];
    readonly releasedRetentionIds: readonly string[];
    readonly closedCourtesyIds: readonly string[];
    readonly providerCalls: readonly {
        readonly subscriptionId: string;
        readonly cancelCall: S13CancelCall;
        readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
    }[];
}> {
    const parsed = grantSchema.safeParse(raw);
    if (!parsed.success) throw invalidInput(parsed.error.issues);
    const input = parsed.data;
    const now = ports.clock.now();
    const committed = await getDb().transaction(async (tx) => {
        const [grant] = await tx
            .insert(permanentGrants)
            .values({
                beneficiaryUserId: input.beneficiaryUserId,
                grantedBy: input.grantedBy,
                reason: input.reason,
                includesAddons: input.includesAddons,
                affectedSubscriptionIds: []
            })
            .returning({ id: permanentGrants.id });
        if (!grant)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Permanent grant insert returned no row'
            );
        const anchors: string[] = [];
        for (const anchor of input.anchors) {
            const [row] = await tx
                .insert(permanentGrantVerticals)
                .values({ permanentGrantId: grant.id, ...anchor })
                .returning({ id: permanentGrantVerticals.id });
            if (!row)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Permanent grant anchor insert returned no row'
                );
            anchors.push(row.id);
        }
        const result = await runS13InTransaction(
            {
                tx,
                permanentGrantId: grant.id,
                beneficiaryUserId: input.beneficiaryUserId,
                verticals: input.anchors.map(({ vertical }) => vertical),
                now,
                actorId: input.grantedBy
            },
            { orphanhood: ports.orphanhood }
        );
        return { grantId: grant.id, anchorIds: anchors, result };
    });
    await emitS13CoverageNotices({
        beneficiaryUserId: input.beneficiaryUserId,
        anchoredVerticals: input.anchors.map(({ vertical }) => vertical),
        movedVerticals: committed.result.cancelled.map(({ vertical }) => vertical),
        coverageNotices: ports.coverageNotices
    });
    const providerResult = await cancelS13AtProvider({ rows: committed.result.cancelled }, ports);
    if (committed.result.orphanedAddons.length > 0)
        await emitAddonCoverageRemoved({
            cancelled: committed.result.orphanedAddons,
            coverageNotices: ports.coverageNotices
        });
    if (committed.result.orphanedAddons.length > 0)
        await cancelAddonComplementsAtProvider(
            { cancelled: committed.result.orphanedAddons },
            ports
        );
    return {
        permanentGrantId: committed.grantId,
        anchorIds: committed.anchorIds,
        cancelledSubscriptionIds: committed.result.cancelled.map(
            ({ subscriptionId }) => subscriptionId
        ),
        releasedRetentionIds: committed.result.releasedRetentionIds,
        closedCourtesyIds: committed.result.closedCourtesyIds,
        providerCalls: providerResult.results
    };
}

export async function anchorPermanentGrantVertical(
    raw: {
        readonly permanentGrantId: string;
        readonly anchoredBy: string;
        readonly vertical: string;
        readonly planId: string;
        readonly floorPlanVersionId: string;
    },
    ports: PermanentGrantPorts
): Promise<{
    readonly anchorId: string;
    readonly cancelledSubscriptionIds: readonly string[];
    readonly releasedRetentionIds: readonly string[];
    readonly closedCourtesyIds: readonly string[];
    readonly providerCalls: readonly {
        readonly subscriptionId: string;
        readonly cancelCall: S13CancelCall;
        readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
    }[];
}> {
    const parsed = anchorInputSchema.safeParse(raw);
    if (!parsed.success) throw invalidInput(parsed.error.issues);
    const input = parsed.data;
    const now = ports.clock.now();
    const committed = await getDb().transaction(async (tx) => {
        const [grant] = await tx
            .select({
                id: permanentGrants.id,
                beneficiaryUserId: permanentGrants.beneficiaryUserId,
                revokedAt: permanentGrants.revokedAt
            })
            .from(permanentGrants)
            .where(eq(permanentGrants.id, input.permanentGrantId))
            .for('update');
        if (!grant)
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                'Permanent grant not found',
                undefined,
                'PERMANENT_GRANT_NOT_FOUND'
            );
        if (grant.revokedAt !== null)
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Permanent grant is not live',
                undefined,
                'PERMANENT_GRANT_NOT_LIVE'
            );
        const [existing] = await tx
            .select({ id: permanentGrantVerticals.id })
            .from(permanentGrantVerticals)
            .where(
                and(
                    eq(permanentGrantVerticals.permanentGrantId, grant.id),
                    eq(permanentGrantVerticals.vertical, input.vertical)
                )
            )
            .limit(1);
        if (existing)
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Permanent grant vertical already anchored',
                undefined,
                'PERMANENT_GRANT_VERTICAL_ALREADY_ANCHORED'
            );
        const [anchor] = await tx
            .insert(permanentGrantVerticals)
            .values({
                permanentGrantId: grant.id,
                vertical: input.vertical,
                planId: input.planId,
                floorPlanVersionId: input.floorPlanVersionId
            })
            .returning({ id: permanentGrantVerticals.id });
        if (!anchor)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Permanent grant anchor insert returned no row'
            );
        const result = await runS13InTransaction(
            {
                tx,
                permanentGrantId: grant.id,
                beneficiaryUserId: grant.beneficiaryUserId,
                verticals: [input.vertical],
                now,
                actorId: input.anchoredBy
            },
            { orphanhood: ports.orphanhood }
        );
        return { anchorId: anchor.id, beneficiaryUserId: grant.beneficiaryUserId, result };
    });
    await emitS13CoverageNotices({
        beneficiaryUserId: committed.beneficiaryUserId,
        anchoredVerticals: [input.vertical],
        movedVerticals: committed.result.cancelled.map(({ vertical }) => vertical),
        coverageNotices: ports.coverageNotices
    });
    const providerResult = await cancelS13AtProvider({ rows: committed.result.cancelled }, ports);
    if (committed.result.orphanedAddons.length > 0)
        await emitAddonCoverageRemoved({
            cancelled: committed.result.orphanedAddons,
            coverageNotices: ports.coverageNotices
        });
    if (committed.result.orphanedAddons.length > 0)
        await cancelAddonComplementsAtProvider(
            { cancelled: committed.result.orphanedAddons },
            ports
        );
    return {
        anchorId: committed.anchorId,
        cancelledSubscriptionIds: committed.result.cancelled.map(
            ({ subscriptionId }) => subscriptionId
        ),
        releasedRetentionIds: committed.result.releasedRetentionIds,
        closedCourtesyIds: committed.result.closedCourtesyIds,
        providerCalls: providerResult.results
    };
}

/** Reanudar es volver a correr el acto entero, no llevar un cursor (TRANS:B:S13, contexto §4). */
export async function resumePermanentGrant(
    input: { readonly permanentGrantId: string; readonly actorId: string },
    ports: PermanentGrantPorts
): Promise<{
    readonly permanentGrantId: string;
    readonly providerCalls: readonly {
        readonly subscriptionId: string;
        readonly cancelCall: S13CancelCall;
        readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
    }[];
}> {
    const now = ports.clock.now();
    const committed = await getDb().transaction(async (tx) => {
        const [grant] = await tx
            .select({
                id: permanentGrants.id,
                beneficiaryUserId: permanentGrants.beneficiaryUserId,
                affected: permanentGrants.affectedSubscriptionIds,
                revokedAt: permanentGrants.revokedAt
            })
            .from(permanentGrants)
            .where(eq(permanentGrants.id, input.permanentGrantId))
            .for('update');
        if (!grant)
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                'Permanent grant not found',
                undefined,
                'PERMANENT_GRANT_NOT_FOUND'
            );
        if (grant.revokedAt !== null)
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Permanent grant is not live',
                undefined,
                'PERMANENT_GRANT_NOT_LIVE'
            );
        const anchors = await tx
            .select({ vertical: permanentGrantVerticals.vertical })
            .from(permanentGrantVerticals)
            .where(eq(permanentGrantVerticals.permanentGrantId, grant.id));
        const local = await runS13InTransaction(
            {
                tx,
                permanentGrantId: grant.id,
                beneficiaryUserId: grant.beneficiaryUserId,
                verticals: anchors.map(({ vertical }) => vertical),
                now,
                actorId: input.actorId
            },
            { orphanhood: ports.orphanhood }
        );
        const ids = [
            ...new Set([
                ...grant.affected,
                ...local.cancelled.map(({ subscriptionId }) => subscriptionId)
            ])
        ];
        const rows = ids.length
            ? await tx
                  .select({
                      subscriptionId: subscriptions.id,
                      userId: subscriptions.userId,
                      vertical: subscriptions.vertical,
                      origin: subscriptions.status,
                      authorizationId: providerLinks.providerId,
                      cardPayer: subscriptions.paymentMethod
                  })
                  .from(subscriptions)
                  .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
                  .where(inArray(subscriptions.id, ids))
            : [];
        const providerRows = rows.map((row) => {
            const userId = row.userId;
            const vertical = row.vertical;
            if (typeof userId !== 'string' || typeof vertical !== 'string')
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Invalid affected S13 subscription row'
                );
            return {
                ...row,
                userId,
                vertical,
                origin: 'CANCELLED' as const,
                cardPayer: row.cardPayer === 'CARD'
            };
        });
        return { grant, local, rows: providerRows };
    });
    await emitS13CoverageNotices({
        beneficiaryUserId: committed.grant.beneficiaryUserId,
        anchoredVerticals: [],
        movedVerticals: committed.local.cancelled.map(({ vertical }) => vertical),
        coverageNotices: ports.coverageNotices
    });
    const providerResult = await cancelS13AtProvider({ rows: committed.rows }, ports);
    if (committed.local.orphanedAddons.length > 0) {
        await emitAddonCoverageRemoved({
            cancelled: committed.local.orphanedAddons,
            coverageNotices: ports.coverageNotices
        });
        await cancelAddonComplementsAtProvider(
            { cancelled: committed.local.orphanedAddons },
            ports
        );
    }
    return { permanentGrantId: committed.grant.id, providerCalls: providerResult.results };
}
