/**
 * AI connection schemas (HOS-2184 T-026).
 *
 * An "AI connection" is an OAuth client (an AI assistant such as Claude or
 * ChatGPT) the user has authorised against the MCP server. It is the user's
 * `oauth_consent` row joined to the `oauth_client` row. There is no table of
 * its own.
 */
import { z } from 'zod';

/**
 * OAuth `client_id` as it appears in a query parameter. A
 * Dynamic-Client-Registration id is an opaque string; a
 * Client-ID-Metadata-Document id is an https URL, so the bound is generous.
 * Never assume a UUID, and never normalise it (no `trim`): it is an opaque id.
 */
export const AiConnectionClientIdSchema = z.string().min(1).max(2048);

/** TypeScript type inferred from {@link AiConnectionClientIdSchema}. */
export type AiConnectionClientId = z.infer<typeof AiConnectionClientIdSchema>;

/**
 * One AI assistant the actor has connected.
 *
 * `name`, `uri` and `logoUri` come from the client's own registration metadata,
 * which any caller of the public registration endpoint can set: treat them as
 * untrusted display text (escape, never render as HTML, never follow `uri`
 * automatically).
 */
export const AiConnectionSchema = z.object({
    /** OAuth `client_id`. The key for revoking. */
    clientId: AiConnectionClientIdSchema,
    /** Client-declared display name, when it registered one. */
    name: z.string().nullable(),
    /** Client-declared home page, when it registered one. */
    uri: z.string().nullable(),
    /** Client-declared logo URL, when it registered one. */
    logoUri: z.string().nullable(),
    /** Scopes the user granted. */
    scopes: z.array(z.string()),
    /** When the user granted access (consent `createdAt`). */
    connectedAt: z.coerce.date().nullable(),
    /**
     * Last time this client obtained a token for the user, or `null` when none
     * is stored. Approximate: access tokens are stateless, so this is the
     * newest refresh-token issue (roughly hourly while the client is in use),
     * not the time of the last tool call.
     */
    lastUsedAt: z.coerce.date().nullable()
});

/** TypeScript type inferred from {@link AiConnectionSchema}. */
export type AiConnection = z.infer<typeof AiConnectionSchema>;

/**
 * A password reset the user has not yet answered (HOS-2184).
 *
 * Present only when the user reset their password through the forgot-password
 * flow while they had at least one AI assistant connected, and has not chosen
 * what to do about it yet. Changing the password while signed in never creates
 * one. `connectionsBeforeReset` holds the connections that were made before the
 * reset and are still in place: a client connected after the reset is not in it.
 */
export const AiConnectionPendingResetReviewSchema = z.object({
    /** When the password was reset. */
    resetAt: z.coerce.date(),
    /** Connections made before `resetAt` that still exist. Never empty. */
    connectionsBeforeReset: z.array(AiConnectionSchema)
});

/** TypeScript type inferred from {@link AiConnectionPendingResetReviewSchema}. */
export type AiConnectionPendingResetReview = z.infer<typeof AiConnectionPendingResetReviewSchema>;

/** Response of `GET /api/v1/protected/ai-connections`. */
export const AiConnectionListSchema = z.object({
    items: z.array(AiConnectionSchema),
    /** The unanswered post-reset question, or `null` when there is none. */
    pendingResetReview: AiConnectionPendingResetReviewSchema.nullable()
});

/** TypeScript type inferred from {@link AiConnectionListSchema}. */
export type AiConnectionList = z.infer<typeof AiConnectionListSchema>;

/**
 * The user's answer to the post-reset question: disconnect the assistants that
 * were connected before the reset, or keep them.
 */
export const AiConnectionResetReviewActionSchema = z.enum(['revoke_previous', 'keep']);

/** TypeScript type inferred from {@link AiConnectionResetReviewActionSchema}. */
export type AiConnectionResetReviewAction = z.infer<typeof AiConnectionResetReviewActionSchema>;

/** Body of `POST /api/v1/protected/ai-connections/reset-review`. */
export const AiConnectionResetReviewBodySchema = z
    .object({ action: AiConnectionResetReviewActionSchema })
    .strict();

/** TypeScript type inferred from {@link AiConnectionResetReviewBodySchema}. */
export type AiConnectionResetReviewBody = z.infer<typeof AiConnectionResetReviewBodySchema>;

/** Response of `POST /api/v1/protected/ai-connections/reset-review`. */
export const AiConnectionResetReviewResultSchema = z.object({
    /** The answer that was applied. */
    action: AiConnectionResetReviewActionSchema,
    /** Client ids that were disconnected. Empty for `keep`. */
    revokedClientIds: z.array(AiConnectionClientIdSchema)
});

/** TypeScript type inferred from {@link AiConnectionResetReviewResultSchema}. */
export type AiConnectionResetReviewResult = z.infer<typeof AiConnectionResetReviewResultSchema>;
