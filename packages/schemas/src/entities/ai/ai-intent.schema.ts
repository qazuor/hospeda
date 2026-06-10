import { z } from 'zod';
import { LanguageEnumSchema } from '../user/user.settings.schema.js';

/**
 * AI intent envelope schema (SPEC-173).
 *
 * Models the GENERIC output of the `extractIntent` capability (§5.11).
 * `extractIntent` is a foundation capability consumed by:
 *   - Child spec B (NL search): refines `entities` into search-specific slots.
 *   - Child spec C (chat): refines `entities` into conversation-turn slots.
 *
 * **Design rationale — generic base, not search-specific**:
 * The concrete domain shape (search filters, facets, entity types) belongs to
 * the child specs, NOT here. The intent envelope is intentionally generic so
 * that multiple child specs can extend it without the base layer depending on
 * any one domain.
 *
 * Child specs are expected to:
 * 1. Extend `AiIntentSchema` with a discriminated `kind` literal.
 * 2. Replace `entities: Record<string, unknown>` with a strongly-typed object
 *    specific to their domain.
 *
 * Example child extension (child spec B):
 * ```ts
 * const SearchIntentSchema = AiIntentSchema.extend({
 *     kind: z.literal('search'),
 *     entities: z.object({
 *         location: z.string().optional(),
 *         guests: z.number().int().min(1).optional(),
 *         amenities: z.array(z.string()).optional(),
 *     }),
 * });
 * ```
 *
 * **Locale reuse**: `LanguageEnumSchema` from `@repo/schemas` (SSoT:
 * `src/entities/user/user.settings.schema.ts`) is the platform-wide locale
 * discriminator (`'es' | 'en' | 'pt'`).
 *
 * **Strictness**: `AiIntentSchema` is NOT `.strict()` at the base level to
 * allow child specs to extend with additional fields via `.extend()`. If a
 * child spec wants to lock its shape it should apply `.strict()` there.
 * `ExtractIntentRequestSchema` IS `.strict()` — it is a boundary schema.
 *
 * **Decision (owner-approved 2026-06-04)**: keep the base intent fully generic
 * (`kind: string`, `entities: Record<string, unknown>`). Child specs B (NL
 * search) and C (chat) narrow `kind` to a `z.literal(...)` and replace
 * `entities` with a typed `z.object({...})` via `.extend()`. Promoting a
 * concrete `SearchIntent` here would couple the foundation layer to a single
 * domain and block reuse by spec C and future child specs. The open base stays.
 */

// ---------------------------------------------------------------------------
// Core intent envelope
// ---------------------------------------------------------------------------

/**
 * Generic intent envelope returned by the `extractIntent` engine capability.
 *
 * `extractIntent` is a FOUNDATION capability: it takes a natural-language query
 * and extracts a structured intent representation. The shape is generic so that
 * multiple child specs (NL search, chat, support routing) can reuse and refine
 * it without coupling the base layer to any one domain.
 *
 * Fields:
 * - `kind`       — Intent type discriminator. A free-form string in the base;
 *                  child specs use a `z.literal(...)` to discriminate.
 * - `confidence` — Model's confidence in the extraction, in [0, 1].
 *                  1.0 = fully certain; 0.0 = no confidence. Callers should
 *                  treat low-confidence intents as uncertain and may fall back
 *                  to keyword search or ask for clarification.
 * - `entities`   — Extracted slot values, keyed by slot name. The base type is
 *                  `Record<string, unknown>`; child specs replace this with a
 *                  typed object via `.extend({ entities: z.object({...}) })`.
 * - `rawQuery`   — The original user query before any transformation.
 *                  Kept for logging, debugging, and analytics. Also useful for
 *                  fallback to keyword search when confidence is low.
 */
export const AiIntentSchema = z.object({
    /**
     * Intent type discriminator.
     *
     * Free-form string in the base schema. Child specs narrow this to a
     * `z.literal(...)` (e.g. `'search'`, `'chat_query'`, `'support_request'`).
     *
     * **Decision (owner-approved 2026-06-04)**: `kind` stays an open `string`
     * in the foundation schema. Child specs B and C narrow it to
     * `z.literal('search')` / `z.literal('chat_query')` etc. via `.extend()`,
     * giving exhaustive switch-case guarantees exactly where they are needed
     * without coupling the base layer to any one domain. The open string also
     * allows future child specs to introduce new kinds without a base-layer
     * schema change.
     */
    kind: z.string().min(1),
    /**
     * Extraction confidence score in the range [0, 1].
     *
     * Produced by the model or by a post-processing heuristic. The engine or
     * child spec SHOULD document its confidence-threshold policy (e.g.
     * "below 0.5 → fall back to keyword search"). No threshold is enforced here
     * — that is a business-logic concern, not a schema concern.
     */
    confidence: z.number().min(0).max(1),
    /**
     * Extracted slot values for this intent.
     *
     * In the base schema this is an open `Record<string, unknown>` to support
     * any child domain. Child specs replace this with a typed `z.object({...})`
     * that names and types each slot they care about.
     *
     * Empty object `{}` is valid when the model could not extract any entities
     * (confidence will typically be low in that case).
     */
    entities: z.record(z.string(), z.unknown()),
    /**
     * The raw user query string, unchanged from input.
     *
     * Preserved for:
     * - Fallback to full-text / keyword search when confidence is low.
     * - Debug logging and analytics (understanding what users actually type).
     * - Prompt re-construction if the engine needs to retry extraction.
     */
    rawQuery: z.string().min(1)
});

/** TypeScript type for the generic AI intent envelope. */
export type AiIntent = z.infer<typeof AiIntentSchema>;

// ---------------------------------------------------------------------------
// extractIntent request / response
// ---------------------------------------------------------------------------

/**
 * Request schema for the `extractIntent` capability.
 *
 * Takes a natural-language query and an optional locale hint. The `feature`
 * field is omitted intentionally — `extractIntent` is an internal engine
 * primitive, not a user-facing feature gated by `AiFeatureSchema`. The engine
 * calls it on behalf of the `search` or `chat` features.
 *
 * `locale` is optional: some models produce better slot extraction when they
 * know the user's language. Absence = the model uses its own language detection.
 */
export const ExtractIntentRequestSchema = z
    .object({
        /**
         * The natural-language query to extract intent from.
         * Typically the raw user input (search box, chat message).
         */
        query: z.string().min(1),
        /**
         * Optional locale hint for the query language.
         * Helps the model produce locale-aware slot extraction.
         */
        locale: LanguageEnumSchema.optional()
    })
    .strict();

/** TypeScript type for an `extractIntent` request. */
export type ExtractIntentRequest = z.infer<typeof ExtractIntentRequestSchema>;

/**
 * Response schema for the `extractIntent` capability.
 *
 * Returns the extracted intent envelope. Callers that need domain-specific
 * slots should validate the `entities` field against their own child schema
 * after receiving the response.
 */
export const ExtractIntentResponseSchema = AiIntentSchema;

/** TypeScript type for an `extractIntent` response. */
export type ExtractIntentResponse = z.infer<typeof ExtractIntentResponseSchema>;
