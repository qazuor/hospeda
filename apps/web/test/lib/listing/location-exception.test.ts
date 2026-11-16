/**
 * @file location-exception.test.ts
 * @description Owner-side helpers of the location exception request (HOS-2192).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const postProtectedMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ apiClient: { postProtected: postProtectedMock } }));

import {
    canRequestLocationException,
    mapLocationExceptionError,
    requestLocationException,
    resolveLocationExceptionStatus,
    validateLocationExceptionReason
} from '@/lib/listing/location-exception';

const request = (
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
    decisionReason: string | null = null
) => ({
    id: '11111111-1111-4111-8111-111111111111',
    status,
    reason: 'Motivo del dueño',
    decisionReason,
    requestedAt: '2026-11-15T10:00:00.000Z',
    decidedAt: null
});

beforeEach(() => vi.clearAllMocks());

describe('resolveLocationExceptionStatus', () => {
    it('reads none when the block is absent or empty', () => {
        expect(resolveLocationExceptionStatus({ locationException: undefined }).status).toBe(
            'none'
        );
        expect(
            resolveLocationExceptionStatus({
                locationException: { hasException: false, request: null }
            }).status
        ).toBe('none');
    });

    it('reads pending', () => {
        const result = resolveLocationExceptionStatus({
            locationException: { hasException: false, request: request('PENDING') }
        });
        expect(result.status).toBe('pending');
    });

    it('reads approved when an exception is in force, even with a pending request', () => {
        const result = resolveLocationExceptionStatus({
            locationException: { hasException: true, request: request('PENDING') }
        });
        expect(result.status).toBe('approved');
    });

    it('reads an APPROVED request without an exception in force (revoked later) as none', () => {
        const result = resolveLocationExceptionStatus({
            locationException: { hasException: false, request: request('APPROVED') }
        });
        expect(result.status).toBe('none');
    });

    it('reads rejected and carries the admin reason', () => {
        const result = resolveLocationExceptionStatus({
            locationException: {
                hasException: false,
                request: request('REJECTED', 'Falta documentación')
            }
        });
        expect(result).toEqual({ status: 'rejected', decisionReason: 'Falta documentación' });
    });
});

describe('canRequestLocationException', () => {
    it.each([
        ['none', true, true],
        ['rejected', true, true],
        ['pending', true, false],
        ['approved', true, false],
        ['none', false, false],
        ['rejected', false, false]
    ] as const)('status %s with duplicate=%s -> %s', (status, locationDuplicate, expected) => {
        expect(canRequestLocationException({ status, locationDuplicate })).toBe(expected);
    });
});

describe('validateLocationExceptionReason', () => {
    it('rejects 9 characters and accepts 10', () => {
        expect(validateLocationExceptionReason({ reason: 'a'.repeat(9) })).toMatchObject({
            ok: false,
            errorKey: 'tooShort'
        });
        expect(validateLocationExceptionReason({ reason: 'a'.repeat(10) }).ok).toBe(true);
    });

    it('measures the trimmed text, like the API', () => {
        expect(validateLocationExceptionReason({ reason: `   ${'a'.repeat(9)}   ` }).ok).toBe(
            false
        );
    });

    it('accepts 500 and rejects 501', () => {
        expect(validateLocationExceptionReason({ reason: 'a'.repeat(500) }).ok).toBe(true);
        expect(validateLocationExceptionReason({ reason: 'a'.repeat(501) })).toMatchObject({
            ok: false,
            errorKey: 'tooLong'
        });
    });
});

describe('mapLocationExceptionError', () => {
    it.each([
        ['LOCATION_EXCEPTION_REQUEST_PENDING', 'requestPending'],
        ['LOCATION_EXCEPTION_ALREADY_GRANTED', 'alreadyGranted'],
        ['LOCATION_EXCEPTION_NOT_NEEDED', 'notNeeded'],
        ['LOCATION_EXCEPTION_NEEDS_KEY', 'needsKey']
    ])('maps the 409 reason %s', (reason, key) => {
        expect(mapLocationExceptionError({ error: { status: 409, reason } })).toBe(key);
    });

    it('maps 400 and 404 to their own messages and the rest to generic', () => {
        expect(mapLocationExceptionError({ error: { status: 400 } })).toBe('invalidReason');
        expect(mapLocationExceptionError({ error: { status: 404 } })).toBe('notFound');
        expect(mapLocationExceptionError({ error: { status: 409, reason: 'OTHER' } })).toBe(
            'generic'
        );
        expect(mapLocationExceptionError({ error: { status: 500 } })).toBe('generic');
    });
});

describe('requestLocationException', () => {
    it.each([
        ['accommodation', 'accommodations'],
        ['venue', 'venues']
    ] as const)('posts the trimmed reason to the %s owner endpoint', async (vertical, plural) => {
        postProtectedMock.mockResolvedValue({ ok: true, data: { id: 'r1', status: 'PENDING' } });
        await requestLocationException({
            vertical,
            listingId: 'abc',
            reason: '  motivo largo ok  '
        });
        expect(postProtectedMock).toHaveBeenCalledWith({
            path: `/api/v1/protected/${plural}/abc/location-exception-request`,
            body: { reason: 'motivo largo ok' }
        });
    });
});
