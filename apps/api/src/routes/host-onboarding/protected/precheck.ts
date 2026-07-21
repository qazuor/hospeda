/**
 * Protected host-onboarding precheck endpoint (BETA-197).
 *
 * Read-only endpoint the web "publicar nueva" flow calls BEFORE rendering the
 * onboarding form, so it can decide which dialog (if any) to show: create
 * directly, resume an existing DRAFT, offer to pick among several DRAFTs, or
 * send the user to upgrade because their plan has no accommodation quota
 * left. This route does NOT mutate anything and does NOT touch
 * `createForOnboarding` / `enforceAccommodationLimit` — it only reads counts
 * and composes the decision via {@link deriveOnboardingDecision}.
 *
 * Same access posture as `/host-onboarding/start`: callable by ANY
 * authenticated user (no accommodation permission required), because a
 * tourist who has never created an accommodation still needs to know they
 * can "create_direct" before they see the form.
 */

import { LimitKey } from '@repo/billing';
import { AccommodationIdSchema, LifecycleStatusEnum } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import {
    deriveOnboardingDecision,
    type OnboardingPrecheckDecision
} from '../../../services/onboarding-precheck';
import { getActorFromContext } from '../../../utils/actor';
import { checkLimit } from '../../../utils/limit-check';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/** Max number of DRAFT rows returned in `drafts`. Onboarding drafts are always few (matrix caps meaningfully at ">1"); this bound only guards against pathological data. */
const MAX_DRAFTS_RETURNED = 50;

const OnboardingPrecheckDraftSchema = z.object({
    id: AccommodationIdSchema,
    slug: z.string(),
    name: z.string()
});

const OnboardingPrecheckResponseSchema = z.object({
    currentCount: z.number().int().nonnegative(),
    maxAllowed: z.number().int(),
    hasQuota: z.boolean(),
    draftCount: z.number().int().nonnegative(),
    drafts: z.array(OnboardingPrecheckDraftSchema),
    decision: z.enum([
        'create_direct',
        'upgrade_only',
        'resume_or_create',
        'resume_delete_or_upgrade',
        'pick_draft_or_create',
        'pick_draft_delete_or_upgrade'
    ])
});

/**
 * GET /api/v1/protected/host-onboarding/precheck
 */
export const protectedHostOnboardingPrecheckRoute = createProtectedRoute({
    method: 'get',
    path: '/precheck',
    summary: 'Precheck host onboarding',
    description:
        'Returns the DRAFT count, accommodation quota, and the derived onboarding decision for the authenticated user, so the web "publicar nueva" flow can pick the right dialog before rendering the onboarding form. Read-only; no special permissions required.',
    tags: ['Host Onboarding'],
    responseSchema: OnboardingPrecheckResponseSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);

        // Total non-deleted accommodations owned by the actor — same predicate
        // enforceAccommodationLimit() uses for the MAX_ACCOMMODATIONS count.
        const countResult = await accommodationService.count(actor, {
            ownerId: actor.id
        } as never);

        if (countResult.error) {
            throw new ServiceError(countResult.error.code, countResult.error.message);
        }

        const currentCount = countResult.data?.count ?? 0;

        const limitCheck = checkLimit({
            context: ctx,
            limitKey: LimitKey.MAX_ACCOMMODATIONS,
            currentCount
        });

        // Draft rows: ownerId + lifecycleState=DRAFT + not-soft-deleted, plus
        // id/slug/name for the picker UI. `createForOnboarding` no longer looks
        // this up itself (BETA-197 removed its auto-resume branch) — this route
        // is now the only place that predicate is evaluated.
        const draftsResult = await accommodationService.list(actor, {
            page: 1,
            pageSize: MAX_DRAFTS_RETURNED,
            where: {
                ownerId: actor.id,
                lifecycleState: LifecycleStatusEnum.DRAFT,
                deletedAt: null
            },
            sortBy: 'createdAt',
            sortOrder: 'desc'
        });

        if (draftsResult.error) {
            throw new ServiceError(draftsResult.error.code, draftsResult.error.message);
        }

        const draftItems = draftsResult.data?.items ?? [];
        const draftCount = draftsResult.data?.total ?? draftItems.length;

        const decision: OnboardingPrecheckDecision = deriveOnboardingDecision({
            draftCount,
            hasQuota: limitCheck.allowed
        });

        return {
            currentCount,
            maxAllowed: limitCheck.maxAllowed,
            hasQuota: limitCheck.allowed,
            draftCount,
            drafts: draftItems.map((item) => ({
                id: item.id,
                slug: item.slug,
                name: item.name
            })),
            decision
        };
    }
});
