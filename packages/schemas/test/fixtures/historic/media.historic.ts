/**
 * Historic media shape fixtures for the additive-only schema compatibility
 * policy. See `packages/schemas/docs/guides/schema-compat-policy.md`.
 *
 * These fixtures MUST continue to parse against the current `ImageSchema`,
 * `VideoSchema`, and `MediaSchema` exports in `@repo/schemas/common/media.schema`.
 * If a change breaks one of these fixtures, the change is breaking and must
 * follow the three-phase migration path before landing.
 *
 * Deterministic and static on purpose: do not introduce faker or randomness
 * here. Diffs in this file are intentional history.
 */

/**
 * Pre-SPEC-078 image shape. Captured from `posts.media.featuredImage` JSONB
 * payloads written by the API before SPEC-078 added the optional `publicId`
 * and `attribution` extensions (GAP-078-196, GAP-078-116).
 *
 * Only `url` and `moderationState` were required. `caption` and `description`
 * were optional free-text fields with loose minimums.
 */
export const imagePreSpec078 = {
    url: 'https://res.cloudinary.com/hospeda/image/upload/v1/legacy/hero.jpg',
    moderationState: 'APPROVED'
} as const;

/**
 * Pre-SPEC-078 image with a caption populated. Verifies that optional-string
 * fields present in historic payloads still pass when the schema is
 * untouched.
 */
export const imagePreSpec078WithCaption = {
    url: 'https://res.cloudinary.com/hospeda/image/upload/v1/legacy/pool.jpg',
    caption: 'Main pool',
    description: 'Heated pool open all year round',
    moderationState: 'APPROVED'
} as const;

/**
 * Pre-SPEC-078 video shape. Same contract as the image (url + moderationState
 * required, caption/description optional). Captured before video metadata
 * extensions were proposed.
 */
export const videoPreSpec078 = {
    url: 'https://res.cloudinary.com/hospeda/video/upload/v1/legacy/tour.mp4',
    moderationState: 'PENDING'
} as const;

/**
 * Pre-SPEC-078 media container where `featuredImage` was required and no
 * `gallery` / `videos` arrays were present. Verifies that:
 *
 * - The legacy "required featuredImage" contract still parses.
 * - Optional extensions added later (gallery, videos) do not reject payloads
 *   that simply omit them.
 *
 * Once GAP-078-185 lands (featuredImage becomes optional), this fixture
 * still parses because a required shape is also a valid "present-and-valid"
 * optional shape.
 */
export const mediaPreSpec078 = {
    featuredImage: imagePreSpec078
} as const;

/**
 * Pre-SPEC-078 media container with all three buckets populated. Historic
 * writers were allowed to include gallery and videos arrays; current readers
 * must keep accepting them.
 */
export const mediaPreSpec078Full = {
    featuredImage: imagePreSpec078WithCaption,
    gallery: [imagePreSpec078],
    videos: [videoPreSpec078]
} as const;
