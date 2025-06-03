import logger, { type ILogger, LoggerColors, LogLevel } from '@repo/logger';

const dbLogger = logger.registerCategory('Database', 'DB', {
    color: LoggerColors.BLUE
});

// Define type for query parameters
interface QueryParams {
    table: string;
    action: string;
    params: Record<string, unknown>;
    result: unknown;
}

// Define type for query parameters
interface PermissionValidationParams {
    permission: string;
    userId: string;
    role: string;
    extraData: unknown;
}

// Register the query method
dbLogger.registerLogMethod<QueryParams>('query', LogLevel.INFO, 'SQL');

dbLogger.registerLogMethod<PermissionValidationParams>('permission', LogLevel.WARN, 'Permission');

// Add this type if you have a logger interface, otherwise define it here
type DbLogger = ILogger & {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    query: (...args: any[]) => void;
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    permission: (...args: any[]) => void;
};

// Cast dbLogger to the correct type if needed
const typedDbLogger = dbLogger as unknown as DbLogger;

export { typedDbLogger as dbLogger };
