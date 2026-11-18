import { describe, expect, it } from 'vitest';
import {
    UMAMI_BLOCK_ATTRIBUTE,
    UMAMI_BLOCK_SELECTOR
} from '../../apps/web/src/lib/analytics/recording-block.js';
import { planRecorderChange } from '../umami/recorder-client.js';
import {
    buildRecorderDefinition,
    normalizeReplayConfig,
    RECORDER_MAX_DURATION_MS,
    RECORDER_SAMPLE_RATE,
    withRecorderDefaults
} from '../umami/recorder-definitions.js';
import { runSetup } from '../umami/setup.js';
import { baseInput, fakeUmami, WEBSITE, writes } from './umami-fake.js';

const DECLARED = buildRecorderDefinition();
const websitePath = `/api/websites/${WEBSITE}`;

describe('recorder definitions (HOS-2347)', () => {
    it('AC-B2: blockSelector derives from the same attribute the components use', () => {
        expect(DECLARED.blockSelector).toBe(`[${UMAMI_BLOCK_ATTRIBUTE}]`);
        expect(DECLARED.blockSelector).toBe(UMAMI_BLOCK_SELECTOR);
        expect(UMAMI_BLOCK_ATTRIBUTE).toBe('data-umami-block');
    });

    it('AC-B3: declares strict masking', () => {
        expect(DECLARED.maskLevel).toBe('strict');
    });

    it('AC-S5: one 0.5 sample rate for replays and heatmaps, 5-minute cap', () => {
        expect(RECORDER_SAMPLE_RATE).toBe(0.5);
        expect(DECLARED.sampleRate).toBe(RECORDER_SAMPLE_RATE);
        expect(DECLARED.heatmapSampleRate).toBe(RECORDER_SAMPLE_RATE);
        expect(DECLARED.maxDuration).toBe(300_000);
        expect(RECORDER_MAX_DURATION_MS).toBe(300_000);
    });

    it('declares replays and heatmaps on, with exactly the seven Umami keys', () => {
        expect(DECLARED).toEqual({
            replayEnabled: true,
            heatmapEnabled: true,
            sampleRate: 0.5,
            heatmapSampleRate: 0.5,
            maskLevel: 'strict',
            maxDuration: 300_000,
            blockSelector: '[data-umami-block]'
        });
    });

    it('normalizes like Umami: drops false booleans, unknown keys and bad types', () => {
        const normalized = normalizeReplayConfig({
            raw: {
                replayEnabled: false,
                heatmapEnabled: true,
                sampleRate: '0.5',
                maskLevel: 'loose',
                maxDuration: 299_999.6,
                extra: 1
            }
        });
        expect(normalized).toEqual({ heatmapEnabled: true, maxDuration: 300_000 });
        expect(normalizeReplayConfig({ raw: null })).toEqual({});
        expect(normalizeReplayConfig({ raw: [1] })).toEqual({});
    });

    it('applies the recorder GET defaults to a sparse config', () => {
        expect(withRecorderDefaults({ config: {} })).toEqual({
            replayEnabled: false,
            heatmapEnabled: false,
            sampleRate: 0.15,
            heatmapSampleRate: 0.15,
            maskLevel: 'moderate',
            maxDuration: 300_000,
            blockSelector: ''
        });
    });
});

describe('planRecorderChange (HOS-2347)', () => {
    it('compares defaulted values: a sparse store equal after defaults is unchanged', () => {
        // Arrange: the store omits maxDuration, whose default equals the declared value.
        const { maxDuration: _omitted, ...sparse } = DECLARED;

        // Act
        const plan = planRecorderChange({
            website: { id: WEBSITE, recorderEnabled: true, replayConfig: sparse },
            desired: DECLARED
        });

        // Assert
        expect(plan).toEqual({ action: 'unchanged', changes: [], unmanagedKeys: [] });
    });

    it('derives recorderEnabled from the config when the read omits it (no false "updated")', () => {
        // Arrange: a website read with no recorderEnabled field at all.
        const plan = planRecorderChange({
            website: { id: WEBSITE, replayConfig: DECLARED },
            desired: DECLARED
        });

        // Assert
        expect(plan).toEqual({ action: 'unchanged', changes: [], unmanagedKeys: [] });
    });

    it('a read that omits recorderEnabled over a disabled config still plans the enable', () => {
        const plan = planRecorderChange({
            website: { id: WEBSITE, replayConfig: { sampleRate: 0.5 } },
            desired: DECLARED
        });

        expect(plan.changes[0]).toEqual({ field: 'recorderEnabled', from: false, to: true });
    });

    it('lists every differing field, recorderEnabled included', () => {
        const plan = planRecorderChange({
            website: { id: WEBSITE, recorderEnabled: false, replayConfig: null },
            desired: DECLARED
        });

        expect(plan.action).toBe('updated');
        expect(plan.changes).toEqual([
            { field: 'recorderEnabled', from: false, to: true },
            { field: 'replayConfig.replayEnabled', from: false, to: true },
            { field: 'replayConfig.heatmapEnabled', from: false, to: true },
            { field: 'replayConfig.sampleRate', from: 0.15, to: 0.5 },
            { field: 'replayConfig.heatmapSampleRate', from: 0.15, to: 0.5 },
            { field: 'replayConfig.maskLevel', from: 'moderate', to: 'strict' },
            { field: 'replayConfig.blockSelector', from: '', to: '[data-umami-block]' }
        ]);
    });
});

describe('runSetup recorder step (HOS-2347)', () => {
    it('AC-S1: writes the declared config once and reports updated', async () => {
        // Arrange
        const fake = fakeUmami();

        // Act
        const result = await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.recorder).toEqual({ created: 0, updated: 1, unchanged: 0 });
        expect(writes(fake.calls).filter((c) => c.path === websitePath)).toEqual([
            { method: 'POST', path: websitePath }
        ]);
        expect(fake.website.recorderEnabled).toBe(true);
        expect(fake.website.replayConfig).toEqual(DECLARED);
    });

    it('AC-S2: a second run reports unchanged and sends no write', async () => {
        const fake = fakeUmami();
        await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);
        fake.calls.length = 0;

        const result = await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);

        expect(result.recorder).toEqual({ created: 0, updated: 0, unchanged: 1 });
        expect(writes(fake.calls)).toEqual([]);
    });

    it('AC-S3: dry-run sends only GETs and prints the per-field diff', async () => {
        // Arrange
        const fake = fakeUmami();
        const { input, out } = baseInput({ fetchImpl: fake.fetchImpl, dryRun: true });

        // Act
        const result = await runSetup(input);

        // Assert
        expect(result.recorder.updated).toBe(1);
        expect(fake.calls.filter((c) => c.method !== 'GET')).toEqual([]);
        expect(fake.website.replayConfig).toBeNull();
        const text = out.join('\n');
        expect(text).toContain('replayConfig.sampleRate: 0.15 -> 0.5');
        expect(text).toContain('replayConfig.maskLevel: "moderate" -> "strict"');
        expect(text).toContain('recorderEnabled: false -> true');
    });

    it('AC-S4: lists a stored undeclared key as unmanaged and never sends it, name or domain', async () => {
        // Arrange: a stored key this script does not declare. Real Umami drops
        // unknown keys on any write (the fake does too), so the guarantee the
        // script can give is that it never SENDS one, nor any website field.
        const fake = fakeUmami({
            website: { replayConfig: { sampleRate: 0.15, futureKey: 'stored' } }
        });
        const before = { name: fake.website.name, domain: fake.website.domain };
        const bodies: unknown[] = [];
        const spying = (async (url: string | URL | Request, init?: RequestInit) => {
            if (init?.method === 'POST' && String(url).endsWith(websitePath)) {
                bodies.push(JSON.parse(String(init.body)));
            }
            return fake.fetchImpl(url, init);
        }) as typeof fetch;

        // Act
        const result = await runSetup(baseInput({ fetchImpl: spying }).input);

        // Assert
        expect(result.unmanaged).toContainEqual({ kind: 'recorder-config-key', name: 'futureKey' });
        expect(bodies).toEqual([{ replayConfig: DECLARED }]);
        expect(Object.keys((bodies[0] as { replayConfig: object }).replayConfig).sort()).toEqual(
            Object.keys(DECLARED).sort()
        );
        expect({ name: fake.website.name, domain: fake.website.domain }).toEqual(before);
        // Umami's own normalization dropped the unknown key on the write.
        expect(fake.website.replayConfig).toEqual(DECLARED);
    });

    it('fails with exit 1 (token-free) when the website read fails', async () => {
        const fake = fakeUmami();
        const failing = (async (url: string | URL | Request, init?: RequestInit) =>
            String(url).endsWith(websitePath)
                ? new Response('{"error":"nope"}', { status: 403 })
                : fake.fetchImpl(url, init)) as typeof fetch;
        const { input, err } = baseInput({ fetchImpl: failing });

        const result = await runSetup(input);

        expect(result.exitCode).toBe(1);
        expect(err.join('\n')).toContain('recorder config');
    });
});
