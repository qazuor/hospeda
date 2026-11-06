import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    assertCyclePriceActionPermitted,
    CYCLE_PRICE_REJECTIONS,
    cyclePriceRejection,
    REJECTION_CODES
} from '../../../../src/services/billing/pricing/cycle-price-authorization.js';
import type { Actor } from '../../../../src/types/index.js';

const getDb = vi.fn();
vi.mock('@repo/db', () => ({ getDb }));

const actor = (permissions: PermissionEnum[], system = false): Actor => ({
    id: crypto.randomUUID(),
    roles: [],
    permissions,
    _isSystemActor: system
});

describe('ACC_19 authorization', () => {
    it('forbids an admin without the action permission before database access', () => {
        expect(() =>
            assertCyclePriceActionPermitted({ actor: actor([PermissionEnum.ACCESS_PANEL_ADMIN]) })
        ).toThrowError(expect.objectContaining({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' }));
        expect(getDb).not.toHaveBeenCalled();
    });

    it('forbids a system actor even with the permission', () => {
        expect(() =>
            assertCyclePriceActionPermitted({
                actor: actor([PermissionEnum.BILLING_SET_CYCLE_PRICE], true)
            })
        ).toThrowError(expect.objectContaining({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' }));
        expect(getDb).not.toHaveBeenCalled();
    });

    it('forbids an absent actor', () => {
        expect(() => assertCyclePriceActionPermitted({ actor: undefined })).toThrowError(
            expect.objectContaining({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' })
        );
        expect(getDb).not.toHaveBeenCalled();
    });

    it('allows the dedicated permission', () => {
        expect(() =>
            assertCyclePriceActionPermitted({
                actor: actor([PermissionEnum.BILLING_SET_CYCLE_PRICE])
            })
        ).not.toThrow();
    });

    it.each(CYCLE_PRICE_REJECTIONS)('maps %s to its service error code', (reason) => {
        const error = cyclePriceRejection({ reason, message: reason });
        expect(error.code).toBe(REJECTION_CODES[reason]);
        expect(error.code).toBeOneOf([
            ServiceErrorCode.FORBIDDEN,
            ServiceErrorCode.NOT_FOUND,
            ServiceErrorCode.ALREADY_EXISTS,
            ServiceErrorCode.VALIDATION_ERROR
        ]);
    });
});
