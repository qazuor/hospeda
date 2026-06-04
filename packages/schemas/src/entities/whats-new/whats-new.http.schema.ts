import { z } from 'zod';

/**
 * Request body for `PATCH /api/v1/protected/users/me/whats-new-seen`.
 *
 * Marks one or more entry ids as seen for the authenticated user.
 * The server performs a server-side Set-union merge — calling this endpoint
 * twice with overlapping ids is safe and idempotent.
 *
 * @see {@link WhatsNewSeenBody} for the inferred TypeScript type.
 */
export const WhatsNewSeenBodySchema = z.object({
    /**
     * Non-empty array of entry ids to mark as seen.
     *
     * Each id must be a non-empty string (matches the `id` field of
     * {@link WhatsNewEntrySchema}). At least one id is required — an empty
     * array is rejected with HTTP 400.
     */
    ids: z.array(z.string().min(1)).min(1)
});

/** Inferred TypeScript type for {@link WhatsNewSeenBodySchema}. */
export type WhatsNewSeenBody = z.infer<typeof WhatsNewSeenBodySchema>;

/**
 * Shape of a single What's New item as returned by the GET endpoint.
 *
 * Titles and bodies are **locale-resolved** by the server before responding:
 * the client receives plain strings, never the raw `{ es, en, pt }` i18n object.
 * Locale is resolved from the actor's `settings.languageAdmin`, falling back
 * to `'es'` when the requested locale is absent from the entry.
 *
 * @see {@link WhatsNewItemSchema} for the full Zod schema.
 */
export const WhatsNewItemSchema = z.object({
    /** Stable entry identifier matching `WhatsNewEntrySchema.id`. */
    id: z.string().min(1),

    /** ISO 8601 datetime string — when the entry was published. */
    publishedAt: z.string().datetime(),

    /**
     * Whether the entry should auto-open the modal when unseen.
     * Mirrors `WhatsNewEntrySchema.highlight`.
     */
    highlight: z.boolean(),

    /**
     * Locale-resolved title string.
     * The server picks the appropriate locale and falls back to `es`.
     */
    title: z.string().min(1),

    /**
     * Locale-resolved body string (Markdown).
     * The server picks the appropriate locale and falls back to `es`.
     */
    body: z.string().min(1),

    /** Optional image URL. Present only if the entry defines one. */
    image: z.string().url().optional(),

    /**
     * Whether this entry has been seen by the authenticated user.
     *
     * `true` when:
     * - `entry.id` is in `settings.onboarding.whatsNew.seenIds`, OR
     * - `entry.publishedAt <= settings.onboarding.whatsNew.baselineAt`
     *   (entries predating the user's baseline are auto-seen to prevent
     *   flooding pre-existing users when the feature is first deployed).
     */
    seen: z.boolean()
});

/** Inferred TypeScript type for a single GET response item. */
export type WhatsNewItem = z.infer<typeof WhatsNewItemSchema>;

/**
 * Response shape for `GET /api/v1/protected/whats-new`.
 *
 * Items are role-filtered (only entries applicable to the actor's role are
 * included) and sorted newest-first by `publishedAt`.
 *
 * `unseenCount` is always the count of items where `seen === false` and must
 * match `items.filter(i => !i.seen).length`.
 *
 * @see {@link WhatsNewGetResponse} for the inferred TypeScript type.
 */
export const WhatsNewGetResponseSchema = z.object({
    /**
     * Role-filtered, locale-resolved, newest-first list of applicable entries.
     * May be empty when no entries target the actor's role.
     */
    items: z.array(WhatsNewItemSchema),

    /**
     * Number of items where `seen === false`.
     * Used by the topbar badge to display the unseen counter.
     * Always a non-negative integer.
     */
    unseenCount: z.number().int().nonnegative()
});

/** Inferred TypeScript type for {@link WhatsNewGetResponseSchema}. */
export type WhatsNewGetResponse = z.infer<typeof WhatsNewGetResponseSchema>;
