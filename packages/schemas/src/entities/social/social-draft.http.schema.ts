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
 * GPT image payload — discriminated on `mode`.
 *
 * - `public_url`: direct HTTPS URL.
 * - `openai_file_refs`: one or more OpenAI file reference objects injected by
 *    OpenAI at runtime. Only the first entry is processed in phase 1 per spec
 *    resolved decision. The field is named `openaiFileIdRefs` to match the
 *    exact property name that triggers OpenAI's automatic file reference
 *    injection in Custom GPT Actions.
 */
export const GptImagePayloadSchema = z.discriminatedUnion('mode', [
    z.object({
        mode: z.literal('public_url'),
        url: z.string().url({ message: 'zodError.socialDraft.image.url.invalid' }),
        altText: z.string().optional(),
        mimeType: z.string().optional()
    }),
    z.object({
        mode: z.literal('openai_file_refs'),
        openaiFileIdRefs: z.array(OpenAiFileIdRefSchema).min(1, {
            message: 'zodError.socialDraft.image.openaiFileIdRefs.required'
        }),
        altText: z.string().optional(),
        mimeType: z.string().optional()
    })
]);

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
 * Full request body schema for `POST /api/v1/ai/social/drafts`.
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
 *
 * @see SPEC-254 US-2 for full acceptance criteria.
 */
export const CreateSocialDraftSchema = z.object({
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

    /** Free-form notes from the operator (scheduling hints, context, etc.). */
    notes: z.string().optional()
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
