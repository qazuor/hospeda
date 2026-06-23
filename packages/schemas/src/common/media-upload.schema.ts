import { z } from 'zod';

// ---------------------------------------------------------------------------
// Gallery cap constants (SSOT for per-entity gallery limits)
// ---------------------------------------------------------------------------

/**
 * Per-entity gallery image caps.
 *
 * This is the **single source of truth** for how many gallery images are
 * allowed per content entity. Both the API route (server-side enforcement)
 * and the admin frontend (client-side UI gating) import from here so they
 * can never drift apart.
 *
 * Keys MUST match the `GalleryEntityTypeSchema` literals exactly
 * (`accommodation`, `destination`, `event`, `post`).
 *
 * TODO(billing): billing-tier addon entitlements will override these defaults
 * once the addon system is wired in.
 *
 * @example
 * ```ts
 * import { ENTITY_GALLERY_CAPS, getGalleryCap } from '@repo/schemas';
 *
 * // Direct lookup
 * const cap = ENTITY_GALLERY_CAPS.accommodation; // 50
 *
 * // Dynamic lookup (string entity type from request)
 * const cap = getGalleryCap(entityType); // safe fallback for unknown types
 * ```
 */
export const ENTITY_GALLERY_CAPS = {
    accommodation: 50,
    destination: 20,
    event: 10,
    post: 15,
    gastronomy: 30,
    experience: 30
} as const;

/**
 * Union of entity type strings that have an explicit gallery cap defined in
 * `ENTITY_GALLERY_CAPS`.
 */
export type EntityGalleryCapKey = keyof typeof ENTITY_GALLERY_CAPS;

/**
 * Fallback gallery cap used for entity types not listed in
 * `ENTITY_GALLERY_CAPS`. Acts as a conservative safety net so an unexpected
 * entity type never gets an unlimited gallery.
 *
 * Set to the same value as the accommodation cap (the largest known cap) to
 * avoid silently blocking legitimate uploads on unrecognized entity types.
 */
export const MAX_GALLERY_CAP_FALLBACK = 50;

/**
 * Returns the maximum number of gallery images allowed for the given entity
 * type.
 *
 * Falls back to `MAX_GALLERY_CAP_FALLBACK` for entity types not present in
 * `ENTITY_GALLERY_CAPS` so callers never have to special-case unknown types.
 *
 * @param entityType - The entity type string (e.g. `'accommodation'`).
 * @returns The gallery cap for that entity type.
 *
 * @example
 * ```ts
 * getGalleryCap('accommodation') // 50
 * getGalleryCap('event')         // 10
 * getGalleryCap('unknown')       // 50 (MAX_GALLERY_CAP_FALLBACK)
 * ```
 */
export function getGalleryCap(entityType: string): number {
    return ENTITY_GALLERY_CAPS[entityType as EntityGalleryCapKey] ?? MAX_GALLERY_CAP_FALLBACK;
}

/**
 * Entity types that support image upload via the admin media endpoint.
 *
 * Defines the set of content domains for which the upload API accepts files.
 * Used to build the storage path and to validate the target entity before upload.
 *
 * The base set reflects the four CRUD-managed content entities. The extended
 * variants (`user`, `postSponsor`, `eventOrganizer`, `avatars`) are declared
 * here so that `AdminUploadRequestSchema` can narrow per-role without the
 * schema having to duplicate the enum per variant.
 *
 * GAP-078-055 — used as the key for `ENTITY_FOLDER_MAP`.
 */
export const MediaEntityTypeSchema = z.enum([
    'accommodation',
    'destination',
    'event',
    'post',
    'gastronomy',
    'experience',
    'user',
    'postSponsor',
    'eventOrganizer',
    'avatars'
]);

/**
 * Image role within an entity's media structure.
 *
 * - `featured` — the primary image shown in listings and headers.
 * - `gallery` — additional images in the entity's photo gallery.
 * - `avatar` — a user avatar (profile picture).
 * - `sponsorLogo` — a logo for a post sponsor entity.
 * - `organizerLogo` — a logo for an event organizer entity.
 */
export const MediaRoleSchema = z.enum([
    'featured',
    'gallery',
    'avatar',
    'sponsorLogo',
    'organizerLogo'
]);

/**
 * UUID validator reused across role variants for `entityId`.
 *
 * Kept as a module-level constant so the error message stays consistent for
 * every variant of the discriminated union.
 */
const EntityIdSchema = z.string().uuid({ message: 'entityId must be a valid UUID' });

/**
 * UUID validator reused for `userId` on the avatar variant.
 */
const UserIdSchema = z.string().uuid({ message: 'userId must be a valid UUID' });

/**
 * Entity-type subset for image roles that belong to a content entity with a
 * gallery (accommodation, destination, event, post).
 *
 * Narrowing the discriminant at this level prevents `role: 'gallery'` from
 * being paired with an entity type that has no gallery concept (user, avatars).
 */
const GalleryEntityTypeSchema = z.enum([
    'accommodation',
    'destination',
    'event',
    'post',
    'gastronomy',
    'experience'
]);

/**
 * Entity-type subset for featured-image uploads. Same shape as gallery —
 * featured images only apply to the four CRUD content entities.
 */
const FeaturedEntityTypeSchema = GalleryEntityTypeSchema;

/**
 * Optional Cloudinary tags. Forwarded to the provider when present.
 *
 * Each tag is constrained so it cannot smuggle a comma (Cloudinary's tag
 * delimiter), whitespace, or path-traversal characters into the SDK call.
 *
 * SPEC-078-GAPS GAP-078-155.
 */
const MediaTagsSchema = z
    .array(
        z.string().regex(/^[A-Za-z0-9_-]{1,64}$/u, {
            message: 'tag must be 1-64 chars of [A-Za-z0-9_-]'
        })
    )
    .max(20, { message: 'tags supports at most 20 entries per upload' })
    .optional();

/**
 * Optional `overwrite` flag forwarded to the provider. Defaults to provider
 * behavior (true) when omitted.
 *
 * SPEC-078-GAPS GAP-078-155.
 */
const MediaOverwriteSchema = z.boolean().optional();

/**
 * Featured-image variant of the upload request.
 *
 * Each CRUD content entity has exactly one featured image (the upload
 * overwrites the existing asset at `.../featured`). Not applicable to users
 * or sponsor/organizer logos.
 */
const FeaturedImageUploadSchema = z.object({
    role: z.literal('featured'),
    entityType: FeaturedEntityTypeSchema,
    entityId: EntityIdSchema,
    tags: MediaTagsSchema,
    overwrite: MediaOverwriteSchema
});

/**
 * Gallery variant of the upload request.
 *
 * Each CRUD content entity may have many gallery images. A `galleryId` MAY be
 * provided by the client to address a specific slot; when omitted, the server
 * generates one (via `generateGalleryId()`). The field is constrained to a
 * nanoid-shaped token (10 URL-safe characters) so that it cannot smuggle a
 * folder traversal segment into the Cloudinary path.
 */
const GalleryUploadSchema = z.object({
    role: z.literal('gallery'),
    entityType: GalleryEntityTypeSchema,
    entityId: EntityIdSchema,
    galleryId: z
        .string()
        .regex(/^[A-Za-z0-9_-]{10}$/u, {
            message: 'galleryId must be a 10-char nanoid-shaped token'
        })
        .optional(),
    tags: MediaTagsSchema,
    overwrite: MediaOverwriteSchema
});

/**
 * Avatar variant of the upload request.
 *
 * Avatars are addressed by the user's own UUID and stored under a dedicated
 * folder (see `ENTITY_FOLDER_MAP`). The `userId` field is the discriminator
 * between "avatar of myself" and "avatar uploaded by an admin on behalf of
 * another user" — both valid, both require a valid UUID. The `entityType`
 * literal is pinned to `'user'` so the variant cannot accidentally apply to
 * any other entity.
 */
const AvatarUploadSchema = z.object({
    role: z.literal('avatar'),
    entityType: z.literal('user'),
    userId: UserIdSchema,
    tags: MediaTagsSchema,
    overwrite: MediaOverwriteSchema
});

/**
 * Sponsor-logo variant of the upload request.
 *
 * A single logo per post-sponsor entity (overwrites). Identified by the
 * sponsor's UUID.
 */
const SponsorLogoUploadSchema = z.object({
    role: z.literal('sponsorLogo'),
    entityType: z.literal('postSponsor'),
    entityId: EntityIdSchema,
    tags: MediaTagsSchema,
    overwrite: MediaOverwriteSchema
});

/**
 * Organizer-logo variant of the upload request.
 *
 * A single logo per event-organizer entity (overwrites). Identified by the
 * organizer's UUID.
 */
const OrganizerLogoUploadSchema = z.object({
    role: z.literal('organizerLogo'),
    entityType: z.literal('eventOrganizer'),
    entityId: EntityIdSchema,
    tags: MediaTagsSchema,
    overwrite: MediaOverwriteSchema
});

/**
 * Request validation for `POST /api/v1/protected/media/upload-entity` (multipart form fields).
 *
 * Subset of `AdminUploadRequestSchema` restricted to entity image roles
 * (featured, gallery) for the four CRUD content entities. The protected
 * tier does NOT allow avatar, sponsorLogo, or organizerLogo uploads —
 * those remain admin-only.
 *
 * The ownership check is performed at the route level after schema
 * validation, against the authenticated actor's ID.
 */
export const ProtectedUploadEntityRequestSchema = z.discriminatedUnion('role', [
    FeaturedImageUploadSchema,
    GalleryUploadSchema
]);

/**
 * Request validation for `POST /api/v1/admin/media/upload` (multipart form fields).
 *
 * GAP-078-153: the schema is a Zod discriminated union on `role` so the
 * TypeScript type narrows per-variant without requiring runtime guards in the
 * route handler. Invalid combinations (e.g. `role: 'avatar'` without
 * `userId`, or `role: 'gallery'` with `entityType: 'user'`) fail to parse.
 *
 * All variants carry the binary file part in the multipart body; this schema
 * only validates the form fields.
 *
 * @example Featured image
 * ```ts
 * AdminUploadRequestSchema.parse({
 *   role: 'featured',
 *   entityType: 'accommodation',
 *   entityId: '550e8400-e29b-41d4-a716-446655440000',
 * });
 * ```
 *
 * @example Avatar
 * ```ts
 * AdminUploadRequestSchema.parse({
 *   role: 'avatar',
 *   entityType: 'user',
 *   userId: '550e8400-e29b-41d4-a716-446655440000',
 * });
 * ```
 */
export const AdminUploadRequestSchema = z.discriminatedUnion('role', [
    FeaturedImageUploadSchema,
    GalleryUploadSchema,
    AvatarUploadSchema,
    SponsorLogoUploadSchema,
    OrganizerLogoUploadSchema
]);

/**
 * Context passed to an `ENTITY_FOLDER_MAP` resolver function.
 *
 * `environment` is the current media environment (`dev`, `test`, `prod`, ...).
 * `entityId` is the UUID of the target entity (for per-entity-id folders).
 * `userId` is only set for the avatar variant (folder is user-addressed).
 *
 * The caller supplies whichever fields the variant requires — resolvers
 * consume only what they need and ignore the rest.
 */
export type MediaFolderContext = {
    readonly environment: string;
    readonly entityId?: string;
    readonly userId?: string;
};

type MediaFolderResolver = (ctx: MediaFolderContext) => string;

/**
 * Maps each `MediaEntityType` to the Cloudinary folder path used for uploads.
 *
 * GAP-078-055 — single source of truth for the Cloudinary folder layout.
 * Previously the admin upload route computed the folder inline with
 * ``hospeda/${environment}/${entityType}s/${entityId}`` which made it easy to
 * silently drift (e.g. an entity type named `news` would produce `newss/`
 * — see the spec gap). The resolvers below pin the exact folder segment per
 * entity type so the layout is auditable and reviewable.
 *
 * Resolver contract:
 * - Returned path MUST NOT have a trailing slash; the provider appends the
 *   `publicId` with its own separator.
 * - Returned path MUST start with `hospeda/{environment}/` so the delete
 *   endpoint's environment-scope refinement accepts it.
 * - Resolvers MUST throw if a required context field is missing, rather
 *   than producing a partial path like `.../undefined`.
 */
export const ENTITY_FOLDER_MAP = {
    accommodation: ({ environment, entityId }) => {
        if (!entityId) throw new Error('ENTITY_FOLDER_MAP.accommodation requires entityId');
        return `hospeda/${environment}/accommodations/${entityId}`;
    },
    destination: ({ environment, entityId }) => {
        if (!entityId) throw new Error('ENTITY_FOLDER_MAP.destination requires entityId');
        return `hospeda/${environment}/destinations/${entityId}`;
    },
    event: ({ environment, entityId }) => {
        if (!entityId) throw new Error('ENTITY_FOLDER_MAP.event requires entityId');
        return `hospeda/${environment}/events/${entityId}`;
    },
    post: ({ environment, entityId }) => {
        if (!entityId) throw new Error('ENTITY_FOLDER_MAP.post requires entityId');
        return `hospeda/${environment}/posts/${entityId}`;
    },
    gastronomy: ({ environment, entityId }) => {
        if (!entityId) throw new Error('ENTITY_FOLDER_MAP.gastronomy requires entityId');
        return `hospeda/${environment}/gastronomies/${entityId}`;
    },
    experience: ({ environment, entityId }) => {
        if (!entityId) throw new Error('ENTITY_FOLDER_MAP.experience requires entityId');
        return `hospeda/${environment}/experiences/${entityId}`;
    },
    user: ({ environment, userId, entityId }) => {
        const id = userId ?? entityId;
        if (!id) throw new Error('ENTITY_FOLDER_MAP.user requires userId');
        return `hospeda/${environment}/avatars/${id}`;
    },
    postSponsor: ({ environment, entityId }) => {
        if (!entityId) throw new Error('ENTITY_FOLDER_MAP.postSponsor requires entityId');
        return `hospeda/${environment}/postSponsors/${entityId}`;
    },
    eventOrganizer: ({ environment, entityId }) => {
        if (!entityId) throw new Error('ENTITY_FOLDER_MAP.eventOrganizer requires entityId');
        return `hospeda/${environment}/eventOrganizers/${entityId}`;
    },
    avatars: ({ environment }) => `hospeda/${environment}/seed/avatars`
} as const satisfies Readonly<Record<z.infer<typeof MediaEntityTypeSchema>, MediaFolderResolver>>;

/**
 * Resolve the Cloudinary folder for a given entity type, using the
 * `ENTITY_FOLDER_MAP`. Convenience wrapper that keeps call sites free of
 * the resolver-indirection noise.
 */
export const resolveMediaFolder = ({
    entityType,
    environment,
    entityId,
    userId
}: {
    readonly entityType: z.infer<typeof MediaEntityTypeSchema>;
    readonly environment: string;
    readonly entityId?: string;
    readonly userId?: string;
}): string => ENTITY_FOLDER_MAP[entityType]({ environment, entityId, userId });

/**
 * Safely decode a URL-encoded string. Returns the input unchanged when
 * `decodeURIComponent` throws (malformed sequence). The fallback ensures the
 * traversal refinement still inspects the raw value instead of crashing
 * validation with an uncaught error.
 */
const safeDecode = (value: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

/**
 * Query parameter validation for `DELETE /api/v1/admin/media`.
 *
 * The `publicId` must start with `'hospeda/'` to prevent callers from deleting
 * assets that live outside the project's Cloudinary namespace.
 *
 * It must also not contain a parent-directory traversal segment (`..`) in
 * either its raw form or after URL-decoding. This blocks attempts such as
 * `hospeda/dev/../prod/x` and `hospeda/dev/%2E%2E/prod/x` from escaping the
 * environment-scoped folder layout.
 *
 * @example
 * ```ts
 * // Valid
 * DeleteMediaQuerySchema.parse({ publicId: 'hospeda/prod/accommodations/abc/featured' });
 *
 * // Invalid — wrong namespace
 * DeleteMediaQuerySchema.parse({ publicId: 'other/image' }); // throws
 *
 * // Invalid — path traversal
 * DeleteMediaQuerySchema.parse({ publicId: 'hospeda/dev/../prod/x' }); // throws
 * DeleteMediaQuerySchema.parse({ publicId: 'hospeda/dev/%2E%2E/prod/x' }); // throws
 * ```
 */
export const DeleteMediaQuerySchema = z.object({
    publicId: z
        .string()
        .min(1, 'publicId is required')
        .refine((s) => s.startsWith('hospeda/'), {
            message: 'publicId must start with "hospeda/"'
        })
        .refine((s) => !s.includes('..') && !safeDecode(s).includes('..'), {
            message: 'publicId must not contain path traversal segments'
        })
});

/**
 * Shape of the `data` payload on a successful upload response.
 *
 * Mirrors the relevant subset of the Cloudinary upload API response that
 * downstream consumers (admin UI, service layer) need to store on the entity.
 *
 * Includes `moderationState: 'APPROVED'` because, per project policy, every
 * image persisted via the upload endpoint is considered pre-approved at
 * creation time. Keeping the literal in the schema makes the contract
 * explicit and lets callers consume the status without a follow-up fetch.
 *
 * Unknown provider fields are stripped (default Zod behavior). This matches
 * the schema compatibility policy: the contract is additive only and
 * downstream clients must never see non-contractual fields leaking through.
 *
 * @example
 * ```ts
 * const data: UploadResponseData = {
 *   url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/abc.jpg',
 *   publicId: 'hospeda/prod/accommodations/abc/featured',
 *   width: 1920,
 *   height: 1080,
 *   moderationState: 'APPROVED',
 * };
 * ```
 */
export const UploadResponseDataSchema = z.object({
    url: z.string().url({ message: 'url must be a valid URL' }),
    publicId: z.string().min(1, 'publicId is required'),
    width: z.number().int().positive({ message: 'width must be a positive integer' }),
    height: z.number().int().positive({ message: 'height must be a positive integer' }),
    moderationState: z.literal('APPROVED').default('APPROVED')
});

/**
 * Metadata envelope returned alongside every successful upload response.
 *
 * Matches the project-wide `ApiResponse.metadata` shape produced by
 * `createResponse()` in the API. Kept inline here (rather than imported from
 * a shared API response schema) so this package remains decoupled from the
 * API app and can be consumed by any client that needs to validate upload
 * responses end-to-end.
 */
export const UploadResponseMetadataSchema = z.object({
    timestamp: z.string().datetime().optional(),
    requestId: z.string().optional()
});

/**
 * Full wrapped response shape returned by the upload endpoint on success.
 *
 * The shape is `{ success: true, data: {...}, metadata: {...} }` (wrapped via
 * the shared `ResponseFactory` on the API side). Route handlers call
 * `UploadResponseSchema.parse(response)` before returning so a malformed
 * provider response causes an explicit 500 instead of silent bad data.
 *
 * Upload routes return HTTP 200 (not 201) because uploads may overwrite an
 * existing asset (avatars, featured images) — they are not strictly a
 * creation.
 *
 * @example
 * ```ts
 * const response: UploadResponse = {
 *   success: true,
 *   data: {
 *     url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/abc.jpg',
 *     publicId: 'hospeda/prod/accommodations/abc/featured',
 *     width: 1920,
 *     height: 1080,
 *     moderationState: 'APPROVED',
 *   },
 *   metadata: { timestamp: '2026-04-19T00:00:00.000Z', requestId: 'abc' },
 * };
 * ```
 */
export const UploadResponseSchema = z.object({
    success: z.literal(true),
    data: UploadResponseDataSchema,
    metadata: UploadResponseMetadataSchema
});

/**
 * Response shape returned by the delete endpoint on success.
 *
 * The `deleted: true` literal acts as a discriminant so callers can safely
 * assert that the operation completed without needing to inspect HTTP status.
 *
 * `wasPresent` (SPEC-078-GAPS GAP-078-154) reports whether the asset existed
 * at the time of the call: `true` when Cloudinary deleted it just now, `false`
 * when the asset was already absent (idempotent no-op). The flag is OPTIONAL
 * for backward compatibility with the previous response shape; new callers
 * MAY rely on it but consumers reading historic logs MUST tolerate its
 * absence.
 *
 * @example
 * ```ts
 * const response: DeleteMediaResponse = {
 *   deleted: true,
 *   publicId: 'hospeda/prod/accommodations/abc/featured',
 *   wasPresent: true,
 * };
 * ```
 */
export const DeleteMediaResponseSchema = z.object({
    deleted: z.literal(true),
    publicId: z.string().min(1, 'publicId is required'),
    wasPresent: z.boolean().optional()
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

/** Union of all entity types that support media uploads. */
export type MediaEntityType = z.infer<typeof MediaEntityTypeSchema>;

/** Role of an image within an entity's media structure. */
export type MediaRole = z.infer<typeof MediaRoleSchema>;

/** Validated form fields for a media upload request (discriminated union). */
export type AdminUploadRequest = z.infer<typeof AdminUploadRequestSchema>;

/** Validated form fields for a protected entity media upload request. */
export type ProtectedUploadEntityRequest = z.infer<typeof ProtectedUploadEntityRequestSchema>;

/** Featured-image variant of the upload request. */
export type FeaturedImageUploadRequest = z.infer<typeof FeaturedImageUploadSchema>;

/** Gallery variant of the upload request. */
export type GalleryUploadRequest = z.infer<typeof GalleryUploadSchema>;

/** Avatar variant of the upload request. */
export type AvatarUploadRequest = z.infer<typeof AvatarUploadSchema>;

/** Sponsor-logo variant of the upload request. */
export type SponsorLogoUploadRequest = z.infer<typeof SponsorLogoUploadSchema>;

/** Organizer-logo variant of the upload request. */
export type OrganizerLogoUploadRequest = z.infer<typeof OrganizerLogoUploadSchema>;

/** Validated query parameters for a media delete request. */
export type DeleteMediaQuery = z.infer<typeof DeleteMediaQuerySchema>;

/** Shape of the `data` payload on a successful upload response. */
export type UploadResponseData = z.infer<typeof UploadResponseDataSchema>;

/** Metadata envelope returned alongside a successful upload response. */
export type UploadResponseMetadata = z.infer<typeof UploadResponseMetadataSchema>;

/** Shape of a successful (wrapped) upload response. */
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

/** Shape of a successful delete response. */
export type DeleteMediaResponse = z.infer<typeof DeleteMediaResponseSchema>;
