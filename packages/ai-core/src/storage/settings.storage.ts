/**
 * AI settings storage helpers (SPEC-173 T-010).
 *
 * Reads and writes the `ai_settings` table (the `'global'` row).
 *
 * The two directions validate against DIFFERENT schemas, on purpose (HOS-1220):
 * writes go through `AiSettingsValueSchema`, whose `features` map is a FULL
 * record over `AiFeatureSchema`, so a save always configures every feature;
 * reads go through `AiSettingsValueResponseSchema`, whose `features` is
 * PARTIAL, so a feature nobody has configured yet does not invalidate the whole
 * document and take the others down with it. See {@link readAiSettings} for why
 * that is safe.
 *
 * The upsert pattern mirrors `platform_settings` exactly: conflict on the
 * primary-key `key` column → replace `value`, `updatedAt`, and `updatedBy`.
 *
 * @module ai-core/storage/settings
 */

import type { DrizzleClient, SelectAiSettings } from '@repo/db';
import { aiSettings, eq, getDb } from '@repo/db';
import {
    AiSettingsKeySchema,
    type AiSettingsValue,
    type AiSettingsValueResponse,
    AiSettingsValueResponseSchema,
    AiSettingsValueSchema
} from '@repo/schemas';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when the JSONB blob stored in `ai_settings` is malformed.
 *
 * Reads validate against `AiSettingsValueResponseSchema`, so a MISSING feature
 * key no longer produces this error (HOS-1220) — that case is a configuration
 * gap, reported by `findUnconfiguredFeatures`, not a corrupt document. What
 * still throws here is real corruption: a bad providers map, an unknown
 * top-level key, or a feature entry that is present but invalid. Writes
 * validate against the stricter `AiSettingsValueSchema`.
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
 * Parses the stored JSONB blob through {@link AiSettingsValueResponseSchema} —
 * the READ-side schema, whose `features` map is a PARTIAL record — so a blob
 * missing a feature key is returned rather than rejected.
 *
 * ## Why the read is partial and the write is not (HOS-1220)
 *
 * This used to parse through `AiSettingsValueSchema`, the WRITE-side schema,
 * whose `features` is a FULL record over `AiFeatureSchema`. That made every
 * widening of the enum a silent data migration: HOS-400 added
 * `chat_gastronomy` and `chat_experience`, the live rows in staging and
 * production carried neither, and this parse threw for every AI call — a
 * feature nobody had configured yet took down the seven that were, including
 * the visitor-facing chat.
 *
 * Failing closed on the whole document bought nothing, because the per-feature
 * fail-closed already exists one layer up: `resolveFeatureConfig` throws
 * `AiFeatureNotConfiguredError` for a feature with no entry. An unconfigured
 * feature therefore still refuses to run — the only thing that changes is that
 * it no longer takes its siblings down with it.
 *
 * A blob that is malformed for any OTHER reason still throws: the response
 * schema relaxes `features` and nothing else, so unknown top-level keys, a bad
 * providers map or an invalid feature config are all still rejected.
 *
 * **Silence is the other half of the bug**, and it is not fixed here: this
 * package deliberately performs no observability side effects (it has no
 * logger, see the isolation rules in CLAUDE.md). Callers detect an incomplete
 * config with {@link findUnconfiguredFeatures} and alert from where they have
 * a logger — `apps/api`'s `createConfiguredAiService` does exactly that.
 *
 * @param tx - Optional transaction client (falls back to `getDb()`).
 * @returns The validated settings blob, or `null` if no row exists yet.
 * @throws {AiSettingsParseError} If the stored blob is malformed beyond missing
 *   feature keys.
 *
 * @example
 * ```ts
 * const settings = await readAiSettings();
 * if (settings) {
 *   // `features` is partial — every access is optional.
 *   console.log(settings.features.text_improve?.enabled);
 * }
 * ```
 */
export async function readAiSettings(tx?: DrizzleClient): Promise<AiSettingsValueResponse | null> {
    const db = tx ?? getDb();
    const KEY = AiSettingsKeySchema.value;

    const rows = await db.select().from(aiSettings).where(eq(aiSettings.key, KEY)).limit(1);

    const row: SelectAiSettings | undefined = rows[0];
    if (!row) {
        return null;
    }

    const parsed = AiSettingsValueResponseSchema.safeParse(row.value);
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
