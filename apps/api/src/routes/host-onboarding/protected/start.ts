/**
 * Protected host-onboarding start endpoint.
 *
 * Specialized entry point for the public web "publicar" flow. Unlike the
 * generic `/api/v1/protected/accommodations/draft` endpoint, this one is
 * callable by any authenticated USER because it does NOT require the
 * `ACCOMMODATION_CREATE` permission.
 *
 * As of BETA-197, this endpoint ALWAYS creates a fresh DRAFT — it no longer
 * auto-resumes an existing active DRAFT. The web calls
 * `GET /host-onboarding/precheck` BEFORE showing the form and decides itself
 * whether to create, resume, delete, or upgrade; by the time `/start` is
 * called, the caller has already committed to creating. Consequently, DRAFTs
 * count against `max_accommodations` like any other create — the limit is
 * enforced with no bypass. When the actor is already HOST (or higher) the
 * role promotion is a no-op but the DRAFT is still created so their input is
 * not lost.
 *
 * A USER who creates onboarding is promoted to HOST during the onboarding
 * flow so they can access host surfaces immediately. The billing trial still
 * starts later, on the first DRAFT -> ACTIVE publish.
 */
import { AnalyticsEvents } from '@repo/analytics';
import {
    AccommodationCreateDraftHttpSchema,
    AccommodationIdSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, type Actor, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { captureServerAnalyticsEvent } from '../../../lib/analytics-client';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { getVisitorContext, type VisitorContext } from '../../../utils/visitor-context';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Response shape for `/host-onboarding/start`. `status` is kept as a
 * single-value enum (rather than dropped) so the response shape stays
 * stable for existing consumers now that `createForOnboarding` always
 * creates (see {@link HostOnboardingResult}).
 */
const HostOnboardingStartResponseSchema = z.object({
    status: z.enum(['created']),
    accommodationId: AccommodationIdSchema.nullable(),
    accommodationSlug: z.string().nullable()
});

/**
 * Who created a host-onboarding draft, for the analytics events' `draft_source`
 * and `creation_source`: the portal form (`manual`) or the owner assistant's
 * `create_listing` tool (`assistant`, owner decision on HOS-2329).
 */
export type HostOnboardingDraftSource = 'manual' | 'assistant';

/** What {@link startHostOnboardingDraft} answers: the created draft. */
export interface HostOnboardingDraft {
    /** Always `created` (BETA-197: the flow never resumes). */
    readonly status: 'created';
    /** The new DRAFT accommodation's id. */
    readonly accommodationId: string;
    /** Its server-derived slug. */
    readonly accommodationSlug: string;
}

/**
 * Creates the host-onboarding DRAFT exactly as `POST /host-onboarding/start`
 * does, side effects included: `AccommodationService.createForOnboarding`
 * (insert + USER -> HOST promotion in one transaction; no trial, which starts
 * on the first publish), then the two server analytics events. Shared by this
 * route and the owner assistant's `create_listing` tool (HOS-2329, spec
 * HOS-2335 C-1/C-6, owner decision D-6), so neither copies the other.
 *
 * @param input - The actor, the validated draft body, the visitor context
 *   when the call came from a browser (the assistant has none), and who created
 *   the draft (defaults to `manual`, the portal form)
 * @returns The created draft
 * @throws {ServiceError} The service's error, as the route throws it
 */
export async function startHostOnboardingDraft(input: {
    readonly actor: Actor;
    readonly body: Parameters<AccommodationService['createForOnboarding']>[1];
    readonly visitor?: VisitorContext;
    readonly source?: HostOnboardingDraftSource;
}): Promise<HostOnboardingDraft> {
    const { actor, body, visitor, source = 'manual' } = input;
    const result = await accommodationService.createForOnboarding(actor, body);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    const data = result.data;
    if (!data) {
        // runWithLoggingAndValidation always populates data when error is
        // absent; this branch is unreachable but satisfies the type narrower.
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'createForOnboarding returned no data and no error'
        );
    }

    captureServerAnalyticsEvent({
        distinctId: actor.id,
        name: AnalyticsEvents.onboardingStarted,
        properties: {
            onboarding_type: 'host_accommodation',
            draft_source: source
        },
        ...(visitor ? { visitor } : {})
    });

    captureServerAnalyticsEvent({
        distinctId: actor.id,
        name: AnalyticsEvents.accommodationDraftSaved,
        properties: {
            accommodation_id: data.accommodation.id,
            creation_source: source
        },
        ...(visitor ? { visitor } : {})
    });

    return {
        status: data.status,
        accommodationId: data.accommodation.id,
        accommodationSlug: data.accommodation.slug
    };
}

/**
 * POST /api/v1/protected/host-onboarding/start
 */
export const protectedHostOnboardingStartRoute = createProtectedRoute({
    method: 'post',
    path: '/start',
    summary: 'Start host onboarding',
    description:
        'Creates a host onboarding draft for the authenticated user. Existing hosts flow through normally — the role promotion is a no-op. No special permissions required. Callers should use GET /host-onboarding/precheck first to decide whether creation is the right action.',
    tags: ['Host Onboarding'],
    requestBody: AccommodationCreateDraftHttpSchema,
    responseSchema: HostOnboardingStartResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const visitor = getVisitorContext(ctx);
        return startHostOnboardingDraft({
            actor: getActorFromContext(ctx),
            body: body as Parameters<AccommodationService['createForOnboarding']>[1],
            ...(visitor ? { visitor } : {})
        });
    },
    options: {
        // Funnel exception: `/host-onboarding/start` is the public publish entry
        // point for authenticated tourists. A tourist-free user must be able to
        // create the onboarding draft; the 14-day owner trial starts later on the
        // first DRAFT -> ACTIVE publish, not here. Keep the limit guard so existing
        // hosts still cannot exceed max_accommodations via this shortcut. As of
        // BETA-197 this endpoint always creates (no more auto-resume), so the
        // limit applies unconditionally, drafts included — the web is responsible
        // for steering the user away from `/start` when they should resume/delete/
        // upgrade instead, via `GET /host-onboarding/precheck`.
    }
});
