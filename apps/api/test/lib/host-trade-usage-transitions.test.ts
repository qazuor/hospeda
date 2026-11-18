/**
 * The shared usage transitions (HOS-2332, HOS-2335 §5.0 C-1).
 *
 * The route and the assistant tools both call these, so the property pinned
 * here is the one a caller that skips the HTTP layer would otherwise lose: a
 * successful confirm emails the declarant, a successful reject emails the
 * declarant WITH the note, a refused transition emails nobody, and the undo
 * never emails anyone.
 *
 * @module test/lib/host-trade-usage-transitions
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    confirm: vi.fn(),
    reject: vi.fn(),
    undo: vi.fn(),
    notifyConfirmed: vi.fn(),
    notifyRejected: vi.fn(),
    notifyDeclared: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeUsageService: vi.fn().mockImplementation(function () {
            return {
                confirmUsage: mocks.confirm,
                rejectUsage: mocks.reject,
                undoRejection: mocks.undo
            };
        })
    };
});

vi.mock('../../src/lib/host-trade-notifications', () => ({
    notifyUsageConfirmed: mocks.notifyConfirmed,
    notifyUsageRejected: mocks.notifyRejected,
    notifyUsageDeclared: mocks.notifyDeclared
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { confirmBenefitUsage, rejectBenefitUsage, undoBenefitUsageRejection } = await import(
    '../../src/lib/host-trade-usage-transitions'
);

const ACTOR = {
    id: '11111111-1111-4111-8111-111111111111',
    roles: [],
    permissions: []
} as unknown as Actor;
const USAGE_ID = '33333333-3333-4333-8333-333333333333';
const USAGE = {
    id: USAGE_ID,
    hostTradeId: '22222222-2222-4222-8222-222222222222',
    hostUserId: ACTOR.id,
    declaredBy: 'PROVIDER',
    status: 'CONFIRMED',
    servicedAt: '2026-08-01'
};
const NOT_FOUND = { error: { code: ServiceErrorCode.NOT_FOUND, message: 'Usage not found' } };

beforeEach(() => {
    vi.clearAllMocks();
});

describe('confirmBenefitUsage', () => {
    it('confirms through the service and emails the declarant once', async () => {
        // Arrange
        mocks.confirm.mockResolvedValue({ data: { usage: USAGE } });

        // Act
        const result = await confirmBenefitUsage({ actor: ACTOR, usageId: USAGE_ID });

        // Assert
        expect(mocks.confirm).toHaveBeenCalledWith({ usageId: USAGE_ID }, ACTOR);
        expect(result.data?.usage).toEqual(USAGE);
        expect(mocks.notifyConfirmed).toHaveBeenCalledTimes(1);
        expect(mocks.notifyConfirmed).toHaveBeenCalledWith(USAGE);
        expect(mocks.notifyRejected).not.toHaveBeenCalled();
    });

    it('emails nobody when the service refuses', async () => {
        // Arrange
        mocks.confirm.mockResolvedValue(NOT_FOUND);

        // Act
        const result = await confirmBenefitUsage({ actor: ACTOR, usageId: USAGE_ID });

        // Assert
        expect(result).toEqual(NOT_FOUND);
        expect(mocks.notifyConfirmed).not.toHaveBeenCalled();
    });
});

describe('rejectBenefitUsage', () => {
    it('rejects with the note and emails the declarant with that note', async () => {
        // Arrange
        mocks.reject.mockResolvedValue({ data: { usage: { ...USAGE, status: 'REJECTED' } } });

        // Act
        await rejectBenefitUsage({ actor: ACTOR, usageId: USAGE_ID, note: 'Nunca vino' });

        // Assert
        expect(mocks.reject).toHaveBeenCalledWith({ usageId: USAGE_ID, note: 'Nunca vino' }, ACTOR);
        expect(mocks.notifyRejected).toHaveBeenCalledTimes(1);
        expect(mocks.notifyRejected).toHaveBeenCalledWith(
            expect.objectContaining({ id: USAGE_ID, status: 'REJECTED' }),
            'Nunca vino'
        );
        expect(mocks.notifyConfirmed).not.toHaveBeenCalled();
    });

    it('rejects without a note and emails without one', async () => {
        // Arrange
        mocks.reject.mockResolvedValue({ data: { usage: USAGE } });

        // Act
        await rejectBenefitUsage({ actor: ACTOR, usageId: USAGE_ID });

        // Assert
        expect(mocks.notifyRejected).toHaveBeenCalledWith(USAGE, undefined);
    });

    it('emails nobody when the service refuses', async () => {
        // Arrange
        mocks.reject.mockResolvedValue(NOT_FOUND);

        // Act
        await rejectBenefitUsage({ actor: ACTOR, usageId: USAGE_ID, note: 'x' });

        // Assert
        expect(mocks.notifyRejected).not.toHaveBeenCalled();
    });
});

describe('undoBenefitUsageRejection', () => {
    it('undoes through the service and emails nobody, like the route', async () => {
        // Arrange
        mocks.undo.mockResolvedValue({ data: { usage: { ...USAGE, status: 'PENDING' } } });

        // Act
        const result = await undoBenefitUsageRejection({ actor: ACTOR, usageId: USAGE_ID });

        // Assert
        expect(mocks.undo).toHaveBeenCalledWith({ usageId: USAGE_ID }, ACTOR);
        expect(result.data?.usage.status).toBe('PENDING');
        expect(mocks.notifyConfirmed).not.toHaveBeenCalled();
        expect(mocks.notifyRejected).not.toHaveBeenCalled();
        expect(mocks.notifyDeclared).not.toHaveBeenCalled();
    });
});
