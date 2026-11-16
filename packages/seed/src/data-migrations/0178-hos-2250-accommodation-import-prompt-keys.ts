/**
 * @fileoverview
 * Data migration: 0178-hos-2250-accommodation-import-prompt-keys
 *
 * Carries the HOS-2250 `accommodation_import` system prompt into the
 * `ai_prompt_versions` rows already seeded on staging and production.
 *
 * ## What was wrong
 *
 * The default prompt listed `address`, `city`, `email`, `pricePerNight`,
 * `maxGuests` and `amenities`, keys the import's output schema never had. The
 * model followed the prompt over the schema, and the import lost capacity,
 * price, amenities and address. HOS-2250 moved the feature to OpenAI strict
 * structured outputs (every field required and nullable) and rewrote the prompt
 * to name exactly the schema keys and to answer `null` for a missing field.
 *
 * ## Why a migration is needed
 *
 * The baseline is `DEFAULT_PROMPTS.accommodation_import` in `@repo/ai-core`,
 * which `aiPrompts.seed.ts` copies into a row only when none exists. Editing it
 * reaches fresh databases only: the rows already seeded keep the old text, and
 * an active row wins over the in-code default at runtime (HOS-25 dual-write).
 *
 * ## How it is scoped
 *
 * Only `content` changes (`rules` is identical on both sides). A row is
 * rewritten only when its `content` still equals the old default EXACTLY. A row
 * an operator reworded is left alone and reported (count + warning), so the
 * operator can apply the key fix by hand. Idempotent by construction: a second
 * run matches nothing and writes nothing.
 *
 * ## Both sides are frozen
 *
 * The colocated `.data.json` was produced by EXECUTING the module (the old text
 * from git HEAD, the new one from this branch), never transcribed. `before`
 * equals 0070's frozen `after`, the last migration that wrote this prompt.
 * Nothing is imported from `@repo/ai-core`, whose exports resolve to its build
 * output: a stale build would hand this migration the old string and it would
 * report a silent no-op.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiPromptVersions, and, eq, ne } from '@repo/db';
import { logger } from '../utils/logger.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0178-hos-2250-accommodation-import-prompt-keys',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Colocated frozen snapshot of the prompt on both sides of HOS-2250. */
const DATA_PATH = path.resolve(
    __dirname,
    '0178-hos-2250-accommodation-import-prompt-keys.data.json'
);

/** The only feature this migration touches. */
export const FEATURE = 'accommodation_import' as const;

/** Shape of the colocated frozen payload. */
interface FrozenBaseline {
    readonly before: { readonly content: string };
    readonly after: { readonly content: string };
}

/**
 * Rewrites `accommodation_import` prompt rows that still hold the exact old
 * default, and reports the ones an operator edited.
 *
 * @param ctx - Seed migration context (only `ctx.db` is used).
 * @returns Summary plus `updated` and `operatorEdited` counts.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const raw = await readFile(DATA_PATH, 'utf-8');
    const { before, after } = JSON.parse(raw) as FrozenBaseline;

    const updatedRows = await ctx.db
        .update(aiPromptVersions)
        .set({ content: after.content })
        .where(
            and(eq(aiPromptVersions.feature, FEATURE), eq(aiPromptVersions.content, before.content))
        )
        .returning({ id: aiPromptVersions.id });

    // Rows holding neither the old nor the new default were reworded by an
    // operator: never overwritten, only reported.
    const editedRows = await ctx.db
        .select({ id: aiPromptVersions.id, version: aiPromptVersions.version })
        .from(aiPromptVersions)
        .where(
            and(
                eq(aiPromptVersions.feature, FEATURE),
                ne(aiPromptVersions.content, before.content),
                ne(aiPromptVersions.content, after.content)
            )
        );

    if (editedRows.length > 0) {
        const versions = editedRows.map((r) => r.version).join(', ');
        logger.warn(
            `HOS-2250: kept ${editedRows.length} operator-edited accommodation_import prompt row(s) (version ${versions}); they may still name the old keys (maxGuests, amenities, pricePerNight, address).`
        );
    }

    const updated = updatedRows.length;
    const operatorEdited = editedRows.length;
    return {
        summary:
            updated === 0
                ? 'The accommodation_import prompt already names the HOS-2250 keys, or was operator-edited — no change.'
                : `Applied the HOS-2250 accommodation_import prompt to ${updated} row(s).`,
        counts: { updated, operatorEdited }
    };
}
