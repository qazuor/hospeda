import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { parseLoggerSchema } from './logger.schema';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env') });

export function getLoggerConfigs() {
    return parseLoggerSchema(process.env as unknown as ConfigMetaEnv);
}
