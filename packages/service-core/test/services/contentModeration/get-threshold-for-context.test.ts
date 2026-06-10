import { describe, expect, it, vi } from 'vitest';
import {
    getThresholdForContext,
    invalidateModerationThresholdCache
} from '../../../src/services/contentModeration/get-threshold-for-context';

describe('getThresholdForContext', () => {
    it('returns a context-specific row when present', async () => {
        invalidateModerationThresholdCache();
        const model = {
            findByContext: vi.fn().mockResolvedValue({
                context: 'message',
                pending: 0.3,
                reject: 0.7
            })
        };

        const result = await getThresholdForContext({ context: 'message', model: model as never });

        expect(result).toEqual({
            context: 'message',
            pending: 0.3,
            reject: 0.7,
            source: 'row'
        });
    });

    it('returns the default row when the requested context misses', async () => {
        invalidateModerationThresholdCache();
        const model = {
            findByContext: vi.fn().mockResolvedValue({
                context: 'default',
                pending: 0.5,
                reject: 0.85
            })
        };

        const result = await getThresholdForContext({ context: 'review', model: model as never });

        expect(result.source).toBe('default-row');
        expect(result.context).toBe('default');
    });

    it('falls back to code constants when the table has no rows', async () => {
        invalidateModerationThresholdCache();
        const model = {
            findByContext: vi.fn().mockResolvedValue(null)
        };

        const result = await getThresholdForContext({ context: 'review', model: model as never });

        expect(result).toEqual({
            context: 'default',
            pending: 0.5,
            reject: 0.85,
            source: 'code-constants'
        });
    });
});
