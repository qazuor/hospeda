import { STATUS_ICONS } from './icons.js';
import type { SeedContext } from './seedContext.js';
import { summaryTracker } from './summaryTracker.js';

/**
 * Extended context with retry functionality
 */
interface ExtendedSeedContext extends SeedContext {
    retryCount?: number;
    retryQueue?: Array<{ item: unknown; retryCount: number }>;
}

/**
 * Creates a retry error handler
 */
export const createRetryErrorHandler = (maxRetries = 3) => {
    return (error: unknown, item: unknown, context: SeedContext) => {
        const extendedContext = context as ExtendedSeedContext;
        const retryCount = extendedContext.retryCount || 0;

        if (retryCount < maxRetries && isRetryableError(error)) {
            extendedContext.retryQueue = extendedContext.retryQueue || [];
            extendedContext.retryQueue.push({ item, retryCount: retryCount + 1 });

            const entityName = context.currentEntity || 'Unknown';
            const fileName = context.currentFile || 'unknown';

            console.warn(
                `${STATUS_ICONS.Warning} Retrying ${entityName} (${fileName}) - Attempt ${retryCount + 1}/${maxRetries}`
            );
        } else {
            defaultErrorHandler(error, item, context);
        }
    };
};

/**
 * Creates an error handler that continues on specific error codes
 */
export const createContinueOnErrorHandler = (continueOnCodes: string[]) => {
    return (error: unknown, item: unknown, context: SeedContext) => {
        const err = error as { code?: string; message?: string };

        if (err.code && continueOnCodes.includes(err.code)) {
            const entityName = context.currentEntity || 'Unknown';
            const fileName = context.currentFile || 'unknown';

            console.warn(
                `${STATUS_ICONS.Warning} Continuing on ${err.code} for ${entityName} (${fileName}): ${err.message}`
            );
            return;
        }

        defaultErrorHandler(error, item, context);
    };
};

/**
 * Creates an error handler that logs detailed information
 */
export const createDetailedErrorHandler = (entityName: string) => {
    return (item: unknown, index: number, error: unknown) => {
        // 🔍 LOG DISTINTIVO: detailed error handler
        console.error(
            `${STATUS_ICONS.Debug} [DETAILED_ERROR_HANDLER] Reportando error con detalles completos`
        );

        const fileName = `item-${index}`;

        console.error(`${STATUS_ICONS.Error} Detailed error for ${entityName} (${fileName}):`);
        console.error(`Error: ${(error as Error).message}`);
        console.error(`Stack: ${(error as Error).stack}`);

        if (item) {
            console.error(`Input data: ${JSON.stringify(item, null, 2)}`);
        }

        if ((error as Error).cause) {
            console.error(`Cause: ${(error as Error).cause}`);
        }
    };
};

/**
 * Creates an error handler that groups similar errors
 */
export const createGroupedErrorHandler = () => {
    const errorGroups = new Map<string, { count: number; examples: string[] }>();

    return (error: unknown, item: unknown, context: SeedContext) => {
        const err = error as Error;
        const errorKey = err.message?.split(':')[0] || 'Unknown Error';

        if (!errorGroups.has(errorKey)) {
            errorGroups.set(errorKey, { count: 0, examples: [] });
        }

        const group = errorGroups.get(errorKey);
        if (!group) return;

        group.count++;

        const entityName = context.currentEntity || 'Unknown';
        const fileName = context.currentFile || 'unknown';
        const example = `${entityName} (${fileName})`;

        if (group.examples.length < 3) {
            group.examples.push(example);
        }

        // Log individual error for first few occurrences
        if (group.count <= 3) {
            defaultErrorHandler(error, item, context);
        }
    };
};

/**
 * Default error handler
 */
export const defaultErrorHandler = (error: unknown, _item: unknown, context: SeedContext) => {
    const entityName = context.currentEntity || 'Unknown';
    const fileName = context.currentFile || 'unknown';

    console.error(`${STATUS_ICONS.Error} Error details for ${fileName}:`);
    console.error(`Message: ${(error as Error).message}`);
    console.error(`Stack: ${(error as Error).stack}`);
    if ((error as Error).cause) {
        console.error(`Cause: ${(error as Error).cause}`);
    }

    summaryTracker.trackError(entityName, fileName, (error as Error).message);
};

/**
 * Checks if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
    const err = error as { code?: string; message?: string };

    // Network errors
    if (
        err.message?.includes('ECONNRESET') ||
        err.message?.includes('ETIMEDOUT') ||
        err.message?.includes('ENOTFOUND')
    ) {
        return true;
    }

    // Database connection errors
    if (
        err.message?.includes('connection') ||
        err.message?.includes('timeout') ||
        err.message?.includes('deadlock')
    ) {
        return true;
    }

    // Specific error codes that are retryable
    const retryableCodes = ['TEMPORARY_ERROR', 'RATE_LIMIT_EXCEEDED', 'SERVICE_UNAVAILABLE'];
    if (err.code && retryableCodes.includes(err.code)) {
        return true;
    }

    return false;
}

export const createBasicErrorHandler = () => {
    return (_item: unknown, index: number, error: unknown) => {
        // 🔍 LOG DISTINTIVO: basic error handler
        console.error(`${STATUS_ICONS.Debug} [BASIC_ERROR_HANDLER] Reportando error básico`);

        const fileName = `item-${index}`;

        console.error(`${STATUS_ICONS.Error} Error details for ${fileName}:`);
        console.error(`Message: ${(error as Error).message}`);
        console.error(`Stack: ${(error as Error).stack}`);

        if ((error as Error).cause) {
            console.error(`Cause: ${(error as Error).cause}`);
        }
    };
};
