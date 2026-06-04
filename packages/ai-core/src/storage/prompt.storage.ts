/**
 * AI prompt storage helpers (SPEC-173 T-010).
 *
 * Reads active `ai_prompt_versions` rows.  The engine calls
 * {@link getActivePrompt} on every AI call to resolve the system prompt
 * for a feature; it falls back to its in-code default when `null` is
 * returned (§5.6, FR-5).
 *
 * Soft-deleted rows are excluded automatically (deletedAt IS NULL filter).
 *
 * @module ai-core/storage/prompt
 */

import { aiPromptVersions, and, eq, getDb, isNull } from '@repo/db';
import type { DrizzleClient, SelectAiPromptVersion } from '@repo/db';
import type { AiFeature } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Input / output shapes (RO-RO)
// ---------------------------------------------------------------------------

/**
 * Input for {@link getActivePrompt}.
 */
export interface GetActivePromptInput {
    /** The AI feature whose active system prompt is requested. */
    readonly feature: AiFeature;
    /** Optional transaction client (falls back to `getDb()`). */
    readonly tx?: DrizzleClient;
}

/**
 * Result returned by {@link getActivePrompt}.
 */
export interface GetActivePromptResult {
    /**
     * The active system prompt content for the feature, or `null` if no active
     * row exists.  A `null` result means the engine should use its in-code
     * default prompt.
     */
    readonly content: string | null;
    /**
     * The full row, or `null` if no active row was found.
     * Exposed for callers that need row metadata (id, version, createdBy…).
     */
    readonly row: SelectAiPromptVersion | null;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Returns the active system prompt for an AI feature.
 *
 * Filters: `feature = :feature AND is_active = true AND deleted_at IS NULL`.
 * If multiple rows somehow satisfy these conditions (data integrity issue),
 * the first returned by the database is used.
 *
 * @param input - {@link GetActivePromptInput}
 * @returns {@link GetActivePromptResult} — content + full row (both `null` when absent).
 *
 * @example
 * ```ts
 * const { content } = await getActivePrompt({ feature: 'text_improve' });
 * const systemPrompt = content ?? DEFAULT_TEXT_IMPROVE_PROMPT;
 * ```
 */
export async function getActivePrompt(input: GetActivePromptInput): Promise<GetActivePromptResult> {
    const { feature, tx } = input;
    const db = tx ?? getDb();

    const rows = await db
        .select()
        .from(aiPromptVersions)
        .where(
            and(
                eq(aiPromptVersions.feature, feature),
                eq(aiPromptVersions.isActive, true),
                isNull(aiPromptVersions.deletedAt)
            )
        )
        .limit(1);

    const row: SelectAiPromptVersion | undefined = rows[0];
    if (!row) {
        return { content: null, row: null };
    }

    return { content: row.content, row };
}
