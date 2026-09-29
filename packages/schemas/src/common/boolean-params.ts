/**
 * Canonical boolean parsers for HTTP inputs (HOS-410).
 *
 * `z.coerce.boolean()` is banned in `packages/schemas/src` and `apps/api/src`
 * (see `scripts/check-no-coerce-boolean.ts`): it applies `Boolean(value)`, so the
 * string `'false'` becomes `true`. On a filter that inverts the result set; on a
 * flag like `dryRun` it runs the wrong mode.
 *
 * The rule for query strings is strict on purpose: only the literals `'true'`
 * and `'false'` are accepted. Anything else (empty string, `1`, `yes`, `TRUE`)
 * is a 400 instead of a guess, because a wrong guess silently returns the wrong
 * data or runs the wrong mode.
 *
 * Declared in a dependency-free module so both `base-http.schema.ts` and the
 * entity schemas can import it without a cycle.
 *
 * @module common/boolean-params
 */
import { z } from 'zod';

/**
 * Lets an already-parsed boolean through a strict string parser, so re-parsing
 * a parsed query object (service layers, `.merge`d schemas) stays idempotent.
 * Strings are untouched: only the literals `'true'`/`'false'` still pass.
 */
const booleanToLiteral = (value: unknown): unknown =>
    typeof value === 'boolean' ? String(value) : value;

const literalToBoolean = z.enum(['true', 'false']).transform((value) => value === 'true');

/**
 * Strict boolean query parameter, optional.
 *
 * @param description - OpenAPI description of the parameter
 * @returns Schema parsing `'true'|'false'` (or an already-parsed boolean) to a
 * boolean; absent stays `undefined`
 *
 * @example
 * createBooleanQueryParam('Filter by active status').parse('false') // => false
 * createBooleanQueryParam('x').parse(undefined)                      // => undefined
 * createBooleanQueryParam('x').parse('')                             // => throws
 */
export const createBooleanQueryParam = (description: string) =>
    z.preprocess(booleanToLiteral, literalToBoolean).optional().describe(description);

/**
 * Strict boolean query parameter with a default that applies ONLY when the
 * parameter is absent. `?flag=false` yields `false` even when the default is
 * `true`, and a present-but-invalid value is still a 400.
 *
 * @param description - OpenAPI description of the parameter
 * @param defaultValue - Value used when the parameter is absent
 * @returns Schema parsing `'true'|'false'` to a boolean, defaulting when absent
 */
export const createBooleanQueryParamWithDefault = (description: string, defaultValue: boolean) =>
    z.preprocess(booleanToLiteral, literalToBoolean).default(defaultValue).describe(description);

/**
 * Boolean field for HTTP request BODIES (JSON or form-encoded).
 *
 * Accepts a real boolean or the exact strings `'true'`/`'false'` (form
 * serialisation). Never coerces: `'false'` is `false`, and anything else is
 * rejected.
 *
 * @returns Schema producing a boolean
 */
export const httpBodyBoolean = () =>
    z.union([z.boolean(), z.enum(['true', 'false']).transform((value) => value === 'true')]);
