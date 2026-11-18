/**
 * @fileoverview The read half of the usage transitions (HOS-2332): the shared
 * counterpart rule `isUsageCounterpart` and `getAnswerableUsage`, which the MCP
 * confirm / reject preview reads through.
 *
 * The property under test is that the preview refuses EXACTLY where the
 * transition refuses: the declarant answering their own declaration (AC-6), a
 * third party and a missing id are one NOT_FOUND, and nothing is written.
 */
import type {
    HostTradeBenefitUsageModel,
    HostTradeModel,
    HostTradeReviewModel,
    UserModel
} from '@repo/db';
import { HostTradeUsageDeclaredByEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isUsageCounterpart } from '../../../src/services/hostTrade/host-trade-usage.permissions';
import { HostTradeUsageService } from '../../../src/services/hostTrade/host-trade-usage.service';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const HT_ID = getMockId('attraction', 'ht-answerable-1');
const USAGE_ID = getMockId('feature', 'usage-answerable-1');
const OWNER_ID = getMockId('user', 'answerable-owner');
const HOST_ID = getMockId('user', 'answerable-host');
const STRANGER_ID = getMockId('user', 'answerable-stranger');

const actorOf = (id: string) => new ActorFactoryBuilder().withId(id).withPermissions([]).build();

const makeUsage = (overrides: Record<string, unknown> = {}) => ({
    id: USAGE_ID,
    hostTradeId: HT_ID,
    hostUserId: HOST_ID,
    declaredBy: 'PROVIDER',
    declaredById: OWNER_ID,
    status: 'PENDING',
    rejectedById: null,
    deletedAt: null,
    ...overrides
});

function buildService(usage: Record<string, unknown> | null = makeUsage()) {
    const model = createModelMock();
    const hostTradeModel = createModelMock(['findByIds']);
    hostTradeModel.hydrateCategories = vi.fn(async () => new Map());
    const reviewModel = createModelMock();
    model.findById = vi.fn(async () => usage);
    hostTradeModel.findById = vi.fn(async () => ({ id: HT_ID, ownerUserId: OWNER_ID }));
    hostTradeModel.findByIds = vi.fn(async (ids: readonly string[]) =>
        ids.map((id) => ({ id, slug: 'plomero-centro', name: 'Plomero Centro' }))
    );
    reviewModel.findAll = vi.fn(async () => ({ items: [], total: 0 }));

    const service = new HostTradeUsageService(
        { logger: createLoggerMock() },
        model as unknown as HostTradeBenefitUsageModel,
        hostTradeModel as unknown as HostTradeModel,
        createModelMock() as unknown as UserModel,
        async () => true,
        reviewModel as unknown as HostTradeReviewModel
    );
    return { service, model, hostTradeModel };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('isUsageCounterpart', () => {
    it('names the host as the counterpart of a provider-declared row', () => {
        // Arrange
        const row = { declaredBy: HostTradeUsageDeclaredByEnum.PROVIDER, hostUserId: HOST_ID };

        // Act / Assert
        expect(isUsageCounterpart({ ...row, providerOwnerUserId: null, actorId: HOST_ID })).toBe(
            true
        );
        expect(
            isUsageCounterpart({ ...row, providerOwnerUserId: OWNER_ID, actorId: OWNER_ID })
        ).toBe(false);
    });

    it('names the listing owner as the counterpart of a host-declared row', () => {
        // Arrange
        const row = { declaredBy: HostTradeUsageDeclaredByEnum.HOST, hostUserId: HOST_ID };

        // Act / Assert
        expect(
            isUsageCounterpart({ ...row, providerOwnerUserId: OWNER_ID, actorId: OWNER_ID })
        ).toBe(true);
        expect(
            isUsageCounterpart({ ...row, providerOwnerUserId: OWNER_ID, actorId: HOST_ID })
        ).toBe(false);
    });

    it('has no counterpart when the listing owner is unknown', () => {
        // Act / Assert
        expect(
            isUsageCounterpart({
                declaredBy: HostTradeUsageDeclaredByEnum.HOST,
                hostUserId: HOST_ID,
                providerOwnerUserId: null,
                actorId: HOST_ID
            })
        ).toBe(false);
    });
});

describe('getAnswerableUsage', () => {
    it('returns a provider-declared usage to its host, with the provider ref', async () => {
        // Arrange
        const { service, model } = buildService();

        // Act
        const result = await service.getAnswerableUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.usage.id).toBe(USAGE_ID);
        expect(result.data?.usage.hostTrade?.name).toBe('Plomero Centro');
        expect(model.update).not.toHaveBeenCalled();
    });

    it('returns a host-declared usage to the listing owner', async () => {
        // Arrange
        const { service } = buildService(makeUsage({ declaredBy: 'HOST', declaredById: HOST_ID }));

        // Act
        const result = await service.getAnswerableUsage({ usageId: USAGE_ID }, actorOf(OWNER_ID));

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.usage.id).toBe(USAGE_ID);
    });

    it('AC-6: answers NOT_FOUND to the declarant of the row', async () => {
        // Arrange
        const { service } = buildService();

        // Act
        const result = await service.getAnswerableUsage({ usageId: USAGE_ID }, actorOf(OWNER_ID));

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('answers the same NOT_FOUND to a third party and for a missing id', async () => {
        // Arrange
        const foreign = buildService();
        const missing = buildService(null);

        // Act
        const third = await foreign.service.getAnswerableUsage(
            { usageId: USAGE_ID },
            actorOf(STRANGER_ID)
        );
        const absent = await missing.service.getAnswerableUsage(
            { usageId: USAGE_ID },
            actorOf(HOST_ID)
        );

        // Assert
        expect(third.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(absent.error).toEqual(third.error);
    });

    it('does not check the state: an already-confirmed row still reads', async () => {
        // Arrange
        const { service } = buildService(makeUsage({ status: 'CONFIRMED' }));

        // Act
        const result = await service.getAnswerableUsage({ usageId: USAGE_ID }, actorOf(HOST_ID));

        // Assert
        expect(result.data?.usage.status).toBe('CONFIRMED');
    });
});
