import { parseMainSchema } from './main.schema';

const env = import.meta.env;

export function getMainConfigs() {
    return parseMainSchema(env);
}
