/**
 * This module configures and extends the base logger for service-layer-specific logging.
 * It introduces a custom `permission` log method to standardize how access control
 * checks are recorded throughout the application's services.
 */

import logger, { type ILogger, LoggerColors, LogLevel } from '@repo/logger';

const serviceLogger = logger.registerCategory('Service', 'SERVICE', {
    color: LoggerColors.GREEN
});

/**
 * Defines the structure for parameters passed to the custom 'permission' log method.
 */
interface PermissionValidationParams {
    /** The permission string being validated (e.g., 'ACCOMMODATION_CREATE_ANY'). */
    permission: string;
    /** The ID of the user whose permission is being checked. */
    userId: string;
    /** The role of the user. */
    role: string;
    /** Any additional data relevant to the permission check. */
    extraData: unknown;
}
serviceLogger.registerLogMethod<PermissionValidationParams>(
    'permission',
    LogLevel.INFO,
    'Permission'
);

/**
 * Extends the base `ILogger` interface with a service-specific `permission` method.
 */
type ServiceLogger = ILogger & {
    /**
     * Logs a permission validation event.
     * @param params - An object containing details about the permission check.
     */
    permission: (params: PermissionValidationParams) => void;
};

/**
 * This cast is safe and necessary to extend the logger instance with a custom 'permission' method
 * for service-level permission logging. The base logger does not include this method, but our
 * service logging infrastructure expects it. This approach allows us to add the method while
 * preserving the base logger's type safety for all other methods. The extended logger is then
 * exported for use throughout the service layer.
 */
const typedServiceLogger = serviceLogger as unknown as ServiceLogger;

export { typedServiceLogger as serviceLogger };
export type { ServiceLogger };
