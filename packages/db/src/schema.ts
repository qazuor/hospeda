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
 */
export const schema = {
    ...hospedaSchema,
    ...qzpaySchema
};
