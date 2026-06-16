import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    checkCanAdminListHostTrades,
    checkCanCreateHostTrade,
    checkCanDeleteHostTrade,
    checkCanHardDeleteHostTrade,
    checkCanRestoreHostTrade,
    checkCanUpdateHostTrade,
    checkCanViewHostTrade
} from '../../../src/services/hostTrade/host-trade.permissions';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';

describe('HostTrade permissions', () => {
    const noPerms = createActor({ permissions: [] });

    describe('checkCanViewHostTrade', () => {
        it('allows actor with HOST_TRADE_VIEW', () => {
            const actor = createActor({ permissions: [PermissionEnum.HOST_TRADE_VIEW] });
            expect(() => checkCanViewHostTrade(actor)).not.toThrow();
        });

        it('throws FORBIDDEN without HOST_TRADE_VIEW', () => {
            expect(() => checkCanViewHostTrade(noPerms)).toThrow(ServiceError);
            try {
                checkCanViewHostTrade(noPerms);
            } catch (err) {
                expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });

        it('throws FORBIDDEN when actor has no id', () => {
            const actor = createActor({ id: '', permissions: [PermissionEnum.HOST_TRADE_VIEW] });
            expect(() => checkCanViewHostTrade(actor)).toThrow(ServiceError);
        });
    });

    describe('checkCanCreateHostTrade', () => {
        it('allows actor with HOST_TRADE_CREATE', () => {
            const actor = createActor({ permissions: [PermissionEnum.HOST_TRADE_CREATE] });
            expect(() => checkCanCreateHostTrade(actor)).not.toThrow();
        });

        it('throws FORBIDDEN without HOST_TRADE_CREATE', () => {
            expect(() => checkCanCreateHostTrade(noPerms)).toThrow(ServiceError);
            try {
                checkCanCreateHostTrade(noPerms);
            } catch (err) {
                expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
    });

    describe('checkCanUpdateHostTrade', () => {
        it('allows actor with HOST_TRADE_UPDATE', () => {
            const actor = createActor({ permissions: [PermissionEnum.HOST_TRADE_UPDATE] });
            expect(() => checkCanUpdateHostTrade(actor)).not.toThrow();
        });

        it('throws FORBIDDEN without HOST_TRADE_UPDATE', () => {
            expect(() => checkCanUpdateHostTrade(noPerms)).toThrow(ServiceError);
            try {
                checkCanUpdateHostTrade(noPerms);
            } catch (err) {
                expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
    });

    describe('checkCanDeleteHostTrade', () => {
        it('allows actor with HOST_TRADE_DELETE', () => {
            const actor = createActor({ permissions: [PermissionEnum.HOST_TRADE_DELETE] });
            expect(() => checkCanDeleteHostTrade(actor)).not.toThrow();
        });

        it('throws FORBIDDEN without HOST_TRADE_DELETE', () => {
            expect(() => checkCanDeleteHostTrade(noPerms)).toThrow(ServiceError);
            try {
                checkCanDeleteHostTrade(noPerms);
            } catch (err) {
                expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
    });

    describe('checkCanHardDeleteHostTrade', () => {
        it('allows actor with HOST_TRADE_HARD_DELETE', () => {
            const actor = createActor({ permissions: [PermissionEnum.HOST_TRADE_HARD_DELETE] });
            expect(() => checkCanHardDeleteHostTrade(actor)).not.toThrow();
        });

        it('throws FORBIDDEN without HOST_TRADE_HARD_DELETE', () => {
            expect(() => checkCanHardDeleteHostTrade(noPerms)).toThrow(ServiceError);
            try {
                checkCanHardDeleteHostTrade(noPerms);
            } catch (err) {
                expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
    });

    describe('checkCanRestoreHostTrade', () => {
        it('allows actor with HOST_TRADE_RESTORE', () => {
            const actor = createActor({ permissions: [PermissionEnum.HOST_TRADE_RESTORE] });
            expect(() => checkCanRestoreHostTrade(actor)).not.toThrow();
        });

        it('throws FORBIDDEN without HOST_TRADE_RESTORE', () => {
            expect(() => checkCanRestoreHostTrade(noPerms)).toThrow(ServiceError);
            try {
                checkCanRestoreHostTrade(noPerms);
            } catch (err) {
                expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
    });

    describe('checkCanAdminListHostTrades', () => {
        it('allows actor with HOST_TRADE_VIEW_ALL', () => {
            const actor = createActor({ permissions: [PermissionEnum.HOST_TRADE_VIEW_ALL] });
            expect(() => checkCanAdminListHostTrades(actor)).not.toThrow();
        });

        it('throws FORBIDDEN without HOST_TRADE_VIEW_ALL', () => {
            expect(() => checkCanAdminListHostTrades(noPerms)).toThrow(ServiceError);
            try {
                checkCanAdminListHostTrades(noPerms);
            } catch (err) {
                expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
                expect((err as ServiceError).message).toContain('HOST_TRADE_VIEW_ALL');
            }
        });

        it('throws FORBIDDEN when actor has HOST_TRADE_VIEW but not HOST_TRADE_VIEW_ALL', () => {
            const actor = createActor({ permissions: [PermissionEnum.HOST_TRADE_VIEW] });
            expect(() => checkCanAdminListHostTrades(actor)).toThrow(ServiceError);
        });
    });
});
