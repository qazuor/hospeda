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

import { AccommodationIdSchema } from '@repo/schemas';
import type { Context } from 'hono';
import { z } from 'zod';
import { resolvePublishPrecheck } from '../../../services/publish-precheck.service';
import { getActorFromContext } from '../../../utils/actor';

import { createProtectedRoute } from '../../../utils/route-factory';

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

        const result = await resolvePublishPrecheck({ ctx, actor, vertical: 'accommodation' });

        return {
            currentCount: result.currentCount,
            maxAllowed: result.maxAllowed,
            hasQuota: result.hasQuota,
            draftCount: result.draftCount,
            drafts: result.drafts.map((item) => ({
                id: item.id,
                slug: item.slug,
                name: item.name
            })),
            decision: result.decision
        };
    }
});
