/**
 * Per-route verification for HOS-425: the ten `requestBody` schemas whose
 * cross-field refinement the route factory used to discard.
 *
 * ## Why this file exists, and why it is not ten HTTP tests
 *
 * Repairing the factory changes WHERE these ten routes refuse a body: at the
 * boundary, rather than wherever the rule happened to be re-applied further in.
 * The request itself was already being refused in all ten cases — each rule is
 * duplicated downstream, by the route's service, by a `parseRefinedBody` patch
 * in the handler, or (for the one schema with a `z.coerce` field) by the
 * factory's own escape hatch. What this file establishes is that the rule
 * survives the rebuild at all, so every schema is exercised with a body that
 * actually violates it — not merely inspected for a check count, which would
 * pass just as happily if the check were re-attached to the wrong schema or
 * never consulted.
 *
 * The assertion runs against `createOpenAPISchema(schema)`, because that is the
 * object the factory hands to the runtime body validator — the exact artifact
 * that lost the rule. Feeding it the violating body answers the question the
 * issue asks ("does the rule reach the request?") for all ten at once, without
 * each route's own auth, ownership and entitlement wiring getting a vote.
 *
 * The two routes whose rejection STATUS is the point get real HTTP tests of
 * their own, over `initApp()`:
 * `routes/event/admin/create-authorship.test.ts` and
 * `routes/content-moderation/threshold-patch-refinement.test.ts`.
 *
 * @module test/routes/refinement-enforcement
 */

import {
    AccommodationOccupancyEventUpdateSchema,
    CreateBillingPlanSchema,
    CreateSocialDraftSchema,
    EventAdminCreateBodySchema,
    EventUpdateInputSchema,
    HostTradeBenefitUsageProviderCreateBodySchema,
    HostTradeOwnerUpdateSchema,
    ScheduleSocialPostSchema,
    UpdateNewsletterPreferencesInputSchema,
    updateContentModerationThresholdSchema
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { createOpenAPISchema, hasObjectLevelRefinement } from '../../src/utils/openapi-schema';
import { hasHttpCoercionFields } from '../../src/utils/route-factory';
import type { z } from '../../src/utils/zod';

/**
 * One row per route from the HOS-425 inventory.
 *
 * `violating` breaks ONLY the cross-field rule: every field-level constraint is
 * satisfied, so a rejection can come from nowhere else. `accepted` is the same
 * body with the rule honoured, which is what stops a schema that rejects
 * everything from reading as a pass.
 */
const CASES: ReadonlyArray<{
    readonly route: string;
    readonly rule: string;
    readonly schema: z.ZodTypeAny;
    readonly violating: unknown;
    readonly accepted: unknown;
}> = [
    {
        route: 'accommodation/protected/updateOccupancyEvent.ts',
        rule: 'each date range must start before it ends',
        schema: AccommodationOccupancyEventUpdateSchema,
        violating: {
            oldStartDate: '2030-07-10',
            oldEndDate: '2030-07-12',
            newStartDate: '2030-07-20',
            newEndDate: '2030-07-18'
        },
        accepted: {
            oldStartDate: '2030-07-10',
            oldEndDate: '2030-07-12',
            newStartDate: '2030-07-18',
            newEndDate: '2030-07-20'
        }
    },
    {
        route: 'billing/admin/plans.ts',
        rule: 'hasTrial requires trialDays > 0',
        schema: CreateBillingPlanSchema,
        violating: { ...buildPlan(), hasTrial: true, trialDays: 0 },
        accepted: { ...buildPlan(), hasTrial: true, trialDays: 14 }
    },
    {
        route: 'ai/social/drafts.ts',
        rule: "image.mode 'openai_file_refs' requires a non-empty root openaiFileIdRefs",
        schema: CreateSocialDraftSchema,
        violating: { ...buildDraft(), image: { mode: 'openai_file_refs' }, openaiFileIdRefs: [] },
        accepted: {
            ...buildDraft(),
            image: { mode: 'openai_file_refs' },
            openaiFileIdRefs: [
                {
                    id: 'file-abc123',
                    name: 'photo.jpg',
                    mime_type: 'image/jpeg',
                    download_link: 'https://files.example.com/file-abc123'
                }
            ]
        }
    },
    {
        route: 'event/admin/create.ts',
        rule: 'date.end must not precede date.start',
        schema: EventAdminCreateBodySchema,
        violating: buildEvent({
            start: '2030-02-01T23:00:00.000Z',
            end: '2030-02-01T18:00:00.000Z'
        }),
        accepted: buildEvent({ start: '2030-02-01T18:00:00.000Z', end: '2030-02-01T23:00:00.000Z' })
    },
    {
        route: 'event/admin/update.ts',
        rule: 'date.end must not precede date.start',
        schema: EventUpdateInputSchema,
        violating: {
            date: { start: '2030-02-01T23:00:00.000Z', end: '2030-02-01T18:00:00.000Z' }
        },
        accepted: {
            date: { start: '2030-02-01T18:00:00.000Z', end: '2030-02-01T23:00:00.000Z' }
        }
    },
    {
        route: 'host-trade/protected/mine-usages.ts',
        rule: 'exactly one of hostUserId / hostEmail',
        schema: HostTradeBenefitUsageProviderCreateBodySchema,
        violating: {
            ...buildUsage(),
            hostUserId: '44444444-4444-4444-8444-444444444444',
            hostEmail: 'host@example.com'
        },
        accepted: { ...buildUsage(), hostEmail: 'host@example.com' }
    },
    {
        route: 'host-trade/protected/mine.ts',
        rule: 'a benefitType that requires a value must carry one',
        schema: HostTradeOwnerUpdateSchema,
        violating: { benefitType: 'PERCENTAGE' },
        accepted: { benefitType: 'PERCENTAGE', benefitValue: 15 }
    },
    {
        route: 'social/admin/posts/schedule.ts',
        rule: 'a WEEKLY recurrence must name a weekday',
        schema: ScheduleSocialPostSchema,
        violating: { ...buildSchedule(), recurrenceType: 'WEEKLY' },
        accepted: {
            ...buildSchedule(),
            recurrenceType: 'WEEKLY',
            recurrenceParamsJson: { weekday: 'MONDAY' }
        }
    },
    {
        route: 'newsletter/protected/preferences.ts',
        rule: 'at least one preference key must be present',
        schema: UpdateNewsletterPreferencesInputSchema,
        violating: {},
        accepted: { offers: false }
    },
    {
        route: 'content-moderation/admin/thresholds/patch.ts',
        rule: 'pending must be strictly below reject',
        schema: updateContentModerationThresholdSchema,
        violating: { pending: 0.9, reject: 0.5 },
        accepted: { pending: 0.5, reject: 0.9 }
    }
];

/** A billing plan body that satisfies every field-level rule. */
function buildPlan() {
    return {
        slug: 'a-test-plan',
        name: 'A Test Plan',
        description: 'A plan used only to exercise the trial refinement.',
        category: 'owner',
        productDomain: 'accommodation',
        monthlyPriceArs: 1000,
        annualPriceArs: 10000,
        monthlyPriceUsdRef: 10,
        isDefault: false,
        sortOrder: 1,
        entitlements: [],
        limits: {},
        isActive: true
    };
}

/** A GPT social draft body that satisfies every field-level rule. */
function buildDraft() {
    return {
        draftId: 'draft-1',
        operatorPin: '123456',
        title: 'A social draft',
        captionBase: 'A social draft body long enough to be plausible.',
        content: 'A social draft body long enough to be plausible.',
        targets: [{ platform: 'INSTAGRAM', publishFormat: 'FEED_POST' }]
    };
}

/** A provider benefit-usage declaration that satisfies every field-level rule. */
function buildUsage() {
    return { servicedAt: '2030-03-01' };
}

/** A social post schedule body that satisfies every field-level rule. */
function buildSchedule() {
    return {
        scheduledAt: '2030-03-01T12:00:00.000Z',
        timezone: 'America/Argentina/Buenos_Aires'
    };
}

/** An admin event create body that satisfies every field-level rule. */
function buildEvent(date: { start: string; end: string }) {
    return {
        name: 'Fiesta de la Playa',
        summary: 'Una fiesta en la costanera con musica en vivo y food trucks.',
        category: 'MUSIC',
        date: { ...date, precision: 'EXACT' }
    };
}

/**
 * A stable, comparable fingerprint of a failed parse: one `code@path` entry per
 * issue, sorted. Comparing whole `ZodError`s would drag in object identity;
 * comparing only `success` would not notice a rejection for the wrong reason.
 */
function issueKeys(result: z.ZodSafeParseResult<unknown>): readonly string[] {
    if (result.success) {
        return [];
    }
    return result.error.issues.map((issue) => `${issue.code}@${issue.path.join('.')}`).sort();
}

describe('HOS-425 — every inventoried body schema declares a cross-field rule', () => {
    for (const { route, rule, schema } of CASES) {
        it(`${route}: ${rule}`, () => {
            expect(hasObjectLevelRefinement(schema)).toBe(true);
        });
    }
});

describe('HOS-425 — which routes actually change behaviour', () => {
    // A schema with `z.coerce.*` at the top level takes the factory's one
    // remaining escape hatch and is handed to the validator WHOLE, so its
    // refinement was running all along. That is a fact about the schema, not a
    // judgement, and the PR's verdict table depends on it being true — so it is
    // measured here rather than asserted in prose.
    const ALREADY_ENFORCED = new Set(['social/admin/posts/schedule.ts']);

    for (const { route, schema } of CASES) {
        it(`${route} ${ALREADY_ENFORCED.has(route) ? 'already enforced its rule (coercion escape hatch)' : 'starts enforcing its rule with this change'}`, () => {
            expect(hasHttpCoercionFields(schema)).toBe(ALREADY_ENFORCED.has(route));
        });
    }
});

describe('HOS-425 — the rule survives the factory rebuild and reaches the request', () => {
    for (const { route, rule, schema, violating, accepted } of CASES) {
        it(`${route} rejects a body that breaks: ${rule}`, () => {
            // The source schema is the control: if IT accepted the body the
            // fixture would be wrong, and the assertion below would be
            // measuring nothing.
            const source = schema.safeParse(violating);
            expect(source.success).toBe(false);

            const rebuilt = createOpenAPISchema(schema).safeParse(violating);
            expect(rebuilt.success).toBe(false);

            // Same issues, not merely "some failure": a rebuilt schema that
            // rejected the body for an unrelated reason (a dropped field, a
            // mangled shape) would otherwise read as a pass.
            expect(issueKeys(rebuilt)).toEqual(issueKeys(source));
        });

        it(`${route} still accepts a body that honours it`, () => {
            const result = createOpenAPISchema(schema).safeParse(accepted);

            expect(result.success ? [] : issueKeys(result)).toEqual([]);
        });
    }
});
