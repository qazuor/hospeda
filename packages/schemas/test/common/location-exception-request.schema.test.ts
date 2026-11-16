import { describe, expect, it } from 'vitest';
import {
    LOCATION_EXCEPTION_EVENT_ACTIONS,
    LOCATION_EXCEPTION_REASON_MAX,
    LOCATION_EXCEPTION_REASON_MIN,
    LOCATION_EXCEPTION_REASONS,
    LOCATION_EXCEPTION_REQUEST_STATUSES,
    LocationExceptionApproveInputSchema,
    LocationExceptionRejectInputSchema,
    LocationExceptionRequestInputSchema,
    LocationExceptionRequestsQuerySchema,
    LocationExceptionRevokeInputSchema
} from '../../src/common/location-rule.schema.js';

const ok = 'a'.repeat(LOCATION_EXCEPTION_REASON_MIN);

describe('location exception request schemas (HOS-2192)', () => {
    it.each([
        ['request', LocationExceptionRequestInputSchema],
        ['reject', LocationExceptionRejectInputSchema]
    ])('%s requires a reason of 10 to 500 characters', (_name, schema) => {
        expect(schema.safeParse({ reason: ok }).success).toBe(true);
        expect(
            schema.safeParse({ reason: 'a'.repeat(LOCATION_EXCEPTION_REASON_MAX) }).success
        ).toBe(true);
        expect(schema.safeParse({}).success).toBe(false);
        expect(
            schema.safeParse({ reason: 'a'.repeat(LOCATION_EXCEPTION_REASON_MIN - 1) }).success
        ).toBe(false);
        expect(
            schema.safeParse({ reason: 'a'.repeat(LOCATION_EXCEPTION_REASON_MAX + 1) }).success
        ).toBe(false);
    });

    it('trims the reason before counting it', () => {
        expect(
            LocationExceptionRequestInputSchema.safeParse({ reason: `  ${'a'.repeat(9)}  ` })
                .success
        ).toBe(false);
    });

    it.each([
        ['approve', LocationExceptionApproveInputSchema],
        ['revoke', LocationExceptionRevokeInputSchema]
    ])('%s accepts no reason but validates one that is present', (_name, schema) => {
        expect(schema.safeParse({}).success).toBe(true);
        expect(schema.safeParse({ reason: ok }).success).toBe(true);
        expect(schema.safeParse({ reason: 'corta' }).success).toBe(false);
    });

    it('defaults the queue to PENDING, page 1 and pageSize 20 and refuses `limit`-style sizes', () => {
        expect(LocationExceptionRequestsQuerySchema.parse({})).toEqual({
            status: 'PENDING',
            page: 1,
            pageSize: 20
        });
        expect(LocationExceptionRequestsQuerySchema.safeParse({ pageSize: '101' }).success).toBe(
            false
        );
    });

    it('keeps the closed lists the database CHECK constraints are built from', () => {
        expect(LOCATION_EXCEPTION_REQUEST_STATUSES).toEqual([
            'PENDING',
            'APPROVED',
            'REJECTED',
            'SUPERSEDED'
        ]);
        expect(LOCATION_EXCEPTION_EVENT_ACTIONS).toEqual([
            'REQUESTED',
            'APPROVED',
            'REJECTED',
            'GRANTED',
            'REVOKED',
            'SUPERSEDED'
        ]);
        expect(new Set(Object.values(LOCATION_EXCEPTION_REASONS)).size).toBe(7);
    });
});
