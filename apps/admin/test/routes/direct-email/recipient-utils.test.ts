/**
 * @file recipient-utils.test.ts
 * HOS-2685: recipient parsing, validation, dedup and cap.
 */
import { describe, expect, it } from 'vitest';
import {
    addRecipients,
    pickSuppressed,
    splitRecipientTokens
} from '@/routes/_authed/direct-emails/-components/recipient-utils';

describe('splitRecipientTokens', () => {
    it('splits on commas, semicolons and whitespace and drops empties', () => {
        expect(splitRecipientTokens({ raw: ' a@x.com, b@x.com;c@x.com\n d@x.com ,, ' })).toEqual([
            'a@x.com',
            'b@x.com',
            'c@x.com',
            'd@x.com'
        ]);
    });
});

describe('addRecipients', () => {
    it('adds a valid address lowercased and trimmed', () => {
        const result = addRecipients({ current: [], raw: '  Ana@Empresa.COM ' });

        expect(result.recipients).toEqual(['ana@empresa.com']);
        expect(result.rejected).toEqual([]);
    });

    it('rejects an invalid address and keeps the list', () => {
        const result = addRecipients({ current: ['a@x.com'], raw: 'not-an-email' });

        expect(result.recipients).toEqual(['a@x.com']);
        expect(result.rejected).toEqual([{ value: 'not-an-email', reason: 'invalid' }]);
    });

    it('dedups case-insensitively against the list', () => {
        const result = addRecipients({ current: ['ana@x.com'], raw: 'ANA@x.com' });

        expect(result.recipients).toEqual(['ana@x.com']);
        expect(result.rejected[0]?.reason).toBe('duplicate');
    });

    it('dedups within a single paste', () => {
        const result = addRecipients({ current: [], raw: 'a@x.com A@x.com b@x.com' });

        expect(result.recipients).toEqual(['a@x.com', 'b@x.com']);
        expect(result.rejected.map((item) => item.reason)).toEqual(['duplicate']);
    });

    it('enforces the maximum and reports the overflow as limit', () => {
        const result = addRecipients({
            current: ['a@x.com', 'b@x.com'],
            raw: 'c@x.com d@x.com',
            max: 3
        });

        expect(result.recipients).toEqual(['a@x.com', 'b@x.com', 'c@x.com']);
        expect(result.rejected).toEqual([{ value: 'd@x.com', reason: 'limit' }]);
    });

    it('uses the API cap of 20 by default', () => {
        const current = Array.from({ length: 20 }, (_, index) => `u${index}@x.com`);

        const result = addRecipients({ current, raw: 'extra@x.com' });

        expect(result.recipients).toHaveLength(20);
        expect(result.rejected[0]?.reason).toBe('limit');
    });
});

describe('pickSuppressed', () => {
    it('returns only the suppressed recipients in list order', () => {
        expect(
            pickSuppressed({
                recipients: ['a@x.com', 'b@x.com', 'c@x.com'],
                suppressed: new Set(['c@x.com', 'a@x.com'])
            })
        ).toEqual(['a@x.com', 'c@x.com']);
    });
});
