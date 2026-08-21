/**
 * Tests for the lead intake backstop cron (H-62 / H-148).
 *
 * The intake alert is fire-and-forget by design — it must never cost an
 * applicant their submission — so a dropped send is a real, expected outcome.
 * This job is what stops that outcome from being permanent, and the properties
 * worth pinning down are the ones that decide whether it actually rescues
 * anything:
 *
 *   - it only chases leads still waiting on a human, so it never re-alerts on
 *     work already done;
 *   - it reuses the intake path verbatim, so the two can never drift into
 *     describing the same lead differently;
 *   - a failed send is reported as an error rather than swallowed, because the
 *     lead stays unannounced and the next tick must try again.
 *
 * @module test/cron/lead-intake-backstop.job.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockAnnounce, mockSelect } = vi.hoisted(() => ({
    mockAnnounce: vi.fn(),
    mockSelect: vi.fn()
}));

vi.mock('../../src/lib/lead-intake-ports.js', () => ({
    announceLeadToOps: mockAnnounce
}));

vi.mock('@repo/db', () => ({
    getDb: () => ({ select: mockSelect }),
    allianceLeads: {
        id: 'id',
        status: 'status',
        opsNotifiedAt: 'ops_notified_at',
        deletedAt: 'deleted_at',
        createdAt: 'created_at'
    }
}));

import { leadIntakeBackstopJob } from '../../src/cron/jobs/lead-intake-backstop.job';

/** Captured `where` clauses, in call order, so the filter can be asserted. */
const capturedWhere: unknown[] = [];

/**
 * Stubs the drizzle query chain, returning `rows` for each successive call.
 *
 * The job runs a single alliance-leads query per tick (HOS-693 dropped the
 * commerce-leads half), so the queue is drained in call order.
 */
function stubQueries(batches: readonly (readonly Record<string, unknown>[])[]): void {
    const queue = [...batches];
    mockSelect.mockImplementation(() => ({
        from: () => ({
            where: (clause: unknown) => {
                capturedWhere.push(clause);
                return {
                    orderBy: () => ({
                        limit: () => Promise.resolve(queue.shift() ?? [])
                    })
                };
            }
        })
    }));
}

function makeCronContext(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date('2026-08-16T00:20:00.000Z'),
        dryRun: false,
        ...overrides
    };
}

const allianceRow = {
    id: 'alliance-1',
    kind: 'service_provider',
    businessName: 'Plomería Acme',
    contactName: 'Ana',
    email: 'ana@example.com',
    phone: '+5491100000',
    message: 'Ofrezco 10%',
    createdAt: new Date('2026-07-24T13:00:00.000Z')
};

describe('leadIntakeBackstopJob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedWhere.length = 0;
        mockAnnounce.mockResolvedValue({ delivered: true });
    });

    it('is registered enabled, on a sub-daily schedule', () => {
        expect(leadIntakeBackstopJob.name).toBe('lead-intake-backstop');
        expect(leadIntakeBackstopJob.enabled).toBe(true);
        // A lead alert loses its value fast; a once-a-day backstop would let a
        // dropped send sit for most of a business day.
        expect(leadIntakeBackstopJob.schedule).toBe('20 */4 * * *');
    });

    it('only looks at leads still waiting on a human', async () => {
        // `drizzle-orm` is NOT mocked, so the captured clause is the real
        // predicate the job builds. Asserting the statuses on it is what makes
        // the claim testable: a lead already approved or rejected was plainly
        // seen by somebody, and alerting on it would tell an operator about
        // work they already did.
        stubQueries([[]]);

        await leadIntakeBackstopJob.handler(makeCronContext());

        expect(capturedWhere).toHaveLength(1);
        for (const clause of capturedWhere) {
            const serialised = JSON.stringify(clause);
            expect(serialised).toContain('pending');
            expect(serialised).toContain('reviewing');
            expect(serialised).not.toContain('approved');
            expect(serialised).not.toContain('rejected');
        }
    });

    it('excludes soft-deleted alliance leads', async () => {
        // Not hypothetical: production carries five soft-deleted `alliance_leads`
        // left over from smoke testing, all of them `pending` and all of them
        // with a null `opsNotifiedAt`. Without this filter the first tick would
        // email an operator about five deleted test applications.
        stubQueries([[]]);

        await leadIntakeBackstopJob.handler(makeCronContext());

        expect(capturedWhere).toHaveLength(1);
        const [clause] = capturedWhere;
        expect(
            JSON.stringify(clause),
            'the alliance query lost its deleted_at filter; soft-deleted applications ' +
                'would be announced to ops'
        ).toContain('deleted_at');
    });

    it('reports a clean tick when every lead has been announced', async () => {
        stubQueries([[]]);

        const result = await leadIntakeBackstopJob.handler(makeCronContext());

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(mockAnnounce).not.toHaveBeenCalled();
    });

    it('announces the leads nobody was told about', async () => {
        stubQueries([[allianceRow]]);

        const result = await leadIntakeBackstopJob.handler(makeCronContext());

        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
        expect(mockAnnounce).toHaveBeenCalledTimes(1);

        const funnels = mockAnnounce.mock.calls.map((call) => call[0]?.alert.funnel);
        expect(funnels).toEqual(['alliance']);

        // The alert carries the lead, exactly as the intake path builds it.
        const allianceCall = mockAnnounce.mock.calls[0];
        if (!allianceCall) {
            throw new Error('expected an announce call for the alliance lead');
        }
        const allianceAlert = allianceCall[0].alert;
        expect(allianceAlert.leadId).toBe('alliance-1');
        expect(allianceAlert.programLabel).toBe('Proveedor');
        expect(allianceAlert.contactEmail).toBe('ana@example.com');
    });

    it('sends nothing in dry-run but still reports what it found', async () => {
        stubQueries([[allianceRow]]);

        const result = await leadIntakeBackstopJob.handler(makeCronContext({ dryRun: true }));

        expect(result.success).toBe(true);
        expect(mockAnnounce).not.toHaveBeenCalled();
        expect(result.message).toContain('1');
        expect(result.details?.dryRun).toBe(true);
    });

    it('reports an undelivered lead as an error instead of swallowing it', async () => {
        // The row keeps its null `opsNotifiedAt`, so the next tick retries it.
        // Reporting success here would hide a funnel that is still silent.
        stubQueries([[allianceRow]]);
        mockAnnounce.mockResolvedValue({ delivered: false });

        const result = await leadIntakeBackstopJob.handler(makeCronContext());

        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
        expect(result.processed).toBe(0);
    });

    it('returns a failed result rather than throwing when the query breaks', async () => {
        mockSelect.mockImplementation(() => {
            throw new Error('db down');
        });

        const result = await leadIntakeBackstopJob.handler(makeCronContext());

        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
        expect(result.message).toContain('db down');
    });
});
