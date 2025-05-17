import { parseLoggerSchema } from './logger.schema.js';

export function getLoggerConfigs() {
    return parseLoggerSchema(import.meta.env);
}
