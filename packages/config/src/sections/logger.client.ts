import { parseLoggerSchema } from './logger.schema';

export function getLoggerConfigs() {
    return parseLoggerSchema(import.meta.env);
}
