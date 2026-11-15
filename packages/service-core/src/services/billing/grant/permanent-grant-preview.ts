/**
 * Permanent grant confirmation reads. A preview is a snapshot: the signed act
 * reads again under its own locks and its result is authoritative. Provider email
 * is predicted from the preapproval, never observed or sent by these reads.
 */
import {
    addonInstances,
    addonProducts,
    addons,
    and,
    eq,
    getDb,
    inArray,
    isNull,
    permanentGrants,
    permanentGrantVerticals
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import type { Actor } from '../../../types';
import { ServiceError } from '../../../types';
import {
    assertPermanentGrantPermitted,
    assertPermanentGrantSubject,
    mapPermanentGrantWriteError
} from './permanent-grant-authorization.js';
import { assertAnchorFloorsAcceptable } from './permanent-grant-floor.js';
import {
    anchorInputSchema,
    grantSchema,
    invalidPermanentGrantInput
} from './permanent-grant-inputs.js';
import type { PermanentGrantPorts } from './permanent-grant-ports.js';
import { readOpenCourtesies, readPermanentGrantEffects } from './permanent-grant-preview-read.js';
import { runS13InTransaction } from './permanent-grant-s13.js';
import { runS20InTransaction } from './permanent-grant-s20.js';

/** Dependencies used by a dry-run; clock is optional for callers without an act clock. */
export type PermanentGrantPreviewPorts = Pick<PermanentGrantPorts, 'planPolicy' | 'orphanhood'> & {
    readonly clock?: PermanentGrantPorts['clock'];
};

/** The effects shown before signing a grant or anchor act. */
export type PermanentGrantPreviewEffects = Awaited<ReturnType<typeof readPermanentGrantEffects>>;

/** Grant preview result; generated grant and anchor IDs are deliberately omitted. */
export type PermanentGrantGrantPreview = PermanentGrantPreviewEffects;
/** Anchor preview result; generated anchor ID is deliberately omitted. */
export type PermanentGrantAnchorPreview = PermanentGrantPreviewEffects;

class PermanentGrantPreviewRollback<T> extends Error {
    constructor(readonly result: T) {
        super('Rollback permanent grant preview');
    }
}

function returnPreview<T>(error: unknown): T {
    if (error instanceof PermanentGrantPreviewRollback) return error.result as T;
    return mapPermanentGrantWriteError({ error });
}

/** Run the grant act's local transaction and return its projected effects after rollback. */
export async function previewPermanentGrant(
    raw: Parameters<typeof import('./permanent-grant.service.js').grantPermanentGrant>[0],
    ports: PermanentGrantPreviewPorts
): Promise<PermanentGrantGrantPreview> {
    assertPermanentGrantPermitted({ actor: raw.actor });
    const { actor, ...grantInput } = raw;
    const parsed = grantSchema.safeParse({ ...grantInput, grantedBy: actor.id });
    if (!parsed.success) throw invalidPermanentGrantInput(parsed.error.issues);
    const input = parsed.data;
    assertPermanentGrantSubject({ actor, beneficiaryUserId: input.beneficiaryUserId });
    await assertAnchorFloorsAcceptable({ anchors: input.anchors, planPolicy: ports.planPolicy });
    const now = ports.clock?.now() ?? new Date();
    try {
        await getDb().transaction(async (tx) => {
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
            const openCourtesies = await readOpenCourtesies({
                tx,
                beneficiaryUserId: input.beneficiaryUserId,
                verticals: input.anchors.map(({ vertical }) => vertical)
            });
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
            const effects = await readPermanentGrantEffects({
                tx,
                cancelled: result.cancelled,
                closedCourtesyIds: result.closedCourtesyIds,
                converted: s20.rows,
                openCourtesies
            });
            throw new PermanentGrantPreviewRollback(effects);
        });
    } catch (error) {
        return returnPreview<PermanentGrantGrantPreview>(error);
    }
    throw new Error('Permanent grant preview unexpectedly committed');
}

/** Run the anchor act's local transaction and return its projected effects after rollback. */
export async function previewPermanentGrantAnchor(
    raw: Parameters<typeof import('./permanent-grant.service.js').anchorPermanentGrantVertical>[0],
    ports: PermanentGrantPreviewPorts
): Promise<PermanentGrantAnchorPreview> {
    assertPermanentGrantPermitted({ actor: raw.actor });
    const { actor, ...inputWithoutActor } = raw;
    const parsed = anchorInputSchema.safeParse({ ...inputWithoutActor, anchoredBy: actor.id });
    if (!parsed.success) throw invalidPermanentGrantInput(parsed.error.issues);
    const input = parsed.data;
    const now = ports.clock?.now() ?? new Date();
    try {
        await getDb().transaction(async (tx) => {
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
            await assertAnchorFloorsAcceptable({
                anchors: [
                    {
                        vertical: input.vertical,
                        planId: input.planId,
                        floorPlanVersionId: input.floorPlanVersionId
                    }
                ],
                planPolicy: ports.planPolicy
            });
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
            const openCourtesies = await readOpenCourtesies({
                tx,
                beneficiaryUserId: grant.beneficiaryUserId,
                verticals: [input.vertical]
            });
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
            const effects = await readPermanentGrantEffects({
                tx,
                cancelled: result.cancelled,
                closedCourtesyIds: result.closedCourtesyIds,
                converted: s20.rows,
                openCourtesies
            });
            throw new PermanentGrantPreviewRollback(effects);
        });
    } catch (error) {
        return returnPreview<PermanentGrantAnchorPreview>(error);
    }
    throw new Error('Permanent grant anchor preview unexpectedly committed');
}

/** Revocation preview: only live instances titled by this grant's anchors are listed. */
export async function previewPermanentGrantRevocation(input: {
    readonly actor: Actor;
    readonly permanentGrantId: string;
}): Promise<{
    readonly permanentGrantId: string;
    readonly verticalsLosingService: readonly string[];
    readonly addonsTurnedOff: readonly {
        readonly addonInstanceId: string;
        readonly addonName: string;
    }[];
    readonly trialReturns: false;
    readonly oldDebitResumes: false;
}> {
    assertPermanentGrantPermitted({ actor: input.actor });
    const parsed = z.uuid().safeParse(input.permanentGrantId);
    if (!parsed.success) throw invalidPermanentGrantInput(parsed.error.issues);
    const db = getDb();
    const [grant] = await db
        .select({
            id: permanentGrants.id,
            beneficiaryUserId: permanentGrants.beneficiaryUserId,
            revokedAt: permanentGrants.revokedAt
        })
        .from(permanentGrants)
        .where(eq(permanentGrants.id, parsed.data));
    if (!grant)
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'Permanent grant not found',
            undefined,
            'PERMANENT_GRANT_NOT_FOUND'
        );
    assertPermanentGrantSubject({ actor: input.actor, beneficiaryUserId: grant.beneficiaryUserId });
    if (grant.revokedAt !== null)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Permanent grant is not live',
            undefined,
            'PERMANENT_GRANT_NOT_LIVE'
        );
    const anchors = await db
        .select({ id: permanentGrantVerticals.id, vertical: permanentGrantVerticals.vertical })
        .from(permanentGrantVerticals)
        .where(eq(permanentGrantVerticals.permanentGrantId, grant.id));
    const anchorIds = anchors.map(({ id }) => id);
    const instances = anchorIds.length
        ? await db
              .select({ addonInstanceId: addonInstances.id, addonName: addons.name })
              .from(addonInstances)
              .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
              .innerJoin(addons, eq(addons.id, addonProducts.addonId))
              .where(
                  and(
                      inArray(addonInstances.titleAnchorId, anchorIds),
                      // Same live-state predicate as permanent-grant-revoke.ts:158-159.
                      inArray(addonInstances.status, ['PENDING_AUTHORIZATION', 'ACTIVE'])
                  )
              )
              .orderBy(addonInstances.id)
        : [];
    return {
        permanentGrantId: grant.id,
        verticalsLosingService: [...new Set(anchors.map(({ vertical }) => vertical))],
        addonsTurnedOff: instances,
        trialReturns: false,
        oldDebitResumes: false
    };
}

/** Read the one unrevoked grant and its anchors for a beneficiary. */
export async function readLivePermanentGrant(input: {
    readonly actor: Actor;
    readonly beneficiaryUserId: string;
}): Promise<{
    readonly grant: null | {
        readonly permanentGrantId: string;
        readonly includesAddons: boolean;
        readonly createdAt: Date;
        readonly anchors: readonly {
            readonly vertical: string;
            readonly planId: string;
            readonly floorPlanVersionId: string;
        }[];
    };
}> {
    assertPermanentGrantPermitted({ actor: input.actor });
    const parsed = z.uuid().safeParse(input.beneficiaryUserId);
    if (!parsed.success) throw invalidPermanentGrantInput(parsed.error.issues);
    const db = getDb();
    const [grant] = await db
        .select({
            permanentGrantId: permanentGrants.id,
            includesAddons: permanentGrants.includesAddons,
            createdAt: permanentGrants.createdAt
        })
        .from(permanentGrants)
        .where(
            and(
                eq(permanentGrants.beneficiaryUserId, parsed.data),
                isNull(permanentGrants.revokedAt)
            )
        );
    if (!grant) return { grant: null };
    const anchors = await db
        .select({
            vertical: permanentGrantVerticals.vertical,
            planId: permanentGrantVerticals.planId,
            floorPlanVersionId: permanentGrantVerticals.floorPlanVersionId
        })
        .from(permanentGrantVerticals)
        .where(eq(permanentGrantVerticals.permanentGrantId, grant.permanentGrantId));
    return { grant: { ...grant, anchors } };
}
