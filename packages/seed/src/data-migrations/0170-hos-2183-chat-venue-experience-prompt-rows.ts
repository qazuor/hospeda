/**
 * @fileoverview
 * Data migration: 0170-hos-2183-chat-venue-experience-prompt-rows
 *
 * HOS-2183: production has no `ai_prompt_versions` rows for the `chat_venue`
 * and `chat_experience` features (it only holds `chat`), while staging has
 * both. Every prior chat-prompt data-migration (`0134`, `0159`..`0165`, `0169`)
 * is an UPDATE keyed on the previous exact text, so on production the two
 * missing features simply matched zero rows and were ledgered as applied.
 *
 * ## Why production lacks them
 *
 * `aiPrompts.seed.ts` inserts one active v1 row per `AiFeatureSchema` option,
 * but it only runs under `--required`. Production was seeded before those two
 * features existed and has never re-run `--required` since (the day-1 recipe
 * is a one-off). Staging was fully re-seeded on 2026-10-29, which is how it
 * got all nine rows. Nothing was ever a data-migration, so nothing reached
 * production.
 *
 * ## What this does
 *
 * For each of `chat_venue` and `chat_experience`: INSERT one active v1 row
 * ONLY when the table holds no row at all for that feature (any version, any
 * state, including soft-deleted). It never updates, never reactivates and
 * never touches an existing row, so an operator-edited or deliberately deleted
 * prompt is left exactly as it is. Re-running inserts nothing.
 *
 * ## Content is the post-HOS-2113 end state
 *
 * The colocated `.data.json` holds the `content` and `rules` that
 * `DEFAULT_PROMPTS` / `DEFAULT_RULES` evaluate to on this branch (produced by
 * executing the code, never transcribed), and they are byte-identical to the
 * staging rows (rules md5 `d08776600cc009698869a31982d60b4b` for
 * `chat_venue`, `5f41dcc1ee6ba7d6fda5e9c602b61e4b` for `chat_experience`).
 * That already includes the HOS-2113 rule change, so `0169` does not need to be
 * re-applied. Ordering: this runs after `0169` (numeric order) and `0169` had
 * nothing to update for these features on production, so the final state equals
 * staging. The data is frozen here, never imported from `@repo/ai-core`, for
 * the reason `0169` documents (the package resolves to its build output).
 *
 * `created_by` is the migration actor, a SUPER_ADMIN resolved by the runner.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiPromptVersions, eq } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0170-hos-2183-chat-venue-experience-prompt-rows',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Colocated frozen snapshot of the two prompts' `content` and `rules`. */
const DATA_PATH = path.resolve(
    __dirname,
    '0170-hos-2183-chat-venue-experience-prompt-rows.data.json'
);

/** The features whose missing v1 row this migration creates, in insert order. */
export const MISSING_FEATURES = ['chat_venue', 'chat_experience'] as const;

/** One of {@link MISSING_FEATURES}. */
type MissingFeature = (typeof MISSING_FEATURES)[number];

/** Shape of the colocated frozen payload. */
interface FrozenPrompts {
    readonly prompts: Readonly<Record<MissingFeature, { content: string; rules: string }>>;
}

/**
 * Inserts the active v1 prompt row for each feature that has no row at all.
 *
 * @param ctx - Seed migration context (`ctx.db` and `ctx.actor` are used).
 * @returns Summary and per-feature counts (`1` inserted, `0` already present).
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const { prompts } = JSON.parse(await readFile(DATA_PATH, 'utf-8')) as FrozenPrompts;

    const counts: Record<string, number> = {};
    let total = 0;

    for (const feature of MISSING_FEATURES) {
        counts[feature] = 0;

        const existing = await ctx.db
            .select({ id: aiPromptVersions.id })
            .from(aiPromptVersions)
            .where(eq(aiPromptVersions.feature, feature))
            .limit(1);
        if (existing.length > 0) continue;

        const { content, rules } = prompts[feature];
        await ctx.db.insert(aiPromptVersions).values({
            feature,
            version: 1,
            content,
            rules,
            isActive: true,
            createdBy: ctx.actor.id
        });
        counts[feature] = 1;
        total += 1;
    }

    return {
        summary:
            total === 0
                ? 'chat_venue and chat_experience prompt rows already exist, no change.'
                : `Inserted ${total} missing chat prompt row(s) (HOS-2183).`,
        counts
    };
}
