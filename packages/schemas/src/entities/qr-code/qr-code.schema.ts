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
import { QrScanDeviceTypeEnumSchema } from '../../enums/qr-scan-device-type.schema.js';
import { QrScanOsEnumSchema } from '../../enums/qr-scan-os.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import { LanguageEnumSchema } from '../user/user.settings.schema.js';

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
 * The largest covered-area fraction at which EVERY sampled render still
 * decoded, per correction level.
 *
 * MEASURED, not quoted. Re-measured on 2026-09-04 over a deliberately wider
 * corpus than the first pass — SEVEN `/q/` and `/qr/` URLs across two hosts, at
 * 256, 384, 512, 768 and 1024 px, so 35 renders per step — with the plate swept
 * by whole odd modules exactly as the renderer emits it, each result fed to a
 * real decoder (`jsqr`). Raw:
 *
 * ```
 * L   3 mod  1.07%  35/35     M   3 mod  1.07%  35/35
 * L   5 mod  2.97%  35/35     M   5 mod  2.97%  35/35
 * L   7 mod  5.83%   0/35     M   7 mod  5.83%  35/35
 *                             M   9 mod  9.63%  10/35   <- partial
 *                             M  11 mod 14.39%   0/35
 * Q   5 mod  2.30%  35/35     H   5 mod  2.30%  35/35
 * Q   7 mod  4.50%  35/35     H   9 mod  7.44%  35/35
 * Q  11 mod 11.11%  35/35     H  13 mod 14.61%  35/35
 * Q  13 mod 15.52%   0/35     H  15 mod 19.50%  10/35   <- partial
 *                             H  17 mod 24.99%   0/35
 * ```
 *
 * ## Two corrections to what the first pass claimed (HOS-981 PR 5 review)
 *
 * 1. **The old L ceiling of `0.03` did not reproduce.** A reviewer sweeping
 *    other URLs got 6/9 at ~3.1% coverage, not 9/9. The wider sweep above puts
 *    the last all-pass step at 2.97%, so the constant was sitting a hair ABOVE
 *    the honest number. Same for H, and by more: the old `0.164` came from a
 *    longer URL landing on a bigger symbol, and 14.61% is what all 35 renders
 *    survive. Both are corrected below.
 * 2. **The transition is NOT a cliff.** The first pass showed adjacent
 *    all-pass/all-fail steps because it happened to sample the two rows that
 *    bracket the whole degradation band. There IS a band — visible above at M
 *    (10/35) and H (10/35), and wider still under a finer, content-varying
 *    sweep — and where it starts depends on the string being encoded, because
 *    the string decides the QR version and therefore how many codewords a given
 *    area destroys. Treat these as "the last step nothing failed at", not as a
 *    threshold with cliff edges. Anyone raising
 *    {@link QR_CODE_CENTER_LOGO_SIZE_RATIO} must re-run the sweep over their
 *    own corpus rather than reading a headroom off these four numbers.
 *
 * ## They are roughly HALF the level's nominal percentage, and that is the point
 *
 * The QR standard's familiar "L≈7%, M≈15%, Q≈25%, H≈30%" describes CODEWORDS a
 * decoder can repair, and repairing a codeword whose position is unknown costs
 * two error-correction codewords, not one. A contiguous blob also destroys
 * whole codewords at its edges that it only partly covers. So reading those
 * percentages as an area budget overstates what a logo can spend by about a
 * factor of two — measured: M's nominal 15% first lost renders at 9.6% of area,
 * H's nominal 30% at 19.5%. Sizing a logo against the nominal numbers is exactly
 * how a code that passes on a screen fails on a wall.
 */
export const QR_CODE_ERROR_CORRECTION_DECODE_CEILING: Readonly<
    Record<QrCodeErrorCorrectionLevelEnum, number>
> = {
    [QrCodeErrorCorrectionLevelEnum.L]: 0.029,
    [QrCodeErrorCorrectionLevelEnum.M]: 0.058,
    [QrCodeErrorCorrectionLevelEnum.Q]: 0.111,
    [QrCodeErrorCorrectionLevelEnum.H]: 0.146
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
 * How a code is drawn, AS STORED — every field validated, no cross-field gate.
 *
 * Stored as a single `jsonb` column rather than a spread of typed columns: this
 * object is expected to grow, and absorbing that growth in a document avoids a
 * second migration over a table that will already hold production rows.
 *
 * Every field carries a default, so an empty `{}` is a valid, fully-specified
 * render configuration.
 *
 * ## Why this is separate from {@link QrCodeRenderOptionsSchema} (HOS-981 PR 5)
 *
 * Because a READ is not a WRITE, and the centre-logo gate is a rule about what
 * may be written. `QrCodeSchema.renderOptions` — and therefore
 * `QrCodeAdminSchema`, the RESPONSE contract — is parsed on the way OUT by
 * `stripWithSchema`, which fail-closes to HTTP 500 by design.
 *
 * Attaching the gate to the entity shape made a stored row the API could not
 * serve. Measured on 2026-09-04, with one row carrying
 * `{centerLogo: 'HOSPEDA', errorCorrectionLevel: 'L'}`:
 *
 * ```
 * getById on a non-affordable row => REJECTED: renderOptions.centerLogo
 * list page with 3 good + 1 bad   => WHOLE PAGE REJECTED (z.array fails on one element)
 * ```
 *
 * No write path can produce such a row today, so it was latent — but a seed, a
 * data-migration or one `UPDATE ... SET render_options` is all it takes, and
 * the symptom would be a 500 on the entire admin list rather than one odd code.
 * A gate that makes bad data UNREADABLE cannot be used to fix bad data.
 *
 * The general lesson, worth carrying to the next cross-field refine: ask which
 * paths PARSE a schema, not only which paths validate against it. An entity
 * schema in this repo is a response contract too.
 */
export const QrCodeRenderOptionsStoredSchema = z
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
         * them. Which is why {@link QrCodeRenderOptionsSchema} gates it rather
         * than merely offering it.
         */
        centerLogo: QrCodeCenterLogoEnumSchema.default(QrCodeCenterLogoEnum.NONE)
    })
    .strict();

export type QrCodeRenderOptions = z.infer<typeof QrCodeRenderOptionsStoredSchema>;

/**
 * How a code MAY BE WRITTEN: the stored shape, plus the centre-logo gate.
 *
 * This is the schema every write path takes — the create input (domain and
 * HTTP), and `QrCodeService._beforeCreate`, which materialises the stored
 * document. The entity/response shape deliberately does NOT carry it; see
 * {@link QrCodeRenderOptionsStoredSchema} for the 500 that taught us why.
 *
 * `.strict()` runs BEFORE the refine — measured on Zod 4.3.6: parsing
 * `{centerLogo: 'HOSPEDA', errorCorrectionLevel: 'L', zzz: 1}` yields only
 * `unrecognized_keys`, never the custom issue. That is fine here (an unknown
 * key is refused either way) and is noted because it is exactly what makes a
 * cross-field refine unreachable when the fields it reads have been omitted
 * from the shape — the trap `QrCodeUpdateInputSchema` fell into with `source`.
 *
 * The issue is attached to `centerLogo` rather than to `errorCorrectionLevel`
 * because turning the mark on is what an operator just did; the level is the
 * thing they now have to raise.
 */
export const QrCodeRenderOptionsSchema = QrCodeRenderOptionsStoredSchema.superRefine(
    (data, ctx) => {
        if (qrCodeCenterLogoFits(data)) return;

        ctx.addIssue({
            code: 'custom',
            message: 'zodError.qrCode.renderOptions.centerLogo.requiresErrorCorrection',
            path: ['centerLogo']
        });
    }
);

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
/**
 * The half of the rule that needs no stored document: if a partial object
 * states BOTH fields, they must fit.
 *
 * Shared by the PATCH schema and the one-request render override, because it is
 * the only part of the gate they genuinely have in common — see
 * {@link QrCodeRenderOptionsOverrideSchema} for what the override deliberately
 * does NOT inherit.
 *
 * @param data - The partial render options being checked.
 * @returns `true` when both fields are stated and the pair does not fit.
 */
function statedCenterLogoPairIsUnaffordable(data: {
    centerLogo?: QrCodeCenterLogoEnum;
    errorCorrectionLevel?: QrCodeErrorCorrectionLevelEnum;
}): boolean {
    if (data.centerLogo === undefined || data.errorCorrectionLevel === undefined) return false;

    return !qrCodeCenterLogoFits({
        centerLogo: data.centerLogo,
        errorCorrectionLevel: data.errorCorrectionLevel
    });
}

export const QrCodeRenderOptionsPatchSchema = z
    .object(stripShapeDefaults(QrCodeRenderOptionsStoredSchema.shape))
    .partial()
    .strict()
    .superRefine((data, ctx) => {
        const statesLogo = data.centerLogo !== undefined;
        const statesLevel = data.errorCorrectionLevel !== undefined;

        if (!statesLogo && !statesLevel) return;

        if (statesLogo && statesLevel) {
            if (!statedCenterLogoPairIsUnaffordable(data)) return;

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
 * Render options overridden for ONE request, never written anywhere.
 *
 * Shaped like the patch — every field optional, no defaults, unknown keys
 * refused — and it carries the gate ONLY in the form that is decidable from the
 * override itself: if it states both `centerLogo` and `errorCorrectionLevel`,
 * the pair must fit.
 *
 * ## What it deliberately does NOT inherit, and why (HOS-981 PR 5 review)
 *
 * The PATCH schema also demands that the two fields TRAVEL TOGETHER. That rule
 * is bought by one specific fact: a patch is MERGED into the stored `jsonb`, so
 * a lone `{centerLogo: 'HOSPEDA'}` becomes a permanent row whose level this
 * schema never saw. An override is merged with nothing and outlives nothing —
 * it decorates a single response and is gone.
 *
 * Carrying the pairing rule here would therefore charge the cost with none of
 * the motive: `?errorCorrectionLevel=L` against a code stored with
 * `centerLogo: NONE` is completely harmless and would have answered 400.
 * Measured before the split:
 *
 * ```
 * renderQuery {errorCorrectionLevel:L} => FAIL centerLogo.logoRequiredWithLevel
 * renderQuery {errorCorrectionLevel:M} => FAIL centerLogo.logoRequiredWithLevel
 * ```
 *
 * ## What that leaves uncovered, said out loud
 *
 * A one-sided override IS still merged over the stored options at RENDER time
 * (`{...qrCode.renderOptions, ...override}`), so `?errorCorrectionLevel=L` on a
 * code stored WITH a mark would render one unscannable image. This schema
 * cannot see that — the stored document is not in the query string. Whoever
 * wires a render endpoint to this schema must run {@link qrCodeCenterLogoFits}
 * over the MERGED object before drawing. There is no consumer today; that is
 * the whole reason this is a note and not a route change.
 */
export const QrCodeRenderOptionsOverrideSchema = z
    .object(stripShapeDefaults(QrCodeRenderOptionsStoredSchema.shape))
    .partial()
    .strict()
    .superRefine((data, ctx) => {
        if (!statedCenterLogoPairIsUnaffordable(data)) return;

        ctx.addIssue({
            code: 'custom',
            message: 'zodError.qrCode.renderOptions.centerLogo.requiresErrorCorrection',
            path: ['centerLogo']
        });
    });

export type QrCodeRenderOptionsOverride = z.infer<typeof QrCodeRenderOptionsOverrideSchema>;

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

    /**
     * The STORED shape, ungated on purpose (HOS-981 PR 5).
     *
     * This schema is a response contract as much as an entity model —
     * `QrCodeAdminSchema` is literally this object, and `stripWithSchema` parses
     * every response through it and fail-closes to 500. Gating here would mean a
     * row written by a seed or a hand-run `UPDATE` could not be read back, and
     * one such row 500s the WHOLE admin list page, not just itself.
     */
    renderOptions: QrCodeRenderOptionsStoredSchema,

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

// ============================================================================
// SCANS (HOS-981, widened by HOS-1141)
// ============================================================================

/**
 * Longest `User-Agent` a scan row will store, in characters.
 *
 * Real user agents run to roughly 200 characters and the longest seen in the
 * wild are under 500. The bound exists for the OTHER kind of caller: the header
 * can legally carry kilobytes, the resolution endpoint is public and
 * unauthenticated, and a client sending 8 KB of junk 240 times a minute (that
 * route's rate limit) must not be able to turn a counter into a storage
 * amplifier.
 *
 * Enforced in three places, outermost first: `deriveQrScanContext` TRUNCATES,
 * this schema bounds, and the `user_agent` column bounds. Truncation comes
 * first deliberately — a schema or a column that REJECTED an over-long value
 * would convert a hostile header into a lost scan, and a lost scan is the one
 * outcome that whole path is written to avoid.
 */
export const QR_SCAN_USER_AGENT_MAX_LENGTH = 1024;

/** Longest `browserLanguage` value. It holds a locale code, not a header. */
export const QR_SCAN_BROWSER_LANGUAGE_MAX_LENGTH = 8;

/**
 * One scan of one code (HOS-981, widened by HOS-1141).
 *
 * Every field past `scannedAt` is nullable, uniformly. That is not laxity: the
 * row is written on the critical path of a redirect, out of headers a stranger
 * controls, and the rule the whole path is built on is that a scan is lost
 * before a redirect is. A REQUIRED field here would be a header a hostile
 * client could omit in order to make the insert fail.
 *
 * There is still no IP column and no referrer column — the note on the
 * `qr_code_scans` table in `@repo/db` rejects those two by name, so that
 * neither gets added later as an obvious completion.
 */
export const QrCodeScanSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    qrCodeId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    scannedAt: z.coerce.date(),

    /**
     * The raw `User-Agent`, already truncated by the deriver.
     *
     * `.max()` rather than a `.transform()` that truncates again: by the time a
     * value reaches this schema the truncation has happened, so a longer string
     * means the deriver was bypassed — a bug worth failing on, not a value to
     * silently repair a second time.
     */
    userAgent: z.string().max(QR_SCAN_USER_AGENT_MAX_LENGTH).nullable().optional(),

    /** Derived. `null` when the user agent named no device positively. */
    deviceType: QrScanDeviceTypeEnumSchema.nullable().optional(),

    /** Derived. `null` when there was no user agent to read at all. */
    os: QrScanOsEnumSchema.nullable().optional(),

    /**
     * Derived from `Accept-Language`, restricted to the locales this platform
     * actually serves. `LanguageEnumSchema` is the platform-wide source of
     * truth for that set and is reused here rather than re-listed.
     */
    browserLanguage: LanguageEnumSchema.nullable().optional(),

    /** Where the code pointed at the instant of this scan. */
    targetUrlAtScan: z
        .string()
        .max(QR_CODE_TARGET_URL_MAX_LENGTH, { message: 'zodError.qrCode.targetUrl.max' })
        .nullable()
        .optional(),

    /** The signed-in scanner, when there was one. `null` for an anonymous scan. */
    userId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }).nullable().optional()
});

export type QrCodeScan = z.infer<typeof QrCodeScanSchema>;
