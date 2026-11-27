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
import { qrCodeCenterLogoFits } from './qr-code.center-logo.js';

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
         * This is DAMAGE, not decoration: the disc blanks whatever modules sit
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
