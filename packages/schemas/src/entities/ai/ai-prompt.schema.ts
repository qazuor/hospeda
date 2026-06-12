import { z } from 'zod';
import { AiFeatureSchema } from './ai-provider.schema.js';

/**
 * AI prompt version schemas (SPEC-173).
 *
 * Models the `ai_prompt_versions` table (§5.4): versioned, per-feature system
 * prompts with an active/inactive flag. The engine falls back to an in-code
 * default when the active admin prompt is empty or invalid (§5.6 §AC-12).
 *
 * **Versioning model**: `version` is a monotonically increasing integer per
 * feature. The admin UI is responsible for incrementing it on each save; the
 * engine reads the row with `is_active = true` for a given feature.
 */

// ---------------------------------------------------------------------------
// Core entity schema (mirrors ai_prompt_versions columns)
// ---------------------------------------------------------------------------

/**
 * A single versioned system-prompt record.
 *
 * Read by the engine's config resolver to pick the active system prompt for
 * each AI feature. If no active prompt exists the engine falls back silently
 * to the in-code default (§AC-12) — it never bricked by an empty admin value.
 */
export const AiPromptVersionSchema = z.object({
    /** Unique identifier for this prompt record (UUID). */
    id: z.string().uuid(),
    /** The AI feature this prompt applies to. */
    feature: AiFeatureSchema,
    /**
     * Monotonically increasing version number per feature.
     * Starts at 1; each admin save creates a new row with version + 1.
     */
    version: z.number().int().min(1),
    /**
     * System-prompt content. Non-empty; any length that the target model
     * accepts (no hard upper bound enforced at the schema layer — the admin UI
     * should surface a soft warning for very long prompts).
     */
    content: z.string().min(1),
    /**
     * Editable hard rules / guardrails, managed separately from `content` and
     * composed after it at runtime (SPEC-214). `null` falls back to the in-code
     * `DEFAULT_RULES[feature]`, preserving the pre-migration effective prompt.
     */
    rules: z.string().nullable(),
    /**
     * Whether this is the currently active prompt for the feature.
     * Only one row per feature should have `isActive = true` at any time
     * (enforced by the service layer, not by a DB constraint in V1).
     */
    isActive: z.boolean(),
    /** Timestamp when this record was created. */
    createdAt: z.coerce.date(),
    /** UUID of the SUPER_ADMIN who authored this version. */
    createdBy: z.string().uuid()
});

/** TypeScript type for a versioned AI system prompt record. */
export type AiPromptVersion = z.infer<typeof AiPromptVersionSchema>;

// ---------------------------------------------------------------------------
// Create / input schema
// ---------------------------------------------------------------------------

/**
 * Input schema for creating a new prompt version.
 *
 * `id`, `createdAt`, and `createdBy` are server-generated and therefore
 * omitted from the client-facing input. `version` is also server-assigned
 * (auto-incremented by the service from the current max for the feature).
 * `isActive` defaults to `true` — creating a new version typically activates
 * it immediately (the service deactivates the previous active row atomically).
 *
 * **Decision (owner-approved 2026-06-04)**: `isActive` defaults to `true` —
 * saving a new prompt version activates it immediately (the service deactivates
 * the previous active row atomically). A future "draft prompt" workflow, if
 * needed, is an additive change.
 */
export const CreateAiPromptVersionSchema = z.object({
    /** The AI feature this prompt applies to. */
    feature: AiFeatureSchema,
    /** System-prompt content. */
    content: z.string().min(1),
    /**
     * Optional editable rules / guardrails (SPEC-214). Omit to leave `null`
     * (runtime then falls back to `DEFAULT_RULES[feature]`).
     */
    rules: z.string().optional(),
    /**
     * Whether to activate this prompt immediately.
     * Defaults to `true` (replaces the current active prompt for the feature).
     */
    isActive: z.boolean().default(true)
});

/** TypeScript type for the create-prompt input. */
export type CreateAiPromptVersion = z.infer<typeof CreateAiPromptVersionSchema>;
