import { parseMainSchema } from './main.schema.js';

const env = import.meta.env;

export function getMainConfigs() {
    return parseMainSchema(env);
}
