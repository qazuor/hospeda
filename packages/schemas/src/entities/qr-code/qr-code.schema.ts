import { z } from 'zod';
import { QrCodeErrorCorrectionLevelEnum } from '../../enums/qr-code-error-correction-level.enum.js';
import { QrCodeErrorCorrectionLevelEnumSchema } from '../../enums/qr-code-error-correction-level.schema.js';
import { QrCodeFormatEnum } from '../../enums/qr-code-format.enum.js';
import { QrCodeFormatEnumSchema } from '../../enums/qr-code-format.schema.js';
import { QrCodeSourceEnumSchema } from '../../enums/qr-code-source.schema.js';

export const QR_CODE_SLUG_MIN_LENGTH = 4;
export const QR_CODE_SLUG_MAX_LENGTH = 64;
export const QR_CODE_LABEL_MAX_LENGTH = 200;
export const QR_CODE_DESCRIPTION_MAX_LENGTH = 2000;
export const QR_CODE_TARGET_URL_MAX_LENGTH = 2048;
export const QR_CODE_ENTITY_TYPE_MAX_LENGTH = 100;

/** Smallest quiet zone, in modules, the renderer will accept. */
export const QR_CODE_MIN_MARGIN = 0;
/** Largest quiet zone, in modules. Past this the symbol is a speck in a field of white. */
export const QR_CODE_MAX_MARGIN = 20;
/** Default quiet zone. Four modules is what the QR specification asks for. */
export const QR_CODE_DEFAULT_MARGIN = 4;

/** Smallest rendered edge, in pixels. Below this a phone camera stops resolving modules. */
export const QR_CODE_MIN_SIZE = 64;
/** Largest rendered edge, in pixels. */
export const QR_CODE_MAX_SIZE = 4096;

/** Default foreground (module) colour. */
export const QR_CODE_DEFAULT_FOREGROUND_COLOR = '#000000';
/** Default background (quiet zone) colour. */
export const QR_CODE_DEFAULT_BACKGROUND_COLOR = '#ffffff';

/**
 * `#rgb`, `#rrggbb` or `#rrggbbaa`. The alpha form is accepted because the
 * underlying renderer understands it and a transparent background is a real
 * request for a code that will be laid over artwork.
 */
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * The slug that ends up inside the printed URL.
 *
 * Deliberately narrower than a general slug: it must survive being read off a
 * sticker and typed by hand, so it carries no separators and no ambiguous
 * characters (see `generateShortId` in `@repo/utils`, which produces these).
 * Manually-authored slugs are allowed to use the whole unambiguous alphabet but
 * nothing outside it.
 */
export const QrCodeSlugSchema = z
    .string()
    .min(QR_CODE_SLUG_MIN_LENGTH, { message: 'zodError.qrCode.slug.min' })
    .max(QR_CODE_SLUG_MAX_LENGTH, { message: 'zodError.qrCode.slug.max' })
    .regex(/^[23456789ABCDEFGHJKLMNPQRSTVWXYZabcdefghijkmnpqrstvwxyz]+$/, {
        message: 'zodError.qrCode.slug.invalidPattern'
    });

/**
 * How a code is drawn.
 *
 * Stored as a single `jsonb` column rather than a spread of typed columns: this
 * object is expected to grow (a centre logo lands with the admin panel that
 * configures it), and absorbing that growth in a document avoids a second
 * migration over a table that will already hold production rows.
 *
 * Every field carries a default, so an empty `{}` is a valid, fully-specified
 * render configuration.
 */
export const QrCodeRenderOptionsSchema = z
    .object({
        /** Damage tolerance. See {@link QrCodeErrorCorrectionLevelEnumSchema}. */
        errorCorrectionLevel: QrCodeErrorCorrectionLevelEnumSchema.default(
            QrCodeErrorCorrectionLevelEnum.M
        ),

        /** Output format. */
        format: QrCodeFormatEnumSchema.default(QrCodeFormatEnum.SVG),

        /** Quiet zone, in modules, around the symbol. */
        margin: z
            .number()
            .int()
            .min(QR_CODE_MIN_MARGIN, { message: 'zodError.qrCode.renderOptions.margin.min' })
            .max(QR_CODE_MAX_MARGIN, { message: 'zodError.qrCode.renderOptions.margin.max' })
            .default(QR_CODE_DEFAULT_MARGIN),

        /**
         * Rendered edge in pixels.
         *
         * `null` means "do not constrain it": an SVG then carries only a
         * `viewBox` and scales to whatever box it is dropped into, which is the
         * right default for a vector. A PNG with no size falls back to the
         * renderer's own scale.
         */
        size: z
            .number()
            .int()
            .min(QR_CODE_MIN_SIZE, { message: 'zodError.qrCode.renderOptions.size.min' })
            .max(QR_CODE_MAX_SIZE, { message: 'zodError.qrCode.renderOptions.size.max' })
            .nullable()
            .default(null),

        /** Colour of the modules. */
        foregroundColor: z
            .string()
            .regex(HEX_COLOR_PATTERN, { message: 'zodError.qrCode.renderOptions.color.invalid' })
            .default(QR_CODE_DEFAULT_FOREGROUND_COLOR),

        /** Colour of the quiet zone and the gaps between modules. */
        backgroundColor: z
            .string()
            .regex(HEX_COLOR_PATTERN, { message: 'zodError.qrCode.renderOptions.color.invalid' })
            .default(QR_CODE_DEFAULT_BACKGROUND_COLOR)
    })
    .strict();

export type QrCodeRenderOptions = z.infer<typeof QrCodeRenderOptionsSchema>;

/**
 * A redirectable QR code (HOS-981).
 *
 * The whole point of the table is `targetUrl`: the printed code encodes a stable
 * `slug`, and where that slug sends a scanner is a value an operator can change
 * afterwards without reprinting anything.
 */
export const QrCodeSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    /** The identifier that appears in the printed URL. UNIQUE. */
    slug: QrCodeSlugSchema,

    /** Where a scan is sent. Editable — that is the reason this system exists. */
    targetUrl: z
        .string()
        .url({ message: 'zodError.qrCode.targetUrl.invalidUrl' })
        .max(QR_CODE_TARGET_URL_MAX_LENGTH, { message: 'zodError.qrCode.targetUrl.max' }),

    /** Human name, so the code is findable in the panel a year from now. */
    label: z
        .string()
        .min(1, { message: 'zodError.qrCode.label.min' })
        .max(QR_CODE_LABEL_MAX_LENGTH, { message: 'zodError.qrCode.label.max' }),

    description: z
        .string()
        .max(QR_CODE_DESCRIPTION_MAX_LENGTH, { message: 'zodError.qrCode.description.max' })
        .nullable()
        .optional(),

    source: QrCodeSourceEnumSchema,

    /** Entity this code was derived from, when `source` is `GENERATED`. */
    entityType: z
        .string()
        .max(QR_CODE_ENTITY_TYPE_MAX_LENGTH, { message: 'zodError.qrCode.entityType.max' })
        .nullable()
        .optional(),

    entityId: z.string().uuid().nullable().optional(),

    renderOptions: QrCodeRenderOptionsSchema,

    /** Retiring a code without losing the scans already recorded against it. */
    isActive: z.boolean().default(true),

    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    deletedAt: z.coerce.date().nullable().optional(),
    createdById: z.string().uuid().nullable(),
    updatedById: z.string().uuid().nullable(),
    deletedById: z.string().uuid().nullable().optional()
});

export type QrCode = z.infer<typeof QrCodeSchema>;

/**
 * One scan of one code.
 *
 * There is no IP column and no user-agent column, and that is a decision rather
 * than an omission — see the note on the `qr_code_scans` table in
 * `@repo/db`. The question this row answers is *when was this code scanned*,
 * and `qrCodeId + scannedAt` answers it in full.
 */
export const QrCodeScanSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    qrCodeId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    scannedAt: z.coerce.date()
});

export type QrCodeScan = z.infer<typeof QrCodeScanSchema>;
