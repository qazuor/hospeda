/**
 * @fileoverview The admin usage listing resolves both sides' names (HOS-376 T-056).
 *
 * The raw row names two people by uuid. A triage screen built on that shows
 * `a3f9…8c21` where it needs to show "Plomero Centro", and the question it
 * exists to answer — is this provider manufacturing usages? — cannot be read
 * off it at all: "40 usos, 2 anfitriones" is a pattern only if the two hosts
 * are legible as two hosts.
 *
 * The resolution must be ONE query per side per page, and must not be
 * load-bearing: a name that fails to resolve keeps its row.
 */
import type {
    HostTradeBenefitUsageModel,
    HostTradeModel,
    HostTradeReviewModel,
    UserModel
} from '@repo/db';
import type { HostTradeBenefitUsageAdmin } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostTradeUsageService } from '../../../src/services/hostTrade/host-trade-usage.service';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const TRADE_A = getMockId('attraction', 'ht-admin-a');
const TRADE_B = getMockId('attraction', 'ht-admin-b');
const HOST_A = getMockId('user', 'host-admin-a');
const HOST_B = getMockId('user', 'host-admin-b');

/** Actor allowed to read every usage row. */
const adminActor = () =>
    new ActorFactoryBuilder()
        .withId(getMockId('user', 'admin-1'))
        .withPermissions([
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.HOST_TRADE_USAGE_VIEW_ALL
        ])
        .build();

const makeUsage = (hostTradeId: string, hostUserId: string, id: string) => ({
    id: getMockId('feature', id),
    hostTradeId,
    hostUserId,
    declaredBy: 'PROVIDER',
    declaredById: hostUserId,
    creationChannel: 'EMAIL_LOOKUP',
    status: 'PENDING',
    servicedAt: new Date('2026-08-01'),
    note: null,
    expiresAt: new Date('2026-09-01'),
    confirmedAt: null,
    rejectedAt: null,
    rejectionNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
});

function buildService(options: {
    usages: ReturnType<typeof makeUsage>[];
    /** Provider ids the directory resolves. Anything else comes back missing. */
    knownTradeIds?: readonly string[];
    /** Host ids the users table resolves. */
    knownHostIds?: readonly string[];
}) {
    const model = createModelMock();
    const hostTradeModel = createModelMock(['findByIds']);
    const userModel = createModelMock(['findByIds']);
    const reviewModel = createModelMock();

    model.findAll = vi.fn(async () => ({ items: options.usages, total: options.usages.length }));
    model.getTable = vi.fn().mockReturnValue({ createdAt: {}, deletedAt: {} });

    const knownTradeIds = options.knownTradeIds ?? [TRADE_A, TRADE_B];
    const findTradesByIds = vi.fn(async (ids: readonly string[]) =>
        ids
            .filter((id) => knownTradeIds.includes(id))
            .map((id) => ({
                id,
                slug: `slug-${id.slice(0, 6)}`,
                name: `Proveedor ${id.slice(0, 4)}`,
                category: 'PLOMERIA'
            }))
    );
    hostTradeModel.findByIds = findTradesByIds;

    const knownHostIds = options.knownHostIds ?? [HOST_A, HOST_B];
    const findHostsByIds = vi.fn(async (ids: readonly string[]) =>
        ids
            .filter((id) => knownHostIds.includes(id))
            .map((id) => ({
                id,
                displayName: `Anfitrión ${id.slice(0, 4)}`,
                firstName: null,
                lastName: null
            }))
    );
    userModel.findByIds = findHostsByIds;

    const service = new HostTradeUsageService(
        { logger: mockLogger },
        model as unknown as HostTradeBenefitUsageModel,
        hostTradeModel as unknown as HostTradeModel,
        userModel as unknown as UserModel,
        vi.fn(async () => true),
        reviewModel as unknown as HostTradeReviewModel
    );

    return { service, model, findTradesByIds, findHostsByIds };
}

/**
 * The page as the ADMIN schema shapes it.
 *
 * `adminList` is typed on the base row — the enrichment is added by this
 * service and validated at the route boundary against
 * `HostTradeBenefitUsageAdminSchema`, per the ADR-022 convention that services
 * stay relation-agnostic at the type level. The cast asserts nothing at
 * runtime: a service that stopped attaching the refs would still compile here
 * and fail every assertion below, which is the point.
 */
function adminRows(items: readonly unknown[]): HostTradeBenefitUsageAdmin[] {
    return items as HostTradeBenefitUsageAdmin[];
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('HostTradeUsageService.adminList — resolving both sides', () => {
    it('attaches the provider and the host of every row', async () => {
        const { service } = buildService({
            usages: [makeUsage(TRADE_A, HOST_A, 'u-1')]
        });

        const result = await service.adminList(adminActor(), {});

        expect(result.error).toBeUndefined();
        const [row] = adminRows(result.data?.items ?? []);
        expect(row?.hostTrade).toMatchObject({
            id: TRADE_A,
            name: `Proveedor ${TRADE_A.slice(0, 4)}`
        });
        expect(row?.host).toMatchObject({
            id: HOST_A,
            displayName: `Anfitrión ${HOST_A.slice(0, 4)}`
        });
    });

    it('resolves a whole page in one query per side, with ids deduplicated', async () => {
        const { service, findTradesByIds, findHostsByIds } = buildService({
            usages: [
                makeUsage(TRADE_A, HOST_A, 'u-1'),
                makeUsage(TRADE_A, HOST_A, 'u-2'),
                makeUsage(TRADE_B, HOST_B, 'u-3')
            ]
        });

        await service.adminList(adminActor(), {});

        expect(findTradesByIds).toHaveBeenCalledTimes(1);
        expect(findHostsByIds).toHaveBeenCalledTimes(1);
        expect(findTradesByIds.mock.calls[0]?.[0]).toEqual([TRADE_A, TRADE_B]);
        expect(findHostsByIds.mock.calls[0]?.[0]).toEqual([HOST_A, HOST_B]);
    });

    it('keeps a row whose provider does not resolve, with a null provider', async () => {
        const { service } = buildService({
            usages: [makeUsage(TRADE_A, HOST_A, 'u-1'), makeUsage(TRADE_B, HOST_B, 'u-2')],
            knownTradeIds: [TRADE_A]
        });

        const result = await service.adminList(adminActor(), {});

        const rows = adminRows(result.data?.items ?? []);
        expect(rows).toHaveLength(2);
        expect(rows[1]?.hostTrade).toBeNull();
        // The other side still resolves: one missing name must not blank the row.
        expect(rows[1]?.host).not.toBeNull();
    });

    it('keeps a row whose host does not resolve, with a null host', async () => {
        const { service } = buildService({
            usages: [makeUsage(TRADE_A, HOST_A, 'u-1')],
            knownHostIds: []
        });

        const result = await service.adminList(adminActor(), {});

        const rows = adminRows(result.data?.items ?? []);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.host).toBeNull();
        expect(rows[0]?.hostTrade).not.toBeNull();
    });

    it('queries nothing when the page is empty', async () => {
        const { service, findTradesByIds, findHostsByIds } = buildService({ usages: [] });

        await service.adminList(adminActor(), {});

        expect(findTradesByIds).not.toHaveBeenCalled();
        expect(findHostsByIds).not.toHaveBeenCalled();
    });
});
