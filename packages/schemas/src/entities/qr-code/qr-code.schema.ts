import { z } from 'zod';
import { EntityTypeEnumSchema } from '../../enums/entity-type.schema.js';
import { QrCodeCenterLogoEnum } from '../../enums/qr-code-center-logo.enum.js';
import { QrCodeCenterLogoEnumSchema } from '../../enums/qr-code-center-logo.schema.js';
import { QrCodeErrorCorrectionLevelEnum } from '../../enums/qr-code-error-correction-level.enum.js';
import { QrCodeErrorCorrectionLevelEnumSchema } from '../../enums/qr-code-error-correction-level.schema.js';
import { QrCodeFormatEnum } from '../../enums/qr-code-format.enum.js';
import { QrCodeFormatEnumSchema } from '../../enums/qr-code-format.schema.js';
import { QrCodePurposeEnumSchema } from '../../enums/qr-code-purpose.schema.js';
import { QrCodeSourceEnumSchema } from '../../enums/qr-code-source.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';

export const QR_CODE_SLUG_MIN_LENGTH = 4;
export const QR_CODE_SLUG_MAX_LENGTH = 64;
export const QR_CODE_LABEL_MAX_LENGTH = 200;
export const QR_CODE_DESCRIPTION_MAX_LENGTH = 2000;
export const QR_CODE_TARGET_URL_MAX_LENGTH = 2048;

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

// ============================================================================
// CENTRE LOGO — the geometry that decides whether one is affordable
// ============================================================================

/**
 * Side of the centre mark, as a fraction of the symbol's side (quiet zone
 * excluded).
 *
 * The renderer snaps this DOWN to the largest odd whole number of modules that
 * fits — odd so the plate centres exactly on an odd-sided symbol, down so that
 * the covered area is never larger than `ratio²` at any QR version. That bound
 * is the whole reason the gate below can be evaluated without knowing which
 * version a given URL will produce.
 */
export const QR_CODE_CENTER_LOGO_SIZE_RATIO = 0.2;

/**
 * Upper bound on the fraction of the symbol the mark can cover, at any version.
 *
 * Equal to {@link QR_CODE_CENTER_LOGO_SIZE_RATIO} squared, and that equality is
 * a consequence of the floor-to-odd snapping described above, not a coincidence
 * — `qr-center-logo.test.ts` re-derives it over all forty QR versions
 * so a change to the snapping rule cannot silently invalidate the gate.
 */
export const QR_CODE_CENTER_LOGO_MAX_COVERAGE =
    QR_CODE_CENTER_LOGO_SIZE_RATIO * QR_CODE_CENTER_LOGO_SIZE_RATIO;

/**
 * The largest covered-area fraction that STILL DECODED, per correction level.
 *
 * MEASURED, not quoted. Every number here came out of a sweep run on
 * 2026-09-04: for each level, the platform's own `/qr/{slug}/` URL was rendered
 * as a real PNG at 256, 512 and 1024 px, a centre plate of increasing size was
 * painted onto it, and the result was fed to a real decoder (`jsqr`). The value
 * below is the largest coverage at which all nine renders still returned the
 * original URL; the next step up returned nothing at all. The sweep is
 * reproduced as a test — see `qr-center-logo.decode.test.ts`.
 *
 * ## These are roughly HALF the level's nominal percentage, and that is the point
 *
 * The QR standard's familiar "L≈7%, M≈15%, Q≈25%, H≈30%" describes CODEWORDS a
 * decoder can repair, and repairing a codeword whose position is unknown costs
 * two error-correction codewords, not one. A contiguous blob also destroys
 * whole codewords at its edges that it only partly covers. So reading those
 * percentages as an area budget overstates what a logo can spend by about a
 * factor of two — measured: M's nominal 15% broke at 9.6% of area, H's nominal
 * 30% broke at 21.1%. Sizing a logo against the nominal numbers is exactly how
 * a code that passes on a screen fails on a wall.
 */
export const QR_CODE_ERROR_CORRECTION_DECODE_CEILING: Readonly<
    Record<QrCodeErrorCorrectionLevelEnum, number>
> = {
    [QrCodeErrorCorrectionLevelEnum.L]: 0.03,
    [QrCodeErrorCorrectionLevelEnum.M]: 0.058,
    [QrCodeErrorCorrectionLevelEnum.Q]: 0.111,
    [QrCodeErrorCorrectionLevelEnum.H]: 0.164
} as const;

/**
 * How much of a level's measured tolerance the mark is allowed to consume.
 *
 * A judgment call, stated as one: half. The ceilings above were measured on a
 * PRISTINE render, and error correction does not exist to pay for decoration —
 * it exists to survive a scuffed sticker, a folded brochure, a bad camera and
 * poor light. Spending everything the ceiling allows would leave a symbol that
 * decodes perfectly on the day it is printed and nowhere afterwards, which is
 * the failure this whole entity exists to avoid: a printed code cannot be
 * corrected. Half to the mark, half to the world.
 */
export const QR_CODE_CENTER_LOGO_DAMAGE_BUDGET_SHARE = 0.5;

/**
 * Whether a centre mark is affordable at a given correction level.
 *
 * The gate. At the shipped ratio of 0.2 it answers `true` for `Q` and `H` and
 * `false` for `L` and `M`, but it is written as the comparison rather than as
 * that list on purpose — enlarging the mark must move the line by itself, not
 * leave a hardcoded set of levels asserting a safety that no longer holds.
 *
 * @param input - Options object (RO-RO).
 * @param input.centerLogo - Which mark, if any, is requested.
 * @param input.errorCorrectionLevel - The level the symbol will be drawn at.
 * @returns `true` when the pair is safe to draw.
 */
export function qrCodeCenterLogoFits(input: {
    centerLogo: QrCodeCenterLogoEnum;
    errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum;
}): boolean {
    if (input.centerLogo === QrCodeCenterLogoEnum.NONE) return true;

    const affordable =
        QR_CODE_ERROR_CORRECTION_DECODE_CEILING[input.errorCorrectionLevel] *
        QR_CODE_CENTER_LOGO_DAMAGE_BUDGET_SHARE;

    return QR_CODE_CENTER_LOGO_MAX_COVERAGE <= affordable;
}

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
            .default(QR_CODE_DEFAULT_BACKGROUND_COLOR),

        /**
         * The mark painted over the middle of the symbol.
         *
         * This is DAMAGE, not decoration: the plate blanks whatever modules sit
         * under it, and the code survives only because Reed-Solomon can rebuild
         * them. Which is why it is gated below rather than merely offered.
         */
        centerLogo: QrCodeCenterLogoEnumSchema.default(QrCodeCenterLogoEnum.NONE)
    })
    .strict()
    /**
     * The geometric gate: refuse a mark the correction level cannot pay for.
     *
     * `.strict()` runs BEFORE this — measured on Zod 4.3.6: parsing
     * `{centerLogo: 'HOSPEDA', errorCorrectionLevel: 'L', zzz: 1}` yields only
     * `unrecognized_keys`, never the custom issue. That is fine here (an
     * unknown key is refused either way) and is noted because it is exactly
     * what makes a cross-field refine unreachable when the fields it reads have
     * been omitted from the shape — the trap `QrCodeUpdateInputSchema` fell
     * into with `source`.
     *
     * The issue is attached to `centerLogo` rather than to
     * `errorCorrectionLevel` because turning the mark on is what an operator
     * just did; the level is the thing they now have to raise.
     */
    .superRefine((data, ctx) => {
        if (qrCodeCenterLogoFits(data)) return;

        ctx.addIssue({
            code: 'custom',
            message: 'zodError.qrCode.renderOptions.centerLogo.requiresErrorCorrection',
            path: ['centerLogo']
        });
    });

export type QrCodeRenderOptions = z.infer<typeof QrCodeRenderOptionsSchema>;

/**
 * The same render options as a PATCH: every field optional, no field defaulted.
 *
 * This exists because `.partial()` alone is not enough, and the difference is
 * invisible until it costs somebody a colour. In Zod 4 a `ZodDefault` still
 * fires through an enclosing `ZodOptional`, so
 * `QrCodeRenderOptionsSchema.partial().parse({margin: 8})` returns all SEVEN
 * fields — the six the caller never mentioned arrive carrying the schema's
 * defaults, indistinguishable from values an operator actually chose. Since
 * `render_options` is one `jsonb` column, that completed object is what gets
 * written: a code stored with `foregroundColor: '#ff0000'` comes back black
 * after a margin-only patch, silently.
 *
 * `stripShapeDefaults` removes the `ZodDefault` wrappers first, so what comes
 * out of a parse is exactly what went in. `.strict()` is preserved, so an
 * unknown drawing key is still refused rather than merged into the stored
 * document.
 *
 * Used by BOTH update schemas (domain and HTTP). Declared once here rather than
 * spelled out in each so the two cannot drift into disagreeing about what a
 * partial render patch is.
 *
 * ## Why the centre-logo gate is re-stated here, and re-stated DIFFERENTLY
 *
 * The refine on {@link QrCodeRenderOptionsSchema} does not survive: this schema
 * is rebuilt from that one's `.shape`, and a shape carries fields, not checks.
 * Re-attaching the same refine would not work either, and that is the part
 * worth reading twice — the gate is a comparison between `centerLogo` and
 * `errorCorrectionLevel`, and a PATCH is free to carry one without the other.
 * `{centerLogo: 'HOSPEDA'}` alone reaches a row whose stored level this schema
 * cannot see; so does `{errorCorrectionLevel: 'L'}` alone, on a row that
 * already carries a mark. Either one, merged into the stored `jsonb` by
 * `QrCodeModel.mergeableJsonbColumns`, produces exactly the configuration the
 * gate exists to refuse — through the gate, with a 200.
 *
 * Nothing in this schema can rescue that, because the payload does not carry
 * the stored document. The service cannot either without a re-read it does not
 * do. So the rule enforced here is the one that IS decidable from the payload
 * alone: **the two fields travel together whenever the answer depends on both**.
 *
 * Concretely, a patch is refused unless one of these holds:
 *
 * - it mentions neither field;
 * - it states BOTH, and the pair fits;
 * - it only turns the mark OFF (`centerLogo: 'NONE'`) — which cannot make any
 *   symbol harder to read, whatever level is stored;
 * - it only raises the level to one that affords a mark — safe whatever mark is
 *   stored, because the worst case is the mark being present.
 *
 * The cost is that turning a mark on, or lowering the correction level, means
 * sending both keys. That is not a UI inconvenience so much as an honest
 * statement of what the server can and cannot check, and the admin form sends
 * the pair for exactly this reason (`diffRenderOptions`).
 */
export const QrCodeRenderOptionsPatchSchema = z
    .object(stripShapeDefaults(QrCodeRenderOptionsSchema.shape))
    .partial()
    .strict()
    .superRefine((data, ctx) => {
        const statesLogo = data.centerLogo !== undefined;
        const statesLevel = data.errorCorrectionLevel !== undefined;

        if (!statesLogo && !statesLevel) return;

        if (statesLogo && statesLevel) {
            if (
                qrCodeCenterLogoFits({
                    centerLogo: data.centerLogo as QrCodeCenterLogoEnum,
                    errorCorrectionLevel:
                        data.errorCorrectionLevel as QrCodeErrorCorrectionLevelEnum
                })
            ) {
                return;
            }

            ctx.addIssue({
                code: 'custom',
                message: 'zodError.qrCode.renderOptions.centerLogo.requiresErrorCorrection',
                path: ['centerLogo']
            });
            return;
        }

        // Only the mark moved. Removing it is always safe; adding one needs the
        // level stated, because the stored one is invisible from here.
        if (statesLogo) {
            if (data.centerLogo === QrCodeCenterLogoEnum.NONE) return;

            ctx.addIssue({
                code: 'custom',
                message: 'zodError.qrCode.renderOptions.centerLogo.levelRequiredWithLogo',
                path: ['errorCorrectionLevel']
            });
            return;
        }

        // Only the level moved. Safe iff the new level would afford a mark —
        // that is the worst case for whatever the row currently stores.
        if (
            qrCodeCenterLogoFits({
                centerLogo: QrCodeCenterLogoEnum.HOSPEDA,
                errorCorrectionLevel: data.errorCorrectionLevel as QrCodeErrorCorrectionLevelEnum
            })
        ) {
            return;
        }

        ctx.addIssue({
            code: 'custom',
            message: 'zodError.qrCode.renderOptions.centerLogo.logoRequiredWithLevel',
            path: ['centerLogo']
        });
    });

export type QrCodeRenderOptionsPatch = z.infer<typeof QrCodeRenderOptionsPatchSchema>;

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

    /**
     * Entity this code was derived from, when `source` is `GENERATED`.
     *
     * The shared `EntityTypeEnumSchema`, not a bounded string: every reference
     * to a domain entity in this repo goes through that enum. A free string
     * would let `'hostTrade'` and `'host_trade'` both be stored for the same
     * subject, after which the `(entityType, entityId)` lookup stops finding the
     * existing code and mints a second, permanent slug for it.
     */
    entityType: EntityTypeEnumSchema.nullable().optional(),

    entityId: z.string().uuid().nullable().optional(),

    /**
     * WHICH code this is, for a subject that carries more than one.
     *
     * The third part of a generated code's identity: uniqueness on the table is
     * `(entityType, entityId, purpose)`, so a restaurant's door code and its
     * table code are not duplicates of each other. Nullable because a `MANUAL`
     * code has no system purpose — and because Postgres excludes `NULL` rows
     * from a UNIQUE index, which is what lets several hand-made codes coexist
     * for one subject. See `QrCodePurposeEnum`.
     */
    purpose: QrCodePurposeEnumSchema.nullable().optional(),

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
