/**
 * @fileoverview
 * Data migration: 0161-hos-2100-chat-group-pet-rules
 *
 * HOS-2100 edits to the shared answer-quality rules of the three listing-chat
 * features (`chat`, `chat_venue`, `chat_experience`), carried into
 * `ai_prompt_versions` rows that already exist in a seeded environment.
 *
 * ## Why a migration is required at all
 *
 * `aiPrompts.seed.ts` inserts with `ON CONFLICT ... DO NOTHING`, so editing
 * `DEFAULT_RULES` in `@repo/ai-core` reaches FRESH databases only; staging and
 * production keep the row they already hold (HOS-25 dual-write rule, same
 * shape as `0160-hos-2095-chat-answer-quality-rules-2`).
 *
 * ## What changed
 *
 * Only the `rules` column, and only two clauses of the block the three
 * features share:
 *
 * - the capacity clause becomes the owner's group rule (09-10/11/2026): compare
 *   the group with the total capacity first; a group over the total gets only
 *   "it does not fit" and the capacity, nothing else; a group within it gets the total
 *   and, when the listing states it, the split by units, rooms or beds, closed
 *   with "depends on how they are distributed and on availability, confirm it
 *   with the place" in the reply language; never "entran sin problema"; reuse
 *   a group size the visitor already gave;
 * - "pets accepted" is never stretched to a number or size of pets.
 *
 * The `chat_venue` age clauses and the legal notice are untouched. `content`
 * did not change.
 *
 * ## How the update is scoped
 *
 * One UPDATE per feature, each rewriting `rules` only when it still holds the
 * EXACT string `0160` wrote. A row an operator reworded — or one 0160 never
 * reached — is left alone; a second run matches nothing and reports zero.
 *
 * ## Both sides are frozen — nothing is imported from `@repo/ai-core`
 *
 * The colocated `.data.json` was produced by EXECUTING code, never transcribed
 * by hand: `before` is `DEFAULT_RULES` evaluated from `origin/staging`'s
 * `default-prompts.ts` (byte-identical to 0160's frozen `after`), and `after`
 * is `DEFAULT_RULES` evaluated from this branch's source. Importing it live is
 * the trap `0100` documents: the package resolves to its build output, so a
 * stale build would hand this migration the old strings.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiPromptVersions, and, eq } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0161-hos-2100-chat-group-pet-rules',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Colocated snapshot of the three chat features' rules on both sides of HOS-2100. */
const DATA_PATH = path.resolve(__dirname, '0161-hos-2100-chat-group-pet-rules.data.json');

/** The chat features this migration touches, in update order. */
export const CHAT_FEATURES = ['chat', 'chat_venue', 'chat_experience'] as const;

/** One of {@link CHAT_FEATURES}. */
type ChatFeature = (typeof CHAT_FEATURES)[number];

/** One side of the frozen snapshot: each chat feature's `rules`. */
interface RulesSnapshot {
    readonly rules: Readonly<Record<ChatFeature, string>>;
}

/** Shape of the colocated frozen payload. */
interface FrozenBaseline {
    readonly before: RulesSnapshot;
    readonly after: RulesSnapshot;
}

/**
 * Rewrites each chat feature's `rules` from the exact string 0160 wrote to the
 * HOS-2100 one, only on rows that still hold that exact string.
 *
 * @param ctx - Seed migration context (only `ctx.db` is used).
 * @returns Summary and per-feature counts of updated rows.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const raw = await readFile(DATA_PATH, 'utf-8');
    const { before, after } = JSON.parse(raw) as FrozenBaseline;

    const counts: Record<string, number> = {};
    let total = 0;

    for (const feature of CHAT_FEATURES) {
        const oldRules = before.rules[feature];
        const newRules = after.rules[feature];
        counts[feature] = 0;
        if (oldRules === newRules) continue;

        const rows = await ctx.db
            .update(aiPromptVersions)
            .set({ rules: newRules })
            .where(and(eq(aiPromptVersions.feature, feature), eq(aiPromptVersions.rules, oldRules)))
            .returning({ id: aiPromptVersions.id });
        counts[feature] = rows.length;
        total += rows.length;
    }

    return {
        summary:
            total === 0
                ? 'The chat rules already carry the HOS-2100 clauses, or were operator-edited — no change.'
                : `Applied the HOS-2100 group and pet rules to ${total} chat rules column(s).`,
        counts
    };
}
