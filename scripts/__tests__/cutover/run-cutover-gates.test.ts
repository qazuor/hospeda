import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readProbeManifest } from '../../cutover/probe-manifest.ts';
import { runCutover } from '../../cutover/run-cutover.ts';
import type { CutoverManifest, ListPage, ProviderApi } from '../../cutover/types.ts';
import { writeManifest } from '../../cutover/write-manifest.ts';
import { createFakeProvider, STANDARD_KNOWN, STANDARD_OBJECTS } from './fake-provider.ts';

const noSleep = async () => {};

/** Wraps a fake provider so the preapproval search answers a scripted sequence of pages. */
function withScriptedPreapprovalPages({ pages }: { readonly pages: readonly ListPage[] }): {
    readonly api: ProviderApi;
    readonly calls: string[];
} {
    const fake = createFakeProvider({
        objects: ['a', 'b', 'c'].map((id) => ({
            kind: 'preapproval' as const,
            id,
            status: 'cancelled'
        }))
    });
    let call = 0;
    const api: ProviderApi = {
        ...fake.api,
        listPage: async ({ kind }) => {
            if (kind === 'plan') return { total: 0, results: [] };
            const page = pages[Math.min(call, pages.length - 1)] as ListPage;
            call += 1;
            return page;
        }
    };
    return { api, calls: fake.calls };
}

const row = (id: string) => ({ id, status: 'cancelled' });

describe('completeness gate branches that a plain count check would miss (AC:U3:4)', () => {
    it('fails when rows repeat across pages even though distinct ids equal the total', async () => {
        // Arrange: total 3, pages [a,b] then [b,c]: 3 distinct, 4 rows
        const { api } = withScriptedPreapprovalPages({
            pages: [
                { total: 3, results: [row('a'), row('b')] },
                { total: 3, results: [row('b'), row('c')] }
            ]
        });
        // Act
        const { ok, manifest } = await runCutover({
            api,
            readKnownIds: async () => ({ planIds: [], preapprovalIds: [] }),
            probeIds: [],
            dryRun: false,
            sleep: noSleep
        });
        // Assert
        expect(ok).toBe(false);
        expect(manifest.failures.map((f) => f.code)).toEqual(['WALK_COUNT_MISMATCH']);
        expect(manifest.failures[0]?.detail).toContain('4 rows');
    });

    it('fails when the provider total changes between pages', async () => {
        // Arrange: first page says 3, second says 4, but only 3 distinct ids arrive
        const { api } = withScriptedPreapprovalPages({
            pages: [
                { total: 3, results: [row('a'), row('b')] },
                { total: 4, results: [row('c')] }
            ]
        });
        // Act
        const { ok, manifest } = await runCutover({
            api,
            readKnownIds: async () => ({ planIds: [], preapprovalIds: [] }),
            probeIds: [],
            dryRun: false,
            sleep: noSleep
        });
        // Assert
        expect(ok).toBe(false);
        expect(manifest.failures[0]?.detail).toContain('total changed between pages');
    });
});

describe('step 2 on a healthy run (AC:U3:3)', () => {
    it('sends exactly one cancel per live target and never waits when the first re-read is cancelled', async () => {
        // Arrange
        const fake = createFakeProvider({ objects: STANDARD_OBJECTS });
        const sleeps: number[] = [];
        // Act
        const { ok } = await runCutover({
            api: fake.api,
            readKnownIds: async () => STANDARD_KNOWN,
            probeIds: ['pre-probe-kept'],
            dryRun: false,
            sleep: async (ms) => {
                sleeps.push(ms);
            }
        });
        // Assert
        const cancels = fake.calls.filter((c) => c.startsWith('CANCEL'));
        expect(ok).toBe(true);
        expect(sleeps).toEqual([]);
        expect(new Set(cancels).size).toBe(cancels.length);
        expect(cancels).toHaveLength(6);
    });
});

describe('plan classification (AC:U3:2)', () => {
    it('treats an inactive plan as not cancelled: it is cancelled and verified', async () => {
        // Arrange
        const fake = createFakeProvider({
            objects: [{ kind: 'plan', id: 'plan-inactive', status: 'inactive' }]
        });
        // Act
        const { ok, manifest } = await runCutover({
            api: fake.api,
            readKnownIds: async () => ({ planIds: ['plan-inactive'], preapprovalIds: [] }),
            probeIds: [],
            dryRun: false,
            sleep: noSleep
        });
        // Assert
        expect(ok).toBe(true);
        expect(manifest.cancelledPlanIds).toEqual(['plan-inactive']);
        expect(manifest.rereadCancelledIds).toEqual(['plan-inactive']);
    });
});

describe('old database failure', () => {
    it('is reported with its own code and cause, before any provider call', async () => {
        // Arrange
        const fake = createFakeProvider({ objects: STANDARD_OBJECTS });
        const dbError = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
        // Act
        const { ok, manifest } = await runCutover({
            api: fake.api,
            readKnownIds: async () => {
                throw dbError;
            },
            probeIds: [],
            dryRun: false,
            sleep: noSleep
        });
        // Assert
        expect(ok).toBe(false);
        expect(manifest.failures).toEqual([
            {
                code: 'OLD_DB_ERROR',
                detail: 'old database read failed: ECONNREFUSED connection refused'
            }
        ]);
        expect(fake.calls).toEqual([]);
    });
});

describe('manifest write never loses the ids', () => {
    const manifest: CutoverManifest = {
        schemaVersion: 1,
        outcome: 'ok',
        startedAt: 'a',
        finishedAt: 'b',
        census: { plans: { total: 0, walked: 0 }, preapprovals: { total: 1, walked: 1 } },
        cancelledPlanIds: [],
        cancelledPreapprovalIds: ['pre-1'],
        rereadCancelledIds: ['pre-1'],
        preservedProbeIds: [],
        unknownLiveIds: [],
        failures: []
    };

    it('writes through a temp file and leaves no temp behind', () => {
        // Arrange
        const dir = mkdtempSync(path.join(tmpdir(), 'manifest-'));
        const target = path.join(dir, 'out', 'm.json');
        // Act
        const { writtenTo } = writeManifest({ manifest, wantedPath: target, fallback: () => {} });
        // Assert
        expect(writtenTo).toBe(target);
        expect(JSON.parse(readFileSync(target, 'utf8')).cancelledPreapprovalIds).toEqual(['pre-1']);
        expect(readdirSync(path.dirname(target))).toEqual(['m.json']);
    });

    it('never overwrites an existing file: it picks a free name', () => {
        // Arrange
        const dir = mkdtempSync(path.join(tmpdir(), 'manifest-'));
        const target = path.join(dir, 'm.json');
        writeFileSync(target, 'old');
        // Act
        const { writtenTo } = writeManifest({ manifest, wantedPath: target, fallback: () => {} });
        // Assert
        expect(readFileSync(target, 'utf8')).toBe('old');
        expect(writtenTo).toBe(path.join(dir, 'm-1.json'));
    });

    it('dumps the full manifest to the fallback when the file cannot be written', () => {
        // Arrange: the parent "directory" is a regular file
        const dir = mkdtempSync(path.join(tmpdir(), 'manifest-'));
        const blocker = path.join(dir, 'blocker');
        writeFileSync(blocker, 'x');
        const dumped: string[] = [];
        // Act
        const { writtenTo } = writeManifest({
            manifest,
            wantedPath: path.join(blocker, 'm.json'),
            fallback: (text) => dumped.push(text)
        });
        // Assert
        expect(writtenTo).toBeNull();
        expect(JSON.parse(dumped[0] ?? '{}').rereadCancelledIds).toEqual(['pre-1']);
        expect(existsSync(path.join(blocker, 'm.json'))).toBe(false);
    });
});

describe('missing probe manifest', () => {
    it('names the file and how to supply another', () => {
        expect(() => readProbeManifest({ path: '/nonexistent/probes.json' })).toThrow(
            /\/nonexistent\/probes\.json.*packages\/payments\/src\/probes\/probes\.json.*--probes/s
        );
    });
});
