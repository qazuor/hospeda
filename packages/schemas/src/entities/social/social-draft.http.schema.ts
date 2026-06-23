/**
 * @file social-draft.http.schema.ts
 *
 * Zod schema for the POST /api/v1/ai/social/drafts request body and response.
 *
 * Consumed by:
 *  - The route handler (T-029) for runtime validation.
 *  - The SocialDraftIngestionService (T-028) for type inference.
 *  - The OpenAPI spec export endpoint (T-030).
 *
 * @module schemas/entities/social/social-draft.http
 * @see SPEC-254 T-028, T-029
 */

import { z } from 'zod';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';
import { SocialPublishFormatEnumSchema } from '../../enums/social-publish-format.schema.js';

// ---------------------------------------------------------------------------
// Image payload schema (mirrors GptImagePayload from SocialImagePipelineService)
// ---------------------------------------------------------------------------

/**
 * An OpenAI file reference object injected at runtime by OpenAI into GPT Actions.
 *
 * OpenAI declares this field in the OpenAPI schema as `items: { type: 'string' }`
 * per their convention, but at RUNTIME injects an array of objects shaped like
 * this. The `download_link` is an HTTPS URL pointing to `files.oaiusercontent.com`
 * that can be used to download the image.
 *
 * @see https://platform.openai.com/docs/actions/sending-files
 */
export const OpenAiFileIdRefSchema = z
    .object({
        download_link: z
            .string()
            .url({ message: 'zodError.socialDraft.image.openaiFileIdRefs.invalidUrl' }),
        id: z.string().optional(),
        name: z.string().optional(),
        mime_type: z.string().optional()
    })
    .passthrough();

/**
 * @deprecated Use {@link OpenAiFileIdRefSchema} instead.
 * Kept as an alias so external code that imported the old name does not break
 * until it can be updated.
 */
export const OpenAiFileRefSchema = OpenAiFileIdRefSchema;

/**
 * GPT image payload — flat object validated with `superRefine`.
 *
 * Declared as a SINGLE flat object (NOT a discriminated union / oneOf) so that
 * the generated JSON Schema stays flat. `openaiFileIdRefs` has been moved to
 * the TOP LEVEL of the enclosing `CreateSocialDraftSchema` object (a sibling of
 * `image`, `operatorPin`, `targets`, etc.) because OpenAI Custom GPT Actions
 * only auto-populate a field named `openaiFileIdRefs` when it is a DIRECT
 * property of the request-body root object — any nesting (inside a sub-object
 * or a union branch) silently prevents injection.
 *
 * Modes:
 * - `public_url`: the GPT provides a direct HTTPS URL via the `url` field.
 * - `openai_file_refs`: OpenAI injects one or more file reference objects into
 *   the root `openaiFileIdRefs` field at runtime. Only the first entry is
 *   processed (phase 1). The field name `openaiFileIdRefs` is required EXACTLY
 *   as-is to trigger OpenAI's automatic file reference injection.
 *
 * @see https://platform.openai.com/docs/actions/sending-files
 */
export const GptImagePayloadBaseSchema = z.object({
    mode: z.enum(['public_url', 'openai_file_refs']),
    /**
     * Used when `mode === 'public_url'`.
     * Direct HTTPS URL of the image to download and re-upload to Cloudinary.
     */
    url: z.string().url({ message: 'zodError.socialDraft.image.url.invalid' }).optional(),
    /** Optional alt text for accessibility. */
    altText: z.string().optional(),
    /** Optional MIME type hint (e.g., "image/jpeg"). Used for media type inference. */
    mimeType: z.string().optional()
});

/**
 * GPT image payload schema with cross-field validation.
 *
 * Uses `superRefine` so the shape stays a flat `ZodObject` at the JSON Schema
 * level. `openaiFileIdRefs` is NOT part of this schema — it lives at the root
 * of `CreateSocialDraftSchema`. The cross-field check between `image.mode` and
 * root `openaiFileIdRefs` is performed there.
 */
export const GptImagePayloadSchema = GptImagePayloadBaseSchema.superRefine((val, ctx) => {
    if (val.mode === 'public_url' && !val.url) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['url'],
            message: 'zodError.socialDraft.image.url.invalid'
        });
    }
});

// ---------------------------------------------------------------------------
// Per-target schema
// ---------------------------------------------------------------------------

/**
 * A single publish target (platform × format pair) requested by the GPT.
 */
export const SocialDraftTargetSchema = z.object({
    platform: SocialPlatformEnumSchema,
    publishFormat: SocialPublishFormatEnumSchema
});

// ---------------------------------------------------------------------------
// Warning shape (shared between service and route response)
// ---------------------------------------------------------------------------

/**
 * A single warning entry in the draft ingestion response.
 */
export const SocialDraftWarningSchema = z.object({
    field: z.string(),
    message: z.string()
});

/** TypeScript type for a single ingestion warning. */
export type SocialDraftWarning = z.infer<typeof SocialDraftWarningSchema>;

// ---------------------------------------------------------------------------
// POST /api/v1/ai/social/drafts request body
// ---------------------------------------------------------------------------

/**
 * Base object shape for `POST /api/v1/ai/social/drafts` before cross-field
 * refinement. Exported so `gpt-action-schema.ts` can call `.extend()` on it
 * to produce the doc-only variant without re-running the superRefine logic.
 *
 * @see {@link CreateSocialDraftSchema} for the refined version with cross-field
 *   validation.
 */
export const CreateSocialDraftBaseSchema = z.object({
    /** Operator PIN — validated in the route against HOSPEDA_OPERATOR_PIN_HASH. */
    operatorPin: z.string().min(1, { message: 'zodError.socialDraft.operatorPin.required' }),

    /**
     * Opaque idempotency key assigned by the GPT.
     * UNIQUE per post — duplicate submissions return 409.
     */
    draftId: z.string().min(1, { message: 'zodError.socialDraft.draftId.required' }),

    /** Post title / subject line. */
    title: z.string().min(1, { message: 'zodError.socialDraft.title.required' }),

    /**
     * Content pillar (e.g. "travel", "gastronomy", "institutional").
     * Stored verbatim; no enum constraint — new pillars may be introduced without
     * a schema migration.
     */
    pillar: z.string().optional(),

    /** Slug of the campaign to associate this post with. Resolved to ID by the service. */
    campaignSlug: z.string().optional(),

    /** Slug of the content batch to associate this post with. Resolved to ID by the service. */
    batchSlug: z.string().optional(),

    /**
     * Slug of the audience to target. Resolved to ID by the service.
     * Falls back to null when the slug is not found.
     */
    audienceSlug: z.string().optional(),

    /** Original caption text from the GPT. Required. */
    captionBase: z.string().min(1, { message: 'zodError.socialDraft.captionBase.required' }),

    /** Slug of the base hashtag set for this post. Resolved to ID by the service. */
    baseHashtagSetSlug: z.string().optional(),

    /**
     * Hashtags from the catalog the GPT wants attached to this post.
     * Each string must start with '#'. The service looks up each one in
     * `social_hashtags.normalized_hashtag`. Unknown entries are dropped + warned.
     */
    curatedHashtags: z.array(z.string()).optional(),

    /**
     * Novel hashtags invented by the GPT (not in the catalog).
     * Stored verbatim in `social_posts.gpt_hashtag_payload_json`.
     * NEVER linked via `social_post_hashtags`.
     */
    customHashtagSuggestions: z.array(z.string()).optional(),

    /** Slug of the footer template to use. Resolved to ID by the service. */
    footerSlug: z.string().optional(),

    /**
     * Optional image payload. When present the image pipeline downloads
     * and re-uploads to Cloudinary. Failure is non-fatal (draft still created).
     *
     * NOTE: `openaiFileIdRefs` is intentionally NOT part of this sub-object.
     * It lives as a TOP-LEVEL sibling of `image` in `CreateSocialDraftSchema`
     * so that OpenAI Custom GPT Actions can auto-populate it. Nesting it inside
     * `image` silently prevents the injection.
     */
    image: GptImagePayloadSchema.optional(),

    /**
     * One or more platform × format targets.
     * At least one entry must match an ENABLED `social_platform_formats` row or
     * the service returns a zero-valid-targets rejection (→ 422).
     */
    targets: z
        .array(SocialDraftTargetSchema)
        .min(1, { message: 'zodError.socialDraft.targets.required' }),

    /**
     * OpenAI file reference objects injected at runtime by OpenAI Custom GPT
     * Actions. Declared at the REQUEST-BODY ROOT (NOT inside `image`) because
     * OpenAI only auto-populates `openaiFileIdRefs` when it is a DIRECT
     * top-level property of the enclosing JSON object.
     *
     * The field name `openaiFileIdRefs` is required EXACTLY as-is — it is the
     * sentinel name OpenAI uses to recognise the file-injection slot.
     *
     * At runtime OpenAI injects an array of objects shaped like
     * `{ download_link, id, name, mime_type }` even though the OpenAPI schema
     * declares items as `{ type: 'string' }` per their convention.
     *
     * Used when `image.mode === 'openai_file_refs'`. The service reads
     * `openaiFileIdRefs[0].download_link` as the image download URL.
     *
     * @see https://platform.openai.com/docs/actions/sending-files
     */
    openaiFileIdRefs: z.array(OpenAiFileIdRefSchema).optional(),

    /** Free-form notes from the operator (scheduling hints, context, etc.). */
    notes: z.string().optional()
});

/**
 * Full request body schema for `POST /api/v1/ai/social/drafts`.
 *
 * Extends `CreateSocialDraftBaseSchema` with a cross-field `superRefine` that
 * enforces: when `image.mode === 'openai_file_refs'`, the root
 * `openaiFileIdRefs` array must be non-empty.
 *
 * The `operatorPin` is validated in the route handler BEFORE calling the
 * service. All other fields are threaded through to the ingestion service.
 *
 * Validation rules:
 * - `draftId` and `captionBase` are required.
 * - Slug references (`campaignSlug`, `batchSlug`, etc.) are optional strings;
 *   the service resolves them to IDs and falls back to null on miss.
 * - `targets` must contain at least one entry (the service may still reject
 *   all of them if none match an enabled platform-format row, yielding 422).
 * - `curatedHashtags` are strings that must look like hashtags (start with #).
 * - `customHashtagSuggestions` are stored verbatim; no catalog lookup.
 * - `operatorPin` is required and validated against `HOSPEDA_OPERATOR_PIN_HASH`
 *   in the route before the service is called.
 * - When `image.mode === 'openai_file_refs'`, root `openaiFileIdRefs` must be
 *   non-empty.
 *
 * @see SPEC-254 US-2 for full acceptance criteria.
 */
export const CreateSocialDraftSchema = CreateSocialDraftBaseSchema.superRefine((val, ctx) => {
    if (val.image?.mode === 'openai_file_refs' && (val.openaiFileIdRefs?.length ?? 0) === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['openaiFileIdRefs'],
            message: 'zodError.socialDraft.image.openaiFileIdRefs.required'
        });
    }
});

/** TypeScript type inferred from {@link CreateSocialDraftSchema}. */
export type CreateSocialDraft = z.infer<typeof CreateSocialDraftSchema>;

// ---------------------------------------------------------------------------
// POST response data schema
// ---------------------------------------------------------------------------

/**
 * Data payload returned on a successful `POST /api/v1/ai/social/drafts` call.
 * Wrapped in the standard `{ success: true, data: <this> }` envelope by the route.
 */
export const CreateSocialDraftResponseSchema = z.object({
    /** UUID of the newly created `social_posts` row. */
    postId: z.string().uuid(),
    /** Echo of the caller-supplied `draftId` for client-side correlation. */
    draftId: z.string(),
    /** Always `"NEEDS_REVIEW"` — overridden by the service regardless of payload. */
    status: z.literal('NEEDS_REVIEW'),
    /** Always `"PENDING"` — overridden by the service regardless of payload. */
    approvalStatus: z.literal('PENDING'),
    /** Number of `social_post_targets` rows successfully created. */
    targetsCreated: z.number().int().min(0),
    /**
     * Image pipeline outcome:
     * - `"uploaded"`: Cloudinary URL stored in `social_assets`.
     * - `"pending"`: download/upload failed; `cloudinary_url` is null.
     * - `"none"`: no image in the payload.
     */
    assetStatus: z.enum(['uploaded', 'pending', 'none']),
    /** Non-fatal warnings (unknown hashtags, dropped targets, overridden fields). */
    warnings: z.array(SocialDraftWarningSchema)
});

/** TypeScript type inferred from {@link CreateSocialDraftResponseSchema}. */
export type CreateSocialDraftResponse = z.infer<typeof CreateSocialDraftResponseSchema>;
