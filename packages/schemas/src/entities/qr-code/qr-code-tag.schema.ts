import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { TagColorEnumSchema } from '../../enums/tag-color.schema.js';

/**
 * QR-code tags (HOS-2679): an admin-only catalog for organising QR codes in the
 * panel. A tag never reaches a scan, a redirect or a UTM parameter.
 *
 * The slug is not part of any input. The service derives it from `name` on every
 * create and rename, and it is the dedupe key — "Verano 2026" and "verano 2026"
 * collide instead of becoming two tags.
 */

export const QR_CODE_TAG_NAME_MAX_LENGTH = 80;

/** Most tags one QR code may carry. A guard against a runaway payload, not a product limit. */
export const QR_CODE_TAG_MAX_PER_CODE = 50;

/** Shared `name` field: trimmed, non-empty, bounded. */
export const QrCodeTagNameSchema = z
    .string()
    .trim()
    .min(1, { message: 'zodError.qrCodeTag.name.min' })
    .max(QR_CODE_TAG_NAME_MAX_LENGTH, { message: 'zodError.qrCodeTag.name.max' });

/** A QR-code tag row. */
export const QrCodeTagSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    name: QrCodeTagNameSchema,
    slug: z.string().min(1).max(QR_CODE_TAG_NAME_MAX_LENGTH),
    /** Badge colour from the shared tag palette; `null` renders neutral. */
    color: TagColorEnumSchema.nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    deletedAt: z.coerce.date().nullable().optional(),
    createdById: z.string().uuid().nullable(),
    updatedById: z.string().uuid().nullable(),
    deletedById: z.string().uuid().nullable().optional()
});

export type QrCodeTag = z.infer<typeof QrCodeTagSchema>;

/** The slice of a tag a QR list row carries: enough to draw the badge. */
export const QrCodeTagRefSchema = QrCodeTagSchema.pick({
    id: true,
    name: true,
    slug: true,
    color: true
});

export type QrCodeTagRef = z.infer<typeof QrCodeTagRefSchema>;

/** Create input (domain and HTTP alike). */
export const QrCodeTagCreateInputSchema = z
    .object({
        name: QrCodeTagNameSchema,
        color: TagColorEnumSchema.nullable().optional()
    })
    .strict();

export type QrCodeTagCreateInput = z.infer<typeof QrCodeTagCreateInputSchema>;

/** Update input: a rename, a recolour, or both. */
export const QrCodeTagUpdateInputSchema = z
    .object({
        name: QrCodeTagNameSchema,
        color: TagColorEnumSchema.nullable()
    })
    .partial()
    .strict();

export type QrCodeTagUpdateInput = z.infer<typeof QrCodeTagUpdateInputSchema>;

/**
 * Admin list of tags. No filter of its own beyond the base `search` (over the
 * name); the catalog is small enough that the panel loads it whole into its
 * pickers, one page of up to 100.
 */
export const QrCodeTagAdminSearchSchema = AdminSearchBaseSchema;

export type QrCodeTagAdminSearch = z.infer<typeof QrCodeTagAdminSearchSchema>;

/**
 * Body of `PUT /admin/qr-codes/{id}/tags`: the COMPLETE set of tags the code
 * should carry. Replacing the set rather than adding and removing one by one is
 * what makes a double-submitted form idempotent.
 */
export const QrCodeSetTagsInputSchema = z
    .object({
        tagIds: z
            .array(z.string().uuid({ message: 'zodError.common.id.invalidUuid' }))
            .max(QR_CODE_TAG_MAX_PER_CODE, { message: 'zodError.qrCodeTag.tagIds.max' })
    })
    .strict();

export type QrCodeSetTagsInput = z.infer<typeof QrCodeSetTagsInputSchema>;

/** Answer of the tag-set read and write on one QR code. */
export const QrCodeTagsResponseSchema = z.object({
    items: z.array(QrCodeTagRefSchema)
});

export type QrCodeTagsResponse = z.infer<typeof QrCodeTagsResponseSchema>;
