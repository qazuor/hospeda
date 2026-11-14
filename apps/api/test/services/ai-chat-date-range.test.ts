/**
 * resolveChatDateRange (HOS-2075): the day filter shared by the owner panel and the staff view.
 */
import { describe, expect, it } from 'vitest';
import { resolveChatDateRange } from '../../src/services/ai-chat-date-range.js';

const NOW = new Date('2026-11-14T12:00:00.000Z');

describe('resolveChatDateRange', () => {
    it('returns an unbounded range when no day is given', () => {
        expect(resolveChatDateRange({ now: NOW })).toEqual({
            ok: true,
            range: { lowerBound: undefined, upperExclusive: undefined }
        });
    });

    it('starts at the beginning of from and ends at the start of the day after to (inclusive to)', () => {
        const result = resolveChatDateRange({ from: '2026-11-01', to: '2026-11-03', now: NOW });
        expect(result).toEqual({
            ok: true,
            range: {
                lowerBound: new Date('2026-11-01T00:00:00.000Z'),
                upperExclusive: new Date('2026-11-04T00:00:00.000Z')
            }
        });
    });

    it('accepts from and to on the same day', () => {
        const result = resolveChatDateRange({ from: '2026-11-03', to: '2026-11-03', now: NOW });
        expect(result.ok).toBe(true);
    });

    it('rejects from after to', () => {
        const result = resolveChatDateRange({ from: '2026-11-05', to: '2026-11-01', now: NOW });
        expect(result.ok).toBe(false);
    });

    it('rejects a from older than the 12 month horizon', () => {
        expect(resolveChatDateRange({ from: '2025-11-13', now: NOW }).ok).toBe(false);
    });

    it('accepts a from on the first day of the horizon', () => {
        expect(resolveChatDateRange({ from: '2025-11-14', now: NOW }).ok).toBe(true);
    });
});
