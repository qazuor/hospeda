/**
 * Tests for `revocation-reasons` (HOS-1678, H8).
 *
 * What would make the screen silently wrong: a refusal of the API without its
 * copy (the admin reads a raw key), a key that points at nothing in the real
 * Spanish copy, or an unknown reason read as a known one.
 */

import esAdminBilling from '@repo/i18n/locales/es/admin-billing.json';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/errors';
import {
    isKnownRevocationReason,
    KNOWN_REVOCATION_REASONS,
    REVOCATION_CANCEL_CALL_KEYS,
    REVOCATION_ESCALATED_KEYS,
    REVOCATION_NOTICE_KEYS,
    REVOCATION_ORIGIN_COPY,
    REVOCATION_REASON_KEYS,
    readRevocationReason
} from '../revocation-reasons';

/** Resolves an `admin-billing.*` key against the REAL Spanish JSON. */
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

describe('HOS-1678 revocation reasons', () => {
    it('has the twelve reasons of the error contract', () => {
        // Arrange + Act + Assert
        expect(KNOWN_REVOCATION_REASONS).toHaveLength(12);
        expect(new Set(KNOWN_REVOCATION_REASONS).size).toBe(12);
    });

    it.each(KNOWN_REVOCATION_REASONS)('%s has a key that exists in the real es copy', (reason) => {
        // Arrange
        const key = REVOCATION_REASON_KEYS[reason];

        // Act
        const text = resolveEs(key);

        // Assert
        expect(key).toBe(`admin-billing.subscriptionRevocation.blocked.${reason}`);
        expect(typeof text).toBe('string');
        expect((text as string).length).toBeGreaterThan(0);
    });

    it('every notice, origin, cancel-call and escalation key exists in the real es copy', () => {
        // Arrange
        const keys = [
            ...Object.values(REVOCATION_NOTICE_KEYS),
            ...Object.values(REVOCATION_ORIGIN_COPY).flatMap((copy) =>
                copy.extra === null ? [copy.label] : [copy.label, copy.extra]
            ),
            ...Object.values(REVOCATION_CANCEL_CALL_KEYS),
            ...Object.values(REVOCATION_ESCALATED_KEYS)
        ];

        // Act
        const missing = keys.filter((key) => typeof resolveEs(key) !== 'string');

        // Assert
        expect(keys.length).toBeGreaterThan(10);
        expect(missing).toEqual([]);
    });

    it('a reason outside the tuple is not known', () => {
        // Arrange + Act + Assert
        expect(isKnownRevocationReason('RETAINED_PAYMENT_SUCCESSION_OPEN')).toBe(false);
        expect(isKnownRevocationReason('')).toBe(false);
        expect(isKnownRevocationReason('REFUND_EXCEEDS_BALANCE')).toBe(true);
    });

    it('readRevocationReason reads body.error.reason of an ApiError', () => {
        // Arrange
        const error = new ApiError('unprocessable', {
            status: 422,
            body: {
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'x', reason: 'REFUND_EXCEEDS_BALANCE' }
            }
        });

        // Act
        const reason = readRevocationReason({ error });

        // Assert
        expect(reason).toBe('REFUND_EXCEEDS_BALANCE');
    });

    it('readRevocationReason returns null without a body, without a reason or for a plain Error', () => {
        // Arrange + Act + Assert
        expect(readRevocationReason({ error: new ApiError('boom', { status: 500 }) })).toBeNull();
        expect(
            readRevocationReason({
                error: new ApiError('forbidden', { status: 403, body: { error: {} } })
            })
        ).toBeNull();
        expect(readRevocationReason({ error: new Error('network') })).toBeNull();
    });
});
