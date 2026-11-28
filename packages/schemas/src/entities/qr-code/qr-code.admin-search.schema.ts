import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { createBooleanQueryParam } from '../../common/boolean-params.js';
import { EntityTypeEnumSchema } from '../../enums/entity-type.schema.js';
import { QrCodePurposeEnumSchema } from '../../enums/qr-code-purpose.schema.js';
import { QrCodeSourceEnumSchema } from '../../enums/qr-code-source.schema.js';

/**
 * Admin list filters for QR codes (HOS-981).
 *
 * Every field but `utmCampaign` and `tagIds` maps directly to a `qr_codes`
 * column; `QrCodeService._executeAdminSearch()` lifts those two out and turns
 * them into SQL conditions (HOS-2679). Note that the free-text
 * `search` param is NOT covered by that default: `QrCodeService` overrides
 * `getSearchableColumns()` because the base default names a `name` column this
 * table does not have.
 */
export const QrCodeAdminSearchSchema = AdminSearchBaseSchema.extend({
    source: QrCodeSourceEnumSchema.optional(),
    /** Filtering by a value the column cannot hold is a typo, not a search. */
    entityType: EntityTypeEnumSchema.optional(),
    entityId: z.string().uuid().optional(),
    /**
     * A subject can hold several codes since HOS-981 PR 4 — a door code and a
     * table code, a listing code and a certificate code — so filtering by
     * entity alone no longer picks one out.
     */
    purpose: QrCodePurposeEnumSchema.optional(),
    /**
     * NOT `z.coerce.boolean()`. A query param arrives as a string and
     * `Boolean('false') === true`, so coercion would hand the filter the exact
     * complement of what the operator asked for: "show me the retired codes"
     * would list the live ones under an "inactive" heading.
     */
    isActive: createBooleanQueryParam('Filter by active status'),
    /**
     * Exact match on the `utm_campaign` stored in `targetUrl` (HOS-2679). Not a
     * column: the service turns it into a condition over the parsed query param,
     * so `verano` does not also match `verano-2025`. Meaningful for MANUAL codes;
     * a GENERATED code's campaign is computed at scan and never stored.
     */
    utmCampaign: z
        .string()
        .trim()
        .min(1, { message: 'zodError.qrCode.utmCampaign.min' })
        .max(200, { message: 'zodError.qrCode.utmCampaign.max' })
        .optional(),
    /**
     * Codes carrying ANY of these tags (HOS-2679). Accepts a repeated param or a
     * comma-separated list. Not a column either: resolved through
     * `r_qr_code_qr_code_tag`, live tags only.
     */
    tagIds: z
        .union([
            z.array(z.string().uuid({ message: 'zodError.common.id.invalidUuid' })),
            z
                .string()
                .transform((val) =>
                    val
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0)
                )
                .pipe(z.array(z.string().uuid({ message: 'zodError.common.id.invalidUuid' })))
        ])
        .optional()
});

export type QrCodeAdminSearch = z.infer<typeof QrCodeAdminSearchSchema>;
