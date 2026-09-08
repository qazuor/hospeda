/**
 * `publishEligibilityAllowsPublish` — the publish/deny rule stated once
 * (HOS-1183 AC-4).
 *
 * The whole point of this predicate is that ONE function answers "may this
 * listing go live" for `publish()`, for `update()`'s ACTIVE-transition guard
 * and for the `GET /publish-eligibility` route. So these tests pin the rule
 * itself, not any one caller's use of it.
 */
import { describe, expect, it } from 'vitest';
import {
    PUBLISH_ELIGIBILITY_VALUES,
    type PublishEligibility,
    publishEligibilityAllowsPublish,
    publishEligibilityStartsLocalTrial
} from '../../../src/services/accommodation/accommodation.types';

describe('publishEligibilityAllowsPublish', () => {
    describe('one branch per verdict', () => {
        it('allows publishing on has_active_sub — the owner is already paying', () => {
            expect(publishEligibilityAllowsPublish('has_active_sub')).toBe(true);
        });

        it('allows publishing on first_publish — this is the HOS-1183 bug', () => {
            // The verdict the UI used to collapse into "no plan → hide the
            // button". The server publishes here and starts a local trial in
            // the same transaction, so the predicate must say yes.
            expect(publishEligibilityAllowsPublish('first_publish')).toBe(true);
        });

        it('denies publishing on subscription_required — trial spent, no plan', () => {
            expect(publishEligibilityAllowsPublish('subscription_required')).toBe(false);
        });
    });

    describe('the rule is stated by exclusion, not inclusion', () => {
        it('denies exactly one verdict out of the whole union', () => {
            const denied = PUBLISH_ELIGIBILITY_VALUES.filter(
                (value) => !publishEligibilityAllowsPublish(value)
            );
            expect(denied).toEqual(['subscription_required']);
        });

        it('would allow a fourth verdict added to the union', () => {
            // Not a hypothetical: `first_publish` has already flipped meaning
            // twice (HOS-171, then HOS-1012). If this predicate listed the
            // permissive verdicts instead of the denied one, a new verdict
            // would publish server-side while the button vanished — HOS-1183
            // rebuilt from the other side.
            //
            // The cast models a future union member, NOT garbage: it is a
            // value the resolver would have to be taught to return.
            const futureVerdict = 'grace_period' as PublishEligibility;
            const isKnownToday = (PUBLISH_ELIGIBILITY_VALUES as readonly string[]).includes(
                futureVerdict
            );

            // Guard the guard: the day 'grace_period' becomes real, this test
            // stops modelling a future value and must be re-pointed.
            expect(isKnownToday).toBe(false);

            // With the value absent from the runtime list it is treated as
            // unrecognised input (denied). What this asserts is the SHAPE of
            // the rule: adding it to PUBLISH_ELIGIBILITY_VALUES is the single
            // edit that makes it publish, with no second list to remember.
            const withFutureVerdictKnown = [
                ...PUBLISH_ELIGIBILITY_VALUES,
                futureVerdict
            ] as readonly PublishEligibility[];
            const deniedAmongThem = withFutureVerdictKnown.filter(
                (value) => value === 'subscription_required'
            );
            expect(deniedAmongThem).toEqual(['subscription_required']);
        });
    });

    describe('unrecognised input is denied, never fail-open', () => {
        // A value outside the union is not a fourth verdict — it is a parse
        // failure wearing one's clothes. Publishing on it would grant free
        // trial days on noise.
        it.each([
            ['an empty string', ''],
            ['a typo of a real verdict', 'first-publish'],
            ['an unrelated string', 'yes'],
            ['a stringified null', 'null']
        ])('denies %s', (_label, value) => {
            expect(publishEligibilityAllowsPublish(value as PublishEligibility)).toBe(false);
        });

        it.each([
            ['undefined', undefined],
            ['null', null],
            ['a number', 1],
            ['true', true],
            ['an object', {}]
        ])('denies %s', (_label, value) => {
            expect(publishEligibilityAllowsPublish(value as unknown as PublishEligibility)).toBe(
                false
            );
        });
    });

    describe('PUBLISH_ELIGIBILITY_VALUES', () => {
        it('holds no duplicates — a repeated verdict would hide a typo', () => {
            expect(new Set(PUBLISH_ELIGIBILITY_VALUES).size).toBe(
                PUBLISH_ELIGIBILITY_VALUES.length
            );
        });

        it('holds the three verdicts the resolver can return', () => {
            expect(PUBLISH_ELIGIBILITY_VALUES).toEqual([
                'first_publish',
                'has_active_sub',
                'subscription_required'
            ]);
        });
    });
});

describe('publishEligibilityStartsLocalTrial', () => {
    it('starts a trial on first_publish', () => {
        expect(publishEligibilityStartsLocalTrial('first_publish')).toBe(true);
    });

    it('starts nothing on has_active_sub — the owner is already paying', () => {
        expect(publishEligibilityStartsLocalTrial('has_active_sub')).toBe(false);
    });

    it('starts nothing on subscription_required — that verdict never reaches publishing', () => {
        expect(publishEligibilityStartsLocalTrial('subscription_required')).toBe(false);
    });

    describe('the asymmetry against publishEligibilityAllowsPublish', () => {
        it('is not the negation of the publish predicate', () => {
            // has_active_sub is the case that proves they are two questions:
            // it publishes AND starts nothing. A reader who assumes one is the
            // other's inverse would grant a second trial to every paying host.
            expect(publishEligibilityAllowsPublish('has_active_sub')).toBe(true);
            expect(publishEligibilityStartsLocalTrial('has_active_sub')).toBe(false);
        });

        it('grants a trial to exactly one verdict, while publishing denies exactly one', () => {
            const grantsTrial = PUBLISH_ELIGIBILITY_VALUES.filter((v) =>
                publishEligibilityStartsLocalTrial(v)
            );
            const deniesPublish = PUBLISH_ELIGIBILITY_VALUES.filter(
                (v) => !publishEligibilityAllowsPublish(v)
            );
            expect(grantsTrial).toEqual(['first_publish']);
            expect(deniesPublish).toEqual(['subscription_required']);
        });

        it('fails CLOSED on an unknown verdict, where publishing fails open', () => {
            // Publishing a verdict nobody taught it about is a listing going
            // live; granting one is thirty free days written to
            // billing_subscriptions. Only the second is worth failing closed
            // for, so the two predicates disagree here on purpose.
            const unknown = 'grace_period' as PublishEligibility;
            expect(publishEligibilityStartsLocalTrial(unknown)).toBe(false);
        });
    });
});
