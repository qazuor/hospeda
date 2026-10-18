import esAdminBilling from '@repo/i18n/locales/es/admin-billing.json';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/errors';
import {
    CANCELLATION_ADDON_WHEN_OFF_KEYS,
    CANCELLATION_CANCEL_CALL_KEYS,
    CANCELLATION_CONFIRM_KEYS,
    CANCELLATION_CYCLE_KEYS,
    CANCELLATION_ESCALATED_KEYS,
    CANCELLATION_NOTICE_KEYS,
    CANCELLATION_ORIGIN_KEYS,
    CANCELLATION_OUTCOME_KEYS,
    CANCELLATION_REASON_KEYS,
    isKnownCancellationReason,
    KNOWN_CANCELLATION_REASONS,
    readCancellationReason
} from '../cancellation-reasons';

function resolveEs(key: string): unknown {
    return key
        .replace(/^admin-billing\./, '')
        .split('.')
        .reduce<unknown>(
            (node, segment) =>
                typeof node === 'object' && node !== null
                    ? (node as Record<string, unknown>)[segment]
                    : undefined,
            esAdminBilling
        );
}
describe('TEST:1696:3 AC:1696:3 cancellation reasons', () => {
    it('has exhaustive key counts and every key exists in es', () => {
        const maps = [
            CANCELLATION_REASON_KEYS,
            CANCELLATION_NOTICE_KEYS,
            CANCELLATION_ORIGIN_KEYS,
            CANCELLATION_CONFIRM_KEYS,
            CANCELLATION_OUTCOME_KEYS,
            CANCELLATION_CANCEL_CALL_KEYS,
            CANCELLATION_ESCALATED_KEYS,
            CANCELLATION_ADDON_WHEN_OFF_KEYS,
            CANCELLATION_CYCLE_KEYS
        ];
        for (const map of maps)
            for (const key of Object.values(map)) expect(typeof resolveEs(key)).toBe('string');
        expect(KNOWN_CANCELLATION_REASONS).toHaveLength(6);
        expect(Object.keys(CANCELLATION_REASON_KEYS)).toHaveLength(5);
        expect(Object.keys(CANCELLATION_NOTICE_KEYS)).toHaveLength(1);
        expect(Object.keys(CANCELLATION_ORIGIN_KEYS)).toHaveLength(4);
        expect(Object.keys(CANCELLATION_CONFIRM_KEYS)).toHaveLength(3);
        expect(Object.keys(CANCELLATION_OUTCOME_KEYS)).toHaveLength(4);
        expect(Object.keys(CANCELLATION_CANCEL_CALL_KEYS)).toHaveLength(5);
        expect(Object.keys(CANCELLATION_ESCALATED_KEYS)).toHaveLength(2);
        expect(Object.keys(CANCELLATION_ADDON_WHEN_OFF_KEYS)).toHaveLength(3);
        expect(Object.keys(CANCELLATION_CYCLE_KEYS)).toHaveLength(4);
    });
    it('recognizes only known reasons and reads ApiError reason', () => {
        expect(isKnownCancellationReason({ reason: 'CANCELLATION_ORIGIN_CHANGED' })).toBe(true);
        expect(isKnownCancellationReason({ reason: 'OTHER' })).toBe(false);
        expect(
            readCancellationReason({
                error: new ApiError('x', {
                    status: 409,
                    body: { error: { reason: 'CANCELLATION_ORIGIN_CHANGED' } }
                })
            })
        ).toBe('CANCELLATION_ORIGIN_CHANGED');
        expect(readCancellationReason({ error: new Error('x') })).toBeNull();
    });
});
