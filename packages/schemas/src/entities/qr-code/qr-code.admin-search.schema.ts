import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';
import { QrCodeSourceEnumSchema } from '../../enums/qr-code-source.schema.js';

/**
 * Admin list filters for QR codes (HOS-981).
 *
 * Every field maps directly to a `qr_codes` column, so the service uses the
 * base class's default `_executeAdminSearch()`. Note that the free-text
 * `search` param is NOT covered by that default: `QrCodeService` overrides
 * `getSearchableColumns()` because the base default names a `name` column this
 * table does not have.
 */
export const QrCodeAdminSearchSchema = AdminSearchBaseSchema.extend({
    source: QrCodeSourceEnumSchema.optional(),
    entityType: z.string().optional(),
    entityId: z.string().uuid().optional(),
    /**
     * NOT `z.coerce.boolean()`. A query param arrives as a string and
     * `Boolean('false') === true`, so coercion would hand the filter the exact
     * complement of what the operator asked for: "show me the retired codes"
     * would list the live ones under an "inactive" heading.
     */
    isActive: queryBooleanParam().describe('Filter by active status')
});

export type QrCodeAdminSearch = z.infer<typeof QrCodeAdminSearchSchema>;
