/**
 * Permanent grant acts (B9a.1). The caller authorizes ACC_2 (INV:30, AC:B9a:9,
 * HOS-1584); no route exposes this in HOS-1582. The anchor floor is stored as
 * a reference and is not checked against políticaDePlan(v).vigente (AC:B9a:11,
 * HOS-1585); the real GRANT coverage source arrives with HOS-1585.
 */
import type { Clock } from '@repo/billing-verticals-contract';
import { and, eq, getDb, permanentGrants, permanentGrantVerticals } from '@repo/db';
import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { emitAddonCoverageRemoved } from '../addon/addon-instance-a5.js';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports.js';
import type { CoverageNotices } from '../payment/payment-ports.js';
import { emitS13CoverageNotices, runS13InTransaction } from './permanent-grant-s13.js';

export interface PermanentGrantPorts {
    readonly clock: Clock;
    readonly coverageNotices: CoverageNotices;
    readonly orphanhood: AddonOrphanhoodPorts;
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
    if (committed.result.orphanedAddons.length > 0)
        await emitAddonCoverageRemoved({
            cancelled: committed.result.orphanedAddons,
            coverageNotices: ports.coverageNotices
        });
    return {
        permanentGrantId: committed.grantId,
        anchorIds: committed.anchorIds,
        cancelledSubscriptionIds: committed.result.cancelled.map(
            ({ subscriptionId }) => subscriptionId
        ),
        releasedRetentionIds: committed.result.releasedRetentionIds,
        closedCourtesyIds: committed.result.closedCourtesyIds
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
    if (committed.result.orphanedAddons.length > 0)
        await emitAddonCoverageRemoved({
            cancelled: committed.result.orphanedAddons,
            coverageNotices: ports.coverageNotices
        });
    return {
        anchorId: committed.anchorId,
        cancelledSubscriptionIds: committed.result.cancelled.map(
            ({ subscriptionId }) => subscriptionId
        ),
        releasedRetentionIds: committed.result.releasedRetentionIds,
        closedCourtesyIds: committed.result.closedCourtesyIds
    };
}
