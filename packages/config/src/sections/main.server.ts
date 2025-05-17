import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { parseMainSchema } from './main.schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env') });

export function getMainConfigs() {
    return parseMainSchema(process.env as unknown as ConfigMetaEnv);
}
