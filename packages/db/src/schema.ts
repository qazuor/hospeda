import { qzpaySchema } from '@qazuor/qzpay-drizzle';
import * as hospedaSchema from './schemas/index.ts';

/**
 * Combined schema including both Hospeda application schemas
 * and QZPay billing schemas for complete database access.
 *
 * Extracted to a separate module to avoid a circular dependency between
 * `client.ts` (which builds the Drizzle client) and `types.ts` (which
 * derives `DrizzleClient` from `typeof schema`). Both files import from
 * this module instead of from each other.
 *
 * The explicit `typeof hospedaSchema & typeof qzpaySchema` annotation is
 * required to prevent TS7056 ("inferred type exceeds the maximum length the
 * compiler will serialize") when the combined schema grows large. Annotating
 * the merged object short-circuits the structural inference that trips the
 * serialization limit while preserving the precise table types Drizzle needs.
 */
export const schema: typeof hospedaSchema & typeof qzpaySchema = {
    ...hospedaSchema,
    ...qzpaySchema
};
