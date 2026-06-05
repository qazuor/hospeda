/**
 * AI prompt storage helpers (SPEC-173 T-010, T-028).
 *
 * Reads and writes `ai_prompt_versions` rows.
 *
 * - {@link getActivePrompt} — engine reads the active system prompt for a feature
 *   (T-010); falls back to in-code default when `null` is returned (§5.6, FR-5).
 * - {@link createPromptVersion} — admin creates a new prompt version, optionally
 *   activating it (T-028). Activation deactivates all other rows for the feature
 *   atomically.
 * - {@link activatePromptVersion} — admin promotes an existing version to active
 *   (T-028). Deactivates all other rows for the feature atomically.
 * - {@link listPromptVersionsByFeature} — admin lists all versions for a feature
 *   ordered by version descending (T-028).
 *
 * Soft-deleted rows are excluded by default (deletedAt IS NULL filter).
 *
 * @module ai-core/storage/prompt
 */

import { aiPromptVersions, and, desc, eq, getDb, isNull, max, withTransaction } from '@repo/db';
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

// ---------------------------------------------------------------------------
// Admin write / list helpers (T-028)
// ---------------------------------------------------------------------------

/**
 * Input for {@link createPromptVersion}.
 */
export interface CreatePromptVersionInput {
    /** The AI feature this prompt belongs to. */
    readonly feature: AiFeature;
    /** System-prompt content. */
    readonly content: string;
    /**
     * Whether to activate this version immediately.
     * When `true`, all other rows for the feature are deactivated atomically.
     */
    readonly isActive: boolean;
    /** UUID of the SUPER_ADMIN creating this version. */
    readonly actorId: string;
    /** Optional transaction client (a new transaction is started when absent). */
    readonly tx?: DrizzleClient;
}

/**
 * Input for {@link activatePromptVersion}.
 */
export interface ActivatePromptVersionInput {
    /** UUID of the prompt version row to activate. */
    readonly id: string;
    /** Optional transaction client. */
    readonly tx?: DrizzleClient;
}

/**
 * Input for {@link listPromptVersionsByFeature}.
 */
export interface ListPromptVersionsByFeatureInput {
    /** The AI feature whose versions to list. */
    readonly feature: AiFeature;
    /** When `true`, soft-deleted rows are included. Default `false`. */
    readonly includeDeleted?: boolean;
    /** Optional transaction client. */
    readonly tx?: DrizzleClient;
}

/**
 * Creates a new versioned prompt and optionally activates it.
 *
 * The `version` number is computed as `MAX(version) + 1` for the feature.
 * If `isActive` is `true`, all other rows for the feature are set to
 * `isActive = false` in the same transaction as the insert.
 *
 * @param input - {@link CreatePromptVersionInput}
 * @returns The inserted {@link SelectAiPromptVersion} row.
 *
 * @example
 * ```ts
 * const row = await createPromptVersion({
 *   feature: 'text_improve',
 *   content: 'You are a helpful writing assistant.',
 *   isActive: true,
 *   actorId: adminId,
 * });
 * console.log(row.version); // e.g. 2
 * ```
 */
export async function createPromptVersion(
    input: CreatePromptVersionInput
): Promise<SelectAiPromptVersion> {
    const { feature, content, isActive, actorId, tx: outerTx } = input;

    const run = async (tx: DrizzleClient): Promise<SelectAiPromptVersion> => {
        // 1. Compute next version: MAX(version) for the feature (all rows, including deleted).
        const maxResult = await tx
            .select({ maxVersion: max(aiPromptVersions.version) })
            .from(aiPromptVersions)
            .where(eq(aiPromptVersions.feature, feature));

        const currentMax = maxResult[0]?.maxVersion ?? 0;
        const nextVersion = currentMax + 1;

        // 2. If activating, deactivate all existing rows for this feature first.
        if (isActive) {
            await tx
                .update(aiPromptVersions)
                .set({ isActive: false })
                .where(eq(aiPromptVersions.feature, feature));
        }

        // 3. Insert the new version row.
        const inserted = await tx
            .insert(aiPromptVersions)
            .values({
                feature,
                version: nextVersion,
                content,
                isActive,
                createdBy: actorId
            })
            .returning();

        const row: SelectAiPromptVersion | undefined = inserted[0];
        if (!row) {
            throw new Error(`createPromptVersion: insert returned no row for feature='${feature}'`);
        }

        return row;
    };

    // Use the provided tx or start a new transaction.
    if (outerTx) {
        return run(outerTx);
    }
    return withTransaction(run);
}

/**
 * Activates an existing prompt version, atomically deactivating all other
 * versions for the same feature.
 *
 * @param input - {@link ActivatePromptVersionInput}
 * @returns The updated {@link SelectAiPromptVersion} row, or `null` if not found.
 *
 * @example
 * ```ts
 * const row = await activatePromptVersion({ id: versionId });
 * if (!row) {
 *   // Not found — route maps to 404
 * }
 * ```
 */
export async function activatePromptVersion(
    input: ActivatePromptVersionInput
): Promise<SelectAiPromptVersion | null> {
    const { id, tx: outerTx } = input;

    const run = async (tx: DrizzleClient): Promise<SelectAiPromptVersion | null> => {
        // 1. Look up the target row to get its feature.
        const existing = await tx
            .select({ id: aiPromptVersions.id, feature: aiPromptVersions.feature })
            .from(aiPromptVersions)
            .where(eq(aiPromptVersions.id, id))
            .limit(1);

        const target = existing[0];
        if (!target) {
            return null;
        }

        // 2. Deactivate all rows for this feature.
        await tx
            .update(aiPromptVersions)
            .set({ isActive: false })
            .where(eq(aiPromptVersions.feature, target.feature));

        // 3. Activate the target row.
        const updated = await tx
            .update(aiPromptVersions)
            .set({ isActive: true })
            .where(eq(aiPromptVersions.id, id))
            .returning();

        const row: SelectAiPromptVersion | undefined = updated[0];
        return row ?? null;
    };

    if (outerTx) {
        return run(outerTx);
    }
    return withTransaction(run);
}

/**
 * Lists all prompt versions for a feature, ordered by `version` descending
 * (newest version first).
 *
 * @param input - {@link ListPromptVersionsByFeatureInput}
 * @returns Read-only array of {@link SelectAiPromptVersion} rows.
 *
 * @example
 * ```ts
 * const rows = await listPromptVersionsByFeature({ feature: 'text_improve' });
 * // rows[0] is the latest version
 * ```
 */
export async function listPromptVersionsByFeature(
    input: ListPromptVersionsByFeatureInput
): Promise<readonly SelectAiPromptVersion[]> {
    const { feature, includeDeleted = false, tx } = input;
    const db = tx ?? getDb();

    const condition = includeDeleted
        ? eq(aiPromptVersions.feature, feature)
        : and(eq(aiPromptVersions.feature, feature), isNull(aiPromptVersions.deletedAt));

    const rows = await db
        .select()
        .from(aiPromptVersions)
        .where(condition)
        .orderBy(desc(aiPromptVersions.version));

    return rows;
}
