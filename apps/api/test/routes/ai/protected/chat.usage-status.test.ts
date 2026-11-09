import { describe, expect, it } from 'vitest';
import { resolveChatUsageStatus } from '../../../../src/routes/ai/protected/chat.usage-status';

describe('resolveChatUsageStatus', () => {
    it('is success for a non-empty answer', () => {
        expect(resolveChatUsageStatus({ text: 'Hola' })).toEqual({
            status: 'success',
            isEmpty: false
        });
    });

    it('is error for an empty answer', () => {
        expect(resolveChatUsageStatus({ text: '' })).toEqual({ status: 'error', isEmpty: true });
    });

    it('is error for a whitespace-only answer', () => {
        expect(resolveChatUsageStatus({ text: ' \n\t ' }).status).toBe('error');
    });
});
