import { z } from 'zod';

/**
 * Safe boolean parser for query string parameters.
 * Unlike z.coerce.boolean(), this correctly handles the string "false"
 * (which z.coerce.boolean() converts to true via Boolean("false")).
 *
 * @returns Zod schema that correctly parses "true"/"false"/"1"/"0" strings
 */
export function queryBooleanParam() {
    return z
        .preprocess((val) => {
            if (val === undefined || val === null || val === '') return undefined;
            return val === 'true' || val === true || val === '1';
        }, z.boolean().optional())
        .optional();
}
