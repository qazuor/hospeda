import type { CoverageSource } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum, TrialStatusEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { publishListing } from '../../src/publication/publish-listing';
import { InvalidTrialMachineInputError } from '../../src/trial/trial-machine-types';
import {
    at,
    clock,
    emailPseudonym,
    event,
    listingId,
    makeHarness,
    userId,
    vertical
} from './support';

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
                : { kind: 'PLAN_VERSION', planVersionId: listingId },
        scope: 'VERTICAL',
        target: null,
        since: notStarted ? 'NOT_STARTED' : at,
        until: notStarted
            ? 'NOT_STARTED'
            : type === 'BASE' || type === 'GRANT'
              ? 'NEVER_EXPIRES'
              : type === 'SUBSCRIPTION' || type === 'ADDON'
                ? 'NO_KNOWN_DATE'
                : new Date('2026-11-10T12:00:00.000Z'),
        charged: type === 'SUBSCRIPTION' ? (options.charged ?? false) : null,
        floor: type === 'GRANT' ? listingId : null
    };
}

function input(harness: ReturnType<typeof makeHarness>, email = emailPseudonym) {
    return {
        ...harness,
        clock,
        userId,
        vertical,
        listingId,
        event,
        emailPseudonym: email,
        correlationId: listingId
    };
}

const consumedRow = {
    userId,
    vertical,
    status: TrialStatusEnum.TRIAL_CONVERTED,
    emailPseudonym,
    trialPlanId: null,
    floorEntitlementsVersionId: null,
    floorLimitsVersionId: null,
    floorTrialPlanVersionId: null,
    startedAt: null,
    endsAt: null,
    deadlinesVersion: null
};

describe('AC:V4:10 (unitaria) - T6 inside PB1', () => {
    it('publishes an unpaid covered subscription without starting or consuming a trial', async () => {
        const harness = makeHarness({ sources: [source('SUBSCRIPTION', { charged: false })] });
        const result = await publishListing(input(harness));
        expect([
            result,
            harness.insertedRows,
            harness.calls.filter((call) =>
                ['trial', 'consumedTrial', 'coverageNotice'].includes(call)
            )
        ]).toEqual([
            { published: true, trialStarted: false, trialConsumed: false, warnings: [] },
            [],
            []
        ]);
    });

    it('consumes on a paid subscription before publication and notifies after commit', async () => {
        const harness = makeHarness({ sources: [source('SUBSCRIPTION', { charged: true })] });
        const result = await publishListing(input(harness));
        expect([result, harness.insertedRows, harness.calls]).toEqual([
            { published: true, trialStarted: false, trialConsumed: true, warnings: [] },
            [consumedRow],
            [
                'lock',
                'read',
                'consumedTrial',
                'set',
                'event',
                'commit',
                'coverageNotice',
                'invalidate',
                'revalidate'
            ]
        ]);
        expect(harness.afterCommit.emitCoverageChanged).toHaveBeenCalledExactlyOnceWith({
            userId,
            vertical,
            sourceType: 'TRIAL',
            change: 'REMOVED'
        });
        expect(harness.calls.indexOf('coverageNotice')).toBeGreaterThan(
            harness.calls.indexOf('commit')
        );
        expect(harness.calls).not.toContain('campaign');
    });

    it.each([source('COURTESY'), source('GRANT')])('consumes a covered %s title', async (title) => {
        const harness = makeHarness({ sources: [title] });
        const result = await publishListing(input(harness));
        expect([result, harness.insertedRows]).toEqual([
            expect.objectContaining({ published: true, trialConsumed: true }),
            [consumedRow]
        ]);
    });

    it('starts T1 when uncovered and keeps trialConsumed false', async () => {
        const harness = makeHarness({ covered: false, sources: [] });
        const result = await publishListing(input(harness));
        expect([result, harness.calls, harness.insertedRows]).toEqual([
            expect.objectContaining({ published: true, trialStarted: true, trialConsumed: false }),
            expect.arrayContaining(['trial', 'campaign']),
            [expect.objectContaining({ status: TrialStatusEnum.TRIAL_ACTIVE })]
        ]);
        expect(harness.calls).not.toContain('consumedTrial');
    });

    it('does not consume when coverage is only a live trial title', async () => {
        const harness = makeHarness({ sources: [source('TRIAL'), source('BASE')] });
        const result = await publishListing(input(harness));
        expect([result, harness.insertedRows, harness.calls]).toEqual([
            expect.objectContaining({ published: true, trialConsumed: false }),
            [],
            expect.not.arrayContaining(['consumedTrial', 'coverageNotice'])
        ]);
    });

    it.each([
        ['undeclared event', { declaredEvent: null }],
        ['zero trial days', { trialPlanDays: 0 }],
        ['missing trial plan', { trialPlanDays: null }]
    ] as const)('publishes covered without consuming for %s', async (_label, options) => {
        const harness = makeHarness({ sources: [source('COURTESY')], ...options });
        const result = await publishListing(input(harness));
        expect([result, harness.insertedRows]).toEqual([
            expect.objectContaining({ published: true, trialConsumed: false }),
            []
        ]);
    });

    it.each([
        ['existing user row', { userHasTrialRow: true }],
        ['pseudonym already used', { pseudonymOwnedByOther: true }]
    ] as const)('publishes without a new row or notice for %s', async (_label, options) => {
        const harness = makeHarness({ sources: [source('COURTESY')], ...options });
        const result = await publishListing(input(harness));
        expect([result, harness.insertedRows, harness.calls]).toEqual([
            expect.objectContaining({ published: true, trialConsumed: false }),
            [],
            expect.not.arrayContaining(['consumedTrial', 'coverageNotice'])
        ]);
    });

    it.each([
        'USER_VERTICAL',
        'EMAIL_PSEUDONYM'
    ] as const)('publishes without throwing or notifying when insert conflicts on %s', async (insertConflict) => {
        const harness = makeHarness({ sources: [source('COURTESY')], insertConflict });
        const result = await publishListing(input(harness));
        expect([result, harness.calls]).toEqual([
            expect.objectContaining({ published: true, trialConsumed: false }),
            expect.not.arrayContaining(['coverageNotice'])
        ]);
    });

    it('does not evaluate T6 from UNPUBLISHED_BY_BILLING under coverage', async () => {
        const harness = makeHarness({
            sources: [source('COURTESY')],
            status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        });
        expect(await publishListing(input(harness))).toEqual({
            published: false,
            reason: 'COVERED_USE_PB3'
        });
        expect(harness.insertedRows).toEqual([]);
    });

    it('checks the publish limit before T6', async () => {
        const harness = makeHarness({ sources: [source('COURTESY')], limit: 0 });
        expect(await publishListing(input(harness))).toEqual({
            published: false,
            reason: 'LIMIT_REACHED'
        });
        expect(harness.insertedRows).toEqual([]);
    });

    it('keeps the publication when the post-commit coverage notice fails', async () => {
        const harness = makeHarness({ sources: [source('COURTESY')] });
        vi.spyOn(harness.afterCommit, 'emitCoverageChanged').mockImplementation(async () => {
            throw new Error('notice failure');
        });
        const result = await publishListing(input(harness));
        expect([result, harness.insertedRows]).toEqual([
            expect.objectContaining({
                published: true,
                trialConsumed: true,
                warnings: ['COVERAGE_NOTICE_FAILED']
            }),
            [consumedRow]
        ]);
    });

    it('rejects an invalid pseudonym after title detection and before setting publication', async () => {
        const harness = makeHarness({ sources: [source('COURTESY')] });
        await expect(publishListing(input(harness, 'invalid'))).rejects.toMatchObject({
            name: InvalidTrialMachineInputError.name,
            field: 'emailPseudonym'
        });
        expect(harness.calls).not.toContain('set');
    });
});
