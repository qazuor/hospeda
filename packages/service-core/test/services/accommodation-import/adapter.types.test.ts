import { describe, expect, it } from 'vitest';
import type {
    ImportContext,
    ImportSourceAdapter,
    RawExtraction
} from '../../../src/services/accommodation-import/adapter.types';
import { supportsAsyncExtraction } from '../../../src/services/accommodation-import/adapter.types';

/**
 * Test suite for the HOS-50 (SPEC-277 R3) supportsAsyncExtraction type guard.
 */
describe('supportsAsyncExtraction', () => {
    const syncOnlyAdapter: ImportSourceAdapter = {
        source: 'generic',
        supports: (_url: URL) => true,
        extract: async (_url: URL, _ctx: ImportContext): Promise<RawExtraction> => ({
            sourcePlatform: 'generic'
        })
    };

    const asyncCapableAdapter: ImportSourceAdapter = {
        source: 'airbnb',
        supports: (_url: URL) => true,
        extract: async (_url: URL, _ctx: ImportContext): Promise<RawExtraction> => ({
            sourcePlatform: 'airbnb'
        }),
        extractAsync: async (_url: URL, _ctx: ImportContext) => ({
            runId: 'run-1',
            datasetId: 'dataset-1'
        })
    };

    it('returns false for an adapter without extractAsync', () => {
        expect(supportsAsyncExtraction(syncOnlyAdapter)).toBe(false);
    });

    it('returns true for an adapter with extractAsync', () => {
        expect(supportsAsyncExtraction(asyncCapableAdapter)).toBe(true);
    });

    it('narrows the type so extractAsync is callable without an optional-chaining guard', async () => {
        if (supportsAsyncExtraction(asyncCapableAdapter)) {
            const result = await asyncCapableAdapter.extractAsync(
                new URL('https://airbnb.com/rooms/123'),
                {} as ImportContext
            );
            expect(result).toEqual({ runId: 'run-1', datasetId: 'dataset-1' });
        } else {
            expect.fail('expected supportsAsyncExtraction to narrow to true');
        }
    });
});
