import type { Actor } from '../types';
import { serviceLogger as defaultLogger } from './service-logger';

let _logger = defaultLogger;
export const setLogger = (logger: typeof defaultLogger) => {
    _logger = logger;
};

/**
 * Logs the start of a method execution.
 * @param {string} methodName - The name of the method being executed
 * @param {unknown} input - The input data for the method
 * @param {Actor} actor - The actor executing the method
 */
export const logMethodStart = (methodName: string, input: unknown, actor: Actor): void => {
    _logger.info(
        `Starting ${methodName} | input: ${JSON.stringify(input)} | actor: ${JSON.stringify(actor)}`
    );
};

/**
 * Logs the successful completion of a method execution.
 * @param {string} methodName - The name of the method that completed
 * @param {unknown} output - The output data from the method
 */
export const logMethodEnd = (methodName: string, output: unknown): void => {
    _logger.info(`Completed ${methodName} | output: ${JSON.stringify(output)}`);
};

/**
 * Logs an error that occurred during method execution.
 * @param {string} methodName - The name of the method where the error occurred
 * @param {Error} error - The error that occurred
 * @param {unknown} input - The input data that caused the error
 * @param {Actor} actor - The actor that was executing the method
 */
export const logError = (methodName: string, error: Error, input: unknown, actor: Actor): void => {
    _logger.error(
        `Error in ${methodName} | error: ${error.message} | input: ${JSON.stringify(input)} | actor: ${JSON.stringify(actor)}`
    );
};

/**
 * Logs a permission check.
 * @param {string} permission - The permission being checked
 * @param {Actor} actor - The actor being checked
 * @param {unknown} input - The input data for the check
 * @param {string} [error] - Optional error message if permission was denied
 */
export const logPermission = (
    permission: string,
    actor: Actor,
    input: unknown,
    error?: string
): void => {
    _logger.permission({
        permission,
        userId: actor.id,
        role: actor.role,
        extraData: { input, error }
    });
};

/**
 * Logs when access is denied.
 * @param {Actor} actor - The actor that was denied access
 * @param {unknown} input - The input data for the denied action
 * @param {unknown} entity - The entity that was accessed
 * @param {string} reason - The reason for denial
 * @param {string} permission - The permission that was denied
 */
export const logDenied = (
    actor: Actor,
    input: unknown,
    entity: unknown,
    reason: string,
    permission: string
): void => {
    _logger.warn(
        `Access denied: ${permission} | actor: ${JSON.stringify(actor)} | input: ${JSON.stringify(input)} | entity: ${JSON.stringify(entity)} | reason: ${reason}`
    );
};

/**
 * Logs when access is granted.
 * @param {Actor} actor - The actor that was granted access
 * @param {unknown} input - The input data for the granted action
 * @param {unknown} entity - The entity that was accessed
 * @param {string} permission - The permission that was granted
 * @param {string} reason - The reason for granting access
 */
export const logGrant = (
    actor: Actor,
    input: unknown,
    entity: unknown,
    permission: string,
    reason: string
): void => {
    _logger.info(
        `Access granted: ${permission} | actor: ${JSON.stringify(actor)} | input: ${JSON.stringify(input)} | entity: ${JSON.stringify(entity)} | reason: ${reason}`
    );
};
