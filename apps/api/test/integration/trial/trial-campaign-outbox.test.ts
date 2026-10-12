import { randomUUID } from 'node:crypto';
import { type CoverageResponse, CoverageResponseSchema } from '@repo/billing-verticals-contract';
import { emailOutbox, eq, getDb, trials } from '@repo/db';
import { VERTICAL_ACTIVATION_EVENT_BY_VERTICAL, VerticalEnum } from '@repo/schemas';
import { computeTrialEmailPseudonym } from '@repo/service-core';
import { marketMidnight } from '@repo/verticals';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { convertTrialOnTitle } from '../../../../../packages/verticals/src/trial/trial-conversion';
import { expireTrial } from '../../../../../packages/verticals/src/trial/trial-expiry';
import { extendTrialByAdmin } from '../../../../../packages/verticals/src/trial/trial-extension';
import type { TrialAfterCommit } from '../../../../../packages/verticals/src/trial/trial-machine-types';
import {
    startTrial,
    startTrialInTransaction
} from '../../../../../packages/verticals/src/trial/trial-start';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';
import { getTrialMachinePorts } from '../../../src/utils/trial/trial-machine-ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    createOwner,
    createTrial,
    ensurePublicationCatalog
} from '../listing-publication/publication-routes.helpers';

const day = 86_400_000;
const start = new Date('2026-10-10T12:00:00.000Z');
const afterCommit: TrialAfterCommit = {
    emitCoverageChanged: async () => undefined,
    invalidateUser: async () => undefined
};

function coverage(input: { readonly covered: boolean }): CoverageResponse {
    return CoverageResponseSchema.parse(
        input.covered
            ? {
                  covered: true,
                  sources: [
                      {
                          type: 'SUBSCRIPTION',
                          reference: { kind: 'PLAN_VERSION', planVersionId: randomUUID() },
                          scope: 'VERTICAL',
                          target: null,
                          since: start,
                          until: 'NO_KNOWN_DATE',
                          charged: true,
                          floor: null
                      }
                  ]
              }
            : { covered: false, sources: [] }
    );
}

function fixedClock(at: Date) {
    return { now: () => at };
}

async function startOwnerTrial(
    user: { readonly id: string; readonly email: string },
    vertical:
        | typeof VerticalEnum.ACCOMMODATION
        | typeof VerticalEnum.GASTRONOMY = VerticalEnum.ACCOMMODATION
) {
    const pseudonym = computeTrialEmailPseudonym({ email: user.email });
    if (!pseudonym.ok) throw new Error('Unable to build trial email pseudonym');
    return startTrial({
        unitOfWork: getListingPublicationPorts().unitOfWork,
        billing: { coverage: async () => coverage({ covered: false }) },
        clock: fixedClock(start),
        emitCoverageChanged: async () => undefined,
        input: {
            userId: user.id,
            vertical,
            event: VERTICAL_ACTIVATION_EVENT_BY_VERTICAL[vertical]!,
            emailPseudonym: pseudonym.pseudonym
        }
    });
}

async function rowsFor(userId: string) {
    return getDb().select().from(emailOutbox).where(eq(emailOutbox.recipientUserId, userId));
}

function expectedSendAfter(targetDate: unknown): string {
    if (typeof targetDate !== 'string') throw new Error('Outbox row has no target date');
    const [year, month, dayOfMonth] = targetDate.split('-').map(Number);
    if (year === undefined || month === undefined || dayOfMonth === undefined) {
        throw new Error('Outbox target date is malformed');
    }
    return marketMidnight({ year, month, day: dayOfMonth }).toISOString();
}

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
});
beforeEach(async () => {
    await testDb.clean();
    await ensurePublicationCatalog(VerticalEnum.ACCOMMODATION);
    injectClock({ clock: fixedClock(start) });
});
afterAll(async () => testDb.teardown());

describe('TEST:V4:22 (parte 1: escritura) - trial campaigns are outbox rows written inside the transition', () => {
    it('writes T1 rows in the publication transaction, rolls them back, and T4 reschedules against the new end date', async () => {
        const owner = await createOwner();
        const started = await startOwnerTrial(owner);
        expect(started.started).toBe(true);
        const original = await rowsFor(owner.id);
        expect(original.filter((row) => row.status === 'pending')).toHaveLength(4);
        expect(original.map((row) => row.template).sort()).toEqual([
            'trial_ending_10d',
            'trial_ending_2d',
            'trial_ending_5d',
            'trial_ending_today'
        ]);
        for (const row of original) {
            expect(row.payload.verticals).toEqual(['accommodation']);
            expect(row.dedupKey).toMatch(/:(pre:-10d|pre:-5d|pre:-2d|pre:0d):\d{4}-\d{2}-\d{2}$/);
            expect(row.sendAfter?.toISOString()).toBe(expectedSendAfter(row.payload.targetDate));
        }

        const rollbackOwner = await createOwner();
        const pseudonym = computeTrialEmailPseudonym({ email: rollbackOwner.email });
        if (!pseudonym.ok) throw new Error('Unable to build trial email pseudonym');
        const listingPorts = getListingPublicationPorts();
        await expect(
            listingPorts.unitOfWork.runLocked(
                { userId: rollbackOwner.id, vertical: VerticalEnum.ACCOMMODATION },
                async (tx) => {
                    await startTrialInTransaction({
                        tx,
                        billing: { coverage: async () => coverage({ covered: false }) },
                        clock: fixedClock(start),
                        input: {
                            userId: rollbackOwner.id,
                            vertical: VerticalEnum.ACCOMMODATION,
                            event: VERTICAL_ACTIVATION_EVENT_BY_VERTICAL.accommodation!,
                            emailPseudonym: pseudonym.pseudonym
                        }
                    });
                    throw new Error('rollback after schedule');
                }
            )
        ).rejects.toThrow('rollback after schedule');
        expect(await rowsFor(rollbackOwner.id)).toHaveLength(0);

        const oldPending = original.find((row) => row.template === 'trial_ending_2d');
        if (!oldPending) throw new Error('Missing old target row');
        await getDb()
            .update(emailOutbox)
            .set({ status: 'sent' })
            .where(eq(emailOutbox.id, oldPending.id));
        const machine = getTrialMachinePorts();
        const extended = await extendTrialByAdmin({
            ...machine,
            clock: fixedClock(start),
            afterCommit,
            input: {
                userId: owner.id,
                vertical: VerticalEnum.ACCOMMODATION,
                days: 7,
                reason: 'schedule test',
                actorId: randomUUID()
            }
        });
        expect(extended.extended).toBe(true);
        const after = await rowsFor(owner.id);
        expect(after.filter((row) => row.lastError === 'cancelled:trial-rescheduled')).toHaveLength(
            3
        );
        const sentOld = after.find((row) => row.id === oldPending.id);
        expect(sentOld?.status).toBe('sent');
        const [trial] = await getDb().select().from(trials).where(eq(trials.userId, owner.id));
        if (!trial?.endsAt) throw new Error('Extended trial has no end date');
        const freshTarget = new Date(trial.endsAt.getTime() - 2 * day);
        const freshDate = `${freshTarget.getUTCFullYear()}-${String(freshTarget.getUTCMonth() + 1).padStart(2, '0')}-${String(freshTarget.getUTCDate()).padStart(2, '0')}`;
        expect(
            after.some(
                (row) =>
                    row.template === 'trial_ending_2d' &&
                    row.status === 'pending' &&
                    row.dedupKey.endsWith(`:pre:-2d:${freshDate}`)
            )
        ).toBe(true);
    });

    it('writes T3 recovery rows and T5 removes only the converted vertical after consolidating two verticals', async () => {
        await ensurePublicationCatalog(VerticalEnum.GASTRONOMY);
        const owner = await createOwner();
        await createTrial({
            userId: owner.id,
            status: 'TRIAL_ACTIVE',
            vertical: VerticalEnum.ACCOMMODATION
        });
        await createTrial({
            userId: owner.id,
            status: 'TRIAL_ACTIVE',
            vertical: VerticalEnum.GASTRONOMY
        });
        const [trial] = await getDb().select().from(trials).where(eq(trials.userId, owner.id));
        if (!trial) throw new Error('Missing trial fixture');
        const expiredAt = new Date('2026-10-06T12:00:00.000Z');
        await getDb().update(trials).set({ endsAt: expiredAt }).where(eq(trials.userId, owner.id));
        const expiryClock = fixedClock(new Date('2026-10-06T13:00:00.000Z'));
        injectClock({ clock: expiryClock });
        const machine = getTrialMachinePorts();
        for (const vertical of [VerticalEnum.ACCOMMODATION, VerticalEnum.GASTRONOMY]) {
            await expireTrial({
                ...machine,
                clock: expiryClock,
                afterCommit,
                input: { userId: owner.id, vertical }
            });
        }
        const recovery = (await rowsFor(owner.id)).filter((row) =>
            row.template.startsWith('trial_win_back_')
        );
        expect(recovery).toHaveLength(5);
        expect(recovery.map((row) => row.template).sort()).toEqual([
            'trial_win_back_15d',
            'trial_win_back_1d',
            'trial_win_back_30d',
            'trial_win_back_5d',
            'trial_win_back_60d'
        ]);
        expect(
            recovery
                .map((row) => Number(row.payload.offsetDays))
                .sort((left, right) => left - right)
        ).toEqual([1, 5, 15, 30, 60]);
        for (const row of recovery) {
            expect(row.status).toBe('pending');
            expect(row.payload.verticals).toEqual(['accommodation', 'gastronomy']);
            expect(row.sendAfter?.toISOString()).toBe(expectedSendAfter(row.payload.targetDate));
            expect(
                row.dedupKey.endsWith(
                    `:rec:+${String(row.payload.offsetDays)}d:${String(row.payload.targetDate)}`
                )
            ).toBe(true);
        }
        const converted = await convertTrialOnTitle({
            ...machine,
            billing: { coverage: async () => coverage({ covered: true }) },
            afterCommit,
            event: {
                userId: owner.id,
                vertical: VerticalEnum.GASTRONOMY,
                sourceType: 'SUBSCRIPTION',
                change: 'CHANGED'
            }
        });
        expect(converted.converted).toBe(true);
        const after = (await rowsFor(owner.id)).filter((row) =>
            row.template.startsWith('trial_win_back_')
        );
        expect(
            after.every(
                (row) =>
                    row.status === 'pending' &&
                    JSON.stringify(row.payload.verticals) === '["accommodation"]'
            )
        ).toBe(true);
    });

    it('T2 cancels only the active vertical pre-expiry campaign', async () => {
        const owner = await createOwner();
        await startOwnerTrial(owner);
        const machine = getTrialMachinePorts();
        await convertTrialOnTitle({
            ...machine,
            billing: { coverage: async () => coverage({ covered: true }) },
            afterCommit,
            event: {
                userId: owner.id,
                vertical: VerticalEnum.ACCOMMODATION,
                sourceType: 'SUBSCRIPTION',
                change: 'CHANGED'
            }
        });
        const rows = await rowsFor(owner.id);
        expect(
            rows.filter(
                (row) =>
                    row.template.startsWith('trial_ending_') &&
                    row.status === 'failed' &&
                    row.lastError === 'cancelled:trial-converted'
            )
        ).toHaveLength(4);
    });
});
