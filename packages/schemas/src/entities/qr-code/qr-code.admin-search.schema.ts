import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { QrCodeSourceEnumSchema } from '../../enums/qr-code-source.schema.js';

/**
 * Admin list filters for QR codes (HOS-981).
 *
 * Every field maps directly to a `qr_codes` column, so the service uses the
 * base class's default `_executeAdminSearch()`.
 */
export const QrCodeAdminSearchSchema = AdminSearchBaseSchema.extend({
    source: QrCodeSourceEnumSchema.optional(),
    entityType: z.string().optional(),
    entityId: z.string().uuid().optional(),
    isActive: z.coerce.boolean().optional()
});

export type QrCodeAdminSearch = z.infer<typeof QrCodeAdminSearchSchema>;
