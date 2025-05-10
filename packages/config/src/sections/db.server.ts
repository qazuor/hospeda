import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { parseDBSchema } from './db.schema';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env') });

export function getDBConfigs() {
    return parseDBSchema(process.env as unknown as ConfigMetaEnv);
}
