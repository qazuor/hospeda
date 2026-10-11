import {
    type CoverageResponse,
    CoverageResponseSchema,
    type CoverageSource
} from '@repo/billing-verticals-contract';
import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { consumeTrialInTransaction, evaluateTrialConsume } from '../../src/trial/trial-consume';
import { InvalidTrialMachineInputError } from '../../src/trial/trial-machine-types';
import type { TrialConsumeTransaction } from '../../src/trial/trial-start-types';

const userId = '11111111-1111-4111-8111-111111111111';
const vertical = VerticalEnum.ACCOMMODATION;
const emailPseudonym = 'a'.repeat(64);
const at = new Date('2026-10-10T12:00:00.000Z');

function source(
    type: CoverageSource['type'],
    options: { readonly charged?: boolean; readonly notStarted?: boolean } = {}
): CoverageSource {
    const notStarted = options.notStarted ?? false;
    return {
        type,
        reference:
            type === 'ADDON'
                ? { kind: 'ADDON_VERSION', addonVersionId: 'addon-1' }
                : { kind: 'PLAN_VERSION', planVersionId: 'plan-1' },
        scope: 'VERTICAL',
        target: null,
        since: notStarted ? 'NOT_STARTED' : at,
        until: notStarted
            ? 'NOT_STARTED'
            : type === 'GRANT' || type === 'BASE'
              ? 'NEVER_EXPIRES'
              : type === 'SUBSCRIPTION' || type === 'ADDON'
                ? 'NO_KNOWN_DATE'
                : new Date('2026-11-10T12:00:00.000Z'),
        charged: type === 'SUBSCRIPTION' ? (options.charged ?? false) : null,
        floor: type === 'GRANT' ? 'floor-1' : null
    };
}

function coverage(...sources: CoverageSource[]): CoverageResponse {
    return CoverageResponseSchema.parse({
        covered: sources.some(
            (candidate) =>
                candidate.type !== 'ADDON' &&
                candidate.type !== 'BASE' &&
                candidate.until !== 'NOT_STARTED'
        ),
        sources
    });
}

function createTx(
    options: {
        readonly declaredEvent?: 'listing_published' | 'start_button_pressed' | null;
        readonly trialDays?: number | null;
        readonly userHasTrial?: boolean;
        readonly pseudonymUsed?: boolean;
        readonly conflict?: 'USER_VERTICAL' | 'EMAIL_PSEUDONYM';
    } = {}
) {
    const reads = { activation: 0, plan: 0, user: 0, pseudonym: 0, insert: 0 };
    const insertedRows: unknown[] = [];
    const tx: TrialConsumeTransaction = {
        async findActivationEvent() {
            reads.activation += 1;
            return options.declaredEvent === undefined
                ? 'listing_published'
                : options.declaredEvent;
        },
        async findTrialPlan() {
            reads.plan += 1;
            return options.trialDays === null
                ? null
                : {
                      planId: 'plan-1',
                      planVersionId: 'version-1',
                      trialDays: options.trialDays ?? 14
                  };
        },
        async findTrialOfUser() {
            reads.user += 1;
            return options.userHasTrial ? { id: 'existing' } : null;
        },
        async findTrialByPseudonym() {
            reads.pseudonym += 1;
            return options.pseudonymUsed ? { userId: 'other-user' } : null;
        },
        async insertTrial({ row }) {
            reads.insert += 1;
            insertedRows.push(row);
            return options.conflict
                ? { inserted: false, conflict: options.conflict }
                : { inserted: true };
        }
    };
    return { tx, reads, insertedRows };
}

const input = {
    userId,
    vertical,
    emailPseudonym,
    expectedEvent: 'listing_published' as const
};

describe('AC:V4:10 (unitaria) - shared T6/T8 guards', () => {
    it('does not read any port when the only subscription is unpaid', async () => {
        const fixture = createTx();
        const result = await consumeTrialInTransaction({
            tx: fixture.tx,
            coverage: coverage(source('SUBSCRIPTION', { charged: false })),
            input
        });
        expect([result, fixture.reads, fixture.insertedRows]).toEqual([
            { consumed: false, reason: 'NO_CONVERTING_TITLE' },
            { activation: 0, plan: 0, user: 0, pseudonym: 0, insert: 0 },
            []
        ]);
    });

    it('writes the exact consumed row for a paid subscription', async () => {
        const fixture = createTx();
        const result = await consumeTrialInTransaction({
            tx: fixture.tx,
            coverage: coverage(source('SUBSCRIPTION', { charged: true })),
            input
        });
        const expectedRow = {
            userId,
            vertical,
            status: 'TRIAL_CONVERTED',
            emailPseudonym,
            trialPlanId: null,
            floorEntitlementsVersionId: null,
            floorLimitsVersionId: null,
            floorTrialPlanVersionId: null,
            startedAt: null,
            endsAt: null,
            deadlinesVersion: null
        };
        expect([result, fixture.insertedRows]).toEqual([
            { consumed: true, row: expectedRow },
            [expectedRow]
        ]);
    });

    it.each([source('COURTESY'), source('GRANT')])('consumes a %s title', async (title) => {
        const fixture = createTx();
        expect(
            await consumeTrialInTransaction({ tx: fixture.tx, coverage: coverage(title), input })
        ).toMatchObject({ consumed: true });
    });

    it('does not treat a live trial or BASE as a converting title', async () => {
        const result = await evaluateTrialConsume({
            reader: createTx().tx,
            coverage: coverage(source('TRIAL'), source('BASE')),
            input
        });
        expect(result).toEqual({ consumes: false, reason: 'NO_CONVERTING_TITLE' });
    });

    it('does not treat a not-started pre-trial source or BASE as a title', async () => {
        const result = await evaluateTrialConsume({
            reader: createTx().tx,
            coverage: coverage(source('TRIAL', { notStarted: true }), source('BASE')),
            input
        });
        expect(result).toEqual({ consumes: false, reason: 'NO_CONVERTING_TITLE' });
    });

    it('finds a paid subscription after ADDON and TRIAL sources', async () => {
        const fixture = createTx();
        const result = await consumeTrialInTransaction({
            tx: fixture.tx,
            coverage: coverage(
                source('ADDON'),
                source('TRIAL'),
                source('SUBSCRIPTION', { charged: true })
            ),
            input
        });
        expect(result).toMatchObject({ consumed: true });
    });

    it('declines when the vertical has no declared activation event', async () => {
        const fixture = createTx({ declaredEvent: null });
        expect(
            await evaluateTrialConsume({
                reader: fixture.tx,
                coverage: coverage(source('COURTESY')),
                input
            })
        ).toEqual({ consumes: false, reason: 'EVENT_NOT_DECLARED_BY_VERTICAL' });
    });

    it('declines when the expected event differs from the declared event', async () => {
        const fixture = createTx();
        expect(
            await evaluateTrialConsume({
                reader: fixture.tx,
                coverage: coverage(source('COURTESY')),
                input: { ...input, expectedEvent: 'start_button_pressed' }
            })
        ).toEqual({ consumes: false, reason: 'EVENT_NOT_DECLARED_BY_VERTICAL' });
    });

    it('allows a null expected event when the vertical declares one', async () => {
        const fixture = createTx();
        expect(
            await evaluateTrialConsume({
                reader: fixture.tx,
                coverage: coverage(source('COURTESY')),
                input: { ...input, expectedEvent: null }
            })
        ).toEqual({ consumes: true });
    });

    it.each([0, null])('declines when the trial plan days are %s', async (trialDays) => {
        const fixture = createTx({ trialDays });
        expect(
            await evaluateTrialConsume({
                reader: fixture.tx,
                coverage: coverage(source('COURTESY')),
                input
            })
        ).toEqual({ consumes: false, reason: 'TRIAL_DAYS_NOT_POSITIVE' });
    });

    it('returns the user row guard before the pseudonym guard', async () => {
        const fixture = createTx({ userHasTrial: true, pseudonymUsed: true });
        const result = await evaluateTrialConsume({
            reader: fixture.tx,
            coverage: coverage(source('COURTESY')),
            input
        });
        expect([result, fixture.reads.pseudonym]).toEqual([
            { consumes: false, reason: 'USER_ALREADY_HAS_TRIAL_ROW' },
            0
        ]);
    });

    it('declines when another user already owns the pseudonym', async () => {
        const fixture = createTx({ pseudonymUsed: true });
        expect(
            await evaluateTrialConsume({
                reader: fixture.tx,
                coverage: coverage(source('COURTESY')),
                input
            })
        ).toEqual({ consumes: false, reason: 'EMAIL_PSEUDONYM_ALREADY_USED' });
    });

    it.each([
        ['USER_VERTICAL', 'USER_ALREADY_HAS_TRIAL_ROW'],
        ['EMAIL_PSEUDONYM', 'EMAIL_PSEUDONYM_ALREADY_USED']
    ] as const)('maps insert conflict %s without throwing', async (conflict, reason) => {
        const fixture = createTx({ conflict });
        await expect(
            consumeTrialInTransaction({
                tx: fixture.tx,
                coverage: coverage(source('COURTESY')),
                input
            })
        ).resolves.toEqual({ consumed: false, reason });
    });

    it('rejects an invalid user id with the non-sensitive machine error', async () => {
        const fixture = createTx();
        await expect(
            consumeTrialInTransaction({
                tx: fixture.tx,
                coverage: coverage(source('COURTESY')),
                input: { ...input, userId: '' }
            })
        ).rejects.toMatchObject({
            name: InvalidTrialMachineInputError.name,
            field: 'userId'
        });
    });

    it('rejects a bad pseudonym only after a converting title without exposing it', async () => {
        const fixture = createTx();
        const invalidPseudonym = 'private-invalid-value';
        let error: unknown;
        try {
            await consumeTrialInTransaction({
                tx: fixture.tx,
                coverage: coverage(source('COURTESY')),
                input: { ...input, emailPseudonym: invalidPseudonym }
            });
        } catch (caught) {
            error = caught;
        }
        expect(error).toMatchObject({
            name: InvalidTrialMachineInputError.name,
            field: 'emailPseudonym'
        });
        expect(String(error)).not.toContain(invalidPseudonym);
    });

    it('does not validate a bad pseudonym when there is no converting title', async () => {
        const fixture = createTx();
        await expect(
            consumeTrialInTransaction({
                tx: fixture.tx,
                coverage: coverage(source('SUBSCRIPTION', { charged: false })),
                input: { ...input, emailPseudonym: 'invalid' }
            })
        ).resolves.toEqual({ consumed: false, reason: 'NO_CONVERTING_TITLE' });
    });
});
