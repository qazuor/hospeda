import { z } from 'zod';

/**
 * AI provider credential schemas (SPEC-173 T-026).
 *
 * Defines the API-boundary shapes for the credential vault routes. The
 * plaintext key, ciphertext, IV, and GCM auth tag are NEVER included in
 * any response schema — only the masked subset of the DB row is exposed.
 *
 * @module schemas/entities/ai/ai-credential
 */

// ---------------------------------------------------------------------------
// Masked response (list / create / rotate responses)
// ---------------------------------------------------------------------------

/**
 * Masked view of a stored AI provider credential.
 *
 * Sensitive fields (`ciphertext`, `iv`, `authTag`) are EXCLUDED.
 * Only metadata safe to return to an admin is included.
 */
export const AiCredentialMaskedSchema = z.object({
    /** Row primary key (UUID). */
    id: z.string().uuid(),
    /** AI provider identifier (e.g. `openai`, `anthropic`, `stub`). */
    providerId: z.string(),
    /** Optional human-readable label set at creation time. */
    label: z.string().nullable(),
    /** Arbitrary operator metadata blob (no secrets). */
    metadata: z.record(z.string(), z.unknown()).nullable(),
    /** ISO-8601 creation timestamp. */
    createdAt: z.string().datetime({ offset: true }),
    /** ISO-8601 last-updated timestamp. */
    updatedAt: z.string().datetime({ offset: true }),
    /** ISO-8601 soft-delete timestamp, or `null` when active. */
    deletedAt: z.string().datetime({ offset: true }).nullable()
});

/** TypeScript type for the masked credential response. */
export type AiCredentialMasked = z.infer<typeof AiCredentialMaskedSchema>;

// ---------------------------------------------------------------------------
// Create input
// ---------------------------------------------------------------------------

/**
 * Input body for `POST /api/v1/admin/ai/credentials`.
 *
 * `plaintextKey` is consumed server-side for encryption and NEVER returned.
 */
export const AiCredentialCreateInputSchema = z
    .object({
        /** AI provider identifier. */
        providerId: z.string().min(1),
        /** The raw API key to encrypt. Consumed server-side — never returned. */
        plaintextKey: z.string().min(1),
        /** Optional operator label (e.g. "Production OpenAI key"). */
        label: z.string().optional(),
        /** Optional arbitrary metadata (e.g. expiry date, key tier). */
        metadata: z.record(z.string(), z.unknown()).optional()
    })
    .strict();

/** TypeScript type for the credential create input. */
export type AiCredentialCreateInput = z.infer<typeof AiCredentialCreateInputSchema>;

// ---------------------------------------------------------------------------
// Rotate input
// ---------------------------------------------------------------------------

/**
 * Input body for `POST /api/v1/admin/ai/credentials/{providerId}/rotate`.
 */
export const AiCredentialRotateInputSchema = z
    .object({
        /** The new raw API key to encrypt. Consumed server-side — never returned. */
        newPlaintextKey: z.string().min(1)
    })
    .strict();

/** TypeScript type for the credential rotate input. */
export type AiCredentialRotateInput = z.infer<typeof AiCredentialRotateInputSchema>;

// ---------------------------------------------------------------------------
// Update input
// ---------------------------------------------------------------------------

/**
 * Input body for `PATCH /api/v1/admin/ai/credentials/{providerId}`.
 *
 * Updates non-sensitive metadata (label, models, baseURL) without touching the
 * encrypted key material.
 */
export const AiCredentialUpdateInputSchema = z
    .object({
        /** Optional human-readable label. */
        label: z.string().optional(),
        /** Optional arbitrary metadata (e.g. baseURL, models). */
        metadata: z.record(z.string(), z.unknown()).optional()
    })
    .strict();

/** TypeScript type for the credential update input. */
export type AiCredentialUpdateInput = z.infer<typeof AiCredentialUpdateInputSchema>;

// ---------------------------------------------------------------------------
// Mutation result (create / rotate / update responses)
// ---------------------------------------------------------------------------

/**
 * Slim response returned by create, rotate, and update operations.
 * Confirms the operation succeeded without leaking any secret material.
 */
export const AiCredentialMutationResultSchema = z.object({
    /** UUID of the credential row. */
    id: z.string().uuid(),
    /** AI provider identifier. */
    providerId: z.string()
});

/** TypeScript type for the credential mutation result. */
export type AiCredentialMutationResult = z.infer<typeof AiCredentialMutationResultSchema>;
