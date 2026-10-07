import { describe, expect, it } from 'vitest';
import type { RunCutoverInput } from '../../cutover/run-cutover.ts';
import { runCutover } from '../../cutover/run-cutover.ts';
import type { FakeProviderOptions } from './fake-provider.ts';
import { createFakeProvider, STANDARD_KNOWN, STANDARD_OBJECTS } from './fake-provider.ts';

const PROBE_KEPT = 'pre-probe-kept';

function run({
    provider = {},
    overrides = {}
}: {
    readonly provider?: Partial<FakeProviderOptions>;
    readonly overrides?: Partial<RunCutoverInput>;
}) {
    const fake = createFakeProvider({ objects: STANDARD_OBJECTS, ...provider });
    const sleeps: number[] = [];
    const promise = runCutover({
        api: fake.api,
        readKnownIds: async () => STANDARD_KNOWN,
        probeIds: [PROBE_KEPT],
        dryRun: false,
        sleep: async (ms) => {
            sleeps.push(ms);
        },
        ...overrides
    });
    return { fake, sleeps, promise };
}

describe('TEST:U3:1 census (AC:U3:1)', () => {
    it('takes every non-cancelled object from the provider, including the one the DB does not know', async () => {
        // Arrange
        const { promise } = run({ overrides: { dryRun: true } });
        // Act
        const { manifest, ok } = await promise;
        // Assert
        expect(ok).toBe(true);
        expect(manifest.outcome).toBe('dry-run');
        expect(manifest.unknownLiveIds).toEqual(['pre-unknown-to-db', 'pre-probe-not-listed']);
        expect(manifest.census.plans).toEqual({ total: 2, walked: 2 });
        expect(manifest.census.preapprovals).toEqual({ total: 7, walked: 7 });
        expect(manifest.preservedProbeIds).toEqual([PROBE_KEPT]);
    });

    it('re-reads the true status by id instead of trusting the stale listing', async () => {
        // Arrange: the fake listing reports every live object as `pending`, even `authorized` ones
        const { fake, promise } = run({ overrides: { dryRun: true } });
        // Act
        await promise;
        // Assert
        expect(fake.calls).toContain('GET preapproval pre-authorized');
        expect(fake.calls.filter((c) => c.startsWith('CANCEL'))).toEqual([]);
    });
});

describe('TEST:U3:2 cancellation order and probes (AC:U3:2)', () => {
    it('cancels plans first, then live preapprovals; keeps the enumerated probe, cancels the other', async () => {
        // Arrange
        const { fake, promise } = run({});
        // Act
        const { ok, manifest } = await promise;
        // Assert
        const cancels = fake.calls.filter((c) => c.startsWith('CANCEL'));
        expect(cancels[0]).toBe('CANCEL plan plan-active');
        expect(cancels.slice(1).every((c) => c.startsWith('CANCEL preapproval'))).toBe(true);
        expect(cancels).not.toContain(`CANCEL preapproval ${PROBE_KEPT}`);
        expect(cancels).toContain('CANCEL preapproval pre-probe-not-listed');
        expect(cancels).toContain('CANCEL preapproval pre-unknown-to-db');
        expect(fake.state.get(PROBE_KEPT)?.status).toBe('authorized');
        expect(fake.state.get('pre-probe-not-listed')?.status).toBe('cancelled');
        expect(ok).toBe(true);
        expect(manifest.cancelledPlanIds).toEqual(['plan-active']);
        expect(manifest.rereadCancelledIds).toHaveLength(6);
        expect(cancels).not.toContain('CANCEL plan plan-cancelled');
    });
});

describe('TEST:U3:3 step 2 reread and retries (AC:U3:3)', () => {
    it('fails the run when a preapproval is still authorized after 3 retries with increasing backoff', async () => {
        // Arrange
        const { fake, sleeps, promise } = run({ provider: { stuckIds: ['pre-paused'] } });
        // Act
        const { ok, manifest } = await promise;
        // Assert
        expect(ok).toBe(false);
        expect(manifest.outcome).toBe('failed');
        expect(manifest.failures).toEqual([
            expect.objectContaining({ code: 'NOT_CANCELLED', id: 'pre-paused' })
        ]);
        expect(fake.calls.filter((c) => c === 'CANCEL preapproval pre-paused')).toHaveLength(4);
        expect(sleeps).toEqual([2_000, 5_000, 10_000]);
        expect(manifest.rereadCancelledIds).not.toContain('pre-paused');
    });

    it('re-reads each cancelled id by id (never by search)', async () => {
        // Arrange
        const { fake, promise } = run({});
        // Act
        await promise;
        // Assert
        const cancelIndex = fake.calls.lastIndexOf('CANCEL preapproval pre-pending');
        expect(fake.calls.slice(cancelIndex)).toContain('GET preapproval pre-pending');
    });
});

describe('TEST:U3:4 completeness gate (AC:U3:4)', () => {
    it('fails when the walked count does not equal the paginated total', async () => {
        // Arrange: the provider claims 12 preapprovals, the walk finds 7
        const { promise } = run({ provider: { totalOverride: { preapproval: 12 } } });
        // Act
        const { ok, manifest } = await promise;
        // Assert
        expect(ok).toBe(false);
        expect(manifest.failures.map((f) => f.code)).toContain('WALK_COUNT_MISMATCH');
    });

    it('fails when an id of a probe manifest is missing from the walk', async () => {
        // Arrange: the walk hides the probe, which still exists by id
        const { promise } = run({ provider: { hiddenFromWalk: [PROBE_KEPT] } });
        // Act
        const { ok, manifest } = await promise;
        // Assert
        expect(ok).toBe(false);
        expect(manifest.failures).toContainEqual(
            expect.objectContaining({ code: 'KNOWN_ID_MISSING', id: PROBE_KEPT })
        );
    });

    it('fails when an id known to the old DB is missing from the walk', async () => {
        // Arrange
        const { promise } = run({ provider: { hiddenFromWalk: ['pre-paused'] } });
        // Act
        const { ok, manifest } = await promise;
        // Assert
        expect(ok).toBe(false);
        expect(manifest.failures).toContainEqual(
            expect.objectContaining({ code: 'KNOWN_ID_MISSING', id: 'pre-paused' })
        );
    });

    it('fails on an id the DB knows that the provider never returns, even for plans', async () => {
        // Arrange
        const { promise } = run({
            overrides: {
                readKnownIds: async () => ({ planIds: ['plan-ghost'], preapprovalIds: [] })
            }
        });
        // Act
        const { ok, manifest } = await promise;
        // Assert
        expect(ok).toBe(false);
        expect(manifest.failures).toContainEqual(
            expect.objectContaining({ code: 'KNOWN_ID_MISSING', id: 'plan-ghost' })
        );
    });

    it('does not guess: an unknown preapproval status is a failure and is left alone', async () => {
        // Arrange
        const { fake, promise } = run({
            provider: {
                objects: [
                    ...STANDARD_OBJECTS,
                    { kind: 'preapproval', id: 'pre-weird', status: 'finished' }
                ]
            }
        });
        // Act
        const { ok, manifest } = await promise;
        // Assert
        expect(ok).toBe(false);
        expect(manifest.failures).toContainEqual(
            expect.objectContaining({ code: 'UNEXPECTED_STATUS', id: 'pre-weird' })
        );
        expect(fake.calls).not.toContain('CANCEL preapproval pre-weird');
    });
});

describe('TEST:U3:6 manifest carries ids only (AC:U3:5)', () => {
    it('contains only ids, counts and fixed text: no person data and no send call', async () => {
        // Arrange
        const { fake, promise } = run({});
        // Act
        const { manifest } = await promise;
        // Assert
        expect(Object.keys(manifest).sort()).toEqual(
            [
                'cancelledPlanIds',
                'cancelledPreapprovalIds',
                'census',
                'failures',
                'finishedAt',
                'outcome',
                'preservedProbeIds',
                'rereadCancelledIds',
                'schemaVersion',
                'startedAt',
                'unknownLiveIds'
            ].sort()
        );
        const text = JSON.stringify(manifest);
        expect(text).not.toMatch(/@|email|name|phone|payer/i);
        expect(fake.calls.every((c) => /^(LIST|GET|CANCEL) /.test(c))).toBe(true);
    });
});
