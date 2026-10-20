import type { z } from 'zod';

/**
 * Accepts an optional Mercado Pago response field that the provider may send
 * as `null` and normalizes that `null` to `undefined` (HOS-1724).
 *
 * Mercado Pago reports "no value" either by omitting a key or by sending it
 * as `null` (a never-charged preapproval answers `summarized.charged_quantity:
 * null`, not an absent key). Consumers in this adapter already decide on
 * `undefined`, so normalizing at the schema keeps one meaning for "absent"
 * instead of teaching every consumer a second one. Never use it on a field the
 * adapter requires: it only widens what an optional field accepts.
 *
 * @param input.schema - The schema of the field's present value
 * @returns A schema accepting the value, `null` or an absent key, outputting `undefined` for the last two
 */
export function nullAsAbsent<T extends z.ZodType>({ schema }: { readonly schema: T }) {
    return schema.nullish().transform((value) => value ?? undefined);
}
