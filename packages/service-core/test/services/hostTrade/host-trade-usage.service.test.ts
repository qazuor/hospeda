/**
 * @fileoverview Unit tests for HostTradeUsageService declaration (HOS-376 T-019).
 *
 * Covers the three channels of spec §6.2 and the sealing of `expiresAt`:
 * - QR      → declaredBy=HOST,     creationChannel=QR
 * - selector→ declaredBy=PROVIDER, creationChannel=LINKED_SELECTOR
 * - email   → declaredBy=PROVIDER, creationChannel=EMAIL_LOOKUP
 *
 * Plus the refusals that make the channels safe: an email that resolves to
 * nobody (or to somebody who is not a host) answers HOST_NOT_FOUND and writes
 * NOTHING, and a provider declaring on someone else's listing gets 404 rather
 * than 403.
 */
import type { HostTradeBenefitUsageModel, HostTradeModel, UserModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostTradeUsageService } from '../../../src/services/hostTrade/host-trade-usage.service';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const HT_ID = getMockId('attraction', 'ht-usage-1');
const OWNER_ID = getMockId('user', 'provider-owner-1');
const HOST_ID = getMockId('user', 'host-1');
const OTHER_ID = getMockId('user', 'other-1');

const makeHostTrade = (overrides: Record<string, unknown> = {}) => ({
    id: HT_ID,
    slug: 'plomero-centro',
    name: 'Plomero Centro',
    ownerUserId: OWNER_ID,
    revokedAt: null,
    deletedAt: null,
    ...overrides
});

/** Actor that is a host: holds HOST_TRADE_VIEW, the directory's only gate. */
const hostActor = () =>
    new ActorFactoryBuilder()
        .withId(HOST_ID)
        .withPermissions([PermissionEnum.HOST_TRADE_VIEW])
        .build();

/** Actor that owns the listing. Providers get no permission — ownership only. */
const providerActor = () => new ActorFactoryBuilder().withId(OWNER_ID).withPermissions([]).build();

function buildService(options: { isHost?: boolean } = {}) {
    const model = createModelMock();
    const hostTradeModel = createModelMock();
    const userModel = createModelMock();

    model.create = vi.fn(async (data: Record<string, unknown>) => ({ id: 'created', ...data }));
    model.findLinkedHosts = vi.fn(async () => [HOST_ID]);
    hostTradeModel.findById = vi.fn(async () => makeHostTrade());
    userModel.findOne = vi.fn(async () => null);

    const isHostUser = vi.fn(async () => options.isHost ?? true);

    const service = new HostTradeUsageService(
        { logger: mockLogger },
        model as unknown as HostTradeBenefitUsageModel,
        hostTradeModel as unknown as HostTradeModel,
        userModel as unknown as UserModel,
        isHostUser
    );

    return { service, model, hostTradeModel, userModel, isHostUser };
}

/** The single row handed to `model.create`, whatever the channel. */
function createdRow(model: ReturnType<typeof createModelMock>): Record<string, unknown> {
    const call = (model.create as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    return call?.[0] as Record<string, unknown>;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('HostTradeUsageService.declareAsHost — the QR channel', () => {
    it('creates a PENDING usage stamped HOST / QR with the actor as the host', async () => {
        const { service, model } = buildService();

        const result = await service.declareAsHost(
            { hostTradeId: HT_ID, servicedAt: '2026-08-01', note: 'Destapación' },
            hostActor()
        );

        expect(result.error).toBeUndefined();
        const row = createdRow(model);
        expect(row.declaredBy).toBe('HOST');
        expect(row.creationChannel).toBe('QR');
        // The QR path needs no identification mechanism precisely because the
        // host IS the session — both ids come from the actor.
        expect(row.hostUserId).toBe(HOST_ID);
        expect(row.declaredById).toBe(HOST_ID);
    });

    it('seals expiresAt 30 days out', async () => {
        const { service, model } = buildService();
        const before = Date.now();

        await service.declareAsHost({ hostTradeId: HT_ID, servicedAt: '2026-08-01' }, hostActor());

        const expiresAt = createdRow(model).expiresAt as Date;
        const elapsed = expiresAt.getTime() - before;
        const thirtyDays = 30 * 86_400_000;
        expect(elapsed).toBeGreaterThan(thirtyDays - 60_000);
        expect(elapsed).toBeLessThan(thirtyDays + 60_000);
    });

    it('refuses an actor without HOST_TRADE_VIEW', async () => {
        const { service, model } = buildService();
        const stranger = new ActorFactoryBuilder().withId(OTHER_ID).withPermissions([]).build();

        const result = await service.declareAsHost(
            { hostTradeId: HT_ID, servicedAt: '2026-08-01' },
            stranger
        );

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for a provider that does not exist', async () => {
        const { service, model, hostTradeModel } = buildService();
        hostTradeModel.findById = vi.fn(async () => null);

        const result = await service.declareAsHost(
            { hostTradeId: HT_ID, servicedAt: '2026-08-01' },
            hostActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });
});

describe('HostTradeUsageService.declareAsProvider — the selector channel', () => {
    it('creates a PENDING usage stamped PROVIDER / LINKED_SELECTOR', async () => {
        const { service, model } = buildService();

        const result = await service.declareAsProvider(
            { hostTradeId: HT_ID, hostUserId: HOST_ID, servicedAt: '2026-08-01' },
            providerActor()
        );

        expect(result.error).toBeUndefined();
        const row = createdRow(model);
        expect(row.declaredBy).toBe('PROVIDER');
        expect(row.creationChannel).toBe('LINKED_SELECTOR');
        expect(row.hostUserId).toBe(HOST_ID);
        expect(row.declaredById).toBe(OWNER_ID);
    });

    it('refuses a hostUserId that is not among the linked hosts', async () => {
        const { service, model } = buildService();
        model.findLinkedHosts = vi.fn(async () => [OTHER_ID]);

        const result = await service.declareAsProvider(
            { hostTradeId: HT_ID, hostUserId: HOST_ID, servicedAt: '2026-08-01' },
            providerActor()
        );

        // The selector's whole privacy property is that it only ever lists
        // hosts with a confirmed usage. Trusting the body would hand a provider
        // the ability to declare against any user id he can guess.
        expect(result.error?.code).toBe(ServiceErrorCode.HOST_NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND, not FORBIDDEN, on someone else listing', async () => {
        const { service, model, hostTradeModel } = buildService();
        hostTradeModel.findById = vi.fn(async () => makeHostTrade({ ownerUserId: OTHER_ID }));

        const result = await service.declareAsProvider(
            { hostTradeId: HT_ID, hostUserId: HOST_ID, servicedAt: '2026-08-01' },
            providerActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });
});

describe('HostTradeUsageService.declareAsProvider — the email channel', () => {
    it('creates a PENDING usage stamped PROVIDER / EMAIL_LOOKUP', async () => {
        const { service, model, userModel } = buildService();
        userModel.findOne = vi.fn(async () => ({ id: HOST_ID, email: 'anfitrion@example.com' }));

        const result = await service.declareAsProvider(
            {
                hostTradeId: HT_ID,
                hostEmail: 'anfitrion@example.com',
                servicedAt: '2026-08-01'
            },
            providerActor()
        );

        expect(result.error).toBeUndefined();
        const row = createdRow(model);
        expect(row.creationChannel).toBe('EMAIL_LOOKUP');
        expect(row.hostUserId).toBe(HOST_ID);
    });

    it('answers HOST_NOT_FOUND and writes nothing when the email matches nobody', async () => {
        const { service, model, userModel } = buildService();
        userModel.findOne = vi.fn(async () => null);

        const result = await service.declareAsProvider(
            { hostTradeId: HT_ID, hostEmail: 'typo@example.com', servicedAt: '2026-08-01' },
            providerActor()
        );

        expect(result.error?.code).toBe(ServiceErrorCode.HOST_NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('answers HOST_NOT_FOUND when the email matches a user who is not a host', async () => {
        const { service, model, userModel } = buildService({ isHost: false });
        userModel.findOne = vi.fn(async () => ({ id: OTHER_ID, email: 'turista@example.com' }));

        const result = await service.declareAsProvider(
            { hostTradeId: HT_ID, hostEmail: 'turista@example.com', servicedAt: '2026-08-01' },
            providerActor()
        );

        // NG-6: the benefit only exists inside the directory, which requires
        // the host role. A confirmed usage from a non-host would unlock nothing
        // anyway, so accepting it would only inflate the public counter.
        expect(result.error?.code).toBe(ServiceErrorCode.HOST_NOT_FOUND);
        expect(model.create).not.toHaveBeenCalled();
    });

    it('rejects a payload carrying neither identifier', async () => {
        const { service, model } = buildService();

        const result = await service.declareAsProvider(
            { hostTradeId: HT_ID, servicedAt: '2026-08-01' },
            providerActor()
        );

        expect(result.error).toBeDefined();
        expect(model.create).not.toHaveBeenCalled();
    });
});
