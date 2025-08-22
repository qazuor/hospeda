import { type ILogger, LogLevel, LoggerColors, logger as baseLogger } from '@repo/logger';

/**
 * Logger instance used by DB helpers.
 * Exported for testing so spies can hook into the exact instance used.
 */
const seedLogger = baseLogger.registerCategory('seed', 'SEED', {
    color: LoggerColors.BLUE,
    truncateLongText: true
});

// export const logger = {
//     info: (msg: string) => baseLogger.info(msg),
//     success: (msg: string) => baseLogger.info(`✅ ${msg}`),
//     warn: (msg: string) => baseLogger.warn(msg),
//     error: (msg: string) => baseLogger.error(msg),
//     dim: (msg: string) => baseLogger.debug(msg)
// };

/**
 * Defines the structure for parameters passed to the custom 'permission' log method.
 */
interface DimValidationParams {
    msg: string;
}
seedLogger.registerLogMethod<DimValidationParams>('dim', LogLevel.INFO, 'Dim');

/**
 * Defines the structure for parameters passed to the custom 'permission' log method.
 */
interface SuccessValidationParams {
    msg: string;
}
seedLogger.registerLogMethod<SuccessValidationParams>('success', LogLevel.INFO, 'SUCCESS');

/**
 * Extends the base `ILogger` interface with a service-specific `permission` method.
 */
type SeedLogger = ILogger & {
    /**
     * Logs a permission validation event.
     * @param params - An object containing details about the permission check.
     */
    dim: (params: DimValidationParams) => void;
    success: (params: SuccessValidationParams) => void;
};

const typedSeedLogger = seedLogger as unknown as SeedLogger;

export { typedSeedLogger as logger };
export type { SeedLogger };
