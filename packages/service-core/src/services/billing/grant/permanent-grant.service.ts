/**
 * Permanent grant acts (B9a.1). The service authorizes ACC_2 (INV:30, AC:B9a:9);
 * API routes are added in HOS-1584's third rollout. The anchor floor is stored as
 * a reference and is not checked against políticaDePlan(v).vigente (AC:B9a:11,
 * HOS-1585); the real GRANT coverage source arrives with HOS-1585.
 */
import { and, eq, getDb, permanentGrants, permanentGrantVerticals } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../../types';
import { ServiceError } from '../../../types';
import {
    cancelAddonComplementsAtProvider,
    emitAddonCoverageRemoved
} from '../addon/addon-instance-a5.js';
import {
    assertPermanentGrantPermitted,
    assertPermanentGrantSubject,
    mapPermanentGrantWriteError
} from './permanent-grant-authorization.js';
import {
    anchorInputSchema,
    grantSchema,
    invalidPermanentGrantInput
} from './permanent-grant-inputs.js';
import type { PermanentGrantPorts } from './permanent-grant-ports.js';
import {
    cancelS13AtProvider,
    emitS13CoverageNotices,
    runS13InTransaction,
    type S13CancelCall
} from './permanent-grant-s13.js';
import {
    cancelS20AtProvider,
    runS20InTransaction,
    type S20ProviderResult
} from './permanent-grant-s20.js';

/**
 * Creates a permanent grant with its initial vertical anchors and applies S13
 * to the beneficiary's live principal subscriptions in those verticals.
 *
 * Local cancellation, retention release, courtesy closure and add-on
 * orphanhood run in one transaction. Coverage notices and provider
 * cancellation happen after commit. The anchor floor is stored as a reference;
 * current-plan policy validation and the live GRANT coverage source belong to
 * HOS-1585.
 *
 * @param raw Grant beneficiary, authorizing actor, reason, add-on policy and
 *   at least one unique vertical anchor.
 * @param ports Clock and integrations required for local and post-commit work.
 * @returns Created grant and anchor IDs, local S13 effects and provider results.
 * @throws {ServiceError} For ADMINISTRATIVE_ACTION_FORBIDDEN, invalid input, missing
 *   references, or a transactional S13 operation that cannot complete.
 */
export async function grantPermanentGrant(
    raw: {
        readonly beneficiaryUserId: string;
        readonly actor: Actor;
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
    readonly anchoredAddonInstanceIds: readonly string[];
    readonly addonProviderCalls: readonly S20ProviderResult[];
}> {
    assertPermanentGrantPermitted({ actor: raw.actor });
    const { actor, ...grantInput } = raw;
    const parsed = grantSchema.safeParse({ ...grantInput, grantedBy: actor.id });
    if (!parsed.success) throw invalidPermanentGrantInput(parsed.error.issues);
    const input = parsed.data;
    assertPermanentGrantSubject({ actor, beneficiaryUserId: input.beneficiaryUserId });
    const now = ports.clock.now();
    const committed = await getDb()
        .transaction(async (tx) => {
            const [grant] = await tx
                .insert(permanentGrants)
                .values({
                    beneficiaryUserId: input.beneficiaryUserId,
                    grantedBy: actor.id,
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
                    actorId: actor.id
                },
                { orphanhood: ports.orphanhood }
            );
            const s20 = await runS20InTransaction(
                {
                    tx,
                    includesAddons: input.includesAddons,
                    permanentGrantId: grant.id,
                    beneficiaryUserId: input.beneficiaryUserId,
                    anchors: input.anchors.map(({ vertical }, index) => ({
                        id: anchors[index]!,
                        vertical
                    })),
                    now,
                    actorId: actor.id
                },
                { orphanhood: ports.orphanhood }
            );
            return { grantId: grant.id, anchorIds: anchors, result, s20 };
        })
        .catch((error: unknown) => mapPermanentGrantWriteError({ error }));
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
    const addonProviderCalls = await cancelS20AtProvider({ rows: committed.s20.rows }, ports);
    return {
        permanentGrantId: committed.grantId,
        anchorIds: committed.anchorIds,
        cancelledSubscriptionIds: committed.result.cancelled.map(
            ({ subscriptionId }) => subscriptionId
        ),
        releasedRetentionIds: committed.result.releasedRetentionIds,
        closedCourtesyIds: committed.result.closedCourtesyIds,
        providerCalls: providerResult.results,
        anchoredAddonInstanceIds: committed.s20.rows
            .filter(
                ({ instanceStatus, titleAnchorId }) =>
                    instanceStatus === 'ACTIVE' && titleAnchorId === null
            )
            .map(({ instanceId }) => instanceId),
        addonProviderCalls
    };
}

/**
 * Adds one vertical anchor to an existing live permanent grant and applies
 * S13 only to the beneficiary's live principal subscriptions in that vertical.
 * The anchor and local cancellation effects are committed atomically; coverage
 * notices and provider cancellation run after commit. The floor is stored as a
 * reference and is not checked against current plan policy in this service.
 *
 * @param raw Grant ID, authorizing actor and the vertical's plan floor.
 * @param ports Clock and integrations required for local and post-commit work.
 * @returns The new anchor ID, local S13 effects and provider results.
 * @throws {ServiceError} For ADMINISTRATIVE_ACTION_FORBIDDEN, invalid input, a missing
 *   or revoked grant, or a transactional S13 operation that cannot complete.
 */
export async function anchorPermanentGrantVertical(
    raw: {
        readonly permanentGrantId: string;
        readonly actor: Actor;
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
    readonly anchoredAddonInstanceIds: readonly string[];
    readonly addonProviderCalls: readonly S20ProviderResult[];
}> {
    assertPermanentGrantPermitted({ actor: raw.actor });
    const { actor, ...inputWithoutActor } = raw;
    const parsed = anchorInputSchema.safeParse({ ...inputWithoutActor, anchoredBy: actor.id });
    if (!parsed.success) throw invalidPermanentGrantInput(parsed.error.issues);
    const input = parsed.data;
    const now = ports.clock.now();
    const committed = await getDb()
        .transaction(async (tx) => {
            const [grant] = await tx
                .select({
                    id: permanentGrants.id,
                    beneficiaryUserId: permanentGrants.beneficiaryUserId,
                    revokedAt: permanentGrants.revokedAt,
                    includesAddons: permanentGrants.includesAddons
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
            assertPermanentGrantSubject({ actor, beneficiaryUserId: grant.beneficiaryUserId });
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
                    actorId: actor.id
                },
                { orphanhood: ports.orphanhood }
            );
            const s20 = await runS20InTransaction(
                {
                    tx,
                    includesAddons: grant.includesAddons,
                    permanentGrantId: grant.id,
                    beneficiaryUserId: grant.beneficiaryUserId,
                    anchors: [{ id: anchor.id, vertical: input.vertical }],
                    now,
                    actorId: actor.id
                },
                { orphanhood: ports.orphanhood }
            );
            return { anchorId: anchor.id, beneficiaryUserId: grant.beneficiaryUserId, result, s20 };
        })
        .catch((error: unknown) => mapPermanentGrantWriteError({ error }));
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
    const addonProviderCalls = await cancelS20AtProvider({ rows: committed.s20.rows }, ports);
    return {
        anchorId: committed.anchorId,
        cancelledSubscriptionIds: committed.result.cancelled.map(
            ({ subscriptionId }) => subscriptionId
        ),
        releasedRetentionIds: committed.result.releasedRetentionIds,
        closedCourtesyIds: committed.result.closedCourtesyIds,
        providerCalls: providerResult.results,
        anchoredAddonInstanceIds: committed.s20.rows
            .filter(
                ({ instanceStatus, titleAnchorId }) =>
                    instanceStatus === 'ACTIVE' && titleAnchorId === null
            )
            .map(({ instanceId }) => instanceId),
        addonProviderCalls
    };
}

export type { PermanentGrantPorts } from './permanent-grant-ports.js';
export { resumePermanentGrant } from './permanent-grant-resume.js';
