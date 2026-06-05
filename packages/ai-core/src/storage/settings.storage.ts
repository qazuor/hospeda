/**
 * AI settings storage helpers (SPEC-173 T-010).
 *
 * Reads and writes the `ai_settings` table (the `'global'` row).
 * Validates the stored JSONB blob through `AiSettingsValueSchema` on every
 * read so the rest of ai-core always receives a typed, trusted value.
 *
 * The upsert pattern mirrors `platform_settings` exactly: conflict on the
 * primary-key `key` column → replace `value`, `updatedAt`, and `updatedBy`.
 *
 * @module ai-core/storage/settings
 */

import { aiSettings, eq, getDb } from '@repo/db';
import type { DrizzleClient } from '@repo/db';
import type { SelectAiSettings } from '@repo/db';
import { AiSettingsKeySchema, type AiSettingsValue, AiSettingsValueSchema } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when the JSONB blob stored in `ai_settings` does not conform to
 * `AiSettingsValueSchema`.  This indicates a storage corruption or a schema
 * migration mismatch and must never be swallowed silently.
 */
export class AiSettingsParseError extends Error {
    /**
     * Zod issue summary for the first few validation errors.
     */
    readonly issues: string;

    constructor(issues: string) {
        super(`ai_settings 'global' blob failed schema validation: ${issues}`);
        this.name = 'AiSettingsParseError';
        this.issues = issues;
    }
}

// ---------------------------------------------------------------------------
// Input / output shapes (RO-RO)
// ---------------------------------------------------------------------------

/**
 * Input for {@link writeAiSettings}.
 */
export interface WriteAiSettingsInput {
    /** The full AI settings blob to persist (validated before write). */
    readonly value: AiSettingsValue;
    /** UUID of the SUPER_ADMIN performing the write (stored in `updatedBy`). */
    readonly actorId: string;
    /** Optional transaction client for callers that already hold a transaction. */
    readonly tx?: DrizzleClient;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Reads the `'global'` AI settings row from `ai_settings`.
 *
 * Parses the stored JSONB blob through `AiSettingsValueSchema` before
 * returning it, so callers always receive a fully-typed `AiSettingsValue`.
 *
 * @param tx - Optional transaction client (falls back to `getDb()`).
 * @returns The validated settings blob, or `null` if no row exists yet.
 * @throws {AiSettingsParseError} If the stored blob fails schema validation.
 *
 * @example
 * ```ts
 * const settings = await readAiSettings();
 * if (settings) {
 *   console.log(settings.features.text_improve.enabled);
 * }
 * ```
 */
export async function readAiSettings(tx?: DrizzleClient): Promise<AiSettingsValue | null> {
    const db = tx ?? getDb();
    const KEY = AiSettingsKeySchema.value;

    const rows = await db.select().from(aiSettings).where(eq(aiSettings.key, KEY)).limit(1);

    const row: SelectAiSettings | undefined = rows[0];
    if (!row) {
        return null;
    }

    const parsed = AiSettingsValueSchema.safeParse(row.value);
    if (!parsed.success) {
        const issues = parsed.error.issues
            .slice(0, 5)
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
        throw new AiSettingsParseError(issues);
    }

    return parsed.data;
}

// ---------------------------------------------------------------------------
// Write (upsert)
// ---------------------------------------------------------------------------

/**
 * Validates `value` against `AiSettingsValueSchema` then upserts the
 * `'global'` row in `ai_settings`.
 *
 * On conflict on the primary key, the row's `value`, `updatedAt`, and
 * `updatedBy` columns are replaced atomically.  The resulting row is
 * returned.
 *
 * @param input - {@link WriteAiSettingsInput}
 * @returns The saved `ai_settings` row.
 * @throws {Error} If `value` fails schema validation (includes Zod issue text).
 *
 * @example
 * ```ts
 * const row = await writeAiSettings({ value: blob, actorId: adminId });
 * console.log(row.updatedAt);
 * ```
 */
export async function writeAiSettings(input: WriteAiSettingsInput): Promise<SelectAiSettings> {
    const { value, actorId, tx } = input;
    const db = tx ?? getDb();
    const KEY = AiSettingsKeySchema.value;

    // Validate before touching the DB.
    const parsed = AiSettingsValueSchema.safeParse(value);
    if (!parsed.success) {
        const issues = parsed.error.issues
            .slice(0, 5)
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
        throw new Error(`Invalid AI settings value: ${issues}`);
    }

    const now = new Date();
    const rows = await db
        .insert(aiSettings)
        .values({
            key: KEY,
            value: parsed.data as Record<string, unknown>,
            updatedBy: actorId,
            updatedAt: now,
            createdAt: now
        })
        .onConflictDoUpdate({
            target: aiSettings.key,
            set: {
                value: parsed.data as Record<string, unknown>,
                updatedBy: actorId,
                updatedAt: now
            }
        })
        .returning();

    const row: SelectAiSettings | undefined = rows[0];
    if (!row) {
        throw new Error(
            `writeAiSettings returned no row for key='${KEY}' — unexpected database state`
        );
    }

    return row;
}
