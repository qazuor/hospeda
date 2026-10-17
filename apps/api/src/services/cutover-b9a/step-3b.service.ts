import { and, eq, getDb, trials } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import {
    type Actor,
    assertAnchorFloorsAcceptable,
    assertPermanentGrantPermitted,
    assertPermanentGrantSubject,
    grantPermanentGrant,
    hasLivePermanentGrantAnchor,
    type PermanentGrantPorts,
    ServiceError
} from '@repo/service-core';
import { z } from 'zod';
import { AuditEventType, auditLog } from '../../utils/audit-logger.js';

/** Stable audit reason for grants written by the B9a step 3b cutover tool. */
export const STEP_3B_REASON = 'Cutover step 3b: owner courtesy account (HOS-1352)';
const VERTICAL = VerticalEnum.ACCOMMODATION;
const Step3bInputSchema = z
    .object({
        beneficiaryUserIds: z.array(z.string().uuid()).length(2),
        planId: z.string().uuid(),
        floorPlanVersionId: z.string().uuid(),
        includesAddons: z.boolean(),
        dryRun: z.boolean()
    })
    .refine(({ beneficiaryUserIds }) => new Set(beneficiaryUserIds).size === 2);

/** Input passed to the B9a step 3b runner. */
export interface RunStep3bInput {
    readonly actor: Actor;
    readonly beneficiaryUserIds: readonly string[];
    readonly planId: string;
    readonly floorPlanVersionId: string;
    readonly includesAddons: boolean;
    readonly dryRun: boolean;
    readonly ports: PermanentGrantPorts;
}

/** Per-beneficiary result with no personal data beyond the user id. */
export interface Step3bBeneficiaryResult {
    readonly userId: string;
    readonly outcome: 'written' | 'skipped' | 'would_write';
    readonly permanentGrantId: string | null;
    readonly trialStatus: string | null;
}

/** Secret-free result of the step 3b cutover operation. */
export interface Step3bResult {
    readonly status: 'completed' | 'dry_run' | 'failed';
    readonly beneficiaries: readonly Step3bBeneficiaryResult[];
}

/** Invalid command input rejected before any database read. */
export class Step3bInputError extends Error {
    constructor() {
        super('Step 3b requires two distinct beneficiary UUIDs and valid plan UUIDs.');
        this.name = 'Step3bInputError';
    }
}

/** A required accommodation trial row is missing for a named beneficiary. */
export class Step3bTrialMissingError extends Error {
    constructor(userId: string) {
        super(`Step 3b requires an accommodation trial for beneficiary ${userId}.`);
        this.name = 'Step3bTrialMissingError';
    }
}

/** Validates, authorizes, and writes the two permanent grants for cutover step 3b. */
export async function runStep3b(input: RunStep3bInput): Promise<Step3bResult> {
    const parsed = Step3bInputSchema.safeParse(input);
    if (!parsed.success) throw new Step3bInputError();
    const beneficiaryUserIds = parsed.data.beneficiaryUserIds;
    assertPermanentGrantPermitted({ actor: input.actor });
    for (const beneficiaryUserId of beneficiaryUserIds) {
        assertPermanentGrantSubject({ actor: input.actor, beneficiaryUserId });
    }

    const initialTrials = await Promise.all(
        beneficiaryUserIds.map((userId) => readTrial({ userId }))
    );
    for (const [index, userId] of beneficiaryUserIds.entries()) {
        if (!initialTrials[index]?.trial) throw new Step3bTrialMissingError(userId);
    }

    const live = await Promise.all(
        beneficiaryUserIds.map((userId) =>
            hasLivePermanentGrantAnchor({
                userId,
                vertical: VERTICAL,
                tx: getDb()
            })
        )
    );
    const needsWrite = live.map((isLive) => !isLive);
    if (needsWrite.some(Boolean)) {
        await assertAnchorFloorsAcceptable({
            anchors: [
                {
                    vertical: VERTICAL,
                    planId: parsed.data.planId,
                    floorPlanVersionId: parsed.data.floorPlanVersionId
                }
            ],
            planPolicy: input.ports.planPolicy
        });
    }

    if (input.dryRun) {
        return {
            status: 'dry_run',
            beneficiaries: beneficiaryUserIds.map((userId, index) => ({
                userId,
                outcome: live[index] ? 'skipped' : 'would_write',
                permanentGrantId: null,
                trialStatus: initialTrials[index]?.trial?.status ?? null
            }))
        };
    }

    const results: Step3bBeneficiaryResult[] = [];
    for (const [index, userId] of beneficiaryUserIds.entries()) {
        if (live[index]) {
            results.push({
                userId,
                outcome: 'skipped',
                permanentGrantId: null,
                trialStatus: initialTrials[index]?.trial?.status ?? null
            });
            continue;
        }
        try {
            const grant = await grantPermanentGrant(
                {
                    beneficiaryUserId: userId,
                    actor: input.actor,
                    reason: STEP_3B_REASON,
                    includesAddons: input.includesAddons,
                    anchors: [
                        {
                            vertical: VERTICAL,
                            planId: parsed.data.planId,
                            floorPlanVersionId: parsed.data.floorPlanVersionId
                        }
                    ]
                },
                input.ports
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: input.actor.id,
                action: 'create',
                resourceType: 'permanent_grant',
                resourceId: grant.permanentGrantId,
                metadata: {
                    administrativeAction: 'ACC_2',
                    transition: 'S13',
                    subjectId: userId,
                    includesAddons: input.includesAddons,
                    reason: STEP_3B_REASON,
                    verticals: [VERTICAL],
                    anchorIds: grant.anchorIds,
                    cancelledSubscriptionIds: grant.cancelledSubscriptionIds,
                    releasedRetentionIds: grant.releasedRetentionIds,
                    closedCourtesyIds: grant.closedCourtesyIds,
                    providerCalls: grant.providerCalls,
                    anchoredAddonInstanceIds: grant.anchoredAddonInstanceIds,
                    addonProviderCalls: grant.addonProviderCalls,
                    tool: 'cutover-step-3b'
                }
            });
            results.push({
                userId,
                outcome: 'written',
                permanentGrantId: grant.permanentGrantId,
                trialStatus: null
            });
        } catch (error) {
            if (!(error instanceof ServiceError) || error.reason !== 'PERMANENT_GRANT_ALREADY_LIVE')
                throw error;
            const nowLive = await hasLivePermanentGrantAnchor({
                userId,
                vertical: VERTICAL,
                tx: getDb()
            });
            if (!nowLive) throw error;
            results.push({ userId, outcome: 'skipped', permanentGrantId: null, trialStatus: null });
        }
    }

    const finalTrials = await Promise.all(
        beneficiaryUserIds.map((userId) => readTrial({ userId }))
    );
    const beneficiaries = results.map((result, index) => ({
        ...result,
        trialStatus: finalTrials[index]?.trial?.status ?? null
    }));
    return {
        status: finalTrials.every((result) => result.trial?.status === 'TRIAL_CONVERTED')
            ? 'completed'
            : 'failed',
        beneficiaries
    };
}

async function readTrial({ userId }: { readonly userId: string }): Promise<{
    readonly trial: { readonly status: string } | null;
}> {
    const [trial] = await getDb()
        .select({ status: trials.status })
        .from(trials)
        .where(and(eq(trials.userId, userId), eq(trials.vertical, VERTICAL)))
        .limit(1);
    return { trial: trial ?? null };
}
