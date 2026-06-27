import type { Actor } from '../types';
import { serviceLogger as defaultLogger } from './service-logger';

let _logger = defaultLogger;

/**
 * Overrides the default logger instance with a custom one.
 * Useful for testing or integrating with a different logging system.
 * @param logger The new logger instance to use. It must conform to the `serviceLogger` interface.
 */
export const setLogger = (logger: typeof defaultLogger) => {
    _logger = logger;
};

/**
 * Builds a compact, log-safe projection of an actor.
 *
 * The full {@link Actor} carries its entire resolved `permissions` array, which
 * for staff actors (ADMIN / SUPER_ADMIN) holds hundreds of entries. Serializing
 * it on every service call floods the logs and, under high volume, interleaves
 * and corrupts the log stream. Only the identifying fields plus a permission
 * COUNT are emitted; the full permission set is never needed for log triage and
 * remains available through the permissions API when required.
 *
 * @param actor - The actor to project.
 * @returns A JSON string with `id`, `role`, and `permissionsCount` only.
 */
const formatActor = (actor: Actor | null | undefined): string => {
    // These helpers run BEFORE the actor/permission check in every service
    // method, so they are reached with a missing actor on the unauthorized
    // path. The previous `JSON.stringify(actor)` tolerated null/undefined;
    // preserve that so logging never throws and masks the real 401/403.
    if (actor === null || actor === undefined) {
        return String(actor);
    }
    return JSON.stringify({
        id: actor.id,
        role: actor.role,
        permissionsCount: actor.permissions?.length ?? 0
    });
};

/**
 * Logs the start of a service method execution, including input and actor details.
 * @param methodName - The full name of the method being executed (e.g., 'accommodation.create').
 * @param input - The input data or parameters for the method.
 * @param actor - The actor (user or system) executing the method.
 */
export const logMethodStart = (methodName: string, input: unknown, actor: Actor): void => {
    _logger.info(
        `Starting ${methodName} | input: ${JSON.stringify(input)} | actor: ${formatActor(actor)}`
    );
};

/**
 * Logs the successful completion of a service method execution, including the output.
 * @param methodName - The full name of the method that completed.
 * @param output - The output data or result from the method.
 */
export const logMethodEnd = (methodName: string, output: unknown): void => {
    _logger.info(`Completed ${methodName} | output: ${JSON.stringify(output)}`);
};

/**
 * Logs an error that occurred during a service method execution.
 * @param methodName - The name of the method where the error occurred.
 * @param error - The error object that was caught.
 * @param input - The input data that may have caused the error.
 * @param actor - The actor that was executing the method.
 */
export const logError = (methodName: string, error: Error, input: unknown, actor: Actor): void => {
    _logger.error(
        `Error in ${methodName} | error: ${error.message} | input: ${JSON.stringify(input)} | actor: ${formatActor(actor)}`
    );
};

/**
 * Logs a specific permission check event.
 * This is useful for auditing and debugging access control.
 * @param permission - The permission being checked (e.g., 'ACCOMMODATION_UPDATE_ANY').
 * @param actor - The actor whose permissions are being checked.
 * @param input - The input data related to the permission check.
 * @param error - Optional error message if the permission was denied.
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
 * Logs an event where access was explicitly denied.
 * @param actor - The actor that was denied access.
 * @param input - The input data for the action that was denied.
 * @param entity - The entity being accessed.
 * @param reason - The reason why access was denied.
 * @param permission - The permission that was required but not met.
 */
export const logDenied = (
    actor: Actor,
    input: unknown,
    entity: unknown,
    reason: string,
    permission: string
): void => {
    _logger.warn(
        `Access denied: ${permission} | actor: ${formatActor(actor)} | input: ${JSON.stringify(input)} | entity: ${JSON.stringify(entity)} | reason: ${reason}`
    );
};

/**
 * Logs an event where access was explicitly granted.
 * @param actor - The actor that was granted access.
 * @param input - The input data for the action that was granted.
 * @param entity - The entity being accessed.
 * @param permission - The permission that was successfully met.
 * @param reason - The reason why access was granted.
 */
export const logGrant = (
    actor: Actor,
    input: unknown,
    entity: unknown,
    permission: string,
    reason: string
): void => {
    _logger.info(
        `Access granted: ${permission} | actor: ${formatActor(actor)} | input: ${JSON.stringify(input)} | entity: ${JSON.stringify(entity)} | reason: ${reason}`
    );
};
