/**
 * The inverse case set (contract §6.2, second set; §7.1 item 4): what billing
 * reads from verticals. It runs against the simulator and against the
 * verticals implementation.
 *
 * The implementation arrives in pieces (V2: `planPolicy`, `changeDirection`,
 * `addonPolicy`; V6: `listing`, `listingPurged` and the PURGED push; V4:
 * `extendTrial`), so the set is split in five groups, each runnable alone with
 * its own harness, and `inverseCaseSet` runs the five. Every group has a case
 * a constant answer fails: two arranged entities with different answers, or
 * an answer that must flip.
 */
import { VerticalEnum } from '@repo/schemas';
import type { z } from 'zod';
import type { VerticalsForBilling } from '../interfaces';
import {
    type AddonPolicyResponse,
    AddonPolicyResponseSchema,
    ChangeDirectionResponseSchema,
    ExtendTrialResponseSchema,
    ListingPurgedResponseSchema,
    ListingResponseSchema,
    type PlanPolicyResponse,
    PlanPolicyResponseSchema
} from '../inverse.schema';
import type { UserVerticalArgs } from '../primitives.schema';
import type { CaseExpect, CaseRunner } from './case-set.types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Asserts a value validates against its schema; returns it parsed. */
function expectValid<TSchema extends z.ZodType>(args: {
    readonly expect: CaseExpect;
    readonly schema: TSchema;
    readonly value: unknown;
    readonly what: string;
}): z.infer<TSchema> {
    const parsed = args.schema.safeParse(args.value);
    args.expect(
        parsed.success ? 'valid' : parsed.error.message,
        `${args.what} validates against the contract`
    ).toBe('valid');
    return args.schema.parse(args.value);
}

/** Harness of the `planPolicy` group. */
export interface PlanPolicyCaseHarness {
    readonly subject: Pick<VerticalsForBilling, 'planPolicy'>;
    /** Creates a plan version whose policy is the given one. */
    readonly arrangePlanVersion: (args: {
        readonly policy: PlanPolicyResponse;
    }) => Promise<{ readonly planVersionId: string }>;
}

/** Harness of the `changeDirection` group. */
export interface ChangeDirectionCaseHarness {
    readonly subject: Pick<VerticalsForBilling, 'changeDirection'>;
    /**
     * Creates two versions of one plan where moving from `from` to `to` lowers
     * something (a limit, an entitlement, a quota) or lowers nothing.
     */
    readonly arrangeChange: (args: {
        readonly lowersSomething: boolean;
    }) => Promise<{ readonly fromPlanVersionId: string; readonly toPlanVersionId: string }>;
}

/** Harness of the listing group (`listing`, `listingPurged`, the PURGED push). */
export interface ListingCaseHarness {
    readonly subject: Pick<VerticalsForBilling, 'listing' | 'listingPurged' | 'onListingPurged'>;
    /** Creates a listing of that vertical and owner, in a state that accepts a feature or not. */
    readonly arrangeListing: (args: {
        readonly vertical: VerticalEnum;
        readonly ownerId: string;
        readonly state: 'PUBLISHED' | 'MODERATED';
    }) => Promise<{ readonly listingId: string }>;
    /** Takes a listing to PURGED (PB12); resolves once committed AND the push emitted. */
    readonly purgeListing: (args: { readonly listingId: string }) => Promise<void>;
    /** A listing id no row was ever written for. */
    readonly unknownListingId: () => string;
    /** A person id nobody else in this harness uses. */
    readonly newUserId: () => string;
}

/** Harness of the `addonPolicy` group. */
export interface AddonPolicyCaseHarness {
    readonly subject: Pick<VerticalsForBilling, 'addonPolicy'>;
    /** Creates an addon version whose policy is the given one. */
    readonly arrangeAddonVersion: (args: {
        readonly policy: AddonPolicyResponse;
    }) => Promise<{ readonly addonVersionId: string }>;
}

/** Harness of the `extendTrial` group. */
export interface ExtendTrialCaseHarness {
    readonly subject: Pick<VerticalsForBilling, 'extendTrial'>;
    /** A running trial with this many days left under the ceiling. */
    readonly arrangeRunningTrial: (
        args: UserVerticalArgs & { readonly remainingExtensionDays: number }
    ) => Promise<void>;
    /** A trial whose end date already passed (its T3 job may be late). */
    readonly arrangeEndedTrial: (args: UserVerticalArgs) => Promise<void>;
    /** The trial's current end date. */
    readonly trialEndsAt: (args: UserVerticalArgs) => Promise<Date>;
    readonly newUserId: () => string;
    readonly newRedemptionKey: () => string;
}

/** Every harness of the inverse set, for `inverseCaseSet`. */
export interface InverseCaseHarness
    extends PlanPolicyCaseHarness,
        ChangeDirectionCaseHarness,
        AddonPolicyCaseHarness,
        Omit<ListingCaseHarness, 'subject' | 'newUserId'>,
        Omit<ExtendTrialCaseHarness, 'subject'> {
    readonly subject: VerticalsForBilling;
}

type Group<THarness> = CaseRunner & { readonly makeHarness: () => Promise<THarness> };

const POLICY_A: PlanPolicyResponse = {
    graceDays: 7,
    allowsPause: true,
    current: true,
    sellable: true
};
const POLICY_B: PlanPolicyResponse = {
    graceDays: 0,
    allowsPause: false,
    current: false,
    sellable: false
};

/** Registers the `planPolicy` group. */
export function planPolicyCaseSet(args: Group<PlanPolicyCaseHarness>): void {
    const { describe, it, expect, makeHarness } = args;
    describe('billing-verticals contract: planPolicy (inverse case set)', () => {
        it('answers each plan version its own policy, with exactly its four fields', async () => {
            const h = await makeHarness();
            const a = await h.arrangePlanVersion({ policy: POLICY_A });
            const b = await h.arrangePlanVersion({ policy: POLICY_B });

            const answers = [await h.subject.planPolicy(a), await h.subject.planPolicy(b)];

            for (const answer of answers) {
                expectValid({
                    expect,
                    schema: PlanPolicyResponseSchema,
                    value: answer,
                    what: 'planPolicy'
                });
                expect(Object.keys(answer).sort(), 'no trial days, entitlements or limits').toEqual(
                    ['allowsPause', 'current', 'graceDays', 'sellable']
                );
            }
            expect(answers).toEqual([POLICY_A, POLICY_B]);
        });
    });
}

/** Registers the `changeDirection` group. */
export function changeDirectionCaseSet(args: Group<ChangeDirectionCaseHarness>): void {
    const { describe, it, expect, makeHarness } = args;
    describe('billing-verticals contract: changeDirection (inverse case set)', () => {
        it('answers DOWN when anything lowers, and UP when nothing does', async () => {
            const h = await makeHarness();
            const lowering = await h.arrangeChange({ lowersSomething: true });
            const raising = await h.arrangeChange({ lowersSomething: false });

            const down = await h.subject.changeDirection(lowering);
            const up = await h.subject.changeDirection(raising);

            expectValid({
                expect,
                schema: ChangeDirectionResponseSchema,
                value: down,
                what: 'changeDirection'
            });
            expectValid({
                expect,
                schema: ChangeDirectionResponseSchema,
                value: up,
                what: 'changeDirection'
            });
            expect(down.direction, 'any drop rules: downgrade').toBe('DOWN');
            expect(up.direction, 'nothing drops: upgrade').toBe('UP');
        });
    });
}

/** Registers the listing group: `listing`, `listingPurged` and the PURGED push. */
export function listingCaseSet(args: Group<ListingCaseHarness>): void {
    const { describe, it, expect, makeHarness } = args;
    describe('billing-verticals contract: listing and listingPurged (inverse case set)', () => {
        it('answers each listing its own vertical and owner', async () => {
            const h = await makeHarness();
            const ownerA = h.newUserId();
            const ownerB = h.newUserId();
            const a = await h.arrangeListing({
                vertical: VerticalEnum.ACCOMMODATION,
                ownerId: ownerA,
                state: 'PUBLISHED'
            });
            const b = await h.arrangeListing({
                vertical: VerticalEnum.GASTRONOMY,
                ownerId: ownerB,
                state: 'PUBLISHED'
            });

            const answerA = expectValid({
                expect,
                schema: ListingResponseSchema,
                value: await h.subject.listing(a),
                what: 'listing'
            });
            const answerB = expectValid({
                expect,
                schema: ListingResponseSchema,
                value: await h.subject.listing(b),
                what: 'listing'
            });

            expect([answerA.vertical, answerA.ownerId]).toEqual([
                VerticalEnum.ACCOMMODATION,
                ownerA
            ]);
            expect([answerB.vertical, answerB.ownerId]).toEqual([VerticalEnum.GASTRONOMY, ownerB]);
        });

        it('a published listing accepts a feature and a moderated one does not', async () => {
            const h = await makeHarness();
            const ownerId = h.newUserId();
            const vertical = VerticalEnum.ACCOMMODATION;
            const published = await h.arrangeListing({ vertical, ownerId, state: 'PUBLISHED' });
            const moderated = await h.arrangeListing({ vertical, ownerId, state: 'MODERATED' });

            expect((await h.subject.listing(published)).acceptsFeature).toBe(true);
            expect((await h.subject.listing(moderated)).acceptsFeature).toBe(false);
        });

        it('listingPurged: no for a live listing, yes once purged, yes for a row that never existed', async () => {
            const h = await makeHarness();
            const live = await h.arrangeListing({
                vertical: VerticalEnum.EXPERIENCE,
                ownerId: h.newUserId(),
                state: 'PUBLISHED'
            });

            const before = await h.subject.listingPurged(live);
            await h.purgeListing(live);
            const after = await h.subject.listingPurged(live);
            const missing = await h.subject.listingPurged({ listingId: h.unknownListingId() });

            for (const answer of [before, after, missing]) {
                expectValid({
                    expect,
                    schema: ListingPurgedResponseSchema,
                    value: answer,
                    what: 'listingPurged'
                });
            }
            expect([before.purged, after.purged, missing.purged]).toEqual([false, true, true]);
        });

        it('purging emits the push after the commit: a listener that re-reads sees it purged', async () => {
            const h = await makeHarness();
            const { listingId } = await h.arrangeListing({
                vertical: VerticalEnum.ACCOMMODATION,
                ownerId: h.newUserId(),
                state: 'PUBLISHED'
            });
            const pushes: unknown[] = [];
            const rereads: Promise<{ readonly purged: boolean }>[] = [];
            const unsubscribe = h.subject.onListingPurged((event) => {
                if (event.listingId !== listingId) return;
                pushes.push(event);
                rereads.push(h.subject.listingPurged({ listingId }));
            });

            await h.purgeListing({ listingId });
            unsubscribe();
            const seen = await Promise.all(rereads);

            expect(pushes, 'one push carrying only the listing id').toEqual([{ listingId }]);
            expect(
                seen.map((answer) => answer.purged),
                'the re-read sees PURGED'
            ).toEqual([true]);
        });
    });
}

const ADDON_FIXED: AddonPolicyResponse = {
    addonId: 'addon-feature',
    validity: 'FIXED_DAYS',
    validityDays: 30,
    scopeType: 'LISTING'
};
const ADDON_ALIVE: AddonPolicyResponse = {
    addonId: 'addon-photos',
    validity: 'WHILE_SUBSCRIPTION_ALIVE',
    validityDays: null,
    scopeType: 'VERTICAL_SUBSCRIPTION'
};

/** Registers the `addonPolicy` group. */
export function addonPolicyCaseSet(args: Group<AddonPolicyCaseHarness>): void {
    const { describe, it, expect, makeHarness } = args;
    describe('billing-verticals contract: addonPolicy (inverse case set)', () => {
        it('answers each addon version its own policy, never what it grants', async () => {
            const h = await makeHarness();
            const fixed = await h.arrangeAddonVersion({ policy: ADDON_FIXED });
            const alive = await h.arrangeAddonVersion({ policy: ADDON_ALIVE });

            const answers = [
                await h.subject.addonPolicy(fixed),
                await h.subject.addonPolicy(alive)
            ];

            for (const answer of answers) {
                expectValid({
                    expect,
                    schema: AddonPolicyResponseSchema,
                    value: answer,
                    what: 'addonPolicy'
                });
            }
            expect(answers).toEqual([ADDON_FIXED, ADDON_ALIVE]);
        });
    });
}

/** Registers the `extendTrial` group (AC:V4:8 (a)-(d), and the retry of contract §4.1). */
export function extendTrialCaseSet(args: Group<ExtendTrialCaseHarness>): void {
    const { describe, it, expect, makeHarness } = args;
    const vertical = VerticalEnum.ACCOMMODATION;
    describe('billing-verticals contract: extendTrial (inverse case set)', () => {
        it('with room under the ceiling: ACCEPTED, and the end moves by exactly the days', async () => {
            const h = await makeHarness();
            const who = { userId: h.newUserId(), vertical };
            await h.arrangeRunningTrial({ ...who, remainingExtensionDays: 10 });
            const before = await h.trialEndsAt(who);

            const answer = await h.subject.extendTrial({
                ...who,
                days: 5,
                redemptionKey: h.newRedemptionKey()
            });

            expectValid({
                expect,
                schema: ExtendTrialResponseSchema,
                value: answer,
                what: 'extendTrial'
            });
            expect(answer.outcome).toBe('ACCEPTED');
            expect((await h.trialEndsAt(who)).getTime() - before.getTime()).toBe(5 * DAY_MS);
        });

        it('an extension that does not fit: REJECTED whole, never truncated, and the end does not move', async () => {
            const h = await makeHarness();
            const who = { userId: h.newUserId(), vertical };
            await h.arrangeRunningTrial({ ...who, remainingExtensionDays: 2 });
            const before = await h.trialEndsAt(who);

            const answer = await h.subject.extendTrial({
                ...who,
                days: 5,
                redemptionKey: h.newRedemptionKey()
            });

            expectValid({
                expect,
                schema: ExtendTrialResponseSchema,
                value: answer,
                what: 'extendTrial'
            });
            expect(answer.outcome).toBe('REJECTED');
            expect((await h.trialEndsAt(who)).getTime()).toBe(before.getTime());
        });

        it('a retry with the same redemption key: ACCEPTED again, without extending twice', async () => {
            const h = await makeHarness();
            const who = { userId: h.newUserId(), vertical };
            await h.arrangeRunningTrial({ ...who, remainingExtensionDays: 10 });
            const before = await h.trialEndsAt(who);
            const call = { ...who, days: 3, redemptionKey: h.newRedemptionKey() };

            const first = await h.subject.extendTrial(call);
            const retry = await h.subject.extendTrial(call);

            expect([first.outcome, retry.outcome]).toEqual(['ACCEPTED', 'ACCEPTED']);
            expect((await h.trialEndsAt(who)).getTime() - before.getTime()).toBe(3 * DAY_MS);
        });

        it('a trial whose end already passed: REJECTED', async () => {
            const h = await makeHarness();
            const who = { userId: h.newUserId(), vertical };
            await h.arrangeEndedTrial(who);

            const answer = await h.subject.extendTrial({
                ...who,
                days: 1,
                redemptionKey: h.newRedemptionKey()
            });

            expect(answer.outcome).toBe('REJECTED');
        });
    });
}

/**
 * Registers the whole inverse case set: the five groups, over one harness.
 *
 * @param args.describe - The runner's `describe`
 * @param args.it - The runner's `it`
 * @param args.expect - The runner's `expect`
 * @param args.makeHarness - Builds a fresh harness for one case
 */
export function inverseCaseSet(args: Group<InverseCaseHarness>): void {
    planPolicyCaseSet(args);
    changeDirectionCaseSet(args);
    listingCaseSet(args);
    addonPolicyCaseSet(args);
    extendTrialCaseSet(args);
}
