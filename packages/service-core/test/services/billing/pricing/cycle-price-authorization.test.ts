import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    previewCyclePrice,
    setCyclePrice
} from '../../../../src/services/billing/pricing/cycle-price.service.js';
import {
    assertCyclePriceActionPermitted,
    CYCLE_PRICE_REJECTIONS,
    cyclePriceRejection,
    REJECTION_CODES
} from '../../../../src/services/billing/pricing/cycle-price-authorization.js';
import type { Actor } from '../../../../src/types/index.js';

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('@repo/db', () => ({
    and: vi.fn(),
    billingOptions: {},
    domainEventModel: { insert: vi.fn() },
    eq: vi.fn(),
    getDb,
    planVersions: {},
    sql: vi.fn(),
    subscriptions: {}
}));

const actor = (permissions: PermissionEnum[], system = false): Actor => ({
    id: crypto.randomUUID(),
    roles: [],
    permissions,
    _isSystemActor: system
});

async function expectRejectedBeforeDb(candidate?: Actor): Promise<void> {
    await expect(previewCyclePrice({ actor: candidate, input: {} })).rejects.toMatchObject({
        reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
    });
    await expect(
        setCyclePrice({ actor: candidate, input: {}, correlationId: crypto.randomUUID() })
    ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
    expect(getDb).not.toHaveBeenCalled();
}

describe('ACC_19 authorization', () => {
    it('forbids an admin without the action permission before database access', async () => {
        const candidate = actor([PermissionEnum.ACCESS_PANEL_ADMIN]);
        expect(() => assertCyclePriceActionPermitted({ actor: candidate })).toThrowError(
            expect.objectContaining({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' })
        );
        await expectRejectedBeforeDb(candidate);
    });

    it('forbids a system actor even with the permission', async () => {
        const candidate = actor([PermissionEnum.BILLING_SET_CYCLE_PRICE], true);
        expect(() =>
            assertCyclePriceActionPermitted({
                actor: candidate
            })
        ).toThrowError(expect.objectContaining({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' }));
        await expectRejectedBeforeDb(candidate);
    });

    it('forbids an absent actor', async () => {
        expect(() => assertCyclePriceActionPermitted({ actor: undefined })).toThrowError(
            expect.objectContaining({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' })
        );
        await expectRejectedBeforeDb(undefined);
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
