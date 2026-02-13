import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    checkCanCreateExchangeRate,
    checkCanDeleteExchangeRate,
    checkCanFetchExchangeRate,
    checkCanUpdateExchangeRate,
    checkCanUpdateExchangeRateConfig,
    checkCanViewExchangeRate
} from '../../../src/services/exchange-rate/exchange-rate.permissions';
import { ServiceError } from '../../../src/types';

const baseActor = { id: 'actor-id', role: RoleEnum.ADMIN, permissions: [] };

describe('exchange-rate.permissions', () => {
    it('checkCanViewExchangeRate allows with EXCHANGE_RATE_VIEW', () => {
        const actor = { ...baseActor, permissions: [PermissionEnum.EXCHANGE_RATE_VIEW] };
        expect(() => checkCanViewExchangeRate(actor)).not.toThrow();
    });

    it('checkCanViewExchangeRate throws without EXCHANGE_RATE_VIEW', () => {
        try {
            checkCanViewExchangeRate(baseActor);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        }
    });

    it('checkCanCreateExchangeRate allows with EXCHANGE_RATE_CREATE', () => {
        const actor = { ...baseActor, permissions: [PermissionEnum.EXCHANGE_RATE_CREATE] };
        expect(() => checkCanCreateExchangeRate(actor)).not.toThrow();
    });

    it('checkCanCreateExchangeRate throws without EXCHANGE_RATE_CREATE', () => {
        try {
            checkCanCreateExchangeRate(baseActor);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        }
    });

    it('checkCanUpdateExchangeRate allows with EXCHANGE_RATE_UPDATE', () => {
        const actor = { ...baseActor, permissions: [PermissionEnum.EXCHANGE_RATE_UPDATE] };
        expect(() => checkCanUpdateExchangeRate(actor)).not.toThrow();
    });

    it('checkCanUpdateExchangeRate throws without EXCHANGE_RATE_UPDATE', () => {
        try {
            checkCanUpdateExchangeRate(baseActor);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        }
    });

    it('checkCanDeleteExchangeRate allows with EXCHANGE_RATE_DELETE', () => {
        const actor = { ...baseActor, permissions: [PermissionEnum.EXCHANGE_RATE_DELETE] };
        expect(() => checkCanDeleteExchangeRate(actor)).not.toThrow();
    });

    it('checkCanDeleteExchangeRate throws without EXCHANGE_RATE_DELETE', () => {
        try {
            checkCanDeleteExchangeRate(baseActor);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        }
    });

    it('checkCanUpdateExchangeRateConfig allows with EXCHANGE_RATE_CONFIG_UPDATE', () => {
        const actor = { ...baseActor, permissions: [PermissionEnum.EXCHANGE_RATE_CONFIG_UPDATE] };
        expect(() => checkCanUpdateExchangeRateConfig(actor)).not.toThrow();
    });

    it('checkCanUpdateExchangeRateConfig throws without EXCHANGE_RATE_CONFIG_UPDATE', () => {
        try {
            checkCanUpdateExchangeRateConfig(baseActor);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        }
    });

    it('checkCanFetchExchangeRate allows with EXCHANGE_RATE_FETCH', () => {
        const actor = { ...baseActor, permissions: [PermissionEnum.EXCHANGE_RATE_FETCH] };
        expect(() => checkCanFetchExchangeRate(actor)).not.toThrow();
    });

    it('checkCanFetchExchangeRate throws without EXCHANGE_RATE_FETCH', () => {
        try {
            checkCanFetchExchangeRate(baseActor);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        }
    });
});
