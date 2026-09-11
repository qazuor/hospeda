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
 * **Field scope (SPEC-198.2)**: `description`, `summary`, and `faq_answer`
 * accommodation fields. Future candidates (`title`, `seo_title`,
 * `seo_description`) can be added following the append-only enum policy in
 * `docs/guides/schema-compat-policy.md`.
 *
 * **Locale reuse**: `LanguageEnumSchema` from
 * `src/entities/user/user.settings.schema.ts` is the platform-wide locale
 * discriminator (`'es' | 'en' | 'pt'`). Reused here as the single source
 * of truth, never re-declared.
 *
 * **Strictness**: the request body uses `.strict()` so unknown keys are
 * rejected at the route boundary. The per-field length cap (300 for
 * `summary`, 5000 for `description`, 1000 for `faq_answer`) is enforced
 * via `superRefine` AFTER `fieldType` is known — the schema-level `.max(5000)`
 * is the gross input cap, the refine is the precision gate.
 */

// ---------------------------------------------------------------------------
// Field-type enum
// ---------------------------------------------------------------------------

/**
 * Discriminator for which accommodation field the AI should improve.
 *
 * **APPEND-ONLY**: once a value ships to production, members may only be
 * added (never removed, never renamed). V2 can add `title`, `seo_title`,
 * `seo_description` without a migration.
 */
export const AiTextImproveFieldTypeSchema = z.enum(['description', 'summary', 'faq_answer']);

/** Inferred type for {@link AiTextImproveFieldTypeSchema}. */
export type AiTextImproveFieldType = z.infer<typeof AiTextImproveFieldTypeSchema>;

// ---------------------------------------------------------------------------
// Entity-type discriminator (HOS-1075)
// ---------------------------------------------------------------------------

/**
 * Which vertical the improved text belongs to (HOS-1075).
 *
 * Before this field existed the route had no way to know whether
 * `fieldValue` came from an accommodation, a gastronomy listing, or an
 * experience listing, so it could only gate on the actor's ACCOMMODATION
 * entitlement — a host who also owns a comercio could improve their
 * comercio's text for free off their accommodation plan, and a comercio-only
 * owner was blocked even though `AI_TEXT_IMPROVE` is meant to be gated per
 * vertical, not per actor.
 *
 * **Optional, defaulting to `'accommodation'`** — every caller in production
 * today (the web host editor and the admin accommodation/FAQ panels) sends
 * neither this field nor `entityId`, and their behaviour must not change.
 * A future comercio "mejorar con IA" panel sends `'gastronomy'` /
 * `'experience'` explicitly once that surface exists.
 *
 * **APPEND-ONLY**: once a value ships to production, members may only be
 * added, mirroring {@link AiTextImproveFieldTypeSchema}.
 */
export const AiTextImproveEntityTypeSchema = z.enum(['accommodation', 'gastronomy', 'experience']);

/** Inferred type for {@link AiTextImproveEntityTypeSchema}. */
export type AiTextImproveEntityType = z.infer<typeof AiTextImproveEntityTypeSchema>;

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
 * - `faq_answer`: 1000 chars — FAQ answers are plain text.
 */
export const AI_TEXT_IMPROVE_MAX_LENGTH: Readonly<Record<AiTextImproveFieldType, number>> =
    Object.freeze({
        description: 5000,
        summary: 300,
        faq_answer: 1000
    });

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
 *   (300 for `summary`, 5000 for `description`, 1000 for `faq_answer`).
 * - `locale` is optional. When absent the route handler defaults to
 *   `'es'` (the Argentine market default). Making it optional in the
 *   schema keeps callers that do not track locale functional.
 * - `entityType` / `entityId` (HOS-1075) identify which entity the text
 *   belongs to, so the route can gate on that vertical's entitlement
 *   instead of always the actor's accommodation one. Both optional and
 *   independent — `entityType` defaults to `'accommodation'` server-side
 *   when absent (see {@link AiTextImproveEntityTypeSchema}); `entityId` is
 *   accepted for observability/future ownership checks but not required.
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
        locale: LanguageEnumSchema.optional(),
        /**
         * Which vertical the text belongs to (HOS-1075). Absent means
         * `'accommodation'` — see {@link AiTextImproveEntityTypeSchema}.
         */
        entityType: AiTextImproveEntityTypeSchema.optional(),
        /**
         * The id of the entity `fieldValue` belongs to (HOS-1075). Optional:
         * this route does not persist anything and performs no ownership
         * check today, so the id is not required for the entitlement gate
         * to work — only `entityType` is. Accepted for observability and to
         * keep the shape consistent with the sibling `/ai/translate` route.
         */
        entityId: z
            .string()
            .uuid({ message: 'zodError.ai.textImprove.entityId.invalidUuid' })
            .optional()
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
