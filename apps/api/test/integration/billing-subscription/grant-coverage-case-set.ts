import type { BillingForVerticals, CoverageResponse } from '@repo/billing-verticals-contract';
import { CoverageResponseSchema } from '@repo/billing-verticals-contract';
import type { CaseRunner } from '@repo/billing-verticals-contract/testing';
import { VerticalEnum } from '@repo/schemas';

export const LIVE_GRANT_COVERAGE_CASE =
    'a live permanent grant covers its anchored vertical with a GRANT source that carries its floor (AC:B9a:12)';
export const GRANT_OTHER_VERTICAL_CASE =
    'a permanent grant does not reach a vertical it is not anchored in (AC:B9a:12)';
export const REAL_COURTESY_COVERAGE_CASE =
    'the real COURTESY source emits nothing from empty tables and one source from a seeded row (AC:B9a:12)';

export interface GrantCoverageCaseHarness {
    readonly subject: Pick<BillingForVerticals, 'coverage'>;
    readonly newUserId: () => string;
    readonly arrange: {
        readonly liveGrant: (
            userId: string,
            vertical: VerticalEnum
        ) => Promise<{
            readonly floor: string;
            readonly since: Date;
        }>;
        readonly courtesy: (userId: string) => Promise<{
            readonly planVersionId: string;
            readonly startsAt: Date;
            readonly endsAt: Date;
        }>;
    };
}

function validResponse(response: unknown): CoverageResponse {
    return CoverageResponseSchema.parse(response);
}

/** Registers the API real-coverage cases for both the production composition and bootstrap comparison. */
export function grantCoverageCaseSet(
    args: CaseRunner & { readonly makeHarness: () => Promise<GrantCoverageCaseHarness> }
): void {
    const { describe, it, expect, makeHarness } = args;
    describe('TEST:B9a:12 API real coverage case set', () => {
        it(LIVE_GRANT_COVERAGE_CASE, async () => {
            const harness = await makeHarness();
            const userId = harness.newUserId();
            const { floor, since } = await harness.arrange.liveGrant(
                userId,
                VerticalEnum.ACCOMMODATION
            );
            const response = validResponse(
                await harness.subject.coverage({
                    userId,
                    vertical: VerticalEnum.ACCOMMODATION
                })
            );
            const grants = response.sources.filter((source) => source.type === 'GRANT');
            expect(grants.length).toBe(1);
            expect(grants[0]).toEqual({
                type: 'GRANT',
                reference: { kind: 'PLAN_VERSION', planVersionId: floor },
                floor,
                scope: 'VERTICAL',
                target: null,
                since,
                until: 'NEVER_EXPIRES',
                charged: null
            });
            expect(response.covered).toBe(true);
        });

        it(GRANT_OTHER_VERTICAL_CASE, async () => {
            const harness = await makeHarness();
            const userId = harness.newUserId();
            await harness.arrange.liveGrant(userId, VerticalEnum.ACCOMMODATION);
            const response = validResponse(
                await harness.subject.coverage({ userId, vertical: VerticalEnum.GASTRONOMY })
            );
            expect(response.sources.some((source) => source.type === 'GRANT')).toBe(false);
        });

        it(REAL_COURTESY_COVERAGE_CASE, async () => {
            const harness = await makeHarness();
            const userId = harness.newUserId();
            const empty = validResponse(
                await harness.subject.coverage({ userId, vertical: VerticalEnum.ACCOMMODATION })
            );
            expect(empty.sources.some((source) => source.type === 'COURTESY')).toBe(false);
            const expected = await harness.arrange.courtesy(userId);
            const response = validResponse(
                await harness.subject.coverage({ userId, vertical: VerticalEnum.ACCOMMODATION })
            );
            expect(response.sources.filter((source) => source.type === 'COURTESY')).toEqual([
                {
                    type: 'COURTESY',
                    reference: { kind: 'PLAN_VERSION', planVersionId: expected.planVersionId },
                    scope: 'VERTICAL',
                    target: null,
                    since: expected.startsAt,
                    until: expected.endsAt,
                    charged: null,
                    floor: null
                }
            ]);
        });
    });
}
