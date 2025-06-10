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

const typedServiceLogger = serviceLogger as unknown as ServiceLogger;

export { typedServiceLogger as serviceLogger };
