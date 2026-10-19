import { describe, expect, it } from 'vitest';
import { runCutover } from '../../cutover/run-cutover.ts';
import type { FakeObject } from './fake-provider.ts';
import { createFakeProvider } from './fake-provider.ts';

const noSleep = async () => {};

function runWithObjects({
    objects,
    probeIds,
    dryRun = false
}: {
    readonly objects: readonly FakeObject[];
    readonly probeIds: readonly string[];
    readonly dryRun?: boolean;
}) {
    const fake = createFakeProvider({ objects });
    const promise = runCutover({
        api: fake.api,
        readKnownIds: async () => ({ planIds: [], preapprovalIds: [] }),
        probeIds,
        dryRun,
        sleep: noSleep
    });
    return { fake, promise };
}

describe('TEST:1402:1 preserved probe plan gate (AC:1402:1)', () => {
    it('fails before any cancellation when a preserved live probe hangs from a live plan', async () => {
        // Arrange
        const { fake, promise } = runWithObjects({
            objects: [
                { kind: 'plan', id: 'plan-live', status: 'active' },
                {
                    kind: 'preapproval',
                    id: 'probe-kept',
                    status: 'authorized',
                    planId: 'plan-live'
                },
                { kind: 'preapproval', id: 'ordinary', status: 'pending' }
            ],
            probeIds: ['probe-kept']
        });
        // Act
        const { ok, manifest } = await promise;
        // Assert
        expect(ok).toBe(false);
        expect(manifest.failures).toEqual([
            {
                code: 'PROBE_PLAN_BOUND',
                id: 'probe-kept',
                detail: 'preserved probe is attached to plan plan-live'
            }
        ]);
        expect(fake.calls.filter((call) => call.startsWith('CANCEL'))).toEqual([]);
        expect(manifest.cancelledPlanIds).toEqual([]);
        expect(manifest.cancelledPreapprovalIds).toEqual([]);
        expect(manifest.outcome).toBe('failed');
    });

    it('cancels normally when the preserved probe has no plan id', async () => {
        // Arrange
        const { fake, promise } = runWithObjects({
            objects: [
                { kind: 'plan', id: 'plan-live', status: 'active' },
                { kind: 'preapproval', id: 'probe-kept', status: 'authorized' },
                { kind: 'preapproval', id: 'ordinary', status: 'pending' }
            ],
            probeIds: ['probe-kept']
        });
        // Act
        const { ok, manifest } = await promise;
        // Assert
        expect(ok).toBe(true);
        expect(fake.calls.filter((call) => call.startsWith('CANCEL')).sort()).toEqual([
            'CANCEL plan plan-live',
            'CANCEL preapproval ordinary'
        ]);
        expect(manifest.cancelledPlanIds).toEqual(['plan-live']);
        expect(manifest.cancelledPreapprovalIds).toEqual(['ordinary']);
    });

    it('does not stop for a preserved probe attached to an already cancelled plan', async () => {
        // Arrange
        const { fake, promise } = runWithObjects({
            objects: [
                { kind: 'plan', id: 'plan-done', status: 'cancelled' },
                { kind: 'preapproval', id: 'probe-kept', status: 'authorized', planId: 'plan-done' }
            ],
            probeIds: ['probe-kept']
        });
        // Act
        const { ok, manifest } = await promise;
        // Assert
        expect(ok).toBe(true);
        expect(manifest.failures).toEqual([]);
        expect(fake.calls.filter((call) => call.startsWith('CANCEL'))).toEqual([]);
    });

    it('cancels a non-preserved preapproval attached to a live plan', async () => {
        // Arrange
        const { fake, promise } = runWithObjects({
            objects: [
                { kind: 'plan', id: 'plan-live', status: 'active' },
                { kind: 'preapproval', id: 'ordinary', status: 'authorized', planId: 'plan-live' }
            ],
            probeIds: []
        });
        // Act
        const { ok, manifest } = await promise;
        // Assert
        expect(ok).toBe(true);
        expect(fake.calls.filter((call) => call.startsWith('CANCEL')).sort()).toEqual([
            'CANCEL plan plan-live',
            'CANCEL preapproval ordinary'
        ]);
        expect(manifest.failures).toEqual([]);
    });

    it('reports multiple bound probes in provider traversal order', async () => {
        // Arrange
        const { fake, promise } = runWithObjects({
            objects: [
                { kind: 'plan', id: 'plan-a', status: 'active' },
                { kind: 'plan', id: 'plan-b', status: 'active' },
                { kind: 'preapproval', id: 'probe-b', status: 'paused', planId: 'plan-b' },
                { kind: 'preapproval', id: 'probe-a', status: 'pending', planId: 'plan-a' }
            ],
            probeIds: ['probe-a', 'probe-b']
        });
        // Act
        const { manifest } = await promise;
        // Assert
        expect(manifest.failures.map(({ code, id }) => ({ code, id }))).toEqual([
            { code: 'PROBE_PLAN_BOUND', id: 'probe-b' },
            { code: 'PROBE_PLAN_BOUND', id: 'probe-a' }
        ]);
        expect(fake.calls.filter((call) => call.startsWith('CANCEL'))).toEqual([]);
    });
});

describe('TEST:1402:2 dry-run plan gate (AC:1402:1)', () => {
    it('fails before any cancellation when a preserved live probe hangs from a live plan', async () => {
        // Arrange
        const { fake, promise } = runWithObjects({
            objects: [
                { kind: 'plan', id: 'plan-live', status: 'active' },
                { kind: 'preapproval', id: 'probe-kept', status: 'authorized', planId: 'plan-live' }
            ],
            probeIds: ['probe-kept'],
            dryRun: true
        });
        // Act
        const { ok, manifest } = await promise;
        // Assert
        expect(ok).toBe(false);
        expect(manifest.outcome).toBe('failed');
        expect(manifest.failures.map(({ code }) => code)).toEqual(['PROBE_PLAN_BOUND']);
        expect(fake.calls.filter((call) => call.startsWith('CANCEL'))).toEqual([]);
    });
});
