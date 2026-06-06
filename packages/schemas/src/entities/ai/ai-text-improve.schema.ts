import { z } from 'zod';
import { LanguageEnumSchema } from '../user/user.settings.schema.js';

/**
 * AI text-improvement request schemas (SPEC-198).
 *
 * Models the input contract for the HOST accommodation text-improvement
 * feature exposed by `POST /api/v1/protected/ai/text-improve`. The route
 * streams an SSE response; this file only describes the JSON body the
 * client sends.
 *
 * **Field scope (V1, owner-decided 2026-06-05)**: ONLY `description` and
 * `summary` accommodation fields. V2 candidates (`title`, `faq_answer`,
 * `seo_title`, `seo_description`) are intentionally NOT in this enum —
 * additions must follow the append-only enum policy in
 * `docs/guides/schema-compat-policy.md`.
 *
 * **Locale reuse**: `LanguageEnumSchema` from
 * `src/entities/user/user.settings.schema.ts` is the platform-wide locale
 * discriminator (`'es' | 'en' | 'pt'`). Reused here as the single source
 * of truth, never re-declared.
 *
 * **Strictness**: the request body uses `.strict()` so unknown keys are
 * rejected at the route boundary. The per-field length cap (300 for
 * `summary`, 5000 for `description`) is enforced via `superRefine` AFTER
 * `fieldType` is known — the schema-level `.max(5000)` is the gross
 * input cap, the refine is the precision gate.
 */

// ---------------------------------------------------------------------------
// Field-type enum
// ---------------------------------------------------------------------------

/**
 * Discriminator for which accommodation field the AI should improve.
 *
 * **APPEND-ONLY**: once a value ships to production, members may only be
 * added (never removed, never renamed). V2 can add `title`, `faq_answer`,
 * `seo_title`, `seo_description` without a migration.
 */
export const AiTextImproveFieldTypeSchema = z.enum(['description', 'summary']);

/** Inferred type for {@link AiTextImproveFieldTypeSchema}. */
export type AiTextImproveFieldType = z.infer<typeof AiTextImproveFieldTypeSchema>;

// ---------------------------------------------------------------------------
// Per-field length caps
// ---------------------------------------------------------------------------

/**
 * Maximum allowed character length for `fieldValue` per field type.
 *
 * Caps limit token cost per call and prevent accept-time overflow
 * (e.g. the live `summary` form has `maxLength: 300`). Owner-approved
 * 2026-06-05.
 *
 * - `description`: 5000 chars — matches the rich-text editor budget.
 * - `summary`: 300 chars — matches the live form `maxLength: 300`.
 */
export const AI_TEXT_IMPROVE_MAX_LENGTH: Readonly<Record<AiTextImproveFieldType, number>> = {
    description: 5000,
    summary: 300
} as const;

// ---------------------------------------------------------------------------
// Request body
// ---------------------------------------------------------------------------

/**
 * Request body for `POST /api/v1/protected/ai/text-improve`.
 *
 * Validation notes:
 *
 * - `fieldValue` is gated by `.min(1).max(5000)` at the schema level. The
 *   schema cap of 5000 is the gross input cap (prevents absurdly long
 *   bodies); the `superRefine` below applies the tighter per-field cap
 *   (300 for `summary`, 5000 for `description`).
 * - `locale` is optional. When absent the route handler defaults to
 *   `'es'` (the Argentine market default). Making it optional in the
 *   schema keeps callers that do not track locale functional.
 * - `.strict()` rejects unknown keys so the route boundary fails fast on
 *   typos and stray client fields.
 */
export const AiTextImproveRequestSchema = z
    .object({
        /**
         * Current text content of the field to improve.
         * Empty strings are rejected (nothing to improve).
         */
        fieldValue: z.string().min(1).max(5000),
        /**
         * Which accommodation field the text belongs to.
         * Drives prompt construction and per-field length limits.
         */
        fieldType: AiTextImproveFieldTypeSchema,
        /**
         * Target locale for the AI suggestion. When absent the route
         * defaults to `'es'`.
         */
        locale: LanguageEnumSchema.optional()
    })
    .strict()
    .superRefine((val, ctx) => {
        const maxLen = AI_TEXT_IMPROVE_MAX_LENGTH[val.fieldType];
        if (val.fieldValue.length > maxLen) {
            ctx.addIssue({
                code: z.ZodIssueCode.too_big,
                origin: 'string',
                maximum: maxLen,
                inclusive: true,
                message: `fieldValue must not exceed ${maxLen} characters for fieldType '${val.fieldType}'.`,
                path: ['fieldValue']
            });
        }
    });

/** Inferred type for the text-improve request body. */
export type AiTextImprove = z.infer<typeof AiTextImproveRequestSchema>;
