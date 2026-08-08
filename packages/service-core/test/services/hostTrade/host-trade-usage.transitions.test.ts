/**
 * @fileoverview Confirm / reject / undo transitions for benefit usages (T-021).
 *
 * The rule under test is that `declaredBy` decides WHO may answer: the
 * counterpart of whoever opened the row, and nobody else. Every wrong actor —
 * including the declarant answering their own declaration (AC-6) — gets 404
 * rather than 403, following the anti-oracle criterion of
 * `alliance/protected/claim.ts`.
 */
import type { HostTradeBenefitUsageModel, HostTradeModel, UserModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostTradeUsageService } from '../../../src/services/hostTrade/host-trade-usage.service';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const HT_ID = getMockId('attraction', 'ht-tx-1');
const USAGE_ID = getMockId('feature', 'usage-tx-1');
const OWNER_ID = getMockId('user', 'tx-owner');
const HOST_ID = getMockId('user', 'tx-host');
const STRANGER_ID = getMockId('user', 'tx-stranger');

const actorOf = (id: string) => new ActorFactoryBuilder().withId(id).withPermissions([]).build();

const makeUsage = (overrides: Record<string, unknown> = {}) => ({
    id: USAGE_ID,
    hostTradeId: HT_ID,
    hostUserId: HOST_ID,
    declaredBy: 'PROVIDER',
    declaredById: OWNER_ID,
    status: 'PENDING',
    confirmedAt: null,
    confirmedById: null,
    rejectedAt: null,
    rejectedById: null,
    rejectionNote: null,
    deletedAt: null,
    ...overrides
});

function buildService(usage: Record<string, unknown> = makeUsage()) {
    const model = createModelMock();
    const hostTradeModel = createModelMock();
    const userModel = createModelMock();

    model.findById = vi.fn(async () => usage);
    // `BaseModel.update` takes a WHERE clause first, not an id — the mock
    // mirrors that shape so it cannot accept a call the real model would reject.
    model.update = vi.fn(
        async (_where: Record<string, unknown>, data: Record<string, unknown>) => ({
            ...usage,
            ...data
        })
    );
    hostTradeModel.findById = vi.fn(async () => ({
        id: HT_ID,
        ownerUserId: OWNER_ID,
        revokedAt: null,
        deletedAt: null
    }));

    const service = new HostTradeUsageService(
        { logger: mockLogger },
        model as unknown as HostTradeBenefitUsageModel,
        hostTradeModel as unknown as HostTradeModel,
        userModel as unknown as UserModel,
        async () => true
    );

    return { service, model };
}

/** The patch handed to `model.update`. */
function patch(model: ReturnType<typeof createModelMock>): Record<string, unknown> {
    const call = (model.update as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    return call?.[1] as Record<string, unknown>;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('counterpart resolution', () => {
    it('lets the HOST confirm what the PROVIDER declared', async () => {
        const { service, model } = buildService(makeUsage({ declaredBy: 'PROVIDER' }));

        const result = await service.confirmUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(result.error).toBeUndefined();
        expect(patch(model).status).toBe('CONFIRMED');
    });

    it('lets the PROVIDER OWNER confirm what the HOST declared', async () => {
        const { service, model } = buildService(
            makeUsage({ declaredBy: 'HOST', declaredById: HOST_ID })
        );

        const result = await service.confirmUsage({ usageId: USAGE_ID }, actorOf(OWNER_ID));

        expect(result.error).toBeUndefined();
        expect(patch(model).status).toBe('CONFIRMED');
    });

    /** AC-6 — the declarant may not confirm their own declaration. */
    it('answers 404 when the declarant confirms their own declaration', async () => {
        const { service, model } = buildService(makeUsage({ declaredBy: 'PROVIDER' }));

        const result = await service.confirmUsage({ usageId: USAGE_ID }, actorOf(OWNER_ID));

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('answers 404 for an unrelated third party', async () => {
        const { service, model } = buildService();

        const result = await service.confirmUsage({ usageId: USAGE_ID }, actorOf(STRANGER_ID));

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('answers 404 for a usage that does not exist', async () => {
        const { service, model } = buildService();
        model.findById = vi.fn(async () => null);

        const result = await service.confirmUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });
});

describe('confirmUsage', () => {
    it('seals confirmedAt and confirmedById', async () => {
        const { service, model } = buildService();

        await service.confirmUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        const data = patch(model);
        expect(data.confirmedById).toBe(HOST_ID);
        expect(data.confirmedAt).toBeInstanceOf(Date);
    });

    it('refuses a usage that is no longer PENDING', async () => {
        const { service, model } = buildService(makeUsage({ status: 'CONFIRMED' }));

        const result = await service.confirmUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(result.error).toBeDefined();
        expect(model.update).not.toHaveBeenCalled();
    });
});

describe('rejectUsage', () => {
    it('seals rejectedAt, rejectedById and the note', async () => {
        const { service, model } = buildService();

        await service.rejectUsage(
            { usageId: USAGE_ID, note: 'Nunca vino a casa' },
            actorOf(HOST_ID)
        );

        const data = patch(model);
        expect(data.status).toBe('REJECTED');
        expect(data.rejectedById).toBe(HOST_ID);
        expect(data.rejectedAt).toBeInstanceOf(Date);
        expect(data.rejectionNote).toBe('Nunca vino a casa');
    });

    it('accepts a rejection with no note — refusing must stay cheap', async () => {
        const { service, model } = buildService();

        const result = await service.rejectUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(result.error).toBeUndefined();
        expect(patch(model).rejectionNote).toBeNull();
    });

    it('answers 404 for the declarant rejecting their own declaration', async () => {
        const { service, model } = buildService();

        const result = await service.rejectUsage({ usageId: USAGE_ID }, actorOf(OWNER_ID));

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });
});

describe('undoRejection', () => {
    const rejected = () =>
        makeUsage({
            status: 'REJECTED',
            rejectedAt: new Date('2026-08-01T00:00:00Z'),
            rejectedById: HOST_ID,
            rejectionNote: 'Me equivoqué'
        });

    it('returns the usage to PENDING and clears the rejection stamps', async () => {
        const { service, model } = buildService(rejected());

        const result = await service.undoRejection({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(result.error).toBeUndefined();
        const data = patch(model);
        expect(data.status).toBe('PENDING');
        expect(data.rejectedAt).toBeNull();
        expect(data.rejectedById).toBeNull();
        expect(data.rejectionNote).toBeNull();
    });

    it('answers 404 when somebody other than the rejector undoes it', async () => {
        const { service, model } = buildService(rejected());

        // The counterpart rule alone would let the provider owner undo a
        // rejection aimed at him. Reversal is the rejector's call, not the
        // rejected party's.
        const result = await service.undoRejection({ usageId: USAGE_ID }, actorOf(OWNER_ID));

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('refuses to undo a usage that is not REJECTED', async () => {
        const { service, model } = buildService();

        const result = await service.undoRejection({ usageId: USAGE_ID }, actorOf(HOST_ID));

        expect(result.error).toBeDefined();
        expect(model.update).not.toHaveBeenCalled();
    });
});
