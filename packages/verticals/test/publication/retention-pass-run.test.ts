import { PublicationStatusEnum as Status } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type {
    PublicationTransaction,
    PublicationUnitOfWork
} from '../../src/publication/publication-types';
import {
    RETENTION_PASS_PAGE_SIZE,
    runRetentionPass
} from '../../src/publication/retention-pass-run';
import { at, clock, listingId, makeHarness, userId, vertical } from './support';

const candidate = (id: string) => ({ vertical, listingId: id, ownerId: userId });

function ports(
    harness: ReturnType<typeof makeHarness>,
    args: {
        notices?: ReturnType<typeof candidate>[][];
        purges?: ReturnType<typeof candidate>[][];
        previousPassStartedAt?: Date | null;
        order?: string[];
    }
) {
    let noticePage = 0;
    let purgePage = 0;
    const notices = args.notices ?? [];
    const purges = args.purges ?? [];
    const order = args.order ?? [];
    return {
        order,
        value: {
            ...harness,
            afterCommit: harness.retentionAfterCommit,
            previousPassStartedAt: args.previousPassStartedAt ?? null,
            clock,
            population: {
                listNoticeDue: vi.fn(async () => {
                    order.push('notice-page');
                    const items = notices[noticePage] ?? [];
                    const next =
                        noticePage < notices.length - 1
                            ? { vertical, listingId: `cursor-n${noticePage}` }
                            : null;
                    noticePage += 1;
                    return { items, next };
                }),
                listPurgeDue: vi.fn(async () => {
                    order.push('purge-page');
                    const items = purges[purgePage] ?? [];
                    const next =
                        purgePage < purges.length - 1
                            ? { vertical, listingId: `cursor-p${purgePage}` }
                            : null;
                    purgePage += 1;
                    return { items, next };
                })
            }
        }
    };
}

describe('TEST:V9b:13 AC:V9b:14 runRetentionPass', () => {
    it('walks every page of both populations once and processes all notices before PB9', async () => {
        const harness = makeHarness({
            status: Status.PUBLISHED,
            covered: false,
            inactiveSince: new Date(at.getTime() - 110 * 86_400_000)
        });
        const setup = ports(harness, {
            notices: [[candidate('n1')], [candidate('n2')]],
            purges: [[candidate('p1')], [candidate('p2')]]
        });
        const result = await runRetentionPass({ ports: setup.value });
        expect(result.read).toEqual({ notices: 2, purges: 2 });
        expect(setup.value.population.listNoticeDue).toHaveBeenCalledTimes(2);
        expect(setup.value.population.listPurgeDue).toHaveBeenCalledTimes(2);
        expect(setup.value.population.listNoticeDue).toHaveBeenCalledWith({
            now: at,
            after: null,
            limit: RETENTION_PASS_PAGE_SIZE
        });
        expect(setup.order.indexOf('purge-page')).toBeGreaterThan(
            setup.order.indexOf('notice-page')
        );
        expect(result.notices).toMatchObject({ sent: 2, enqueued: 2, skipped: {} });
        expect(harness.listingNotices).toEqual([]);
    });

    it('uses null and a prior pass instant for PB9 first-pass safety', async () => {
        const makePurgeHarness = () =>
            makeHarness({
                status: Status.ARCHIVED,
                covered: false,
                inactiveSince: new Date(at.getTime() - 300 * 86_400_000),
                deletionAnnouncedAt: new Date(at.getTime() - 200 * 86_400_000)
            });
        const first = makePurgeHarness();
        const firstResult = await runRetentionPass({
            ports: ports(first, { purges: [[candidate(listingId)]], previousPassStartedAt: null })
                .value
        });
        expect(firstResult.purgeSkipped).toEqual({ FIRST_PASS: 1 });
        const next = makePurgeHarness();
        const nextResult = await runRetentionPass({
            ports: ports(next, {
                purges: [[candidate(listingId)]],
                previousPassStartedAt: new Date(at.getTime() - 86_400_000)
            }).value
        });
        expect(nextResult.purged).toBe(1);
    });

    it('counts sent, enqueued, skips, purges and purge warnings', async () => {
        const noticeHarness = makeHarness({
            status: Status.PUBLISHED,
            covered: true,
            inactiveSince: new Date(at.getTime() - 110 * 86_400_000)
        });
        const coveredResult = await runRetentionPass({
            ports: ports(noticeHarness, { notices: [[candidate(listingId)]] }).value
        });
        expect(coveredResult.notices).toEqual({ sent: 0, enqueued: 0, skipped: { COVERED: 1 } });

        const duplicateHarness = makeHarness({
            status: Status.PUBLISHED,
            covered: false,
            inactiveSince: new Date(at.getTime() - 110 * 86_400_000),
            noticeEnqueued: false
        });
        const duplicateResult = await runRetentionPass({
            ports: ports(duplicateHarness, { notices: [[candidate(listingId)]] }).value
        });
        expect(duplicateResult.notices).toEqual({ sent: 1, enqueued: 0, skipped: {} });

        const purgeHarness = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: new Date(at.getTime() - 300 * 86_400_000),
            deletionAnnouncedAt: new Date(at.getTime() - 200 * 86_400_000)
        });
        const purgeResult = await runRetentionPass({
            ports: ports(purgeHarness, {
                purges: [[candidate(listingId)]],
                previousPassStartedAt: at
            }).value
        });
        expect(purgeResult.purged).toBe(1);
        expect(purgeResult.purgeSkipped).toEqual({});
        expect(purgeResult.purgeWarnings).toBe(0);
    });

    it('isolates a notice failure, continues notices and still reaches PB9', async () => {
        const harness = makeHarness({
            status: Status.PUBLISHED,
            covered: false,
            inactiveSince: new Date(at.getTime() - 110 * 86_400_000)
        });
        let noticeCalls = 0;
        const unitOfWork: PublicationUnitOfWork = {
            async runLocked<T>(
                lock: Parameters<PublicationUnitOfWork['runLocked']>[0],
                work: (tx: PublicationTransaction) => Promise<T>
            ): Promise<T> {
                noticeCalls += 1;
                if (noticeCalls === 1) throw new Error('notice failure');
                return harness.unitOfWork.runLocked(lock, work);
            }
        };
        const setup = ports(harness, {
            notices: [[candidate('bad'), candidate('good')]],
            purges: [[candidate('purge')]]
        });
        const result = await runRetentionPass({ ports: { ...setup.value, unitOfWork } });
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0]).toMatchObject({ step: 'NOTICE', listingId: 'bad' });
        expect(result.complete).toBe(false);
        expect(result.notices.sent).toBe(1);
        expect(result.read.purges).toBe(1);
    });

    it('does not enqueue the archive notice directly', async () => {
        const harness = makeHarness({
            status: Status.PUBLISHED,
            covered: false,
            inactiveSince: new Date(at.getTime() - 110 * 86_400_000)
        });
        await runRetentionPass({
            ports: ports(harness, { notices: [[candidate(listingId)]] }).value
        });
        expect(harness.listingNotices).toEqual([]);
        expect(harness.retentionNotices).toHaveLength(1);
    });

    it('isolates a PB9 failure and records step PURGE', async () => {
        const harness = makeHarness({
            status: Status.ARCHIVED,
            covered: false,
            inactiveSince: new Date(at.getTime() - 300 * 86_400_000)
        });
        const unitOfWork: PublicationUnitOfWork = {
            async runLocked<T>(): Promise<T> {
                throw new Error('purge failure');
            }
        };
        const result = await runRetentionPass({
            ports: {
                ...ports(harness, { purges: [[candidate('bad')]], previousPassStartedAt: at })
                    .value,
                unitOfWork
            }
        });
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0]).toMatchObject({ step: 'PURGE', listingId: 'bad' });
        expect(result.complete).toBe(false);
    });
});
