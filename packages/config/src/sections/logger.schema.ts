import { z } from 'zod';
import { getBooleanOrUndefined } from '../utils.js';

export const LoggerSchema = z.object({
    LEVEL: z.enum(['LOG', 'INFO', 'WARN', 'ERROR', 'DEBUG']),
    INCLUDE_TIMESTAMPS: z.coerce.boolean().optional(),
    INCLUDE_LEVEL: z.coerce.boolean().optional(),
    USE_COLORS: z.coerce.boolean().optional()
});

export const parseLoggerSchema = (env: ConfigMetaEnv) => {
    return LoggerSchema.parse({
        LEVEL: env.VITE_LOG_LEVEL?.toUpperCase(),
        INCLUDE_TIMESTAMPS: getBooleanOrUndefined(env.VITE_LOG_INCLUDE_TIMESTAMPS),
        INCLUDE_LEVEL: getBooleanOrUndefined(env.VITE_LOG_INCLUDE_LEVEL),
        USE_COLORS: getBooleanOrUndefined(env.VITE_LOG_USE_COLORS)
    });
};
