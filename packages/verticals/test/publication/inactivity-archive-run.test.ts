import { describe, expect, it, vi } from 'vitest';
import { runInactivityArchive } from '../../src/publication/inactivity-archive-run';
import { at, clock, listingId, makeHarness, userId, vertical } from './support';

describe('TEST:V6:8 inactivity archive runner', () => {
    it('TEST:V6:8 continues after a candidate failure and reports incomplete work', async () => {
        const harness = makeHarness({ covered: false });
        const retentionStopped = vi
            .fn()
            .mockRejectedValueOnce(new Error('billing unavailable'))
            .mockResolvedValue({ stopped: false, pauseEndedAt: null, coverageLostAt: null });
        const result = await runInactivityArchive({
            ports: {
                population: {
                    listDue: vi.fn(async ({ after }) => ({
                        items: after
                            ? []
                            : [
                                  { vertical, listingId, ownerId: userId },
                                  { vertical, listingId, ownerId: userId }
                              ],
                        next: null
                    }))
                },
                unitOfWork: harness.unitOfWork,
                billing: { ...harness.billing, retentionStopped },
                clock,
                afterCommit: harness.afterCommit
            }
        });
        expect(result).toMatchObject({
            read: 2,
            complete: false,
            failures: [{ vertical, listingId }],
            skipped: { NOT_DUE: 1 }
        });
        expect(at).toEqual(clock.now());
    });
});
