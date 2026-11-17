/**
 * @fileoverview
 * Data migration: 0179-hos-2294-search-prompt-strict
 *
 * Carries the HOS-2294 `search` prompt into the `ai_prompt_versions` rows that
 * are already seeded on staging and production.
 *
 * ## What changed
 *
 * HOS-2294 moved the `search` intent extraction to OpenAI strict structured
 * outputs: the model now answers with every field present and `null` for a slot
 * the query does not state. The prompt used to say "optional sub-fields only"
 * and "omit the rest entirely", which contradicts that contract, and its field
 * list lacked `expandToNearby`, `attractionSlugs` and `poiSlugs`. Both columns
 * changed:
 *
 * - `content`: the field list names exactly the keys of the model-facing schema
 *   (`SearchIntentModelOutputSchema` in apps/api) and says `null` where it used
 *   to say "omit".
 * - `rules`: "Omit the rest entirely" became "Set every other field to null".
 *
 * ## Why a migration is needed
 *
 * The baseline is `DEFAULT_PROMPTS.search` / `DEFAULT_RULES.search` in
 * `@repo/ai-core`, which `aiPrompts.seed.ts` copies into a row only when none
 * exists. Editing it reaches fresh databases only; an active row wins over the
 * in-code default at runtime (HOS-25 dual-write).
 *
 * ## Production was already behind the code default
 *
 * Measured read-only on production (2026-11-17): the active row (v3, 4908
 * chars) is NOT the `DEFAULT_PROMPTS.search` of staging HEAD (5367 chars). The
 * prompt edits made after it was seeded (HOS-551 `isNewSearch`, nearby
 * expansion) never got a migration, so production has been running without
 * them. This migration therefore accepts TWO exact old texts as "unedited":
 * the staging-HEAD default, and that production v3 text. Both are frozen in the
 * colocated `.data.json`. Applying it brings production up to the current
 * default, with the HOS-2294 changes.
 *
 * ## How it is scoped
 *
 * A column is rewritten only when it still equals one of the known old values
 * EXACTLY. A row an operator reworded is left alone and reported (count +
 * warning). Idempotent: a second run matches nothing and writes nothing.
 *
 * ## Both sides are frozen
 *
 * The `.data.json` was produced by EXECUTING the default-prompts module (old
 * text from git HEAD, new text from this branch) and by reading the production
 * row, never transcribed. Nothing is imported from `@repo/ai-core`, whose
 * exports resolve to its build output: a stale build would hand this migration
 * the old string and it would report a silent no-op.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiPromptVersions, and, eq, inArray, notInArray } from '@repo/db';
import { logger } from '../utils/logger.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0179-hos-2294-search-prompt-strict',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Colocated frozen snapshot of the prompt on both sides of HOS-2294. */
const DATA_PATH = path.resolve(__dirname, '0179-hos-2294-search-prompt-strict.data.json');

/** The only feature this migration touches. */
export const FEATURE = 'search' as const;

/** Shape of the colocated frozen payload. */
interface FrozenBaseline {
    readonly before: { readonly contents: readonly string[]; readonly rules: string };
    readonly after: { readonly content: string; readonly rules: string };
}

/**
 * Rewrites `search` prompt rows that still hold a known old default, and
 * reports the ones an operator edited.
 *
 * @param ctx - Seed migration context (only `ctx.db` is used).
 * @returns Summary plus `contentUpdated`, `rulesUpdated` and `operatorEdited` counts.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const raw = await readFile(DATA_PATH, 'utf-8');
    const { before, after } = JSON.parse(raw) as FrozenBaseline;

    const contentRows = await ctx.db
        .update(aiPromptVersions)
        .set({ content: after.content })
        .where(
            and(
                eq(aiPromptVersions.feature, FEATURE),
                inArray(aiPromptVersions.content, [...before.contents])
            )
        )
        .returning({ id: aiPromptVersions.id });

    const rulesRows = await ctx.db
        .update(aiPromptVersions)
        .set({ rules: after.rules })
        .where(and(eq(aiPromptVersions.feature, FEATURE), eq(aiPromptVersions.rules, before.rules)))
        .returning({ id: aiPromptVersions.id });

    // ACTIVE rows whose content is neither an old default nor the new one were
    // reworded by an operator: never overwritten, only reported. Inactive
    // history rows (v1, v2) are not what the engine serves, so not reported.
    const editedRows = await ctx.db
        .select({ id: aiPromptVersions.id, version: aiPromptVersions.version })
        .from(aiPromptVersions)
        .where(
            and(
                eq(aiPromptVersions.feature, FEATURE),
                eq(aiPromptVersions.isActive, true),
                notInArray(aiPromptVersions.content, [...before.contents, after.content])
            )
        );

    if (editedRows.length > 0) {
        const versions = editedRows.map((r) => r.version).join(', ');
        logger.warn(
            `HOS-2294: kept ${editedRows.length} operator-edited search prompt row(s) (version ${versions}); they may still tell the model to omit fields instead of answering null.`
        );
    }

    const contentUpdated = contentRows.length;
    const rulesUpdated = rulesRows.length;
    const operatorEdited = editedRows.length;
    return {
        summary:
            contentUpdated + rulesUpdated === 0
                ? 'The search prompt already carries the HOS-2294 text, or was operator-edited — no change.'
                : `Applied the HOS-2294 search prompt to ${contentUpdated} content and ${rulesUpdated} rules column(s).`,
        counts: { contentUpdated, rulesUpdated, operatorEdited }
    };
}
