/**
 * H-54 — the two refined schemas that had no second line of defence.
 *
 * The audit measured the factory's real behaviour: of 12 schemas used as
 * `requestBody` that carry a refinement, 2 survive by accident (they contain a
 * `z.coerce.*` field, which trips the factory's other escape hatch) and 10 are
 * rebuilt without their refinement. Eight of those ten re-apply the rule in
 * their service. These two did not:
 *
 *  - `CreateBillingPlanSchema` — `trialDays > 0` required when `hasTrial`.
 *    Without it, `resolvePlanTrialConfig` reads 0 and the plan is silently
 *    created "with no trial".
 *  - `CreateSocialDraftSchema` — `openaiFileIdRefs` required when
 *    `image.mode === 'openai_file_refs'`. Without it the pipeline reads `?.[0]`
 *    and produces a post with no image.
 *
 * Both degrade rather than corrupt, which is why neither was caught: nothing
 * throws, nothing looks wrong, the result is just quietly less than asked for.
 *
 * These assertions run against the REAL exported schemas, never a local
 * re-declaration — a fixture rebuilt from the same assumption as the code stays
 * green while the rule is dead.
 */

import { CreateBillingPlanSchema, CreateSocialDraftSchema, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core/types';
import { describe, expect, it } from 'vitest';
import { parseRefinedBody, RefinedBodyValidationError } from '../../src/utils/refined-body';

/** A plan body that satisfies every field-level rule. */
const validPlan = {
    slug: 'guard-probe-plan',
    name: 'Guard probe',
    description: 'A plan used only by this guard.',
    category: 'owner' as const,
    monthlyPriceArs: 100000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 100,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 1,
    entitlements: [],
    limits: {},
    isActive: true
};

describe('parseRefinedBody', () => {
    describe('CreateBillingPlanSchema — trialDays required when hasTrial', () => {
        it('rejects hasTrial: true with trialDays: 0', () => {
            expect(() =>
                parseRefinedBody({
                    schema: CreateBillingPlanSchema,
                    body: { ...validPlan, hasTrial: true, trialDays: 0 }
                })
            ).toThrow(ServiceError);
        });

        it('reports it as a validation error, not a server fault', () => {
            try {
                parseRefinedBody({
                    schema: CreateBillingPlanSchema,
                    body: { ...validPlan, hasTrial: true, trialDays: 0 }
                });
                throw new Error('expected parseRefinedBody to throw');
            } catch (error) {
                expect(error).toBeInstanceOf(ServiceError);
                expect((error as ServiceError).code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            }
        });

        it('accepts hasTrial: true with a positive trialDays', () => {
            const parsed = parseRefinedBody({
                schema: CreateBillingPlanSchema,
                body: { ...validPlan, hasTrial: true, trialDays: 30 }
            });

            expect(parsed.trialDays).toBe(30);
        });

        it('accepts a plan with no trial at all', () => {
            expect(
                parseRefinedBody({ schema: CreateBillingPlanSchema, body: validPlan }).hasTrial
            ).toBe(false);
        });

        it('HOS-607: throws a RefinedBodyValidationError carrying the rich transformZodError shape, not a raw i18n key', () => {
            // Regression for HOS-607 — the smoke found this rejection replying a
            // flat `{code, message}` body whose `message` was the LITERAL,
            // untranslated Zod key (`zodError.billing.plan.create.trialDays.
            // requiredWhenTrial`), while an ordinary field-level rejection on
            // the same endpoint replies the rich `{details, summary,
            // userFriendlyMessage}` shape. `parseRefinedBody` must now throw a
            // `RefinedBodyValidationError` carrying that same rich shape so
            // `handleRouteError` can render it identically (see
            // response-helpers.test.ts for the rendered-response assertion).
            try {
                parseRefinedBody({
                    schema: CreateBillingPlanSchema,
                    body: { ...validPlan, hasTrial: true, trialDays: 0 }
                });
                throw new Error('expected parseRefinedBody to throw');
            } catch (error) {
                expect(error).toBeInstanceOf(RefinedBodyValidationError);
                const refinedError = error as RefinedBodyValidationError;

                // Still a ServiceError(VALIDATION_ERROR) — every existing
                // `instanceof ServiceError` / `.code` check upstream must keep
                // working unchanged.
                expect(refinedError).toBeInstanceOf(ServiceError);
                expect(refinedError.code).toBe(ServiceErrorCode.VALIDATION_ERROR);

                const { validation } = refinedError;
                expect(validation.code).toBe('VALIDATION_ERROR');
                expect(validation.details).toHaveLength(1);
                expect(validation.details[0]?.field).toBe('trialDays');
                // The raw zodError key belongs in `messageKey` (for the client
                // to resolve via i18n) — never surfaced anywhere as a literal,
                // untranslated `message` string.
                expect(validation.details[0]?.messageKey).toBe(
                    'zodError.billing.plan.create.trialDays.requiredWhenTrial'
                );
                expect(validation.summary.totalErrors).toBe(1);
                expect(typeof validation.userFriendlyMessage).toBe('string');
            }
        });

        it('confirms the refinement is what rejects it, not a field-level rule', () => {
            // The instrument check. `trialDays: 0` passes every field-level
            // constraint the schema declares (int, min 0) — so if this body were
            // rejected for any other reason, the test above would pass while the
            // cross-field rule stayed dead.
            expect(() =>
                parseRefinedBody({
                    schema: CreateBillingPlanSchema,
                    body: { ...validPlan, hasTrial: false, trialDays: 0 }
                })
            ).not.toThrow();
        });
    });

    describe('CreateSocialDraftSchema — openaiFileIdRefs required for openai_file_refs', () => {
        /**
         * Every required field, with values the enums actually accept.
         *
         * The first draft of this fixture used `platform: 'instagram'` and no
         * `targets`, so the schema rejected it on the enum and the "rejects"
         * assertions below passed WITHOUT the refinement ever running — a green
         * test measuring the wrong rejection. `baseDraft` is asserted valid on
         * its own first, precisely so that cannot recur.
         */
        const baseDraft = {
            operatorPin: '000000',
            draftId: 'guard-probe-draft',
            title: 'Guard probe title',
            captionBase: 'Guard probe caption body.',
            targets: [{ platform: 'INSTAGRAM', publishFormat: 'FEED_POST' }]
        };

        const fileRef = {
            download_link: 'https://example.com/guard-probe.png',
            id: 'file-abc123',
            name: 'guard-probe.png'
        };

        it('accepts the base draft, so every later rejection is the refinement', () => {
            expect(() =>
                parseRefinedBody({ schema: CreateSocialDraftSchema, body: baseDraft })
            ).not.toThrow();
        });

        it('rejects image.mode openai_file_refs with no refs', () => {
            expect(() =>
                parseRefinedBody({
                    schema: CreateSocialDraftSchema,
                    body: { ...baseDraft, image: { mode: 'openai_file_refs' } }
                })
            ).toThrow(ServiceError);
        });

        it('rejects it when the refs array is present but empty', () => {
            expect(() =>
                parseRefinedBody({
                    schema: CreateSocialDraftSchema,
                    body: {
                        ...baseDraft,
                        image: { mode: 'openai_file_refs' },
                        openaiFileIdRefs: []
                    }
                })
            ).toThrow(ServiceError);
        });

        it('accepts it once a ref is supplied', () => {
            expect(() =>
                parseRefinedBody({
                    schema: CreateSocialDraftSchema,
                    body: {
                        ...baseDraft,
                        image: { mode: 'openai_file_refs' },
                        openaiFileIdRefs: [fileRef]
                    }
                })
            ).not.toThrow();
        });
    });
});
