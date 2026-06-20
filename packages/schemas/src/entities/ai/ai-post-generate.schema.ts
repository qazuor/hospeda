import { z } from 'zod';
import { PostCategoryEnumSchema } from '../../enums/index.js';
import { LanguageEnumSchema } from '../user/user.settings.schema.js';

/**
 * AI post-generation request/draft schemas (SPEC-223).
 *
 * Models the input/output contract for the admin AI post-generation feature
 * exposed by `POST /api/v1/admin/ai/post-generate`. An admin or editor
 * supplies a topic and key points (plus optional tone, category, and locale)
 * and receives a generated post draft (title, summary, and HTML content).
 *
 * **Locale reuse**: `LanguageEnumSchema` from
 * `src/entities/user/user.settings.schema.ts` is the platform-wide locale
 * discriminator (`'es' | 'en' | 'pt'`). Reused here as the single source of
 * truth, never re-declared.
 *
 * **Category reuse**: `PostCategoryEnumSchema` from `src/enums/` is the
 * canonical post-category discriminator. Reused here rather than re-declared.
 *
 * **Bounds alignment**: `title` max 150, `summary` max 300, `content` min 100
 * / max 50000 — all match the constraints enforced in `PostSchema`.
 */

// ---------------------------------------------------------------------------
// Tone enum
// ---------------------------------------------------------------------------

/**
 * Output tone for AI-generated post content.
 *
 * Controls the register and style of the generated draft:
 * - `formal`   — professional, authoritative tone suitable for press releases.
 * - `informal` — conversational, approachable tone for blog-style content.
 * - `neutral`  — balanced, informational tone (default).
 */
export const AiPostGenerateToneSchema = z.enum(['formal', 'informal', 'neutral']);

/** Inferred type for {@link AiPostGenerateToneSchema}. */
export type AiPostGenerateTone = z.infer<typeof AiPostGenerateToneSchema>;

// ---------------------------------------------------------------------------
// Request body
// ---------------------------------------------------------------------------

/**
 * Request body for `POST /api/v1/admin/ai/post-generate`.
 *
 * Validation notes:
 *
 * - `topic` must be 3..300 characters — long enough to be meaningful, capped
 *   to avoid excessive token cost.
 * - `points` must contain 1..10 items, each 1..200 characters. The lower
 *   bound of 1 item ensures the model has at least one key point to work from.
 * - `category`, `tone`, and `locale` are optional. The route handler applies
 *   defaults (`'neutral'` and `'es'`) at the prompt-builder level.
 *
 * @example
 * ```ts
 * const result = AiPostGenerateRequestSchema.safeParse({
 *   topic: 'Carnaval de Concepción del Uruguay 2024',
 *   points: ['Fechas: 3–11 de febrero', 'Comparsas internacionales', 'Récord de asistencia'],
 *   tone: 'informal',
 *   locale: 'es'
 * });
 * result.success; // true
 * ```
 */
export const AiPostGenerateRequestSchema = z.object({
    /**
     * Editorial topic for the post. 3..300 characters.
     * Drives the main subject of the AI-generated content.
     */
    topic: z.string().min(3).max(300),
    /**
     * Key points to cover in the post. 1..10 items, each 1..200 characters.
     * The model uses these as the factual backbone of the generated draft.
     */
    points: z.array(z.string().min(1).max(200)).min(1).max(10),
    /**
     * Optional post category. When provided it is included in the prompt
     * so the model can tailor the content style and framing to the category.
     */
    category: PostCategoryEnumSchema.optional(),
    /**
     * Output tone for the generated draft.
     * When absent the route handler defaults to `'neutral'`.
     */
    tone: AiPostGenerateToneSchema.optional(),
    /**
     * Target output locale for the generated text.
     * When absent the route handler defaults to `'es'` (Argentine market).
     */
    locale: LanguageEnumSchema.optional()
});

/** Inferred type for {@link AiPostGenerateRequestSchema}. */
export type AiPostGenerateRequest = z.infer<typeof AiPostGenerateRequestSchema>;

// ---------------------------------------------------------------------------
// Draft response
// ---------------------------------------------------------------------------

/**
 * Shape of the AI-generated post draft returned by the endpoint.
 *
 * All three fields are required in the response. The bounds mirror the
 * constraints in `PostSchema` to prevent a draft from being incompatible
 * with the post editor's own validation.
 *
 * - `title`:   3..150 characters (matches `PostSchema.title`).
 * - `summary`: 10..300 characters (matches `PostSchema.summary`).
 * - `content`: 100..50000 characters — must be valid HTML (enforced by the
 *              system prompt; sanitisation happens at the route layer).
 *
 * @example
 * ```ts
 * const result = AiPostGenerateDraftSchema.safeParse({
 *   title: 'Carnaval 2024: récord de asistencia en Concepción del Uruguay',
 *   summary: 'El carnaval de este año superó todas las expectativas...',
 *   content: '<p>El carnaval de Concepción del Uruguay...</p>'
 * });
 * result.success; // true
 * ```
 */
export const AiPostGenerateDraftSchema = z.object({
    /**
     * Generated post title. 3..150 characters.
     */
    title: z.string().min(3).max(150),
    /**
     * Generated post summary / teaser. 10..300 characters.
     */
    summary: z.string().min(10).max(300),
    /**
     * Generated post body as valid HTML. 100..50000 characters.
     * The route layer sanitises the HTML before returning it to the client.
     */
    content: z.string().min(100).max(50000)
});

/** Inferred type for {@link AiPostGenerateDraftSchema}. */
export type AiPostGenerateDraft = z.infer<typeof AiPostGenerateDraftSchema>;
