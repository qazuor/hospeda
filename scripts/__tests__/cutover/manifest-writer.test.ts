import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readInverseManifest } from '../../cutover/read-manifest.ts';
import { runCutover } from '../../cutover/run-cutover.ts';
import type { CutoverManifest, ProviderApi } from '../../cutover/types.ts';
import { createManifestWriter } from '../../cutover/write-manifest.ts';
import { createFakeProvider, STANDARD_KNOWN, STANDARD_OBJECTS } from './fake-provider.ts';

/**
 * The manifest is written INCREMENTALLY (HOS-1427, owner decision 18), so an abort mid-run still
 * leaves the ids the abort inverses need. A partial manifest reads `outcome: 'in-progress'`.
 */

const base: CutoverManifest = {
    schemaVersion: 1,
    outcome: 'in-progress',
    startedAt: '2026-10-07T10:00:00.000Z',
    finishedAt: '2026-10-07T10:00:00.000Z',
    census: { plans: { total: 0, walked: 0 }, preapprovals: { total: 0, walked: 0 } },
    cancelledPlanIds: [],
    cancelledPreapprovalIds: [],
    rereadCancelledIds: [],
    preservedProbeIds: [],
    unknownLiveIds: [],
    failures: []
};

const readJson = (file: string): CutoverManifest =>
    JSON.parse(readFileSync(file, 'utf8')) as CutoverManifest;

function scratch(): { readonly dir: string; readonly target: string } {
    const dir = mkdtempSync(path.join(tmpdir(), 'manifest-writer-'));
    return { dir, target: path.join(dir, 'm.json') };
}

describe('incremental manifest writer', () => {
    it('replaces its own partial file checkpoint after checkpoint, then the finished record, leaving no temp', () => {
        // Arrange
        const { dir, target } = scratch();
        const writer = createManifestWriter({ wantedPath: target, fallback: () => {} });
        // Act
        writer.write(base);
        const partial = readJson(target);
        writer.write({ ...base, cancelledPreapprovalIds: ['pre-1'] });
        const second = readJson(target);
        const final = writer.write({
            ...base,
            outcome: 'failed',
            cancelledPreapprovalIds: ['pre-1']
        });
        // Assert
        expect(partial.outcome).toBe('in-progress');
        expect(second.cancelledPreapprovalIds).toEqual(['pre-1']);
        expect(final.writtenTo).toBe(target);
        expect(readJson(target).outcome).toBe('failed');
        expect(readdirSync(dir)).toEqual(['m.json']);
    });

    it('never claims a file that already exists', () => {
        // Arrange
        const { dir, target } = scratch();
        writeFileSync(target, 'someone else');
        const writer = createManifestWriter({ wantedPath: target, fallback: () => {} });
        // Act
        writer.write(base);
        writer.write({ ...base, outcome: 'ok' });
        // Assert
        expect(readFileSync(target, 'utf8')).toBe('someone else');
        expect(writer.currentPath()).toBe(path.join(dir, 'm-1.json'));
        expect(readJson(path.join(dir, 'm-1.json')).outcome).toBe('ok');
    });

    it('never overwrites a finished record found at its path: it claims a new name', () => {
        // Arrange: the claimed file is replaced by a FINISHED record behind the writer's back
        const { dir, target } = scratch();
        const writer = createManifestWriter({ wantedPath: target, fallback: () => {} });
        writer.write(base);
        writeFileSync(target, JSON.stringify({ ...base, outcome: 'ok' }));
        // Act
        const { writtenTo } = writer.write({ ...base, cancelledPlanIds: ['plan-1'] });
        // Assert
        expect(readJson(target).outcome).toBe('ok');
        expect(writtenTo).toBe(path.join(dir, 'm-1.json'));
    });

    it('refuses to write after the finished record: the extra write goes to the fallback', () => {
        // Arrange
        const { target } = scratch();
        const dumped: string[] = [];
        const writer = createManifestWriter({
            wantedPath: target,
            fallback: (text) => dumped.push(text)
        });
        writer.write({ ...base, outcome: 'ok' });
        // Act
        const { writtenTo } = writer.write({ ...base, cancelledPlanIds: ['late'] });
        // Assert
        expect(writtenTo).toBeNull();
        expect(readJson(target).outcome).toBe('ok');
        expect(JSON.parse(dumped[0] ?? '{}').cancelledPlanIds).toEqual(['late']);
    });

    it('dumps a checkpoint it cannot write to the fallback so the ids are never lost', () => {
        // Arrange: the parent "directory" is a regular file
        const { dir } = scratch();
        const blocker = path.join(dir, 'blocker');
        writeFileSync(blocker, 'x');
        const dumped: string[] = [];
        const writer = createManifestWriter({
            wantedPath: path.join(blocker, 'm.json'),
            fallback: (text) => dumped.push(text)
        });
        // Act
        const { writtenTo } = writer.write({ ...base, cancelledPlanIds: ['plan-1'] });
        // Assert
        expect(writtenTo).toBeNull();
        expect(JSON.parse(dumped[0] ?? '{}').cancelledPlanIds).toEqual(['plan-1']);
    });
});

describe('the run checkpoints as it goes', () => {
    it('leaves on disk, at the moment of a crash, a partial manifest with every id already cancelled', async () => {
        // Arrange: the process "dies" right after the second preapproval cancellation
        const { target } = scratch();
        const writer = createManifestWriter({ wantedPath: target, fallback: () => {} });
        const fake = createFakeProvider({ objects: STANDARD_OBJECTS });
        let preapprovalCancels = 0;
        const crash = new Error('process killed');
        const api: ProviderApi = {
            ...fake.api,
            cancel: async (input) => {
                if (input.kind === 'preapproval') {
                    preapprovalCancels += 1;
                    if (preapprovalCancels === 3) throw crash;
                }
                return fake.api.cancel(input);
            }
        };
        let snapshotAtCrash: CutoverManifest | undefined;
        // Act
        await runCutover({
            api,
            readKnownIds: async () => STANDARD_KNOWN,
            probeIds: ['pre-probe-kept'],
            dryRun: false,
            sleep: async () => {},
            onCheckpoint: (m) => {
                const landed = writer.write(m).writtenTo !== null;
                if (preapprovalCancels === 2 && snapshotAtCrash === undefined) {
                    snapshotAtCrash = readJson(target);
                }
                return landed;
            }
        });
        // Assert: what was on disk when the crash came, not the run's own final record
        expect(snapshotAtCrash?.outcome).toBe('in-progress');
        expect(snapshotAtCrash?.cancelledPlanIds).toEqual(['plan-active']);
        expect(snapshotAtCrash?.cancelledPreapprovalIds).toHaveLength(2);
        expect(readInverseManifest({ path: target }).schemaVersion).toBe(1);
    });

    it('stops before any provider call when the first checkpoint cannot be written', async () => {
        // Arrange
        const fake = createFakeProvider({ objects: STANDARD_OBJECTS });
        let reads = 0;
        // Act
        const { ok, manifest } = await runCutover({
            api: fake.api,
            readKnownIds: async () => {
                reads += 1;
                return STANDARD_KNOWN;
            },
            probeIds: [],
            dryRun: false,
            sleep: async () => {},
            onCheckpoint: () => false
        });
        // Assert
        expect(ok).toBe(false);
        expect(manifest.failures.map((f) => f.code)).toEqual(['MANIFEST_WRITE_FAILED']);
        expect(fake.calls).toEqual([]);
        expect(reads).toBe(0);
    });

    it('keeps going when a later checkpoint fails (that one went to the fallback)', async () => {
        // Arrange
        const fake = createFakeProvider({ objects: STANDARD_OBJECTS });
        let n = 0;
        // Act
        const { ok } = await runCutover({
            api: fake.api,
            readKnownIds: async () => STANDARD_KNOWN,
            probeIds: ['pre-probe-kept'],
            dryRun: false,
            sleep: async () => {},
            onCheckpoint: () => {
                n += 1;
                return n === 1;
            }
        });
        // Assert
        expect(ok).toBe(true);
        expect(n).toBeGreaterThan(2);
    });
});
