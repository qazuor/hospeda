import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * Checks if the actor can view exchange rates.
 * Requires EXCHANGE_RATE_VIEW permission.
 * @param actor - The actor performing the action.
 * @throws {ServiceError} If not permitted.
 */
export const checkCanViewExchangeRate = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.EXCHANGE_RATE_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing EXCHANGE_RATE_VIEW permission'
        );
    }
};

/**
 * Checks if the actor can create exchange rates.
 * Requires EXCHANGE_RATE_CREATE permission.
 * @param actor - The actor performing the action.
 * @throws {ServiceError} If not permitted.
 */
export const checkCanCreateExchangeRate = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.EXCHANGE_RATE_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing EXCHANGE_RATE_CREATE permission'
        );
    }
};

/**
 * Checks if the actor can update exchange rates.
 * Requires EXCHANGE_RATE_UPDATE permission.
 * @param actor - The actor performing the action.
 * @throws {ServiceError} If not permitted.
 */
export const checkCanUpdateExchangeRate = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.EXCHANGE_RATE_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing EXCHANGE_RATE_UPDATE permission'
        );
    }
};

/**
 * Checks if the actor can delete exchange rates.
 * Requires EXCHANGE_RATE_DELETE permission.
 * @param actor - The actor performing the action.
 * @throws {ServiceError} If not permitted.
 */
export const checkCanDeleteExchangeRate = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.EXCHANGE_RATE_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing EXCHANGE_RATE_DELETE permission'
        );
    }
};

/**
 * Checks if the actor can update exchange rate configuration.
 * Requires EXCHANGE_RATE_CONFIG_UPDATE permission.
 * @param actor - The actor performing the action.
 * @throws {ServiceError} If not permitted.
 */
export const checkCanUpdateExchangeRateConfig = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.EXCHANGE_RATE_CONFIG_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing EXCHANGE_RATE_CONFIG_UPDATE permission'
        );
    }
};

/**
 * Checks if the actor can fetch exchange rates from external providers.
 * Requires EXCHANGE_RATE_FETCH permission.
 * @param actor - The actor performing the action.
 * @throws {ServiceError} If not permitted.
 */
export const checkCanFetchExchangeRate = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.EXCHANGE_RATE_FETCH)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing EXCHANGE_RATE_FETCH permission'
        );
    }
};

/**
 * Checks if the actor can list exchange rates.
 * Requires EXCHANGE_RATE_VIEW permission.
 * @param actor - The actor performing the action.
 * @throws {ServiceError} If not permitted.
 */
export const checkCanListExchangeRate = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.EXCHANGE_RATE_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing EXCHANGE_RATE_VIEW permission'
        );
    }
};

/**
 * Checks if the actor can search exchange rates.
 * Requires EXCHANGE_RATE_VIEW permission.
 * @param actor - The actor performing the action.
 * @throws {ServiceError} If not permitted.
 */
export const checkCanSearchExchangeRate = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.EXCHANGE_RATE_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing EXCHANGE_RATE_VIEW permission'
        );
    }
};

/**
 * Checks if the actor can count exchange rates.
 * Requires EXCHANGE_RATE_VIEW permission.
 * @param actor - The actor performing the action.
 * @throws {ServiceError} If not permitted.
 */
export const checkCanCountExchangeRate = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.EXCHANGE_RATE_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing EXCHANGE_RATE_VIEW permission'
        );
    }
};
