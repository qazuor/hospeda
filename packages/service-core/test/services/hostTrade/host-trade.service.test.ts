/**
 * @fileoverview
 * Unit tests for HostTradeService.
 *
 * Covers:
 * - CRUD happy paths call the right permission check and succeed.
 * - Permission denials: actors missing each permission get FORBIDDEN.
 * - slug dedup: same name → first slug free, then slug-N pattern.
 * - slug collision on user-provided slug → VALIDATION_ERROR.
 * - listForHost: resolves distinct destinationIds, calls model.findForHost.
 * - listForHost: returns [] when the host has no accommodations.
 * - _canAdminList calls super before the entity-specific check (call-order).
 */

import type { AccommodationModel, HostTradeModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as hostTradePermissions from '../../../src/services/hostTrade/host-trade.permissions';
import { HostTradeService } from '../../../src/services/hostTrade/host-trade.service';
import type { Actor } from '../../../src/types';
import { ActorFactoryBuilder, createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

// Deterministic UUIDs for tests
const HT_ID = getMockId('attraction', 'ht-1'); // reuse 'attraction' slot for hostTrade
const DEST_ID_1 = getMockId('destination', 'dest-1');
const DEST_ID_2 = getMockId('destination', 'dest-2');
const ACC_ID = getMockId('accommodation', 'acc-1');
const USER_ID = getMockId('user', 'owner-1');

/** Minimal valid HostTrade row returned by model mocks */
const makeHostTrade = (overrides: Record<string, unknown> = {}) => ({
    id: HT_ID,
    slug: 'plomero-centro',
    name: 'Plomero Centro',
    category: 'PLOMERIA',
    contact: '+54 3442 123456',
    benefit: '10% descuento presentando Hospeda',
    destinationId: DEST_ID_1,
    is24h: false,
    scheduleText: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: USER_ID,
    updatedById: USER_ID,
    deletedAt: null,
    deletedById: null,
    ...overrides
});

/** Minimal Accommodation row — only destinationId matters for listForHost */
const makeAccommodation = (destinationId: string, ownerId: string) => ({
    id: ACC_ID,
    destinationId,
    ownerId,
    name: 'Mi Hospedaje',
    deletedAt: null
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildService(
    modelOverrides: Partial<ReturnType<typeof createModelMock>> = {},
    accommodationModelOverrides: Partial<ReturnType<typeof createModelMock>> = {}
) {
    const model = { ...createModelMock(['findForHost']), ...modelOverrides };
    const accommodationModel = { ...createModelMock(), ...accommodationModelOverrides };

    const service = new HostTradeService(
        { logger: mockLogger },
        model as unknown as HostTradeModel,
        accommodationModel as unknown as AccommodationModel
    );

    return { service, model, accommodationModel };
}

// ---------------------------------------------------------------------------
// Permission helpers: actors
// ---------------------------------------------------------------------------

const actorWithCreate = createActor({ permissions: [PermissionEnum.HOST_TRADE_CREATE] });
const actorWithUpdate = createActor({ permissions: [PermissionEnum.HOST_TRADE_UPDATE] });
const actorWithDelete = createActor({ permissions: [PermissionEnum.HOST_TRADE_DELETE] });
const actorWithHardDelete = createActor({ permissions: [PermissionEnum.HOST_TRADE_HARD_DELETE] });
const actorWithRestore = createActor({ permissions: [PermissionEnum.HOST_TRADE_RESTORE] });
const actorWithView = createActor({ permissions: [PermissionEnum.HOST_TRADE_VIEW] });
const actorWithViewAll = createActor({
    permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.HOST_TRADE_VIEW_ALL]
});
const actorNoPerms = createActor({ permissions: [] });

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('HostTradeService', () => {
    // -----------------------------------------------------------------------
    // create
    // -----------------------------------------------------------------------
    describe('create()', () => {
        it('succeeds with HOST_TRADE_CREATE permission and auto-generates slug', async () => {
            const hostTrade = makeHostTrade();
            const { service, model } = buildService({
                findOne: vi.fn().mockResolvedValue(null), // slug not taken
                create: vi.fn().mockResolvedValue(hostTrade),
                findById: vi.fn().mockResolvedValue(hostTrade)
            });

            const result = await service.create(actorWithCreate, {
                name: 'Plomero Centro',
                category: 'PLOMERIA',
                contact: '+54 3442 123456',
                benefit: '10% descuento',
                destinationId: DEST_ID_1,
                is24h: false
            } as Parameters<typeof service.create>[1]);

            expect(result.error).toBeUndefined();
            expect(model.create).toHaveBeenCalled();
        });

        it('returns FORBIDDEN when actor lacks HOST_TRADE_CREATE', async () => {
            const { service } = buildService();

            const result = await service.create(actorNoPerms, {
                name: 'Plomero',
                category: 'PLOMERIA',
                contact: '123',
                benefit: 'desc',
                destinationId: DEST_ID_1,
                is24h: false
            } as Parameters<typeof service.create>[1]);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('returns VALIDATION_ERROR when a caller-supplied slug is already taken', async () => {
            const existing = makeHostTrade({
                id: getMockId('attraction', 'ht-other'),
                slug: 'plomero-centro'
            });
            const { service } = buildService({
                findOne: vi.fn().mockResolvedValue(existing) // slug taken
            });

            const result = await service.create(actorWithCreate, {
                name: 'Plomero Norte',
                slug: 'plomero-centro', // collides
                category: 'PLOMERIA',
                contact: '123',
                benefit: 'desc',
                destinationId: DEST_ID_1,
                is24h: false
            } as Parameters<typeof service.create>[1]);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.message).toContain('plomero-centro');
        });

        it('deduplicates auto-generated slug when the base slug is taken', async () => {
            const existingWithSameSlug = makeHostTrade({ slug: 'plomero' });
            const newHostTrade = makeHostTrade({ slug: 'plomero-a1b2' });

            // findOne is called by the slug-uniqueness check: first call sees existing (taken),
            // second call returns null (suffix variant is free)
            const findOneMock = vi
                .fn()
                .mockResolvedValueOnce(existingWithSameSlug)
                .mockResolvedValueOnce(null);

            const { service, model } = buildService({
                findOne: findOneMock,
                create: vi.fn().mockResolvedValue(newHostTrade),
                findById: vi.fn().mockResolvedValue(newHostTrade)
            });

            const result = await service.create(actorWithCreate, {
                name: 'Plomero',
                category: 'PLOMERIA',
                contact: '123',
                benefit: 'desc',
                destinationId: DEST_ID_1,
                is24h: false
            } as Parameters<typeof service.create>[1]);

            expect(result.error).toBeUndefined();
            // findOne was called at least twice during deduplication
            expect(findOneMock).toHaveBeenCalledTimes(2);
            expect(model.create).toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // update
    // -----------------------------------------------------------------------
    describe('update()', () => {
        it('succeeds with HOST_TRADE_UPDATE permission', async () => {
            const existing = makeHostTrade();
            const updated = makeHostTrade({ name: 'Plomero Sur' });
            const { service } = buildService({
                findById: vi.fn().mockResolvedValue(existing),
                findOne: vi.fn().mockResolvedValue(null), // slug check: no collision
                update: vi.fn().mockResolvedValue(updated)
            });

            const result = await service.update(actorWithUpdate, HT_ID, {
                name: 'Plomero Sur'
            } as Parameters<typeof service.update>[2]);

            expect(result.error).toBeUndefined();
        });

        it('returns FORBIDDEN when actor lacks HOST_TRADE_UPDATE', async () => {
            const existing = makeHostTrade();
            const { service } = buildService({
                findById: vi.fn().mockResolvedValue(existing)
            });

            const result = await service.update(actorNoPerms, HT_ID, {
                name: 'x'
            } as Parameters<typeof service.update>[2]);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // -----------------------------------------------------------------------
    // softDelete
    // -----------------------------------------------------------------------
    describe('softDelete()', () => {
        it('succeeds with HOST_TRADE_DELETE permission', async () => {
            const existing = makeHostTrade();
            const { service } = buildService({
                findById: vi.fn().mockResolvedValue(existing),
                softDelete: vi.fn().mockResolvedValue(existing)
            });

            const result = await service.softDelete(actorWithDelete, HT_ID);
            expect(result.error).toBeUndefined();
        });

        it('returns FORBIDDEN when actor lacks HOST_TRADE_DELETE', async () => {
            const existing = makeHostTrade();
            const { service } = buildService({
                findById: vi.fn().mockResolvedValue(existing)
            });

            const result = await service.softDelete(actorNoPerms, HT_ID);
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // -----------------------------------------------------------------------
    // hardDelete
    // -----------------------------------------------------------------------
    describe('hardDelete()', () => {
        it('succeeds with HOST_TRADE_HARD_DELETE permission', async () => {
            const existing = makeHostTrade({ deletedAt: new Date() });
            const { service } = buildService({
                findById: vi.fn().mockResolvedValue(existing),
                hardDelete: vi.fn().mockResolvedValue(undefined)
            });

            const result = await service.hardDelete(actorWithHardDelete, HT_ID);
            expect(result.error).toBeUndefined();
        });

        it('returns FORBIDDEN when actor lacks HOST_TRADE_HARD_DELETE', async () => {
            const existing = makeHostTrade({ deletedAt: new Date() });
            const { service } = buildService({
                findById: vi.fn().mockResolvedValue(existing)
            });

            const result = await service.hardDelete(actorNoPerms, HT_ID);
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // -----------------------------------------------------------------------
    // restore
    // -----------------------------------------------------------------------
    describe('restore()', () => {
        it('succeeds with HOST_TRADE_RESTORE permission', async () => {
            const softDeleted = makeHostTrade({ deletedAt: new Date() });
            const restored = makeHostTrade({ deletedAt: null });
            const { service } = buildService({
                findById: vi.fn().mockResolvedValue(softDeleted),
                restore: vi.fn().mockResolvedValue(restored)
            });

            const result = await service.restore(actorWithRestore, HT_ID);
            expect(result.error).toBeUndefined();
        });

        it('returns FORBIDDEN when actor lacks HOST_TRADE_RESTORE', async () => {
            const softDeleted = makeHostTrade({ deletedAt: new Date() });
            const { service } = buildService({
                findById: vi.fn().mockResolvedValue(softDeleted)
            });

            const result = await service.restore(actorNoPerms, HT_ID);
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // -----------------------------------------------------------------------
    // listForHost
    // -----------------------------------------------------------------------
    describe('listForHost()', () => {
        it('returns FORBIDDEN when actor lacks HOST_TRADE_VIEW', async () => {
            const { service } = buildService();

            const result = await service.listForHost(actorNoPerms);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('returns empty trades array when host has no accommodations', async () => {
            const { service, accommodationModel } = buildService();
            (accommodationModel.findAll as ReturnType<typeof vi.fn>).mockResolvedValue({
                items: [],
                total: 0
            });

            const result = await service.listForHost(actorWithView);

            expect(result.error).toBeUndefined();
            expect(result.data?.trades).toEqual([]);
        });

        it('resolves distinct destinationIds and calls model.findForHost', async () => {
            const acc1 = makeAccommodation(DEST_ID_1, actorWithView.id);
            const acc2 = makeAccommodation(DEST_ID_2, actorWithView.id);
            const acc3 = makeAccommodation(DEST_ID_1, actorWithView.id); // duplicate dest
            const trades = [makeHostTrade({ destinationId: 'dest-uuid-1' })];

            const findForHostMock = vi.fn().mockResolvedValue(trades);
            const { service } = buildService(
                { findForHost: findForHostMock },
                {
                    findAll: vi.fn().mockResolvedValue({
                        items: [acc1, acc2, acc3],
                        total: 3
                    })
                }
            );

            const result = await service.listForHost(actorWithView);

            expect(result.error).toBeUndefined();
            expect(result.data?.trades).toEqual(trades);

            // findForHost must be called with DISTINCT destinationIds only
            const calledWith = findForHostMock.mock.calls[0]?.[0] as string[];
            expect(calledWith).toHaveLength(2);
            expect(calledWith).toContain(DEST_ID_1);
            expect(calledWith).toContain(DEST_ID_2);
        });

        it('returns empty trades when accommodations have no destinationId set', async () => {
            const accNoDestination = {
                ...makeAccommodation('', actorWithView.id),
                destinationId: undefined
            };
            const { service } = buildService(
                {},
                {
                    findAll: vi.fn().mockResolvedValue({
                        items: [accNoDestination],
                        total: 1
                    })
                }
            );

            const result = await service.listForHost(actorWithView);

            expect(result.error).toBeUndefined();
            expect(result.data?.trades).toEqual([]);
        });

        it('passes transaction context to underlying model calls', async () => {
            const acc = makeAccommodation(DEST_ID_1, actorWithView.id);
            const trades = [makeHostTrade()];
            const fakeTx = Symbol('tx') as unknown as import('@repo/db').DrizzleClient;
            const findForHostMock = vi.fn().mockResolvedValue(trades);
            const findAllMock = vi.fn().mockResolvedValue({ items: [acc], total: 1 });

            const { service } = buildService(
                { findForHost: findForHostMock },
                { findAll: findAllMock }
            );

            await service.listForHost(actorWithView, { tx: fakeTx });

            expect(findAllMock).toHaveBeenCalledWith(
                expect.objectContaining({ ownerId: actorWithView.id }),
                undefined,
                undefined,
                fakeTx
            );
            expect(findForHostMock).toHaveBeenCalledWith([DEST_ID_1], fakeTx);
        });
    });

    // -----------------------------------------------------------------------
    // _canAdminList — call-order test (super first, entity check second)
    // -----------------------------------------------------------------------
    describe('_canAdminList()', () => {
        beforeEach(() => {
            vi.restoreAllMocks();
        });

        it('rejects actor without admin panel access (super check fires first)', async () => {
            const { service } = buildService();
            const actor = new ActorFactoryBuilder()
                .withId('no-admin')
                .withPermissions([PermissionEnum.HOST_TRADE_VIEW_ALL]) // has entity perm but no admin access
                .build();

            await expect(
                (service as unknown as CanAdminListAccessor)._canAdminList(actor)
            ).rejects.toMatchObject({
                code: ServiceErrorCode.FORBIDDEN,
                message: 'Admin access required for admin list operations'
            });
        });

        it('rejects actor with admin access but without HOST_TRADE_VIEW or HOST_TRADE_VIEW_ALL', async () => {
            const { service } = buildService();
            const actor = new ActorFactoryBuilder()
                .withId('admin-no-entity')
                .withPermissions([PermissionEnum.ACCESS_PANEL_ADMIN])
                .build();

            // Actor passes the admin boundary (super._canAdminList) but then fails
            // _canList (checkCanViewOrViewAll) because they hold neither HOST_TRADE_VIEW
            // nor HOST_TRADE_VIEW_ALL.
            await expect(
                (service as unknown as CanAdminListAccessor)._canAdminList(actor)
            ).rejects.toMatchObject({
                code: ServiceErrorCode.FORBIDDEN
            });
        });

        it('rejects actor with admin access and HOST_TRADE_VIEW_ALL=false check (entity check)', async () => {
            const { service } = buildService();
            // Actor has HOST_TRADE_VIEW (passes _canList) but not HOST_TRADE_VIEW_ALL
            // (fails entity-specific checkCanAdminListHostTrades).
            const actor = new ActorFactoryBuilder()
                .withId('admin-with-view-but-not-view-all')
                .withPermissions([
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.HOST_TRADE_VIEW
                ])
                .build();

            await expect(
                (service as unknown as CanAdminListAccessor)._canAdminList(actor)
            ).rejects.toMatchObject({
                code: ServiceErrorCode.FORBIDDEN,
                message: expect.stringContaining('HOST_TRADE_VIEW_ALL')
            });
        });

        it('allows actor with admin access AND HOST_TRADE_VIEW_ALL', async () => {
            const { service } = buildService();

            await expect(
                (service as unknown as CanAdminListAccessor)._canAdminList(actorWithViewAll)
            ).resolves.toBeUndefined();
        });

        it('calls super._canAdminList() before checkCanAdminListHostTrades()', async () => {
            const { service } = buildService();
            const callOrder: string[] = [];

            const superSpy = vi
                .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), '_canAdminList')
                .mockImplementation(() => {
                    callOrder.push('super._canAdminList');
                });

            const checkSpy = vi
                .spyOn(hostTradePermissions, 'checkCanAdminListHostTrades')
                .mockImplementation(() => {
                    callOrder.push('checkCanAdminListHostTrades');
                });

            await (service as unknown as CanAdminListAccessor)._canAdminList(actorWithViewAll);

            expect(callOrder).toEqual(['super._canAdminList', 'checkCanAdminListHostTrades']);

            superSpy.mockRestore();
            checkSpy.mockRestore();
        });

        it('does not call checkCanAdminListHostTrades when super rejects', async () => {
            const { service } = buildService();
            const checkSpy = vi.spyOn(hostTradePermissions, 'checkCanAdminListHostTrades');

            const actorNoAdmin = new ActorFactoryBuilder()
                .withId('no-admin')
                .withPermissions([PermissionEnum.HOST_TRADE_VIEW_ALL])
                .build();

            await expect(
                (service as unknown as CanAdminListAccessor)._canAdminList(actorNoAdmin)
            ).rejects.toThrow();

            expect(checkSpy).not.toHaveBeenCalled();
            checkSpy.mockRestore();
        });
    });
});

type CanAdminListAccessor = { _canAdminList: (actor: Actor) => Promise<void> };
