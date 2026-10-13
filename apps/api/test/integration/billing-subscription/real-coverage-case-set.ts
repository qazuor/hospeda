/**
 * The real implementation's own case set (contract §6.2; AC:B4:9, TEST:B4:9).
 *
 * "Los casos de las fuentes de billing no son del juego único": a case such as
 * "an ACTIVE subscription covers" is one the bootstrap implementation of V4 can
 * never pass, because it answers no to every billing source. In the shared
 * forward case set (`coverageCaseSet`) it would stay red for the whole
 * verticals epic, or be conditioned on the implementation, and a conditioned
 * case cannot fail. So those cases go in a set of the real implementation's
 * own, which runs ONLY against it and holds at least one case the bootstrap
 * would not pass: that is what proves the real one is not the bootstrap under
 * another name.
 *
 * B9a adds its GRANT case, with the `floor` it carries, to this set when it
 * plugs the grants in (B4 "Lista cuando", clause 3).
 *
 * Test support, not production, and not a `*.test.ts` file: the closed
 * `include` of the integration config never collects it on its own; the test
 * that registers it decides the harness.
 */
import {
    type BillingForVerticals,
    type CoverageResponse,
    CoverageResponseSchema,
    coverageSourceClassOf,
    type UserVerticalArgs
} from '@repo/billing-verticals-contract';
import type { CaseExpect, CaseRunner } from '@repo/billing-verticals-contract/testing';
import { VerticalEnum } from '@repo/schemas';

/**
 * What a case of the real implementation's own set needs. A fresh harness is
 * made for every case.
 */
export interface RealCoverageCaseHarness {
    /** The implementation under test. */
    readonly subject: Pick<BillingForVerticals, 'coverage'>;
    /** Puts a person in a billing state, through whatever the implementation reads. */
    readonly arrange: {
        /**
         * An `ACTIVE` PRINCIPAL subscription of that person in that vertical,
         * with no trial.
         */
        readonly activeSubscription: (args: UserVerticalArgs) => Promise<void>;
    };
    /** A person id nobody else in this harness uses. */
    readonly newUserId: () => string;
}

/** The vertical the subscription is arranged in. */
const SUBSCRIBED_VERTICAL = VerticalEnum.ACCOMMODATION;

/** A second vertical, where the person holds no subscription. */
const OTHER_VERTICAL = VerticalEnum.GASTRONOMY;

/** Asserts the response validates against the contract; returns it typed. */
function expectValid(args: {
    readonly expect: CaseExpect;
    readonly response: unknown;
}): CoverageResponse {
    const parsed = CoverageResponseSchema.safeParse(args.response);
    args.expect(
        parsed.success ? 'valid' : parsed.error.message,
        'the coverage response validates against the contract'
    ).toBe('valid');
    return CoverageResponseSchema.parse(args.response);
}

/**
 * Registers the real implementation's own case set (contract §6.2).
 *
 * @param args.describe - The runner's `describe`
 * @param args.it - The runner's `it`
 * @param args.expect - The runner's `expect`
 * @param args.makeHarness - Builds a fresh harness for one case
 */
export function realCoverageCaseSet(
    args: CaseRunner & { readonly makeHarness: () => Promise<RealCoverageCaseHarness> }
): void {
    const { describe, it, expect, makeHarness } = args;

    describe("billing-verticals contract: coverage (the real implementation's own case set, contract §6.2)", () => {
        it('an ACTIVE subscription covers', async () => {
            const h = await makeHarness();
            const who = { userId: h.newUserId(), vertical: SUBSCRIBED_VERTICAL };
            await h.arrange.activeSubscription(who);

            const response = expectValid({ expect, response: await h.subject.coverage(who) });

            expect(response.covered, 'an ACTIVE subscription covers').toBe(true);
            expect(
                response.sources.some(
                    (source) =>
                        source.type === 'SUBSCRIPTION' &&
                        coverageSourceClassOf({ source }).sourceClass === 'TITLE' &&
                        source.until === 'NO_KNOWN_DATE'
                ),
                'a SUBSCRIPTION source of class TITLE, with until NO_KNOWN_DATE'
            ).toBe(true);
        });

        it('an ACTIVE subscription does not cover another vertical', async () => {
            const h = await makeHarness();
            const userId = h.newUserId();
            await h.arrange.activeSubscription({ userId, vertical: SUBSCRIBED_VERTICAL });

            const response = expectValid({
                expect,
                response: await h.subject.coverage({ userId, vertical: OTHER_VERTICAL })
            });

            expect(response.covered, 'the subscription does not reach another vertical').toBe(
                false
            );
            expect(
                response.sources.some((source) => source.type === 'SUBSCRIPTION'),
                'no SUBSCRIPTION source in a vertical the person did not subscribe in'
            ).toBe(false);
        });
    });
}
