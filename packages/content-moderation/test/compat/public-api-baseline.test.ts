import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as publicApi from '../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type PublicApiBaseline = {
    exportKeys: string[];
    pendingThreshold: number;
    resultCategoryKeys: string[];
    resultKeys: string[];
    moderateTextReturnsPromise: boolean;
};

async function readBaseline(): Promise<PublicApiBaseline> {
    const content = await readFile(resolve(__dirname, './public-api-baseline.json'), 'utf8');
    return JSON.parse(content) as PublicApiBaseline;
}

describe('SPEC-166 public API baseline', () => {
    it('matches the frozen export surface baseline', async () => {
        const baseline = await readBaseline();
        const exportKeys = Object.keys(publicApi).sort();

        expect(exportKeys).toEqual(baseline.exportKeys);
        expect(publicApi.MODERATION_PENDING_THRESHOLD).toBe(baseline.pendingThreshold);
    });

    it('preserves the frozen moderateText result shape', async () => {
        const baseline = await readBaseline();
        const promise = publicApi.moderateText({ text: 'clean baseline input', context: 'review' });

        expect(typeof promise?.then).toBe('function');
        expect(baseline.moderateTextReturnsPromise).toBe(true);

        const result = await promise;

        expect(Object.keys(result).sort()).toEqual(baseline.resultKeys);
        expect(Object.keys(result.categories).sort()).toEqual(baseline.resultCategoryKeys);
        expect(typeof result.score).toBe('number');
        expect(Array.isArray(result.matchedTerms)).toBe(true);
    });
});
