/**
 * TEST:V1:9 (AC:V1:6, items 1 to 3): every response, argument and event of the
 * contract has its schema; a response that does not validate is not delivered;
 * the simulators of both interfaces are programmable.
 */
import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import {
    AddonPolicyArgsSchema,
    AddonPolicyResponseSchema,
    type BillingForVerticals,
    CanChargeArgsSchema,
    CanChargeResponseSchema,
    ChangeDirectionArgsSchema,
    ChangeDirectionResponseSchema,
    ContractValidationError,
    CoverageArgsSchema,
    CoverageChangedEventSchema,
    type CoverageResponse,
    CoverageResponseSchema,
    type CoverageSource,
    ExtendTrialArgsSchema,
    ExtendTrialResponseSchema,
    ListingArgsSchema,
    ListingPurgedEventSchema,
    ListingPurgedResponseSchema,
    ListingResponseSchema,
    PlanPolicyArgsSchema,
    type PlanPolicyResponse,
    PlanPolicyResponseSchema,
    RetentionStoppedArgsSchema,
    RetentionStoppedResponseSchema,
    type VerticalsForBilling
} from '../src/index';
import {
    BillingForVerticalsSimulator,
    SimulatorNotProgrammedError,
    VerticalsForBillingSimulator
} from '../src/testing/index';
import {
    BASE_SOURCE,
    FIXED_CLOCK,
    GRANT_SOURCE,
    LISTING_ADDON_SOURCE,
    PRE_TRIAL_RESPONSE,
    PRE_TRIAL_SOURCE,
    RUNNING_TRIAL_RESPONSE,
    RUNNING_TRIAL_SOURCE,
    SUBSCRIPTION_SOURCE
} from './fixtures';

const who = { userId: 'user-1', vertical: VerticalEnum.ACCOMMODATION };

/** Every query of each interface, with its argument and response schemas. */
const QUERY_SCHEMAS = {
    coverage: [CoverageArgsSchema, CoverageResponseSchema],
    retentionStopped: [RetentionStoppedArgsSchema, RetentionStoppedResponseSchema],
    canCharge: [CanChargeArgsSchema, CanChargeResponseSchema],
    planPolicy: [PlanPolicyArgsSchema, PlanPolicyResponseSchema],
    changeDirection: [ChangeDirectionArgsSchema, ChangeDirectionResponseSchema],
    listingPurged: [ListingArgsSchema, ListingPurgedResponseSchema],
    listing: [ListingArgsSchema, ListingResponseSchema],
    addonPolicy: [AddonPolicyArgsSchema, AddonPolicyResponseSchema],
    extendTrial: [ExtendTrialArgsSchema, ExtendTrialResponseSchema]
} as const satisfies Record<
    Exclude<keyof BillingForVerticals | keyof VerticalsForBilling, `on${string}`>,
    readonly [z.ZodType, z.ZodType]
>;

/** Every event of each interface, with its schema. */
const EVENT_SCHEMAS = {
    onCoverageChanged: CoverageChangedEventSchema,
    onListingPurged: ListingPurgedEventSchema
} as const satisfies Record<
    Extract<keyof BillingForVerticals | keyof VerticalsForBilling, `on${string}`>,
    z.ZodType
>;

/** The method names of both simulators, i.e. of both interfaces. */
function interfaceMethods(): readonly string[] {
    const billing = Object.getOwnPropertyNames(BillingForVerticalsSimulator.prototype);
    const verticals = Object.getOwnPropertyNames(VerticalsForBillingSimulator.prototype);
    const programming = /^(constructor|calls|set[A-Z]\w*|emit\w+|purgeListing|trialEndsAt)$/;
    return [...billing, ...verticals].filter((name) => !programming.test(name)).sort();
}

const coverageOf = (sources: readonly CoverageSource[], covered: boolean) =>
    CoverageResponseSchema.safeParse({ covered, sources }).success;

describe('TEST:V1:9 every response, argument and event has its schema', () => {
    it('maps every entry of both interfaces to its schemas, and nothing else', () => {
        expect([...Object.keys(QUERY_SCHEMAS), ...Object.keys(EVENT_SCHEMAS)].sort()).toEqual(
            interfaceMethods()
        );
    });

    it('coverage: accepts the six source types in their allowed shapes', () => {
        expect(coverageOf([PRE_TRIAL_SOURCE, BASE_SOURCE], false)).toBe(true);
        expect(coverageOf([RUNNING_TRIAL_SOURCE, BASE_SOURCE], true)).toBe(true);
        expect(coverageOf([SUBSCRIPTION_SOURCE, LISTING_ADDON_SOURCE, BASE_SOURCE], true)).toBe(
            true
        );
        expect(coverageOf([GRANT_SOURCE], true)).toBe(true);
        expect(
            coverageOf(
                [{ ...SUBSCRIPTION_SOURCE, type: 'COURTESY', until: new Date(), charged: null }],
                true
            )
        ).toBe(true);
    });

    it.each([
        [
            'covered derived wrong: PRE_TRIAL answered as covered',
            [PRE_TRIAL_SOURCE, BASE_SOURCE],
            true
        ],
        [
            'covered derived wrong: a running trial answered as not covered',
            [RUNNING_TRIAL_SOURCE],
            false
        ],
        [
            'an addon alone answered as covered (a COMPLEMENT is not a TITLE)',
            [LISTING_ADDON_SOURCE],
            true
        ],
        [
            'two SUBSCRIPTION sources of class TITLE',
            [SUBSCRIPTION_SOURCE, SUBSCRIPTION_SOURCE],
            true
        ],
        ['a null reference', [{ ...BASE_SOURCE, reference: null }], false],
        [
            'an ADDON pointing at a plan version',
            [{ ...LISTING_ADDON_SOURCE, reference: BASE_SOURCE.reference }],
            false
        ],
        ['a LISTING scope without its target', [{ ...LISTING_ADDON_SOURCE, target: null }], false],
        ['a target outside LISTING', [{ ...BASE_SOURCE, target: 'listing-1' }], false],
        [
            'a non-ADDON source with a scope other than VERTICAL',
            [{ ...BASE_SOURCE, scope: 'USER' }],
            false
        ],
        ['charged on a non-SUBSCRIPTION source', [{ ...BASE_SOURCE, charged: true }], false],
        ['a SUBSCRIPTION without charged', [{ ...SUBSCRIPTION_SOURCE, charged: null }], true],
        ['floor on a non-GRANT source', [{ ...BASE_SOURCE, floor: 'pv-1' }], false],
        ['a GRANT without its floor', [{ ...GRANT_SOURCE, floor: null }], true],
        [
            'until NOT_STARTED with a since instant',
            [{ ...PRE_TRIAL_SOURCE, since: new Date() }],
            false
        ],
        [
            'a SUBSCRIPTION with until NOT_STARTED (§2.4 impossible)',
            [{ ...SUBSCRIPTION_SOURCE, since: 'NOT_STARTED', until: 'NOT_STARTED' }],
            false
        ],
        [
            'a TRIAL with until NEVER_EXPIRES (§2.4 impossible)',
            [{ ...RUNNING_TRIAL_SOURCE, until: 'NEVER_EXPIRES' }],
            true
        ],
        ['an unknown field', [{ ...BASE_SOURCE, values: { photos: 5 } }], false],
        ['an invalid instant', [{ ...BASE_SOURCE, since: new Date('not a date') }], false]
    ] as const)('coverage: rejects %s', (_case, sources, covered) => {
        expect(CoverageResponseSchema.safeParse({ covered, sources }).success).toBe(false);
    });

    it('rejects a coverage argument without its vertical: the vertical is mandatory', () => {
        expect(CoverageArgsSchema.safeParse({ userId: 'user-1' }).success).toBe(false);
        expect(CoverageArgsSchema.safeParse({ userId: 'user-1', vertical: 'boats' }).success).toBe(
            false
        );
    });

    it('planPolicy carries exactly its four fields: no trial days, entitlements or limits', () => {
        const policy: PlanPolicyResponse = {
            graceDays: 7,
            allowsPause: true,
            current: true,
            sellable: true
        };
        expect(PlanPolicyResponseSchema.safeParse(policy).success).toBe(true);
        expect(PlanPolicyResponseSchema.safeParse({ ...policy, trialDays: 30 }).success).toBe(
            false
        );
        expect(PlanPolicyResponseSchema.safeParse({ ...policy, graceDays: -1 }).success).toBe(
            false
        );
    });

    it('the remaining schemas reject a malformed value', () => {
        expect(RetentionStoppedResponseSchema.safeParse({ stopped: true }).success).toBe(false);
        expect(CanChargeResponseSchema.safeParse({ canCharge: 'yes' }).success).toBe(false);
        expect(ChangeDirectionResponseSchema.safeParse({ direction: 'SIDEWAYS' }).success).toBe(
            false
        );
        expect(
            ListingResponseSchema.safeParse({ vertical: 'accommodation', ownerId: '' }).success
        ).toBe(false);
        expect(
            AddonPolicyResponseSchema.safeParse({
                addonId: 'a',
                validity: 'FIXED_DAYS',
                validityDays: null,
                scopeType: 'LISTING'
            }).success
        ).toBe(false);
        expect(
            ExtendTrialArgsSchema.safeParse({ ...who, days: 0, redemptionKey: 'k' }).success
        ).toBe(false);
        expect(ExtendTrialResponseSchema.safeParse({ outcome: 'REJECTED' }).success).toBe(false);
        expect(CoverageChangedEventSchema.safeParse({ ...who, sourceType: 'TRIAL' }).success).toBe(
            false
        );
        expect(ListingPurgedEventSchema.safeParse({ listingId: 'l', vertical: 'x' }).success).toBe(
            false
        );
    });
});

describe('TEST:V1:9 a value that does not validate is not delivered', () => {
    it('the billing simulator rejects a programmed coverage answer that does not validate', async () => {
        // Arrange: PRE_TRIAL answered as covered, which the schema refuses
        const billing = new BillingForVerticalsSimulator();
        const invalid: CoverageResponse = { ...PRE_TRIAL_RESPONSE, covered: true };
        billing.setCoverage({ ...who, response: invalid });

        // Act / Assert
        const error = await billing.coverage(who).catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(ContractValidationError);
        expect(error).toMatchObject({ operation: 'coverage', kind: 'response' });
    });

    it('the verticals simulator rejects a programmed policy that does not validate', async () => {
        const verticals = new VerticalsForBillingSimulator({ clock: FIXED_CLOCK });
        verticals.setPlanPolicy({
            planVersionId: 'pv-1',
            policy: { graceDays: 1.5, allowsPause: true, current: true, sellable: true }
        });

        await expect(verticals.planPolicy({ planVersionId: 'pv-1' })).rejects.toMatchObject({
            name: 'ContractValidationError',
            operation: 'planPolicy',
            kind: 'response'
        });
    });

    it('rejects an argument that does not validate, before the implementation runs', async () => {
        const billing = new BillingForVerticalsSimulator();

        await expect(
            billing.coverage({ userId: '', vertical: VerticalEnum.ACCOMMODATION })
        ).rejects.toMatchObject({ kind: 'argument' });
        expect(billing.calls).toEqual([]);
    });

    it('does not deliver an event that does not validate to the listener', async () => {
        // Arrange
        const verticals = new VerticalsForBillingSimulator({ clock: FIXED_CLOCK });
        const listener = vi.fn();
        verticals.onListingPurged(listener);

        // Act
        const error = await verticals
            .emitListingPurged({ event: { listingId: '' } })
            .catch((caught: unknown) => caught);

        // Assert
        expect(error).toBeInstanceOf(ContractValidationError);
        expect(listener).not.toHaveBeenCalled();
    });
});

describe('TEST:V1:9 the simulators are programmable', () => {
    it('billing: answers what was programmed, the bootstrap answers otherwise, and records the calls', async () => {
        // Arrange
        const billing = new BillingForVerticalsSimulator();
        billing.setCoverage({ ...who, response: RUNNING_TRIAL_RESPONSE });
        billing.setRetentionStopped({
            ...who,
            response: { stopped: true, pauseEndedAt: null, coverageLostAt: new Date(0) }
        });
        billing.setCanCharge({ userId: who.userId, response: { canCharge: true } });
        const other = { userId: 'user-2', vertical: VerticalEnum.GASTRONOMY };

        // Act / Assert
        expect(await billing.coverage(who)).toEqual(RUNNING_TRIAL_RESPONSE);
        expect((await billing.retentionStopped(who)).stopped).toBe(true);
        expect(await billing.canCharge({ userId: who.userId })).toEqual({ canCharge: true });
        expect(await billing.coverage(other)).toEqual({ covered: false, sources: [] });
        expect(await billing.retentionStopped(other)).toEqual({
            stopped: false,
            pauseEndedAt: null,
            coverageLostAt: null
        });
        expect(await billing.canCharge({ userId: other.userId })).toEqual({ canCharge: false });
        expect(billing.calls.map((call) => call.operation)).toEqual([
            'coverage',
            'retentionStopped',
            'canCharge',
            'coverage',
            'retentionStopped',
            'canCharge'
        ]);
    });

    it('billing: delivers the coverage-changed notice to its listeners until they unsubscribe', async () => {
        const billing = new BillingForVerticalsSimulator();
        const listener = vi.fn();
        const unsubscribe = billing.onCoverageChanged(listener);
        const event = { ...who, sourceType: 'TRIAL', change: 'ADDED' } as const;

        await billing.emitCoverageChanged({ event });
        unsubscribe();
        await billing.emitCoverageChanged({ event });

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(event);
    });

    it('verticals: answers what was programmed, and refuses what was not', async () => {
        // Arrange
        const verticals = new VerticalsForBillingSimulator({ clock: FIXED_CLOCK });
        const listing = {
            vertical: VerticalEnum.EXPERIENCE,
            ownerId: 'owner-1',
            acceptsFeature: true
        };
        verticals.setListing({ listingId: 'listing-1', listing });
        verticals.setChangeDirection({
            fromPlanVersionId: 'pv-a',
            toPlanVersionId: 'pv-b',
            direction: 'DOWN'
        });

        // Act / Assert
        expect(await verticals.listing({ listingId: 'listing-1' })).toEqual(listing);
        expect(
            await verticals.changeDirection({ fromPlanVersionId: 'pv-a', toPlanVersionId: 'pv-b' })
        ).toEqual({ direction: 'DOWN' });
        await expect(
            verticals.changeDirection({ fromPlanVersionId: 'pv-b', toPlanVersionId: 'pv-a' })
        ).rejects.toBeInstanceOf(SimulatorNotProgrammedError);
        await expect(verticals.addonPolicy({ addonVersionId: 'av-x' })).rejects.toBeInstanceOf(
            SimulatorNotProgrammedError
        );
        expect(await verticals.listingPurged({ listingId: 'never-written' })).toEqual({
            purged: true
        });
    });
});
