import logger, { type ILogger, LoggerColors, LogLevel } from '@repo/logger';

const serviceLogger = logger.registerCategory('Service', 'SERVICE', {
    color: LoggerColors.GREEN
});

interface PermissionValidationParams {
    permission: string;
    userId: string;
    role: string;
    extraData: unknown;
}
serviceLogger.registerLogMethod<PermissionValidationParams>(
    'permission',
    LogLevel.INFO,
    'Permission'
);

type ServiceLogger = ILogger & {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    permission: (...args: any[]) => void;
};

/**
 * This cast is safe and necessary to extend the logger instance with a custom 'permission' method
 * for service-level permission logging. The base logger does not include this method, but our
 * service logging infrastructure expects it. This approach allows us to add the method while
 * preserving the base logger's type safety for all other methods.
 */
const typedServiceLogger = serviceLogger as unknown as ServiceLogger;

export { typedServiceLogger as serviceLogger };
export type { ServiceLogger };
