import { z } from 'zod';

/**
 * Safe boolean parser for query string parameters.
 * Unlike z.coerce.boolean(), this correctly handles the string "false"
 * (which z.coerce.boolean() converts to true via Boolean("false")).
 *
 * @returns Zod schema that correctly parses "true"/"false"/"1"/"0" strings
 */
export function queryBooleanParam() {
    return z.preprocess((val) => {
        if (val === undefined || val === null || val === '') return undefined;
        return val === 'true' || val === true || val === '1';
    }, z.boolean().optional());
}

/**
 * Safe date parser for query string parameters.
 * Parses ISO 8601 datetime strings (with timezone offset) into Date objects.
 * Rejects non-ISO strings, empty strings, null, and undefined gracefully.
 *
 * @example
 * queryDateParam().parse('2026-04-08T00:00:00Z') // => Date
 * queryDateParam().parse(undefined)               // => undefined
 * queryDateParam().parse('')                      // => undefined
 * queryDateParam().parse('01/15/2026')            // => ZodError (invalid ISO 8601)
 *
 * @returns Zod schema that parses ISO 8601 strings into Date | undefined
 */
export function queryDateParam() {
    return z.preprocess((val) => {
        if (val === undefined || val === null || val === '') return undefined;
        return val;
    }, z.string().datetime({ offset: true }).pipe(z.coerce.date()).optional());
}

/**
 * Safe number parser for query string parameters.
 * Avoids the pitfall of z.coerce.number() converting empty strings to 0.
 * Rejects non-numeric strings explicitly.
 *
 * @example
 * queryNumberParam().parse('42')      // => 42
 * queryNumberParam().parse('3.14')    // => 3.14
 * queryNumberParam().parse(undefined) // => undefined
 * queryNumberParam().parse('')        // => undefined (NOT 0)
 * queryNumberParam().parse('abc')     // => ZodError
 *
 * @returns Zod schema that parses numeric strings into number | undefined
 */
export function queryNumberParam() {
    return z.preprocess((val) => {
        if (val === undefined || val === null || val === '') return undefined;
        return val;
    }, z.coerce.number().optional());
}
