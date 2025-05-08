import { z } from 'zod';
import { getBooleanOrUndefined } from '../utils';

const LoggerSchema = z.object({
    LEVEL: z.enum(['LOG', 'DEBUG', 'INFO', 'WARN', 'ERROR']),
    INCLUDE_TIMESTAMPS: z.coerce.boolean(),
    INCLUDE_LEVEL: z.coerce.boolean(),
    USE_COLORS: z.coerce.boolean()
});

const parsed = LoggerSchema.parse({
    LEVEL: process.env.LOG_LEVEL?.toUpperCase(),
    INCLUDE_TIMESTAMPS: getBooleanOrUndefined(process.env.LOG_INCLUDE_TIMESTAMPS),
    INCLUDE_LEVEL: getBooleanOrUndefined(process.env.LOG_INCLUDE_LEVEL),
    USE_COLORS: getBooleanOrUndefined(process.env.LOG_USE_COLORS)
});

export function getLoggerConfigs() {
    return parsed;
}
